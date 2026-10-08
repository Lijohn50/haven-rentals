package com.example.rentals.payment;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface PayoutRepository extends JpaRepository<Payout, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Payout p WHERE p.id = :id")
    Optional<Payout> findByIdForUpdate(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Payout p WHERE p.booking.id = :bookingId")
    Optional<Payout> findByBookingIdForUpdate(@Param("bookingId") Long bookingId);

    Optional<Payout> findByBookingId(Long bookingId);

    Page<Payout> findByHostIdOrderByScheduledForDesc(Long hostId, Pageable pageable);

    Page<Payout> findByHostIdAndStatusOrderByScheduledForDesc(Long hostId, PayoutStatus status, Pageable pageable);

    @Query("""
        SELECT p FROM Payout p
        WHERE p.status = 'SCHEDULED'
          AND p.scheduledFor <= :now
    """)
    List<Payout> findDueScheduledPayouts(@Param("now") Instant now);
}
