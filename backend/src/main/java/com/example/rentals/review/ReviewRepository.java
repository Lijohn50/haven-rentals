package com.example.rentals.review;

import com.example.rentals.booking.Booking;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ReviewRepository extends JpaRepository<Review, Long> {

    Optional<Review> findByBookingIdAndDirection(Long bookingId, ReviewDirection direction);

    List<Review> findByBookingId(Long bookingId);

    Page<Review> findByListingIdAndDirectionAndStatus(
            Long listingId,
            ReviewDirection direction,
            ReviewStatus status,
            Pageable pageable
    );

    /** Published guest reviews of every listing owned by a host. */
    @Query("""
        SELECT r FROM Review r
        WHERE r.listing.host.id = :hostId
          AND r.direction = 'GUEST_TO_HOST'
          AND r.status = 'PUBLISHED'
        """)
    Page<Review> findPublishedGuestReviewsByHost(@Param("hostId") Long hostId, Pageable pageable);

    /**
     * Completed stays of a host's listings whose review exchange is still
     * open: at least one side has not written its review yet.
     */
    @Query("""
        SELECT b FROM Booking b
        WHERE b.listing.host.id = :hostId
          AND b.status = 'COMPLETED'
          AND b.checkOut >= :cutoff
          AND (
            NOT EXISTS (SELECT r FROM Review r WHERE r.booking.id = b.id AND r.direction = 'GUEST_TO_HOST')
            OR NOT EXISTS (SELECT r FROM Review r WHERE r.booking.id = b.id AND r.direction = 'HOST_TO_GUEST')
          )
        ORDER BY b.checkOut DESC
        """)
    List<Booking> findOpenExchanges(@Param("hostId") Long hostId, @Param("cutoff") LocalDate cutoff);

    /** Moderation queue: every review, optionally filtered by status and free-text search. */
    @Query("""
        SELECT r FROM Review r
        WHERE (:status IS NULL OR r.status = :status)
          AND (:query IS NULL OR :query = ''
            OR LOWER(r.reviewer.firstName) LIKE LOWER(CONCAT('%', :query, '%'))
            OR LOWER(COALESCE(r.reviewer.lastName, '')) LIKE LOWER(CONCAT('%', :query, '%'))
            OR LOWER(r.listing.title) LIKE LOWER(CONCAT('%', :query, '%')))
        """)
    Page<Review> searchForModeration(
            @Param("status") ReviewStatus status,
            @Param("query") String query,
            Pageable pageable
    );

    @Query("""
        SELECT r FROM Review r
        WHERE r.status = 'HIDDEN'
          AND r.publishDeadline <= :now
        """)
    List<Review> findDueToPublish(@Param("now") Instant now);

    @Query("""
        SELECT COALESCE(AVG(CAST(r.overallRating as double)), 0.0), COUNT(r.id)
        FROM Review r
        WHERE r.listing.id = :listingId
          AND r.direction = 'GUEST_TO_HOST'
          AND r.status = 'PUBLISHED'
        """)
    List<Object[]> calculateListingRating(@Param("listingId") Long listingId);

    boolean existsByBookingIdAndReviewerId(Long bookingId, Long reviewerId);
}
