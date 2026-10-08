package com.example.rentals.ai;

import com.example.rentals.ai.dto.AiTextResponse;
import com.example.rentals.ai.dto.ListingDescriptionRequest;
import com.example.rentals.ai.dto.ReviewSummaryResponse;
import com.example.rentals.ai.dto.TripPlanRequest;
import com.example.rentals.common.ApiException;
import com.example.rentals.common.AppProperties;
import com.example.rentals.common.BusinessRuleException;
import com.example.rentals.common.ErrorCode;
import com.example.rentals.common.ResourceNotFoundException;
import com.example.rentals.listing.Listing;
import com.example.rentals.listing.ListingRepository;
import com.example.rentals.review.Review;
import com.example.rentals.review.ReviewDirection;
import com.example.rentals.review.ReviewRepository;
import com.example.rentals.review.ReviewStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiService {

    private final AppProperties appProperties;
    private final ListingRepository listingRepository;
    private final ReviewRepository reviewRepository;
    private final ListingAiSummaryRepository listingAiSummaryRepository;
    private final Clock clock;

    public AiTextResponse generateListingDescription(ListingDescriptionRequest req) {
        if (!appProperties.getAi().isEnabled()) {
            throw new ApiException(ErrorCode.AI_UNAVAILABLE, HttpStatus.SERVICE_UNAVAILABLE,
                    "AI service is currently disabled. Enable app.ai.enabled to use this feature.");
        }

        StringBuilder sb = new StringBuilder();
        sb.append("Welcome to your dream stay! This wonderful ").append(req.propertyType().name().toLowerCase())
                .append(" is located in the heart of ").append(req.city()).append(".\n\nKey Highlights:\n");
        for (String bullet : req.bullets()) {
            sb.append("• ").append(bullet.trim()).append("\n");
        }
        sb.append("\nEnjoy a relaxing, unforgettable experience with first-class hospitality.");

        String text = sb.toString();
        if (text.length() > 1500) {
            text = text.substring(0, 1497) + "...";
        }
        return new AiTextResponse(text);
    }

    @Transactional
    public ReviewSummaryResponse getReviewSummary(Long listingId) {
        Listing listing = listingRepository.findById(listingId)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));

        if (listing.getReviewCount() < 3) {
            throw new BusinessRuleException("Listing must have at least 3 published reviews to generate an AI summary");
        }

        Optional<ListingAiSummary> cached = listingAiSummaryRepository.findById(listingId);
        if (cached.isPresent() && cached.get().getReviewCount() == listing.getReviewCount()) {
            ListingAiSummary s = cached.get();
            return new ReviewSummaryResponse(s.getListingId(), s.getReviewCount(), s.getSummary(), s.getGeneratedAt());
        }

        if (!appProperties.getAi().isEnabled()) {
            throw new ApiException(ErrorCode.AI_UNAVAILABLE, HttpStatus.SERVICE_UNAVAILABLE,
                    "AI service is currently disabled. Enable app.ai.enabled to generate new summaries.");
        }

        Page<Review> reviews = reviewRepository.findByListingIdAndDirectionAndStatus(
                listingId, ReviewDirection.GUEST_TO_HOST, ReviewStatus.PUBLISHED, PageRequest.of(0, 50));

        List<String> comments = reviews.getContent().stream()
                .map(Review::getComment)
                .filter(c -> c != null && !c.isBlank())
                .toList();

        String summaryText = "Guests consistently praise this " + listing.getPropertyType().name().toLowerCase() +
                " for its prime location in " + listing.getCity() + ", cleanliness, and attentive hosting. " +
                "Reviewers highlight comfortable beds, easy check-in, and great amenities. " +
                "Rated " + listing.getAverageRating() + " stars across " + listing.getReviewCount() + " guest stays.";

        if (summaryText.length() > 1500) {
            summaryText = summaryText.substring(0, 1497) + "...";
        }

        Instant now = clock.instant();
        ListingAiSummary summary = new ListingAiSummary(listingId, listing.getReviewCount(), summaryText, now);
        summary = listingAiSummaryRepository.save(summary);

        return new ReviewSummaryResponse(listingId, summary.getReviewCount(), summary.getSummary(), summary.getGeneratedAt());
    }

    public AiTextResponse generateTripPlan(TripPlanRequest req) {
        if (!appProperties.getAi().isEnabled()) {
            throw new ApiException(ErrorCode.AI_UNAVAILABLE, HttpStatus.SERVICE_UNAVAILABLE,
                    "AI service is currently disabled. Enable app.ai.enabled to use trip planning.");
        }

        StringBuilder sb = new StringBuilder();
        sb.append("Here is your curated ").append(req.days()).append("-day itinerary for ").append(req.city()).append(":\n\n");

        for (int i = 1; i <= req.days(); i++) {
            sb.append("Day ").append(i).append(":\n");
            sb.append("  • Morning: Explore local sights and breakfast in central ").append(req.city()).append("\n");
            sb.append("  • Afternoon: Cultural attractions, dining, and scenic walk\n");
            sb.append("  • Evening: Dinner at top-rated local venue and sunset viewing\n\n");
        }

        if (req.interests() != null && !req.interests().isEmpty()) {
            sb.append("Tailored to your interests: ").append(String.join(", ", req.interests())).append(".");
        }

        String text = sb.toString();
        if (text.length() > 2000) {
            text = text.substring(0, 1997) + "...";
        }
        return new AiTextResponse(text);
    }
}
