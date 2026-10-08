package com.example.rentals.ai;

import com.example.rentals.ai.dto.AiTextResponse;
import com.example.rentals.ai.dto.ListingDescriptionRequest;
import com.example.rentals.ai.dto.ReviewSummaryResponse;
import com.example.rentals.ai.dto.TripPlanRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Tag(name = "AI Helpers", description = "AI-powered listing description generation, review summaries, and trip planning")
@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;

    @Operation(summary = "Generate draft listing description")
    @PostMapping("/listing-description")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<AiTextResponse> generateListingDescription(
            @Valid @RequestBody ListingDescriptionRequest request
    ) {
        return ResponseEntity.ok(aiService.generateListingDescription(request));
    }

    @Operation(summary = "Get AI summary of listing reviews")
    @GetMapping("/listings/{id}/review-summary")
    public ResponseEntity<ReviewSummaryResponse> getReviewSummary(@PathVariable Long id) {
        return ResponseEntity.ok(aiService.getReviewSummary(id));
    }

    @Operation(summary = "Generate AI trip itinerary")
    @PostMapping("/trip-plan")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AiTextResponse> generateTripPlan(
            @Valid @RequestBody TripPlanRequest request
    ) {
        return ResponseEntity.ok(aiService.generateTripPlan(request));
    }
}
