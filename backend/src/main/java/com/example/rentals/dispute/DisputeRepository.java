package com.example.rentals.dispute;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface DisputeRepository extends JpaRepository<Dispute, Long> {

    Page<Dispute> findByRaisedByIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    @Query("SELECT d FROM Dispute d WHERE d.booking.guest.id = :userId OR d.booking.listing.host.id = :userId ORDER BY d.createdAt DESC")
    Page<Dispute> findUserDisputes(@Param("userId") Long userId, Pageable pageable);

    Page<Dispute> findByStatusOrderByCreatedAtAsc(DisputeStatus status, Pageable pageable);

    Page<Dispute> findAllByOrderByCreatedAtAsc(Pageable pageable);

    boolean existsByBookingIdAndStatusIn(Long bookingId, Collection<DisputeStatus> statuses);

    long countByStatus(DisputeStatus status);

    List<Dispute> findByBookingId(Long bookingId);
}
