package com.example.rentals.availability.dto;

import com.example.rentals.common.NoHtml;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record BlockRequest(
        @NotNull(message = "Start date is required")
        LocalDate startDate,

        @NotNull(message = "End date is required")
        LocalDate endDate,

        @Size(max = 200, message = "Reason must not exceed 200 characters")
        @NoHtml
        String reason
) {}
