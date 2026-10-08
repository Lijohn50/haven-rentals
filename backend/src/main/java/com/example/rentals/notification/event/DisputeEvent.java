package com.example.rentals.notification.event;

import com.example.rentals.notification.NotificationType;

public record DisputeEvent(
        Long disputeId,
        NotificationType type
) {
}
