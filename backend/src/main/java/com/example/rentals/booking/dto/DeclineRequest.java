package com.example.rentals.booking.dto;

import com.example.rentals.common.NoHtml;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DeclineRequest(
        @NotBlank(message = "Decline reason is required")
        @Size(min = 5, max = 500, message = "Decline reason must be between 5 and 500 characters")
        @NoHtml
        String reason
) {}
