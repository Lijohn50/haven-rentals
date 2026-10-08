package com.example.rentals.notification.dto;

import com.example.rentals.notification.Notification;
import com.example.rentals.notification.NotificationType;

import java.time.Instant;

public record NotificationResponse(
        Long id,
        NotificationType type,
        String title,
        String body,
        String link,
        Instant readAt,
        Instant createdAt
) {
    public static NotificationResponse from(Notification n) {
        return new NotificationResponse(
                n.getId(),
                n.getType(),
                n.getTitle(),
                n.getBody(),
                n.getLink(),
                n.getReadAt(),
                n.getCreatedAt()
        );
    }
}
