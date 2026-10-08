package com.example.rentals.messaging.dto;

import com.example.rentals.messaging.Conversation;
import com.example.rentals.user.User;

import java.time.Instant;

public record ConversationResponse(
        Long id,
        Long listingId,
        String listingTitle,
        Long counterpartId,
        String counterpartDisplayName,
        Instant lastMessageAt,
        String lastMessagePreview,
        int unreadCount
) {
    public static ConversationResponse from(Conversation c, Long currentUserId, int unreadCount) {
        boolean isGuest = c.getGuest().getId().equals(currentUserId);
        User counterpart = isGuest ? c.getHost() : c.getGuest();
        String name = counterpart.getHostProfile() != null ? counterpart.getHostProfile().getDisplayName() : counterpart.getFirstName();

        return new ConversationResponse(
                c.getId(),
                c.getListing().getId(),
                c.getListing().getTitle(),
                counterpart.getId(),
                name,
                c.getLastMessageAt(),
                c.getLastMessagePreview(),
                unreadCount
        );
    }
}
