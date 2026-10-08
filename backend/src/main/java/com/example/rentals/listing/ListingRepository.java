package com.example.rentals.listing;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ListingRepository extends JpaRepository<Listing, Long>, JpaSpecificationExecutor<Listing> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT l FROM Listing l WHERE l.id = :id")
    Optional<Listing> findByIdForUpdate(@Param("id") Long id);

    Page<Listing> findByHostIdAndStatusNot(Long hostId, ListingStatus status, Pageable pageable);

    Page<Listing> findByHostIdAndStatus(Long hostId, ListingStatus status, Pageable pageable);

    Page<Listing> findByStatusOrderByCreatedAtAsc(ListingStatus status, Pageable pageable);

    int countByHostIdAndStatusNot(Long hostId, ListingStatus status);

    Optional<Listing> findByIdAndHostId(Long id, Long hostId);
}
