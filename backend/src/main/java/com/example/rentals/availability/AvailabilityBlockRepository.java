package com.example.rentals.availability;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface AvailabilityBlockRepository extends JpaRepository<AvailabilityBlock, Long> {

    List<AvailabilityBlock> findByListingIdOrderByStartDateAsc(Long listingId);

    @Query("""
        SELECT b FROM AvailabilityBlock b
        WHERE b.listing.id = :listingId
          AND b.startDate < :end
          AND b.endDate > :start
    """)
    List<AvailabilityBlock> findOverlappingBlocks(
            @Param("listingId") Long listingId,
            @Param("start") LocalDate start,
            @Param("end") LocalDate end
    );

    boolean existsByListingIdAndStartDateLessThanAndEndDateGreaterThan(Long listingId, LocalDate end, LocalDate start);
}
