package com.example.rentals.listing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HouseRuleRepository extends JpaRepository<HouseRule, Long> {
    List<HouseRule> findByListingIdOrderBySortOrderAsc(Long listingId);
    void deleteByListingId(Long listingId);
}
