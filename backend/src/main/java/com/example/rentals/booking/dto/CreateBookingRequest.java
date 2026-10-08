package com.example.rentals.booking.dto;

import com.example.rentals.common.NoHtml;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateBookingRequest(
        @NotNull(message = "Listing ID is required")
        @Positive(message = "Listing ID must be positive")
        Long listingId,

        @NotNull(message = "Check-in date is required")
        LocalDate checkIn,

        @NotNull(message = "Check-out date is required")
        LocalDate checkOut,

        @NotNull(message = "Guests count is required")
        @Min(value = 1, message = "Guests count must be at least 1")
        @Max(value = 50, message = "Guests count cannot exceed 50")
        Integer guests,

        @NotNull(message = "Expected total is required")
        @DecimalMin(value = "0.01", message = "Expected total must be positive")
        @DecimalMax(value = "100000.00", message = "Expected total cannot exceed 100000.00")
        BigDecimal expectedTotal,

        @Size(max = 1000, message = "Message must not exceed 1000 characters")
        @NoHtml
        String message
) {}
