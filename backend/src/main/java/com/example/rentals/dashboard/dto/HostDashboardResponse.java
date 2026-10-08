package com.example.rentals.dashboard.dto;

import com.example.rentals.booking.dto.BookingResponse;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record HostDashboardResponse(
        LocalDate from,
        LocalDate to,
        EarningsResponse earnings,
        BigDecimal overallOccupancyRate,
        long upcomingCheckIns,
        long pendingRequests,
        Instant oldestPendingRequestExpiry,
        List<BookingResponse> recentBookings,
        BigDecimal averageRating,
        List<ListingMetricsResponse> listings
) {
}
