package com.example.rentals.pricing.dto;

import java.time.LocalDate;

public record QuoteResponse(
        Long listingId,
        LocalDate checkIn,
        LocalDate checkOut,
        int nights,
        int guests,
        boolean instantBook,
        PriceBreakdownResponse priceBreakdown
) {}
