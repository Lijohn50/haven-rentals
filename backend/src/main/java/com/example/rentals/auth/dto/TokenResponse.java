package com.example.rentals.auth.dto;

import com.example.rentals.user.dto.UserResponse;

public record TokenResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresIn,
        UserResponse user
) {}
