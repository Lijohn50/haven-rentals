package com.example.rentals.review;

import com.example.rentals.booking.Booking;
import com.example.rentals.listing.Listing;
import com.example.rentals.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "reviews")
@Getter
@Setter
@NoArgsConstructor
public class Review {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "listing_id", nullable = false)
    private Listing listing;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewer_id", nullable = false)
    private User reviewer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewee_id", nullable = false)
    private User reviewee;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private ReviewDirection direction;

    @Column(name = "overall_rating", nullable = false)
    private int overallRating;

    @Column(name = "cleanliness_rating")
    private Integer cleanlinessRating;

    @Column(name = "communication_rating")
    private Integer communicationRating;

    @Column(name = "accuracy_rating")
    private Integer accuracyRating;

    @Column(length = 2000)
    private String comment;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private ReviewStatus status = ReviewStatus.HIDDEN;

    @Column(name = "publish_deadline", nullable = false)
    private Instant publishDeadline;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Review(Booking booking, Listing listing, User reviewer, User reviewee, ReviewDirection direction,
                  int overallRating, Integer cleanlinessRating, Integer communicationRating, Integer accuracyRating,
                  String comment, Instant publishDeadline) {
        this.booking = booking;
        this.listing = listing;
        this.reviewer = reviewer;
        this.reviewee = reviewee;
        this.direction = direction;
        this.overallRating = overallRating;
        this.cleanlinessRating = cleanlinessRating;
        this.communicationRating = communicationRating;
        this.accuracyRating = accuracyRating;
        this.comment = comment;
        this.publishDeadline = publishDeadline;
        this.status = ReviewStatus.HIDDEN;
        this.createdAt = Instant.now();
    }

    public void publish(Instant now) {
        this.status = ReviewStatus.PUBLISHED;
        this.publishedAt = now;
    }
}
