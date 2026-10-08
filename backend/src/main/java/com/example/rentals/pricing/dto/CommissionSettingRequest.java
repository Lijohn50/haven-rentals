package com.example.rentals.pricing.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;

public record CommissionSettingRequest(
        @NotNull(message = "Guest service fee percent is required")
        @DecimalMin(value = "0.00", message = "Fee percent cannot be negative")
        @DecimalMax(value = "30.00", message = "Fee percent cannot exceed 30.00")
        BigDecimal guestServiceFeePercent,

        @NotNull(message = "Host commission percent is required")
        @DecimalMin(value = "0.00", message = "Commission percent cannot be negative")
        @DecimalMax(value = "30.00", message = "Commission percent cannot exceed 30.00")
        BigDecimal hostCommissionPercent,

        @NotNull(message = "Tax percent is required")
        @DecimalMin(value = "0.00", message = "Tax percent cannot be negative")
        @DecimalMax(value = "30.00", message = "Tax percent cannot exceed 30.00")
        BigDecimal taxPercent,

        @NotNull(message = "Effective from timestamp is required")
        Instant effectiveFrom
) {}
