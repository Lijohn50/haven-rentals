package com.example.rentals.scheduler;

import com.example.rentals.common.AuditService;
import com.example.rentals.booking.Booking;
import com.example.rentals.booking.BookingStatus;
import com.example.rentals.dispute.DisputeRepository;
import com.example.rentals.dispute.DisputeStatus;
import com.example.rentals.notification.NotificationService;
import com.example.rentals.notification.NotificationType;
import com.example.rentals.payment.Payout;
import com.example.rentals.payment.PayoutRepository;
import com.example.rentals.payment.PayoutStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class PayoutJob {

    private final PayoutRepository payoutRepository;
    private final DisputeRepository disputeRepository;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final Clock clock;
    private final PayoutJob self;

    /** Explicit so {@code @Lazy} reaches the parameter; see ExpirePendingPaymentJob. */
    public PayoutJob(PayoutRepository payoutRepository,
                     DisputeRepository disputeRepository,
                     NotificationService notificationService,
                     AuditService auditService,
                     Clock clock,
                     @Lazy PayoutJob self) {
        this.payoutRepository = payoutRepository;
        this.disputeRepository = disputeRepository;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.clock = clock;
        this.self = self;
    }

    @Scheduled(fixedRate = 900000)
    public void run() {
        Instant now = clock.instant();
        List<Payout> duePayouts = payoutRepository.findDueScheduledPayouts(now);
        if (duePayouts.isEmpty()) return;

        log.info("PayoutJob processing {} due payouts", duePayouts.size());
        for (Payout p : duePayouts) {
            try {
                self.processPayout(p.getId(), now);
            } catch (Exception e) {
                log.error("Failed to release payout id={}: {}", p.getId(), e.getMessage());
            }
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void processPayout(Long payoutId, Instant now) {
        Payout payout = payoutRepository.findByIdForUpdate(payoutId).orElse(null);
        if (payout == null || payout.getStatus() != PayoutStatus.SCHEDULED) {
            return;
        }

        Booking b = payout.getBooking();
        if (b.getStatus() != BookingStatus.CONFIRMED && b.getStatus() != BookingStatus.COMPLETED) {
            log.warn("Skipping payout id={} because booking status is {}", payoutId, b.getStatus());
            return;
        }

        // Check if there is an active dispute
        boolean hasActiveDispute = disputeRepository.existsByBookingIdAndStatusIn(
                b.getId(), List.of(DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW));

        if (hasActiveDispute) {
            log.info("Holding payout id={} due to active dispute on booking id={}", payoutId, b.getId());
            payout.setStatus(PayoutStatus.HELD);
            payoutRepository.save(payout);
            return;
        }

        payout.setStatus(PayoutStatus.PAID);
        payout.setPaidAt(now);
        payoutRepository.save(payout);

        auditService.log(null, "PAYOUT_PAID", "Payout", payout.getId(),
                Map.of("bookingId", b.getId(), "amount", payout.getAmount()));

        notificationService.createNotification(
                payout.getHost(),
                NotificationType.PAYOUT_PAID,
                "Payout Sent",
                "Your payout of ৳" + payout.getAmount() + " for booking " + b.getReference() + " has been processed.",
                "/host/payouts"
        );

        log.info("Successfully released payout id={} of ৳{} to host id={}", payoutId, payout.getAmount(), payout.getHost().getId());
    }
}
