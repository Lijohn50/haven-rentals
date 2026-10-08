package com.example.rentals.booking.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record PayBookingRequest(
        @NotBlank(message = "Payment token is required")
        @Size(min = 1, max = 100, message = "Payment token must be between 1 and 100 characters")
        @Pattern(regexp = "^[A-Za-z0-9_-]+$", message = "Payment token contains invalid characters")
        String paymentToken
) {}
