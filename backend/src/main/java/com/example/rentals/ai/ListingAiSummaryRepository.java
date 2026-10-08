package com.example.rentals.ai;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ListingAiSummaryRepository extends JpaRepository<ListingAiSummary, Long> {
}
