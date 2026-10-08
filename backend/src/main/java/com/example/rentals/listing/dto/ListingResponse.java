package com.example.rentals.listing.dto;

import com.example.rentals.listing.*;
import com.example.rentals.user.dto.PublicHostResponse;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalTime;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

public record ListingResponse(
        Long id,
        Long hostId,
        String hostDisplayName,
        String title,
        String description,
        PropertyType propertyType,
        ListingStatus status,
        String rejectionReason,
        String addressLine,
        String city,
        String stateRegion,
        String country,
        String postalCode,
        BigDecimal latitude,
        BigDecimal longitude,
        String timezone,
        int maxGuests,
        int bedrooms,
        int beds,
        BigDecimal bathrooms,
        BigDecimal baseNightlyPrice,
        BigDecimal weekendMultiplier,
        BigDecimal cleaningFee,
        BigDecimal weeklyDiscountPercent,
        BigDecimal monthlyDiscountPercent,
        int minNights,
        int maxNights,
        int advanceNoticeDays,
        int bookingWindowDays,
        LocalTime checkInTime,
        LocalTime checkOutTime,
        CancellationPolicyType cancellationPolicy,
        boolean instantBook,
        BigDecimal averageRating,
        int reviewCount,
        String coverPhotoUrl,
        List<PhotoResponse> photos,
        List<AmenityResponse> amenities,
        List<HouseRuleItemDto> houseRules,
        Instant createdAt,
        Instant updatedAt
) {
    public static ListingResponse from(Listing listing) {
        String cover = null;
        if (listing.getPhotos() != null) {
            cover = listing.getPhotos().stream()
                    .filter(ListingPhoto::isCover)
                    .findFirst()
                    .map(PhotoResponse::from)
                    .map(PhotoResponse::url)
                    .orElse(listing.getPhotos().isEmpty() ? null : PhotoResponse.from(listing.getPhotos().get(0)).url());
        }

        List<PhotoResponse> photoDtos = listing.getPhotos() != null ?
                listing.getPhotos().stream().map(PhotoResponse::from).toList() : Collections.emptyList();

        List<AmenityResponse> amenityDtos = listing.getAmenities() != null ?
                listing.getAmenities().stream().map(AmenityResponse::from).toList() : Collections.emptyList();

        List<HouseRuleItemDto> ruleDtos = listing.getHouseRules() != null ?
                listing.getHouseRules().stream().map(r -> new HouseRuleItemDto(r.getRuleText(), r.getSortOrder())).toList() : Collections.emptyList();

        String hostName = listing.getHost() != null && listing.getHost().getHostProfile() != null ?
                listing.getHost().getHostProfile().getDisplayName() : (listing.getHost() != null ? listing.getHost().getFirstName() : null);

        return new ListingResponse(
                listing.getId(),
                listing.getHost() != null ? listing.getHost().getId() : null,
                hostName,
                listing.getTitle(),
                listing.getDescription(),
                listing.getPropertyType(),
                listing.getStatus(),
                listing.getRejectionReason(),
                listing.getAddressLine(),
                listing.getCity(),
                listing.getStateRegion(),
                listing.getCountry(),
                listing.getPostalCode(),
                listing.getLatitude(),
                listing.getLongitude(),
                listing.getTimezone(),
                listing.getMaxGuests(),
                listing.getBedrooms(),
                listing.getBeds(),
                listing.getBathrooms(),
                listing.getBaseNightlyPrice(),
                listing.getWeekendMultiplier(),
                listing.getCleaningFee(),
                listing.getWeeklyDiscountPercent(),
                listing.getMonthlyDiscountPercent(),
                listing.getMinNights(),
                listing.getMaxNights(),
                listing.getAdvanceNoticeDays(),
                listing.getBookingWindowDays(),
                listing.getCheckInTime(),
                listing.getCheckOutTime(),
                listing.getCancellationPolicy(),
                listing.isInstantBook(),
                listing.getAverageRating(),
                listing.getReviewCount(),
                cover,
                photoDtos,
                amenityDtos,
                ruleDtos,
                listing.getCreatedAt(),
                listing.getUpdatedAt()
        );
    }
}
