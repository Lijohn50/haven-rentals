package com.example.rentals.auth.dto;

import com.example.rentals.common.CountryCode;
import com.example.rentals.common.NoHtml;
import com.example.rentals.common.Phone;
import com.example.rentals.common.StrongPassword;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank(message = "Email is required")
        @Email(message = "Invalid email format")
        @Size(max = 254, message = "Email must not exceed 254 characters")
        String email,

        @NotBlank(message = "Password is required")
        @StrongPassword
        String password,

        @NotBlank(message = "First name is required")
        @Size(min = 1, max = 60, message = "First name must be between 1 and 60 characters")
        @NoHtml
        String firstName,

        @NotBlank(message = "Last name is required")
        @Size(min = 1, max = 60, message = "Last name must be between 1 and 60 characters")
        @NoHtml
        String lastName,

        @Phone
        String phone
) {}
