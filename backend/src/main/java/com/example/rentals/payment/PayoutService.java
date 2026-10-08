package com.example.rentals.payment;

import com.example.rentals.booking.Booking;
import com.example.rentals.booking.BookingStatus;
import com.example.rentals.common.AuditService;
import com.example.rentals.common.MoneyUtils;
import com.example.rentals.common.ResourceNotFoundException;
import com.example.rentals.payment.dto.PayoutResponse;
import com.example.rentals.payment.dto.PayoutSummaryResponse;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class PayoutService {

    private final PayoutRepository payoutRepository;
    private final AuditService auditService;
    private final Clock clock;

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public Payout createPayout(Booking booking, Instant scheduledFor) {
        Payout payout = new Payout(booking.getHost(), booking, booking.getHostPayoutAmount(), scheduledFor);
        return payoutRepository.save(payout);
    }

    @Transactional
    public void adjustPayoutOnCancellation(Booking booking, BigDecimal refundAmount) {
        Optional<Payout> opt = payoutRepository.findByBookingIdForUpdate(booking.getId());
        if (opt.isEmpty()) return;

        Payout payout = opt.get();
        if (payout.getStatus() == PayoutStatus.PAID) {
            log.warn("Payout for booking {} was already PAID; platform absorbs cancellation adjustment", booking.getId());
            return;
        }

        if (refundAmount.compareTo(booking.getTotalAmount()) >= 0) {
            payout.setStatus(PayoutStatus.CANCELLED);
            payout.setAmount(MoneyUtils.ZERO);
        } else {
            BigDecimal a = booking.getTotalAmount().subtract(booking.getServiceFee());
            if (a.compareTo(BigDecimal.ZERO) <= 0) {
                payout.setStatus(PayoutStatus.CANCELLED);
                payout.setAmount(MoneyUtils.ZERO);
            } else {
                BigDecimal remainingA = a.subtract(refundAmount).max(BigDecimal.ZERO);
                BigDecimal ratio = remainingA.divide(a, 4, MoneyUtils.DEFAULT_ROUNDING);
                BigDecimal newPayout = MoneyUtils.round(booking.getHostPayoutAmount().multiply(ratio));

                payout.setAmount(newPayout);
                if (newPayout.compareTo(BigDecimal.ZERO) == 0) {
                    payout.setStatus(PayoutStatus.CANCELLED);
                }
            }
        }
        payoutRepository.save(payout);
    }

    @Transactional
    public void holdPayout(Booking booking) {
        payoutRepository.findByBookingIdForUpdate(booking.getId()).ifPresent(p -> {
            if (p.getStatus() == PayoutStatus.SCHEDULED) {
                p.setStatus(PayoutStatus.HELD);
                payoutRepository.save(p);
            }
        });
    }

    @Transactional
    public void releaseHold(Booking booking) {
        payoutRepository.findByBookingIdForUpdate(booking.getId()).ifPresent(p -> {
            if (p.getStatus() == PayoutStatus.HELD) {
                p.setStatus(PayoutStatus.SCHEDULED);
                payoutRepository.save(p);
            }
        });
    }

    @Transactional
    public void releaseDuePayouts() {
        Instant now = clock.instant();
        List<Payout> due = payoutRepository.findDueScheduledPayouts(now);

        for (Payout payout : due) {
            try {
                processSinglePayout(payout.getId(), now);
            } catch (Exception e) {
                log.error("Failed to release payout id={}", payout.getId(), e);
            }
        }
    }

    @Transactional
    public void processSinglePayout(Long payoutId, Instant now) {
        Payout payout = payoutRepository.findByIdForUpdate(payoutId).orElse(null);
        if (payout == null || payout.getStatus() != PayoutStatus.SCHEDULED) {
            return;
        }

        Booking booking = payout.getBooking();
        if (booking.getStatus() != BookingStatus.CONFIRMED && booking.getStatus() != BookingStatus.COMPLETED) {
            return;
        }

        // Check if open dispute exists
        Number activeDisputes = (Number) entityManager.createNativeQuery("""
            SELECT COUNT(*) FROM disputes d
            WHERE d.booking_id = :bookingId AND d.status IN ('OPEN', 'UNDER_REVIEW')
        """)
        .setParameter("bookingId", booking.getId())
        .getSingleResult();

        if (activeDisputes != null && activeDisputes.longValue() > 0) {
            payout.setStatus(PayoutStatus.HELD);
            payoutRepository.save(payout);
            return;
        }

        payout.setStatus(PayoutStatus.PAID);
        payout.setPaidAt(now);
        payoutRepository.save(payout);

        auditService.record(null, "PAYOUT_PAID", "Payout", payout.getId(),
                Map.of("hostId", payout.getHost().getId(), "bookingId", booking.getId(), "amount", payout.getAmount()));
    }

    @Transactional(readOnly = true)
    public Page<PayoutResponse> getHostPayouts(Long hostId, PayoutStatus status, Pageable pageable) {
        Page<Payout> page = (status != null) ?
                payoutRepository.findByHostIdAndStatusOrderByScheduledForDesc(hostId, status, pageable) :
                payoutRepository.findByHostIdOrderByScheduledForDesc(hostId, pageable);
        return page.map(PayoutResponse::from);
    }

    @Transactional(readOnly = true)
    public PayoutSummaryResponse getHostPayoutSummary(Long hostId) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
            SELECT status, COALESCE(SUM(amount), 0), COUNT(id)
            FROM payouts
            WHERE host_id = :hostId
            GROUP BY status
        """)
        .setParameter("hostId", hostId)
        .getResultList();

        BigDecimal pending = BigDecimal.ZERO;
        BigDecimal paid = BigDecimal.ZERO;
        BigDecimal held = BigDecimal.ZERO;
        int scheduledCount = 0;

        for (Object[] r : rows) {
            String status = (String) r[0];
            BigDecimal sum = (BigDecimal) r[1];
            long count = ((Number) r[2]).longValue();

            if ("SCHEDULED".equals(status)) {
                pending = pending.add(sum);
                scheduledCount += (int) count;
            } else if ("PAID".equals(status)) {
                paid = paid.add(sum);
            } else if ("HELD".equals(status)) {
                held = held.add(sum);
            }
        }

        return new PayoutSummaryResponse(pending, paid, held, scheduledCount);
    }
}
