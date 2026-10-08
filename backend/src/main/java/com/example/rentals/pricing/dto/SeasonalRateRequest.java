package com.example.rentals.pricing.dto;

import com.example.rentals.common.NoHtml;
import com.example.rentals.pricing.SeasonalRate;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;

public record SeasonalRateRequest(
        @NotBlank(message = "Name is required")
        @Size(min = 2, max = 60, message = "Name must be between 2 and 60 characters")
        @NoHtml
        String name,

        @NotNull(message = "Start date is required")
        LocalDate startDate,

        @NotNull(message = "End date is required")
        LocalDate endDate,

        @NotNull(message = "Nightly price is required")
        @DecimalMin(value = "1.00", message = "Nightly price must be at least 1.00")
        @DecimalMax(value = "100000.00", message = "Nightly price cannot exceed 100000.00")
        BigDecimal nightlyPrice
) {}
