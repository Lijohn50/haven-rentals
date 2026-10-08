package com.example.rentals.ai.dto;

import com.example.rentals.common.NoHtml;
import jakarta.validation.constraints.*;

import java.util.List;

public record TripPlanRequest(
        @NotBlank(message = "City is required")
        @Size(max = 100, message = "City cannot exceed 100 characters")
        @NoHtml
        String city,

        @NotNull(message = "Days is required")
        @Min(value = 1, message = "Days must be at least 1")
        @Max(value = 14, message = "Days cannot exceed 14")
        Integer days,

        @Size(max = 5, message = "At most 5 interests allowed")
        List<@NotBlank @Size(max = 50) @NoHtml String> interests
) {
}
