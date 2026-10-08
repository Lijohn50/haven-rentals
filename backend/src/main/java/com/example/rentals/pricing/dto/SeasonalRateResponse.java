package com.example.rentals.pricing.dto;

import com.example.rentals.pricing.SeasonalRate;

import java.math.BigDecimal;
import java.time.LocalDate;

public record SeasonalRateResponse(
        Long id,
        Long listingId,
        String name,
        LocalDate startDate,
        LocalDate endDate,
        BigDecimal nightlyPrice
) {
    public static SeasonalRateResponse from(SeasonalRate rate) {
        return new SeasonalRateResponse(
                rate.getId(),
                rate.getListing().getId(),
                rate.getName(),
                rate.getStartDate(),
                rate.getEndDate(),
                rate.getNightlyPrice()
        );
    }
}
