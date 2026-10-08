package com.example.rentals.ai;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "listing_ai_summaries")
@Getter
@Setter
@NoArgsConstructor
public class ListingAiSummary {

    @Id
    @Column(name = "listing_id")
    private Long listingId;

    @Column(name = "review_count", nullable = false)
    private int reviewCount;

    @Column(name = "summary", nullable = false, length = 1500)
    private String summary;

    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;

    public ListingAiSummary(Long listingId, int reviewCount, String summary, Instant generatedAt) {
        this.listingId = listingId;
        this.reviewCount = reviewCount;
        this.summary = summary;
        this.generatedAt = generatedAt;
    }
}
