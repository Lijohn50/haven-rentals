package com.example.rentals.user.dto;

import com.example.rentals.common.NoHtml;
import com.example.rentals.common.Phone;
import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @Size(min = 1, max = 60, message = "First name must be between 1 and 60 characters")
        @NoHtml
        String firstName,

        @Size(min = 1, max = 60, message = "Last name must be between 1 and 60 characters")
        @NoHtml
        String lastName,

        @Phone
        String phone
) {}
