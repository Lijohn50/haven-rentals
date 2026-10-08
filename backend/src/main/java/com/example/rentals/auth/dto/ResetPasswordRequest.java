package com.example.rentals.auth.dto;

import com.example.rentals.common.StrongPassword;
import jakarta.validation.constraints.NotBlank;

public record ResetPasswordRequest(
        @NotBlank(message = "Token is required")
        String token,

        @NotBlank(message = "New password is required")
        @StrongPassword
        String newPassword
) {}
