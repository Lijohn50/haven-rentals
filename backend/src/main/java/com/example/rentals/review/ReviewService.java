package com.example.rentals.review;

import com.example.rentals.booking.Booking;
import com.example.rentals.booking.BookingRepository;
import com.example.rentals.booking.BookingStatus;
import com.example.rentals.common.*;
import com.example.rentals.listing.Listing;
import com.example.rentals.listing.ListingPhoto;
import com.example.rentals.listing.ListingRepository;
import com.example.rentals.listing.dto.PhotoResponse;
import com.example.rentals.review.dto.AdminReviewResponse;
import com.example.rentals.review.dto.CreateReviewRequest;
import com.example.rentals.review.dto.PendingReviewResponse;
import com.example.rentals.review.dto.ReviewExchangeResponse;
import com.example.rentals.review.dto.ReviewResponse;
import com.example.rentals.user.User;
import com.example.rentals.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReviewService {

    /** How long after check-out a review window stays open. */
    public static final int REVIEW_WINDOW_DAYS = 14;

    private final ReviewRepository reviewRepository;
    private final BookingRepository bookingRepository;
    private final ListingRepository listingRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;
    private final CacheManager cacheManager;
    private final Clock clock;

    @Transactional
    public ReviewResponse submitReview(Long userId, Long bookingId, CreateReviewRequest req) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

        boolean isGuest = booking.getGuest().getId().equals(userId);
        boolean isHost = booking.getHost().getId().equals(userId);
        if (!isGuest && !isHost) {
            throw new ResourceNotFoundException("Booking not found");
        }

        if (booking.getStatus() != BookingStatus.COMPLETED) {
            throw new BusinessRuleException("Reviews can only be submitted for completed stays");
        }

        ReviewDirection direction = isGuest ? ReviewDirection.GUEST_TO_HOST : ReviewDirection.HOST_TO_GUEST;
        User reviewer = isGuest ? booking.getGuest() : booking.getHost();
        User reviewee = isGuest ? booking.getHost() : booking.getGuest();

        if (direction == ReviewDirection.HOST_TO_GUEST) {
            if (req.cleanlinessRating() != null || req.communicationRating() != null || req.accuracyRating() != null) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "Sub-ratings are only applicable for guest reviews");
            }
        }

        ZoneId zoneId = ZoneId.of(booking.getListingTimezone());
        ZonedDateTime checkOutEndOfDay = booking.getCheckOut().atTime(23, 59, 59).atZone(zoneId);
        Instant deadline = checkOutEndOfDay.plus(REVIEW_WINDOW_DAYS, ChronoUnit.DAYS).toInstant();
        Instant now = clock.instant();

        if (now.isAfter(deadline)) {
            throw new BusinessRuleException("The 14-day review window for this booking has closed");
        }

        if (reviewRepository.findByBookingIdAndDirection(bookingId, direction).isPresent()) {
            throw new ConflictException(ErrorCode.DUPLICATE_RESOURCE, "You have already reviewed this booking");
        }

        Review review = new Review(
                booking,
                booking.getListing(),
                reviewer,
                reviewee,
                direction,
                req.overallRating(),
                req.cleanlinessRating(),
                req.communicationRating(),
                req.accuracyRating(),
                req.comment(),
                deadline
        );

        ReviewDirection opposite = isGuest ? ReviewDirection.HOST_TO_GUEST : ReviewDirection.GUEST_TO_HOST;
        Optional<Review> counterpart = reviewRepository.findByBookingIdAndDirection(bookingId, opposite);

        if (counterpart.isPresent()) {
            // Both reviews present! Publish both immediately
            review.publish(now);
            Review other = counterpart.get();
            other.publish(now);
            reviewRepository.save(other);

            recalculateListingRating(booking.getListing().getId());
        }

        review = reviewRepository.save(review);
        return ReviewResponse.from(review);
    }

    @Transactional
    public void recalculateListingRating(Long listingId) {
        List<Object[]> rows = reviewRepository.calculateListingRating(listingId);
        if (!rows.isEmpty()) {
            Object[] row = rows.get(0);
            Double avg = (Double) row[0];
            Long count = ((Number) row[1]).longValue();

            BigDecimal avgBd = BigDecimal.valueOf(avg).setScale(2, RoundingMode.HALF_UP);
            listingRepository.findById(listingId).ifPresent(l -> {
                l.setAverageRating(avgBd);
                l.setReviewCount(count.intValue());
                listingRepository.save(l);
            });

            var cache = cacheManager.getCache(CacheConfig.CACHE_LISTING_DETAIL);
            if (cache != null) cache.evict(listingId);
            var searchCache = cacheManager.getCache(CacheConfig.CACHE_SEARCH_RESULTS);
            if (searchCache != null) searchCache.clear();
        }
    }

    @Transactional(readOnly = true)
    public List<ReviewResponse> getBookingReviews(Long userId, Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

        if (!booking.getGuest().getId().equals(userId) && !booking.getHost().getId().equals(userId)) {
            throw new ResourceNotFoundException("Booking not found");
        }

        List<Review> reviews = reviewRepository.findByBookingId(bookingId);
        List<ReviewResponse> result = new ArrayList<>();
        for (Review r : reviews) {
            if (r.getStatus() == ReviewStatus.PUBLISHED || r.getReviewer().getId().equals(userId)) {
                result.add(ReviewResponse.from(r));
            }
        }
        return result;
    }

    @Transactional(readOnly = true)
    public Page<ReviewResponse> getListingReviews(Long listingId, ReviewSort sort, Pageable pageable) {
        Pageable sortedPageable = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), sortFor(sort));
        return reviewRepository.findByListingIdAndDirectionAndStatus(
                listingId, ReviewDirection.GUEST_TO_HOST, ReviewStatus.PUBLISHED, sortedPageable
        ).map(ReviewResponse::from);
    }

    /** The host's side of the module: published guest reviews of their listings. */
    @Transactional(readOnly = true)
    public Page<ReviewResponse> getHostReviews(Long hostId, ReviewSort sort, Pageable pageable) {
        Pageable sortedPageable = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), sortFor(sort));
        return reviewRepository.findPublishedGuestReviewsByHost(hostId, sortedPageable)
                .map(ReviewResponse::from);
    }

    /**
     * Completed stays of the host's listings where the review
     * exchange is still open — at least one side has not reviewed yet.
     */
    @Transactional(readOnly = true)
    public List<ReviewExchangeResponse> getHostExchanges(Long hostId) {
        Instant now = clock.instant();
        LocalDate cutoff = LocalDate.now(clock).minusDays(REVIEW_WINDOW_DAYS);
        List<Booking> open = reviewRepository.findOpenExchanges(hostId, cutoff);

        List<ReviewExchangeResponse> result = new ArrayList<>();
        for (Booking b : open) {
            ZoneId zoneId = ZoneId.of(b.getListingTimezone());
            Instant deadline = b.getCheckOut().atTime(23, 59, 59).atZone(zoneId)
                    .plus(REVIEW_WINDOW_DAYS, ChronoUnit.DAYS).toInstant();
            if (!now.isBefore(deadline)) continue;

            boolean guestReviewed = reviewRepository
                    .findByBookingIdAndDirection(b.getId(), ReviewDirection.GUEST_TO_HOST).isPresent();
            boolean hostReviewed = reviewRepository
                    .findByBookingIdAndDirection(b.getId(), ReviewDirection.HOST_TO_GUEST).isPresent();

            Listing l = b.getListing();
            String cover = null;
            if (l.getPhotos() != null) {
                cover = l.getPhotos().stream()
                        .filter(ListingPhoto::isCover)
                        .findFirst()
                        .map(PhotoResponse::from)
                        .map(PhotoResponse::url)
                        .orElse(null);
            }
            result.add(new ReviewExchangeResponse(
                    b.getId(),
                    b.getReference(),
                    l.getId(),
                    l.getTitle(),
                    cover,
                    b.getCheckOut(),
                    deadline,
                    guestReviewed,
                    hostReviewed
            ));
        }
        return result;
    }

    /** The admin's side of the module: the full moderation queue. */
    @Transactional(readOnly = true)
    public Page<AdminReviewResponse> getAdminReviews(ReviewStatus status, String query, Pageable pageable) {
        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt");
        Pageable sortedPageable = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), sort);
        return reviewRepository.searchForModeration(status, query, sortedPageable)
                .map(AdminReviewResponse::from);
    }

    private Sort sortFor(ReviewSort sort) {
        return switch (sort != null ? sort : ReviewSort.NEWEST) {
            case NEWEST -> Sort.by(Sort.Direction.DESC, "publishedAt");
            case HIGHEST -> Sort.by(Sort.Direction.DESC, "overallRating");
            case LOWEST -> Sort.by(Sort.Direction.ASC, "overallRating");
        };
    }

    @Transactional(readOnly = true)
    public List<PendingReviewResponse> getPendingReviews(Long userId) {
        Instant now = clock.instant();
        List<Booking> completed = bookingRepository.findAllByUser(userId).stream()
                .filter(b -> b.getStatus() == BookingStatus.COMPLETED)
                .toList();

        List<PendingReviewResponse> pending = new ArrayList<>();
        for (Booking b : completed) {
            ZoneId zoneId = ZoneId.of(b.getListingTimezone());
            Instant deadline = b.getCheckOut().atTime(23, 59, 59).atZone(zoneId)
                    .plus(REVIEW_WINDOW_DAYS, ChronoUnit.DAYS).toInstant();

            if (now.isBefore(deadline)) {
                boolean alreadyReviewed = reviewRepository.existsByBookingIdAndReviewerId(b.getId(), userId);
                if (!alreadyReviewed) {
                    Listing l = b.getListing();
                    String cover = null;
                    if (l.getPhotos() != null) {
                        cover = l.getPhotos().stream()
                                .filter(ListingPhoto::isCover)
                                .findFirst()
                                .map(PhotoResponse::from)
                                .map(PhotoResponse::url)
                                .orElse(null);
                    }
                    pending.add(new PendingReviewResponse(
                            b.getId(),
                            b.getReference(),
                            l.getId(),
                            l.getTitle(),
                            cover,
                            b.getCheckOut(),
                            deadline
                    ));
                }
            }
        }
        return pending;
    }

    @Transactional
    public void removeReview(Long adminId, Long reviewId, String reason) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Review not found"));

        review.setStatus(ReviewStatus.REMOVED);
        reviewRepository.save(review);

        if (review.getDirection() == ReviewDirection.GUEST_TO_HOST) {
            recalculateListingRating(review.getListing().getId());
        }

        auditService.record(adminId, "REVIEW_REMOVED", "Review", reviewId, Map.of("reason", reason));
    }

    @Transactional
    public void publishDueReviews() {
        Instant now = clock.instant();
        List<Review> due = reviewRepository.findDueToPublish(now);

        Set<Long> affectedListings = new HashSet<>();
        for (Review r : due) {
            r.publish(now);
            reviewRepository.save(r);
            if (r.getDirection() == ReviewDirection.GUEST_TO_HOST) {
                affectedListings.add(r.getListing().getId());
            }
        }

        for (Long listingId : affectedListings) {
            recalculateListingRating(listingId);
        }
    }
}
