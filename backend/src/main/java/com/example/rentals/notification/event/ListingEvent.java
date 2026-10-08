package com.example.rentals.notification.event;

import com.example.rentals.notification.NotificationType;

public record ListingEvent(
        Long listingId,
        NotificationType type,
        String reason
) {
}
