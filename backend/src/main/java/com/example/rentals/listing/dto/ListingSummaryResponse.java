package com.example.rentals.listing.dto;

import com.example.rentals.listing.Listing;
import com.example.rentals.listing.ListingPhoto;
import com.example.rentals.listing.ListingStatus;
import com.example.rentals.listing.PropertyType;

import java.math.BigDecimal;
import java.time.Instant;

public record ListingSummaryResponse(
        Long id,
        String title,
        String city,
        String country,
        PropertyType propertyType,
        ListingStatus status,
        BigDecimal baseNightlyPrice,
        BigDecimal averageRating,
        int reviewCount,
        String coverPhotoUrl,
        Instant createdAt
) {
    public static ListingSummaryResponse from(Listing listing) {
        String cover = null;
        if (listing.getPhotos() != null) {
            cover = listing.getPhotos().stream()
                    .filter(ListingPhoto::isCover)
                    .findFirst()
                    .map(PhotoResponse::from)
                    .map(PhotoResponse::url)
                    .orElse(listing.getPhotos().isEmpty() ? null : PhotoResponse.from(listing.getPhotos().get(0)).url());
        }
        return new ListingSummaryResponse(
                listing.getId(),
                listing.getTitle(),
                listing.getCity(),
                listing.getCountry(),
                listing.getPropertyType(),
                listing.getStatus(),
                listing.getBaseNightlyPrice(),
                listing.getAverageRating(),
                listing.getReviewCount(),
                cover,
                listing.getCreatedAt()
        );
    }
}
