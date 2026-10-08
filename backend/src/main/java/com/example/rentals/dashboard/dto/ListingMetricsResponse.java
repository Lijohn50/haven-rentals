package com.example.rentals.dashboard.dto;

import java.math.BigDecimal;

public record ListingMetricsResponse(
        Long listingId,
        String title,
        String coverPhotoUrl,
        long bookings,
        long bookedNights,
        long blockedNights,
        BigDecimal occupancyRate,
        BigDecimal revenue,
        BigDecimal averageRating
) {
}
