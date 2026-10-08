package com.example.rentals.search.dto;

import com.example.rentals.listing.Listing;
import com.example.rentals.listing.ListingPhoto;
import com.example.rentals.listing.PropertyType;
import com.example.rentals.listing.dto.PhotoResponse;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;

public record SearchResultResponse(
        Long id,
        String title,
        String city,
        String country,
        PropertyType propertyType,
        String coverPhotoUrl,
        int maxGuests,
        int bedrooms,
        BigDecimal baseNightlyPrice,
        BigDecimal averageRating,
        int reviewCount,
        boolean instantBook,
        List<String> amenitiesPreview,
        BigDecimal totalPrice,
        Integer nights
) {
    public static SearchResultResponse from(Listing listing, BigDecimal totalPrice, Integer nights) {
        String cover = null;
        if (listing.getPhotos() != null) {
            cover = listing.getPhotos().stream()
                    .filter(ListingPhoto::isCover)
                    .findFirst()
                    .map(PhotoResponse::from)
                    .map(PhotoResponse::url)
                    .orElse(listing.getPhotos().isEmpty() ? null : PhotoResponse.from(listing.getPhotos().get(0)).url());
        }

        List<String> amenitiesPreview = listing.getAmenities() != null ?
                listing.getAmenities().stream()
                        .map(a -> a.getName())
                        .limit(4)
                        .toList() : Collections.emptyList();

        return new SearchResultResponse(
                listing.getId(),
                listing.getTitle(),
                listing.getCity(),
                listing.getCountry(),
                listing.getPropertyType(),
                cover,
                listing.getMaxGuests(),
                listing.getBedrooms(),
                listing.getBaseNightlyPrice(),
                listing.getAverageRating(),
                listing.getReviewCount(),
                listing.isInstantBook(),
                amenitiesPreview,
                totalPrice,
                nights
        );
    }
}
