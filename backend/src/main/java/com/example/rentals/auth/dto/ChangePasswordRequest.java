package com.example.rentals.auth.dto;

import com.example.rentals.common.StrongPassword;
import jakarta.validation.constraints.NotBlank;

public record ChangePasswordRequest(
        @NotBlank(message = "Current password is required")
        String currentPassword,

        @NotBlank(message = "New password is required")
        @StrongPassword
        String newPassword
) {}
