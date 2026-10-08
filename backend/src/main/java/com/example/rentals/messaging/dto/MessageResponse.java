package com.example.rentals.messaging.dto;

import com.example.rentals.messaging.MessageDocument;

import java.time.Instant;

public record MessageResponse(
        String id,
        Long conversationId,
        Long senderId,
        String body,
        Instant sentAt,
        Instant readAt
) {
    public static MessageResponse from(MessageDocument doc) {
        return new MessageResponse(
                doc.getId(),
                doc.getConversationId(),
                doc.getSenderId(),
                doc.getBody(),
                doc.getSentAt(),
                doc.getReadAt()
        );
    }
}
