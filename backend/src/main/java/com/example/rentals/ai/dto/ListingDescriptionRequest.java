package com.example.rentals.ai.dto;

import com.example.rentals.common.NoHtml;
import com.example.rentals.listing.PropertyType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ListingDescriptionRequest(
        @NotNull(message = "Property type is required")
        PropertyType propertyType,

        @NotBlank(message = "City is required")
        @Size(max = 100, message = "City cannot exceed 100 characters")
        @NoHtml
        String city,

        @NotEmpty(message = "At least one bullet point is required")
        @Size(max = 15, message = "Maximum 15 bullet points allowed")
        List<@NotBlank @Size(min = 3, max = 200, message = "Each bullet must be 3-200 characters") @NoHtml String> bullets
) {
}
