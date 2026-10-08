package com.example.rentals.notification.event;

import com.example.rentals.notification.NotificationType;

public record ReviewEvent(
        Long reviewId,
        NotificationType type
) {
}
