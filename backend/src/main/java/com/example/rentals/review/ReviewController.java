package com.example.rentals.review;

import com.example.rentals.admin.dto.ReasonRequest;
import com.example.rentals.common.CurrentUserProvider;
import com.example.rentals.common.PageResponse;
import com.example.rentals.review.dto.AdminReviewResponse;
import com.example.rentals.review.dto.CreateReviewRequest;
import com.example.rentals.review.dto.PendingReviewResponse;
import com.example.rentals.review.dto.ReviewExchangeResponse;
import com.example.rentals.review.dto.ReviewResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;
    private final CurrentUserProvider currentUser;

    @PostMapping("/bookings/{id}/reviews")
    public ResponseEntity<ReviewResponse> submitReview(
            @PathVariable Long id,
            @Valid @RequestBody CreateReviewRequest req
    ) {
        ReviewResponse res = reviewService.submitReview(currentUser.getUserId(), id, req);
        return ResponseEntity.created(URI.create("/api/v1/bookings/" + id + "/reviews")).body(res);
    }

    @GetMapping("/bookings/{id}/reviews")
    public ResponseEntity<List<ReviewResponse>> getBookingReviews(@PathVariable Long id) {
        return ResponseEntity.ok(reviewService.getBookingReviews(currentUser.getUserId(), id));
    }

    @GetMapping("/listings/{id}/reviews")
    public ResponseEntity<PageResponse<ReviewResponse>> getListingReviews(
            @PathVariable Long id,
            @RequestParam(defaultValue = "NEWEST") ReviewSort sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 50));
        return ResponseEntity.ok(PageResponse.from(reviewService.getListingReviews(id, sort, pageable)));
    }

    @GetMapping("/reviews/pending")
    public ResponseEntity<List<PendingReviewResponse>> getPendingReviews() {
        return ResponseEntity.ok(reviewService.getPendingReviews(currentUser.getUserId()));
    }

    /** Host connection: published guest reviews of the host's own listings. */
    @GetMapping("/host/reviews")
    public ResponseEntity<PageResponse<ReviewResponse>> getHostReviews(
            @RequestParam(defaultValue = "NEWEST") ReviewSort sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 50));
        return ResponseEntity.ok(PageResponse.from(
                reviewService.getHostReviews(currentUser.getUserId(), sort, pageable)));
    }

    /** Host connection: stays whose review exchange is still open. */
    @GetMapping("/host/reviews/exchange")
    public ResponseEntity<List<ReviewExchangeResponse>> getHostExchanges() {
        return ResponseEntity.ok(reviewService.getHostExchanges(currentUser.getUserId()));
    }

    /** Admin connection: the review moderation queue. */
    @GetMapping("/admin/reviews")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PageResponse<AdminReviewResponse>> getAdminReviews(
            @RequestParam(required = false) ReviewStatus status,
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 50));
        return ResponseEntity.ok(PageResponse.from(
                reviewService.getAdminReviews(status, query, pageable)));
    }

    @DeleteMapping("/admin/reviews/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> removeReview(
            @PathVariable Long id,
            @Valid @RequestBody ReasonRequest req
    ) {
        reviewService.removeReview(currentUser.getUserId(), id, req.reason());
        return ResponseEntity.noContent().build();
    }
}
