package com.example.rentals.scheduler;

import com.example.rentals.review.ReviewService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class ReviewPublishJob {

    private final ReviewService reviewService;

    @Scheduled(fixedRate = 1800000)
    public void run() {
        try {
            reviewService.publishDueReviews();
        } catch (Exception e) {
            log.error("ReviewPublishJob failed: {}", e.getMessage());
        }
    }
}
