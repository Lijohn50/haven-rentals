package com.example.rentals.dispute.dto;

import com.example.rentals.common.NoHtml;
import com.example.rentals.dispute.DisputeCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateDisputeRequest(
        @NotNull(message = "Category is required")
        DisputeCategory category,

        @NotBlank(message = "Description is required")
        @Size(min = 20, max = 2000, message = "Description must be between 20 and 2000 characters")
        @NoHtml
        String description
) {
}
