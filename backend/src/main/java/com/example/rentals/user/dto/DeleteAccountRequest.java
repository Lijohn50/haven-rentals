package com.example.rentals.user.dto;

import jakarta.validation.constraints.NotBlank;

public record DeleteAccountRequest(
        @NotBlank(message = "Password is required to delete account")
        String password
) {}
