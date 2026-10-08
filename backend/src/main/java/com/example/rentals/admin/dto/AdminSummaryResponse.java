package com.example.rentals.admin.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record AdminSummaryResponse(
        BigDecimal grossMerchandiseValue,
        BigDecimal platformRevenue,
        Map<String, Long> bookingsByStatus,
        long newUsers,
        long newListings,
        List<CityStatsDto> topCities,
        Double averageHostResponseHours,
        Map<String, Long> disputesByStatus
) {
    public record CityStatsDto(
            String city,
            long bookingsCount,
            BigDecimal totalGmv
    ) {}
}
