package com.example.rentals.listing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AmenityRepository extends JpaRepository<Amenity, Long> {
    List<Amenity> findByActiveTrueOrderByCategoryAscNameAsc();
    Optional<Amenity> findByNameIgnoreCase(String name);
    boolean existsByNameIgnoreCase(String name);

    @org.springframework.data.jpa.repository.Query(value = "SELECT COUNT(*) FROM listing_amenities WHERE amenity_id = :amenityId", nativeQuery = true)
    long countListingsUsingAmenity(@org.springframework.data.repository.query.Param("amenityId") Long amenityId);
}
