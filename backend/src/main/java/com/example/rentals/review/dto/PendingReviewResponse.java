package com.example.rentals.review.dto;

import java.time.Instant;
import java.time.LocalDate;

public record PendingReviewResponse(
        Long bookingId,
        String reference,
        Long listingId,
        String listingTitle,
        String coverPhotoUrl,
        LocalDate checkOut,
        Instant deadline
) {}
