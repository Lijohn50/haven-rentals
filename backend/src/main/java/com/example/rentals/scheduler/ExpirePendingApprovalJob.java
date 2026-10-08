package com.example.rentals.scheduler;

import com.example.rentals.booking.Booking;
import com.example.rentals.booking.BookingRepository;
import com.example.rentals.booking.BookingStatus;
import com.example.rentals.booking.BookingStatusHistory;
import com.example.rentals.booking.BookingStatusHistoryRepository;
import com.example.rentals.notification.NotificationType;
import com.example.rentals.notification.event.BookingEvent;
import com.example.rentals.payment.Payment;
import com.example.rentals.payment.PaymentRepository;
import com.example.rentals.payment.PaymentStatus;
import com.example.rentals.payment.RefundReason;
import com.example.rentals.payment.RefundService;
import com.example.rentals.common.CacheConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

@Slf4j
@Component
public class ExpirePendingApprovalJob {

    private final BookingRepository bookingRepository;
    private final BookingStatusHistoryRepository bookingStatusHistoryRepository;
    private final PaymentRepository paymentRepository;
    private final RefundService refundService;
    private final ApplicationEventPublisher eventPublisher;
    private final CacheManager cacheManager;
    private final Clock clock;
    private final ExpirePendingApprovalJob self;

    /** Explicit so {@code @Lazy} reaches the parameter; see ExpirePendingPaymentJob. */
    public ExpirePendingApprovalJob(BookingRepository bookingRepository,
                                    BookingStatusHistoryRepository bookingStatusHistoryRepository,
                                    PaymentRepository paymentRepository,
                                    RefundService refundService,
                                    ApplicationEventPublisher eventPublisher,
                                    CacheManager cacheManager,
                                    Clock clock,
                                    @Lazy ExpirePendingApprovalJob self) {
        this.bookingRepository = bookingRepository;
        this.bookingStatusHistoryRepository = bookingStatusHistoryRepository;
        this.paymentRepository = paymentRepository;
        this.refundService = refundService;
        this.eventPublisher = eventPublisher;
        this.cacheManager = cacheManager;
        this.clock = clock;
        this.self = self;
    }

    @Scheduled(fixedRate = 300000)
    public void run() {
        Instant now = clock.instant();
        List<Booking> expiredApprovals = bookingRepository.findExpiredApprovalRequests(now);
        if (expiredApprovals.isEmpty()) return;

        log.info("ExpirePendingApprovalJob found {} pending approvals to expire", expiredApprovals.size());
        for (Booking b : expiredApprovals) {
            try {
                self.expireApproval(b.getId(), now);
            } catch (Exception e) {
                log.error("Failed to expire pending approval booking id={}: {}", b.getId(), e.getMessage());
            }
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void expireApproval(Long bookingId, Instant now) {
        Booking b = bookingRepository.findByIdForUpdate(bookingId).orElse(null);
        if (b == null) return;

        if (b.getStatus() == BookingStatus.PENDING_APPROVAL && !b.getExpiresAt().isAfter(now)) {
            b.transitionTo(BookingStatus.EXPIRED, null);
            bookingRepository.save(b);

            BookingStatusHistory history = new BookingStatusHistory(
                    b, BookingStatus.PENDING_APPROVAL.name(), BookingStatus.EXPIRED.name(), null, "SYSTEM", "Host response window expired");
            bookingStatusHistoryRepository.save(history);

            // Refund 100%
            Payment payment = paymentRepository.findByBookingId(bookingId).orElse(null);
            if (payment != null && payment.getStatus() == PaymentStatus.SUCCEEDED) {
                refundService.issueRefund(payment.getId(), b.getTotalAmount(), RefundReason.HOST_DECLINED, "approval-expired-" + bookingId);
            }

            eventPublisher.publishEvent(new BookingEvent(bookingId, NotificationType.BOOKING_EXPIRED));

            var dashboardCache = cacheManager.getCache(CacheConfig.CACHE_HOST_DASHBOARD);
            if (dashboardCache != null) dashboardCache.clear();

            log.info("Booking id={} expired from PENDING_APPROVAL", bookingId);
        }
    }
}
