package com.example.rentals.review.dto;

import com.example.rentals.review.Review;
import com.example.rentals.review.ReviewDirection;
import com.example.rentals.review.ReviewStatus;

import java.time.Instant;

/**
 * Every field a moderator needs, including the counterpart names and the
 * publish deadline of a review that is still waiting to go public.
 */
public record AdminReviewResponse(
        Long id,
        Long bookingId,
        Long listingId,
        String listingTitle,
        Long reviewerId,
        String reviewerName,
        Long revieweeId,
        String revieweeName,
        ReviewDirection direction,
        int overallRating,
        Integer cleanlinessRating,
        Integer communicationRating,
        Integer accuracyRating,
        String comment,
        ReviewStatus status,
        Instant createdAt,
        Instant publishDeadline,
        Instant publishedAt
) {
    public static AdminReviewResponse from(Review r) {
        String reviewerName = r.getReviewer().getFirstName();
        String revieweeName = r.getReviewee().getFirstName();
        return new AdminReviewResponse(
                r.getId(),
                r.getBooking().getId(),
                r.getListing().getId(),
                r.getListing().getTitle(),
                r.getReviewer().getId(),
                reviewerName,
                r.getReviewee().getId(),
                revieweeName,
                r.getDirection(),
                r.getOverallRating(),
                r.getCleanlinessRating(),
                r.getCommunicationRating(),
                r.getAccuracyRating(),
                r.getComment(),
                r.getStatus(),
                r.getCreatedAt(),
                r.getPublishDeadline(),
                r.getPublishedAt()
        );
    }
}
