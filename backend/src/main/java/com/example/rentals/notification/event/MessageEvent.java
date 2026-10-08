package com.example.rentals.notification.event;

public record MessageEvent(
        Long conversationId,
        Long senderId,
        Long recipientId,
        String preview
) {
}
