package com.example.rentals.listing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ListingPhotoRepository extends JpaRepository<ListingPhoto, Long> {

    List<ListingPhoto> findByListingIdOrderBySortOrderAsc(Long listingId);

    int countByListingId(Long listingId);

    Optional<ListingPhoto> findByListingIdAndIsCoverTrue(Long listingId);

    @Modifying
    @Query("UPDATE ListingPhoto p SET p.isCover = false WHERE p.listing.id = :listingId")
    void clearCoverPhoto(@Param("listingId") Long listingId);

    Optional<ListingPhoto> findByListingIdAndId(Long listingId, Long photoId);

    boolean existsByStorageKey(String storageKey);
}
