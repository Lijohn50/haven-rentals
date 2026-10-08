package com.example.rentals.dashboard;

import com.example.rentals.booking.Booking;
import com.example.rentals.booking.BookingStatus;
import com.example.rentals.payment.PayoutStatus;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Repository
@RequiredArgsConstructor
public class DashboardRepository {

    private final EntityManager em;

    public BigDecimal sumPayoutsByStatus(Long hostId, PayoutStatus status) {
        String jpql = "SELECT COALESCE(SUM(p.amount), 0) FROM Payout p WHERE p.host.id = :hostId AND p.status = :status";
        return em.createQuery(jpql, BigDecimal.class)
                .setParameter("hostId", hostId)
                .setParameter("status", status)
                .getSingleResult();
    }

    public BigDecimal sumPayoutsPaidSince(Long hostId, Instant since) {
        String jpql = "SELECT COALESCE(SUM(p.amount), 0) FROM Payout p WHERE p.host.id = :hostId AND p.status = :status AND p.paidAt >= :since";
        return em.createQuery(jpql, BigDecimal.class)
                .setParameter("hostId", hostId)
                .setParameter("status", PayoutStatus.PAID)
                .setParameter("since", since)
                .getSingleResult();
    }

    public long countUpcomingCheckIns(Long hostId, LocalDate today, LocalDate nextWeek) {
        String jpql = """
            SELECT COUNT(b) FROM Booking b
            WHERE b.listing.host.id = :hostId
              AND b.status = :status
              AND b.checkIn >= :today AND b.checkIn <= :nextWeek
        """;
        return em.createQuery(jpql, Long.class)
                .setParameter("hostId", hostId)
                .setParameter("status", BookingStatus.CONFIRMED)
                .setParameter("today", today)
                .setParameter("nextWeek", nextWeek)
                .getSingleResult();
    }

    public long countPendingRequests(Long hostId) {
        String jpql = """
            SELECT COUNT(b) FROM Booking b
            WHERE b.listing.host.id = :hostId
              AND b.status = :status
        """;
        return em.createQuery(jpql, Long.class)
                .setParameter("hostId", hostId)
                .setParameter("status", BookingStatus.PENDING_APPROVAL)
                .getSingleResult();
    }

    public Instant findOldestPendingExpiry(Long hostId) {
        String jpql = """
            SELECT MIN(b.expiresAt) FROM Booking b
            WHERE b.listing.host.id = :hostId
              AND b.status = :status
        """;
        List<Instant> results = em.createQuery(jpql, Instant.class)
                .setParameter("hostId", hostId)
                .setParameter("status", BookingStatus.PENDING_APPROVAL)
                .getResultList();
        return results.isEmpty() ? null : results.get(0);
    }

    public List<Booking> findRecentBookings(Long hostId, int limit) {
        String jpql = """
            SELECT b FROM Booking b
            WHERE b.listing.host.id = :hostId
            ORDER BY b.createdAt DESC
        """;
        return em.createQuery(jpql, Booking.class)
                .setParameter("hostId", hostId)
                .setMaxResults(limit)
                .getResultList();
    }

    public List<Booking> findOverlappingBookingsForHost(Long hostId, LocalDate from, LocalDate to) {
        String jpql = """
            SELECT b FROM Booking b
            WHERE b.listing.host.id = :hostId
              AND b.status IN (:statuses)
              AND b.checkIn < :to AND b.checkOut > :from
        """;
        return em.createQuery(jpql, Booking.class)
                .setParameter("hostId", hostId)
                .setParameter("statuses", List.of(BookingStatus.CONFIRMED, BookingStatus.COMPLETED))
                .setParameter("from", from)
                .setParameter("to", to)
                .getResultList();
    }
}
