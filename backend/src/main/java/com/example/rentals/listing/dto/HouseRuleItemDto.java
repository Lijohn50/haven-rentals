package com.example.rentals.listing.dto;

import com.example.rentals.common.NoHtml;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record HouseRuleItemDto(
        @NotBlank(message = "Rule text is required")
        @Size(max = 200, message = "Rule text must not exceed 200 characters")
        @NoHtml
        String text,
        int sortOrder
) {}
