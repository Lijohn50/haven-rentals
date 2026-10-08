package com.example.rentals.user.dto;

import com.example.rentals.common.NoHtml;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record BecomeHostRequest(
        @NotBlank(message = "Display name is required")
        @Size(min = 2, max = 80, message = "Display name must be between 2 and 80 characters")
        @NoHtml
        String displayName,

        @Size(max = 1000, message = "Bio must not exceed 1000 characters")
        @NoHtml
        String bio,

        @AssertTrue(message = "Terms must be accepted")
        Boolean acceptTerms
) {}
