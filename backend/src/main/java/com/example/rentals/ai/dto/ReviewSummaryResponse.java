package com.example.rentals.ai.dto;

import java.time.Instant;

public record ReviewSummaryResponse(
        Long listingId,
        int reviewCount,
        String summary,
        Instant generatedAt
) {
}
