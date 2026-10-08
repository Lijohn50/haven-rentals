package com.example.rentals.review.dto;

import java.time.Instant;
import java.time.LocalDate;

/**
 * A completed stay from the host's side of the review exchange: which
 * reviews are still missing and when the window closes.
 */
public record ReviewExchangeResponse(
        Long bookingId,
        String reference,
        Long listingId,
        String listingTitle,
        String coverPhotoUrl,
        LocalDate checkOut,
        Instant deadline,
        boolean guestReviewed,
        boolean hostReviewed
) {}
