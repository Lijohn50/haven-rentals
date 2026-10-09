package com.example.rentals.dispute;

import com.example.rentals.common.AuditService;
import com.example.rentals.booking.Booking;
import com.example.rentals.booking.BookingRepository;
import com.example.rentals.booking.BookingStatus;
import com.example.rentals.booking.BookingStatusHistory;
import com.example.rentals.booking.BookingStatusHistoryRepository;
import com.example.rentals.booking.dto.BookingHistoryResponse;
import com.example.rentals.booking.dto.BookingResponse;
import com.example.rentals.common.BusinessRuleException;
import com.example.rentals.common.ConflictException;
import com.example.rentals.common.ErrorCode;
import com.example.rentals.common.MoneyUtils;
import com.example.rentals.common.PageResponse;
import com.example.rentals.common.ResourceNotFoundException;
import com.example.rentals.dispute.dto.*;
import com.example.rentals.messaging.Conversation;
import com.example.rentals.messaging.ConversationRepository;
import com.example.rentals.messaging.MessageDocument;
import com.example.rentals.messaging.MessageRepository;
import com.example.rentals.messaging.dto.MessageResponse;
import com.example.rentals.notification.NotificationService;
import com.example.rentals.notification.NotificationType;
import com.example.rentals.payment.*;
import com.example.rentals.payment.dto.PaymentResponse;
import com.example.rentals.user.Role;
import com.example.rentals.user.User;
import com.example.rentals.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class DisputeService {

    private final DisputeRepository disputeRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final PaymentRepository paymentRepository;
    private final RefundService refundService;
    private final PayoutRepository payoutRepository;
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final BookingStatusHistoryRepository bookingStatusHistoryRepository;
    private final AuditService auditService;
    private final NotificationService notificationService;
    private final Clock clock;

    @Transactional
    public DisputeResponse openDispute(Long userId, Long bookingId, CreateDisputeRequest req) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

        if (!booking.getGuest().getId().equals(userId) && !booking.getListing().getHost().getId().equals(userId)) {
            throw new ResourceNotFoundException("Booking not found");
        }

        Instant now = clock.instant();

        // Dispute window checks:
        // CONFIRMED with check-in time passed, OR COMPLETED within 14 days, OR CANCELLED within 14 days
        boolean eligible = false;
        if (booking.getStatus() == BookingStatus.CONFIRMED && !now.isBefore(booking.getCheckInDateTime())) {
            eligible = true;
        } else if (booking.getStatus() == BookingStatus.COMPLETED) {
            Instant maxDate = booking.getCheckOutDateTime().plus(14, ChronoUnit.DAYS);
            if (!now.isAfter(maxDate)) {
                eligible = true;
            }
        } else if (booking.isCancelled() && booking.getCancelledAt() != null) {
            Instant maxDate = booking.getCancelledAt().plus(14, ChronoUnit.DAYS);
            if (!now.isAfter(maxDate)) {
                eligible = true;
            }
        }

        if (!eligible) {
            throw new BusinessRuleException("Booking is not eligible for dispute opening at this time");
        }

        // Only one active dispute per booking
        if (disputeRepository.existsByBookingIdAndStatusIn(bookingId, List.of(DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW))) {
            throw new ConflictException(ErrorCode.DUPLICATE_RESOURCE, "An active dispute already exists for this booking");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Dispute dispute = new Dispute(booking, user, req.category(), req.description().trim(), now);
        dispute = disputeRepository.save(dispute);

        // Put payout on hold if scheduled
        payoutRepository.findByBookingId(bookingId).ifPresent(payout -> {
            if (payout.getStatus() == PayoutStatus.SCHEDULED) {
                payout.setStatus(PayoutStatus.HELD);
                payoutRepository.save(payout);
            }
        });

        // Audit log
        auditService.log(userId, "DISPUTE_OPENED", "Dispute", dispute.getId(),
                Map.of("bookingId", bookingId, "category", req.category().name()));

        // Notify counterpart
        User counterpart = booking.getGuest().getId().equals(userId) ? booking.getListing().getHost() : booking.getGuest();
        notificationService.createNotification(
                counterpart,
                NotificationType.DISPUTE_OPENED,
                "Dispute Opened",
                "A dispute was opened for booking reference " + booking.getReference(),
                "/disputes"
        );

        return DisputeResponse.from(dispute);
    }

    @Transactional(readOnly = true)
    public PageResponse<DisputeResponse> getMyDisputes(Long userId, int page, int size) {
        int validatedSize = Math.min(Math.max(1, size), 50);
        int validatedPage = Math.max(0, page);
        Pageable pageable = PageRequest.of(validatedPage, validatedSize);

        Page<Dispute> p = disputeRepository.findUserDisputes(userId, pageable);
        return PageResponse.from(p.map(DisputeResponse::from));
    }

    @Transactional(readOnly = true)
    public PageResponse<DisputeResponse> getSupportDisputes(DisputeStatus status, int page, int size) {
        int validatedSize = Math.min(Math.max(1, size), 50);
        int validatedPage = Math.max(0, page);
        Pageable pageable = PageRequest.of(validatedPage, validatedSize);

        Page<Dispute> p;
        if (status != null) {
            p = disputeRepository.findByStatusOrderByCreatedAtAsc(status, pageable);
        } else {
            p = disputeRepository.findAllByOrderByCreatedAtAsc(pageable);
        }
        return PageResponse.from(p.map(DisputeResponse::from));
    }

    @Transactional
    public SupportDisputeDetailResponse getSupportDisputeDetail(Long staffUserId, Long disputeId) {
        Dispute dispute = disputeRepository.findById(disputeId)
                .orElseThrow(() -> new ResourceNotFoundException("Dispute not found"));

        Booking booking = dispute.getBooking();
        Payment payment = paymentRepository.findByBookingId(booking.getId()).orElse(null);

        List<BookingStatusHistory> history = bookingStatusHistoryRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId());
        List<BookingHistoryResponse> historyResponses = history.stream()
                .map(BookingHistoryResponse::from)
                .toList();

        // Chat messages
        List<MessageResponse> messageResponses = List.of();
        Conversation conv = conversationRepository.findByListingIdAndGuestId(
                booking.getListing().getId(), booking.getGuest().getId()).orElse(null);
        if (conv != null) {
            List<MessageDocument> docs = messageRepository.findByConversationIdOrderBySentAtDesc(
                    conv.getId(), PageRequest.of(0, 100));
            messageResponses = docs.stream().map(MessageResponse::from).toList();
        }

        // Audited access
        auditService.log(staffUserId, "DISPUTE_CONVERSATION_VIEWED", "Dispute", dispute.getId(),
                Map.of("bookingId", booking.getId()));

        return new SupportDisputeDetailResponse(
                DisputeResponse.from(dispute),
                BookingResponse.from(booking, staffUserId),
                payment != null ? PaymentResponse.from(payment, List.of()) : null,
                historyResponses,
                messageResponses
        );
    }

    @Transactional
    public DisputeResponse assignDispute(Long staffUserId, Long disputeId) {
        Dispute dispute = disputeRepository.findById(disputeId)
                .orElseThrow(() -> new ResourceNotFoundException("Dispute not found"));

        User staff = userRepository.findById(staffUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (dispute.getBooking().getGuest().getId().equals(staffUserId) ||
                dispute.getBooking().getListing().getHost().getId().equals(staffUserId)) {
            throw new BusinessRuleException("Support agent cannot handle a dispute for their own booking");
        }

        if (dispute.getStatus() != DisputeStatus.OPEN && dispute.getStatus() != DisputeStatus.UNDER_REVIEW) {
            throw new BusinessRuleException("Only OPEN or UNDER_REVIEW disputes can be assigned");
        }

        dispute.setStatus(DisputeStatus.UNDER_REVIEW);
        dispute.setAssignedAgent(staff);
        dispute = disputeRepository.save(dispute);

        auditService.log(staffUserId, "DISPUTE_ASSIGNED", "Dispute", dispute.getId(),
                Map.of("assignedTo", staffUserId));

        return DisputeResponse.from(dispute);
    }

    @Transactional
    public DisputeResponse resolveDispute(Long staffUserId, Long disputeId, ResolveDisputeRequest req) {
        Dispute dispute = disputeRepository.findById(disputeId)
                .orElseThrow(() -> new ResourceNotFoundException("Dispute not found"));

        User staff = userRepository.findById(staffUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        boolean isStaffOrAdmin = staff.hasRole(Role.ADMIN) || staff.hasRole(Role.SUPPORT_AGENT);
        if (!isStaffOrAdmin) {
            throw new BusinessRuleException("Unauthorized");
        }

        if (dispute.getBooking().getGuest().getId().equals(staffUserId) ||
                dispute.getBooking().getListing().getHost().getId().equals(staffUserId)) {
            throw new BusinessRuleException("Staff cannot resolve a dispute they are party to");
        }

        if (dispute.getStatus() != DisputeStatus.UNDER_REVIEW) {
            throw new BusinessRuleException("Dispute must be UNDER_REVIEW before resolving");
        }

        if (!staff.hasRole(Role.ADMIN) && (dispute.getAssignedAgent() == null || !dispute.getAssignedAgent().getId().equals(staffUserId))) {
            throw new BusinessRuleException("Only the assigned agent or an admin can resolve this dispute");
        }

        Booking booking = dispute.getBooking();
        Payment payment = paymentRepository.findByBookingId(booking.getId()).orElse(null);

        BigDecimal remainingRefundable = BigDecimal.ZERO;
        if (payment != null) {
            remainingRefundable = payment.getAmount().subtract(payment.getRefundedTotal());
        }

        BigDecimal refundToIssue = BigDecimal.ZERO;
        switch (req.resolutionType()) {
            case FULL_REFUND -> {
                if (remainingRefundable.compareTo(BigDecimal.ZERO) <= 0) {
                    throw new BusinessRuleException("No refundable amount remaining on this booking");
                }
                refundToIssue = remainingRefundable;
            }
            case PARTIAL_REFUND -> {
                if (req.refundAmount() == null || req.refundAmount().compareTo(BigDecimal.ZERO) <= 0) {
                    throw new BusinessRuleException("Partial refund requires a positive refundAmount");
                }
                if (req.refundAmount().compareTo(remainingRefundable) > 0) {
                    throw new BusinessRuleException("Refund amount exceeds remaining refundable balance of ৳" + remainingRefundable);
                }
                refundToIssue = req.refundAmount();
            }
            case NO_REFUND -> {
                if (req.refundAmount() != null && req.refundAmount().compareTo(BigDecimal.ZERO) > 0) {
                    throw new BusinessRuleException("NO_REFUND resolution must not have a refund amount");
                }
                refundToIssue = BigDecimal.ZERO;
            }
        }

        // Issue refund if applicable
        if (refundToIssue.compareTo(BigDecimal.ZERO) > 0 && payment != null) {
            refundService.issueRefund(
                    payment.getId(),
                    refundToIssue,
                    RefundReason.DISPUTE_RESOLUTION,
                    "dispute-" + dispute.getId()
            );
        }

        // Payout adjustment
        final BigDecimal refundToApply = refundToIssue;
        final Long resolvedDisputeId = dispute.getId();
        payoutRepository.findByBookingId(booking.getId()).ifPresent(payout -> {
            if (payout.getStatus() == PayoutStatus.PAID) {
                // Platform absorbs refund
                auditService.log(staffUserId, "PLATFORM_ABSORBED_REFUND", "Payout", payout.getId(),
                        Map.of("bookingId", booking.getId(), "disputeId", resolvedDisputeId));
            } else {
                // Payout is not yet paid
                if (refundToApply.compareTo(BigDecimal.ZERO) > 0) {
                    BigDecimal a = booking.getTotalAmount().subtract(booking.getServiceFee());
                    if (a.compareTo(BigDecimal.ZERO) <= 0 || refundToApply.compareTo(a) >= 0) {
                        payout.setStatus(PayoutStatus.CANCELLED);
                    } else {
                        BigDecimal originalPayout = booking.getHostPayoutAmount();
                        BigDecimal factor = a.subtract(refundToApply).divide(a, 6, RoundingMode.HALF_UP);
                        BigDecimal newPayout = MoneyUtils.round(originalPayout.multiply(factor));
                        if (newPayout.compareTo(BigDecimal.ZERO) <= 0) {
                            payout.setStatus(PayoutStatus.CANCELLED);
                        } else {
                            payout.setAmount(newPayout);
                            payout.setStatus(PayoutStatus.SCHEDULED);
                        }
                    }
                } else {
                    // NO_REFUND restores original scheduled payout
                    payout.setStatus(PayoutStatus.SCHEDULED);
                }
                payoutRepository.save(payout);
            }
        });

        dispute.setStatus(DisputeStatus.RESOLVED);
        dispute.setResolutionType(req.resolutionType());
        dispute.setRefundAmount(refundToIssue);
        dispute.setResolutionNote(req.note().trim());
        dispute.setResolvedAt(clock.instant());
        dispute = disputeRepository.save(dispute);

        auditService.log(staffUserId, "DISPUTE_RESOLVED", "Dispute", dispute.getId(),
                Map.of("resolutionType", req.resolutionType().name(), "refundAmount", refundToIssue));

        // Notify both parties
        notificationService.createNotification(
                booking.getGuest(),
                NotificationType.DISPUTE_RESOLVED,
                "Dispute Resolved",
                "Your dispute for booking " + booking.getReference() + " has been resolved.",
                "/disputes"
        );
        notificationService.createNotification(
                booking.getListing().getHost(),
                NotificationType.DISPUTE_RESOLVED,
                "Dispute Resolved",
                "The dispute for booking " + booking.getReference() + " has been resolved.",
                "/disputes"
        );

        return DisputeResponse.from(dispute);
    }

    @Transactional
    public DisputeResponse rejectDispute(Long staffUserId, Long disputeId, RejectDisputeRequest req) {
        Dispute dispute = disputeRepository.findById(disputeId)
                .orElseThrow(() -> new ResourceNotFoundException("Dispute not found"));

        User staff = userRepository.findById(staffUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (dispute.getStatus() != DisputeStatus.UNDER_REVIEW) {
            throw new BusinessRuleException("Dispute must be UNDER_REVIEW before rejecting");
        }

        if (!staff.hasRole(Role.ADMIN) && (dispute.getAssignedAgent() == null || !dispute.getAssignedAgent().getId().equals(staffUserId))) {
            throw new BusinessRuleException("Only the assigned agent or an admin can reject this dispute");
        }

        Booking booking = dispute.getBooking();
        payoutRepository.findByBookingId(booking.getId()).ifPresent(payout -> {
            if (payout.getStatus() == PayoutStatus.HELD) {
                payout.setStatus(PayoutStatus.SCHEDULED);
                payoutRepository.save(payout);
            }
        });

        dispute.setStatus(DisputeStatus.REJECTED);
        dispute.setResolutionNote(req.note().trim());
        dispute.setResolvedAt(clock.instant());
        dispute = disputeRepository.save(dispute);

        auditService.log(staffUserId, "DISPUTE_REJECTED", "Dispute", dispute.getId(),
                Map.of("disputeId", dispute.getId()));

        notificationService.createNotification(
                dispute.getRaisedBy(),
                NotificationType.DISPUTE_RESOLVED,
                "Dispute Rejected",
                "Your dispute for booking " + booking.getReference() + " was rejected: " + req.note(),
                "/disputes"
        );

        return DisputeResponse.from(dispute);
    }
}
