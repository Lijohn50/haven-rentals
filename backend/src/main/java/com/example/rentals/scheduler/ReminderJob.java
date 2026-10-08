package com.example.rentals.scheduler;

import com.example.rentals.booking.Booking;
import com.example.rentals.booking.BookingRepository;
import com.example.rentals.booking.BookingStatus;
import com.example.rentals.notification.NotificationService;
import com.example.rentals.notification.NotificationType;
import com.example.rentals.review.ReviewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class ReminderJob {

    private final BookingRepository bookingRepository;
    private final ReviewRepository reviewRepository;
    private final NotificationService notificationService;
    private final Clock clock;

    @Scheduled(cron = "0 0 8 * * *", zone = "UTC")
    @Transactional(readOnly = true)
    public void run() {
        LocalDate today = LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC);
        LocalDate tomorrow = today.plusDays(1);

        // 1. Check-in reminder (day before)
        List<Booking> upcomingCheckIns = bookingRepository.findAll().stream()
                .filter(b -> b.getStatus() == BookingStatus.CONFIRMED && tomorrow.equals(b.getCheckIn()))
                .toList();

        for (Booking b : upcomingCheckIns) {
            try {
                notificationService.createNotification(
                        b.getGuest(),
                        NotificationType.CHECK_IN_REMINDER,
                        "Check-in Tomorrow!",
                        "Your stay at " + b.getListing().getTitle() + " starts tomorrow. Check your reservation details for access instructions.",
                        "/trips/" + b.getReference()
                );
            } catch (Exception e) {
                log.error("Failed to send check-in reminder for booking {}: {}", b.getId(), e.getMessage());
            }
        }

        // 2. Review reminder (3 days before deadline)
        Instant now = clock.instant();
        Instant threeDaysAhead = now.plus(3, ChronoUnit.DAYS);
        Instant fourDaysAhead = now.plus(4, ChronoUnit.DAYS);

        List<Booking> completedBookings = bookingRepository.findAll().stream()
                .filter(b -> b.getStatus() == BookingStatus.COMPLETED)
                .toList();

        for (Booking b : completedBookings) {
            try {
                // If guest has not reviewed
                if (!reviewRepository.existsByBookingIdAndReviewerId(b.getId(), b.getGuest().getId())) {
                    notificationService.createNotification(
                            b.getGuest(),
                            NotificationType.REVIEW_REMINDER,
                            "Time is running out to review your stay",
                            "Share your experience at " + b.getListing().getTitle() + " before the review window closes.",
                            "/trips/" + b.getReference()
                    );
                }
            } catch (Exception e) {
                log.error("Failed to send review reminder for booking {}: {}", b.getId(), e.getMessage());
            }
        }
    }
}
