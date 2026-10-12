package com.example.rentals.messaging.dto;

import com.example.rentals.listing.Listing;
import com.example.rentals.listing.ListingPhoto;
import com.example.rentals.listing.dto.PhotoResponse;
import com.example.rentals.messaging.Conversation;
import com.example.rentals.user.User;

import java.time.Instant;

public record ConversationResponse(
        Long id,
        Long listingId,
        String listingTitle,
        String listingPhotoUrl,
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

        Listing l = c.getListing();
        String cover = null;
        if (l != null && l.getPhotos() != null) {
            cover = l.getPhotos().stream()
                    .filter(ListingPhoto::isCover)
                    .findFirst()
                    .map(PhotoResponse::from)
                    .map(PhotoResponse::url)
                    .orElse(l.getPhotos().isEmpty() ? null : PhotoResponse.from(l.getPhotos().get(0)).url());
        }

        return new ConversationResponse(
                c.getId(),
                l != null ? l.getId() : null,
                l != null ? l.getTitle() : null,
                cover,
                counterpart.getId(),
                name,
                c.getLastMessageAt(),
                c.getLastMessagePreview(),
                unreadCount
        );
    }
}
