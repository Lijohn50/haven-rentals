package com.example.rentals.notification;

import com.example.rentals.booking.Booking;
import com.example.rentals.booking.BookingRepository;
import com.example.rentals.listing.Listing;
import com.example.rentals.listing.ListingRepository;
import com.example.rentals.notification.event.*;
import com.example.rentals.user.User;
import com.example.rentals.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationListener {

    private final NotificationService notificationService;
    private final BookingRepository bookingRepository;
    private final ListingRepository listingRepository;
    private final UserRepository userRepository;

    @EventListener
    @Async
    public void onBookingEvent(BookingEvent event) {
        try {
            Booking b = bookingRepository.findById(event.bookingId()).orElse(null);
            if (b == null) return;

            String ref = b.getReference();
            String title = b.getListing().getTitle();
            User guest = b.getGuest();
            User host = b.getListing().getHost();

            switch (event.type()) {
                case BOOKING_REQUESTED -> notificationService.createNotification(
                        host,
                        NotificationType.BOOKING_REQUESTED,
                        "New Booking Request",
                        "You have a new booking request for " + title + " (" + ref + ")",
                        "/host/bookings"
                );
                case BOOKING_CONFIRMED -> {
                    notificationService.createNotification(
                            guest,
                            NotificationType.BOOKING_CONFIRMED,
                            "Booking Confirmed!",
                            "Your reservation at " + title + " (" + ref + ") is confirmed!",
                            "/trips/" + ref
                    );
                    notificationService.createNotification(
                            host,
                            NotificationType.BOOKING_CONFIRMED,
                            "Reservation Confirmed",
                            "Reservation (" + ref + ") for " + title + " is confirmed!",
                            "/host/bookings"
                    );
                }
                case BOOKING_DECLINED -> notificationService.createNotification(
                        guest,
                        NotificationType.BOOKING_DECLINED,
                        "Booking Request Declined",
                        "The host was unable to accept your request for " + title + " (" + ref + ").",
                        "/trips/" + ref
                );
                case BOOKING_CANCELLED -> {
                    notificationService.createNotification(
                            guest,
                            NotificationType.BOOKING_CANCELLED,
                            "Reservation Cancelled",
                            "Reservation (" + ref + ") for " + title + " has been cancelled.",
                            "/trips/" + ref
                    );
                    notificationService.createNotification(
                            host,
                            NotificationType.BOOKING_CANCELLED,
                            "Reservation Cancelled",
                            "Reservation (" + ref + ") for " + title + " has been cancelled.",
                            "/host/bookings"
                    );
                }
                case BOOKING_EXPIRED -> {
                    notificationService.createNotification(
                            guest,
                            NotificationType.BOOKING_EXPIRED,
                            "Booking Expired",
                            "Booking request (" + ref + ") for " + title + " has expired.",
                            "/trips/" + ref
                    );
                    notificationService.createNotification(
                            host,
                            NotificationType.BOOKING_EXPIRED,
                            "Booking Expired",
                            "Booking request (" + ref + ") for " + title + " has expired.",
                            "/host/bookings"
                    );
                }
                case BOOKING_COMPLETED -> {
                    notificationService.createNotification(
                            guest,
                            NotificationType.BOOKING_COMPLETED,
                            "How was your stay?",
                            "Your stay at " + title + " is complete! Please leave a review.",
                            "/trips/" + ref
                    );
                    notificationService.createNotification(
                            host,
                            NotificationType.BOOKING_COMPLETED,
                            "Rate your guest",
                            "Your guest's stay at " + title + " is complete. Please leave a review!",
                            "/host/bookings"
                    );
                }
                default -> {}
            }
        } catch (Exception e) {
            log.error("Error processing booking event {}: {}", event, e.getMessage());
        }
    }

    @EventListener
    @Async
    public void onListingEvent(ListingEvent event) {
        try {
            Listing listing = listingRepository.findById(event.listingId()).orElse(null);
            if (listing == null) return;
            User host = listing.getHost();

            switch (event.type()) {
                case LISTING_APPROVED -> notificationService.createNotification(
                        host,
                        NotificationType.LISTING_APPROVED,
                        "Listing Approved",
                        "Congratulations! Your listing '" + listing.getTitle() + "' has been approved and is now active.",
                        "/host/listings"
                );
                case LISTING_REJECTED -> notificationService.createNotification(
                        host,
                        NotificationType.LISTING_REJECTED,
                        "Listing Not Approved",
                        "Your listing '" + listing.getTitle() + "' requires changes: " + (event.reason() != null ? event.reason() : ""),
                        "/host/listings"
                );
                case LISTING_SUSPENDED -> notificationService.createNotification(
                        host,
                        NotificationType.LISTING_SUSPENDED,
                        "Listing Suspended",
                        "Your listing '" + listing.getTitle() + "' was suspended: " + (event.reason() != null ? event.reason() : ""),
                        "/host/listings"
                );
                default -> {}
            }
        } catch (Exception e) {
            log.error("Error processing listing event {}: {}", event, e.getMessage());
        }
    }

    @EventListener
    @Async
    public void onMessageEvent(MessageEvent event) {
        try {
            User recipient = userRepository.findById(event.recipientId()).orElse(null);
            if (recipient == null) return;

            String preview = event.preview();
            if (preview != null && preview.length() > 60) {
                preview = preview.substring(0, 57) + "...";
            }

            notificationService.createNotification(
                    recipient,
                    NotificationType.NEW_MESSAGE,
                    "New message",
                    preview != null ? preview : "You have received a new message",
                    "/conversations/" + event.conversationId()
            );
        } catch (Exception e) {
            log.error("Error processing message event {}: {}", event, e.getMessage());
        }
    }
}
