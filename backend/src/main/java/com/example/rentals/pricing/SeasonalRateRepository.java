package com.example.rentals.pricing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface SeasonalRateRepository extends JpaRepository<SeasonalRate, Long> {

    List<SeasonalRate> findByListingIdOrderByStartDateAsc(Long listingId);

    @Query("""
        SELECT s FROM SeasonalRate s
        WHERE s.listing.id = :listingId
          AND s.startDate <= :end
          AND s.endDate >= :start
    """)
    List<SeasonalRate> findOverlappingSeasons(
            @Param("listingId") Long listingId,
            @Param("start") LocalDate start,
            @Param("end") LocalDate end
    );

    boolean existsByListingIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(Long listingId, LocalDate end, LocalDate start);
}
