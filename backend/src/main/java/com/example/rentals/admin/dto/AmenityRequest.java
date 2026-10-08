package com.example.rentals.admin.dto;

import com.example.rentals.common.NoHtml;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AmenityRequest(
        @NotBlank(message = "Amenity name is required")
        @Size(min = 2, max = 60, message = "Name must be between 2 and 60 characters")
        @NoHtml
        String name,

        @NotBlank(message = "Category is required")
        @Size(max = 50, message = "Category must be under 50 characters")
        @NoHtml
        String category,

        @NotBlank(message = "Icon is required")
        @Size(max = 50, message = "Icon must be under 50 characters")
        @NoHtml
        String icon,

        Boolean active
) {
}
