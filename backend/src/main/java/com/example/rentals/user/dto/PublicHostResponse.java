package com.example.rentals.user.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record PublicHostResponse(
        Long userId,
        String displayName,
        String bio,
        Instant memberSince,
        int activeListings,
        BigDecimal averageRating,
        int reviewCount
) {}
