package com.example.rentals.notification.event;

import com.example.rentals.notification.NotificationType;

public record BookingEvent(
        Long bookingId,
        NotificationType type
) {
}
