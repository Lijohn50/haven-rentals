package com.example.rentals.review.dto;

import com.example.rentals.review.Review;
import com.example.rentals.review.ReviewDirection;
import com.example.rentals.review.ReviewStatus;

import java.time.Instant;

public record ReviewResponse(
        Long id,
        Long bookingId,
        Long listingId,
        String listingTitle,
        Long reviewerId,
        String reviewerName,
        ReviewDirection direction,
        int overallRating,
        Integer cleanlinessRating,
        Integer communicationRating,
        Integer accuracyRating,
        String comment,
        ReviewStatus status,
        Instant publishedAt
) {
    public static ReviewResponse from(Review r) {
        String name = r.getReviewer().getFirstName();
        return new ReviewResponse(
                r.getId(),
                r.getBooking().getId(),
                r.getListing().getId(),
                r.getListing().getTitle(),
                r.getReviewer().getId(),
                name,
                r.getDirection(),
                r.getOverallRating(),
                r.getCleanlinessRating(),
                r.getCommunicationRating(),
                r.getAccuracyRating(),
                r.getComment(),
                r.getStatus(),
                r.getPublishedAt()
        );
    }
}
