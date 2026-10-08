package com.example.rentals.booking;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long>, JpaSpecificationExecutor<Booking> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM Booking b WHERE b.id = :id")
    Optional<Booking> findByIdForUpdate(@Param("id") Long id);

    Optional<Booking> findByReference(String reference);

    Optional<Booking> findByGuestIdAndIdempotencyKey(Long guestId, String idempotencyKey);

    int countByGuestIdAndStatus(Long guestId, BookingStatus status);

    Page<Booking> findByGuestIdOrderByCreatedAtDesc(Long guestId, Pageable pageable);

    Page<Booking> findByGuestIdAndStatusOrderByCreatedAtDesc(Long guestId, BookingStatus status, Pageable pageable);

    Page<Booking> findByHostIdAndStatus(Long hostId, BookingStatus status, Pageable pageable);

    Page<Booking> findByGuestIdAndStatus(Long guestId, BookingStatus status, Pageable pageable);

    long countByHostIdAndStatus(Long hostId, BookingStatus status);

    @Query("""
        SELECT b.host.id AS hostId, COUNT(b) AS total
        FROM Booking b
        WHERE b.status = com.example.rentals.booking.BookingStatus.CANCELLED_BY_HOST
          AND b.host.id IN :hostIds
        GROUP BY b.host.id
    """)
    List<Object[]> countHostCancellationsByHostIds(@Param("hostIds") List<Long> hostIds);

    /**
     * Host bookings apply their optional status and listing filters through
     * {@link BookingSpecifications}. A JPQL `:param IS NULL` guard was tried here and
     * fails: Postgres cannot infer a JDBC type for an untyped null bind, so the query
     * errors out whenever either filter is omitted.
     */

    @Query("SELECT b FROM Booking b WHERE b.status = 'PENDING_PAYMENT' AND b.expiresAt <= :now")
    List<Booking> findExpiredHolds(@Param("now") Instant now);

    @Query("SELECT b FROM Booking b WHERE b.status = 'PENDING_APPROVAL' AND b.expiresAt <= :now")
    List<Booking> findExpiredApprovalRequests(@Param("now") Instant now);

    @Query("SELECT b FROM Booking b WHERE b.status = 'CONFIRMED' AND b.checkOut <= :today")
    List<Booking> findCompletedStaysCandidates(@Param("today") LocalDate today);

    @Query("""
        SELECT COUNT(b) > 0 FROM Booking b
        WHERE b.listing.id = :listingId
          AND b.status IN ('PENDING_PAYMENT', 'PENDING_APPROVAL', 'CONFIRMED')
          AND b.checkOut >= :today
    """)
    boolean hasActiveFutureBookings(@Param("listingId") Long listingId, @Param("today") LocalDate today);

    @Query("SELECT b FROM Booking b WHERE b.guest.id = :userId OR b.host.id = :userId")
    List<Booking> findAllByUser(@Param("userId") Long userId);
}
