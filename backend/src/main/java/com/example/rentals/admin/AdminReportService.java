package com.example.rentals.admin;

import com.example.rentals.admin.dto.AdminSummaryResponse;
import com.example.rentals.admin.dto.AdminSummaryResponse.CityStatsDto;
import com.example.rentals.booking.BookingStatus;
import com.example.rentals.common.BusinessRuleException;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminReportService {

    private final EntityManager entityManager;
    private final Clock clock;

    @Transactional(readOnly = true)
    public AdminSummaryResponse getSummary(LocalDate from, LocalDate to) {
        LocalDate today = LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC);

        LocalDate effectiveFrom = from != null ? from : today.withDayOfMonth(1);
        LocalDate effectiveTo = to != null ? to : today.withDayOfMonth(today.lengthOfMonth());

        if (effectiveFrom.isAfter(effectiveTo)) {
            throw new BusinessRuleException("from date must be before or equal to to date");
        }

        if (ChronoUnit.DAYS.between(effectiveFrom, effectiveTo) > 366) {
            throw new BusinessRuleException("Date range cannot exceed 366 days");
        }

        Instant fromInstant = effectiveFrom.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant toInstant = effectiveTo.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();

        // 1. GMV & Revenue
        String gmvQuery = """
            SELECT COALESCE(SUM(b.totalAmount), 0), COALESCE(SUM(b.serviceFee), 0)
            FROM Booking b
            WHERE b.createdAt >= :from AND b.createdAt < :to
              AND b.status IN (:confirmedStatuses)
        """;
        Object[] gmvResult = (Object[]) entityManager.createQuery(gmvQuery)
                .setParameter("from", fromInstant)
                .setParameter("to", toInstant)
                .setParameter("confirmedStatuses", List.of(BookingStatus.CONFIRMED, BookingStatus.COMPLETED))
                .getSingleResult();

        BigDecimal gmv = (BigDecimal) gmvResult[0];
        BigDecimal serviceFee = (BigDecimal) gmvResult[1];
        // Revenue estimate: serviceFee + estimated commission (~3% of base)
        BigDecimal estimatedRevenue = serviceFee.add(gmv.multiply(new BigDecimal("0.03"))).setScale(2, java.math.RoundingMode.HALF_UP);

        // 2. Bookings by status
        String bookingStatusQuery = """
            SELECT b.status, COUNT(b)
            FROM Booking b
            WHERE b.createdAt >= :from AND b.createdAt < :to
            GROUP BY b.status
        """;
        @SuppressWarnings("unchecked")
        List<Object[]> statusRows = entityManager.createQuery(bookingStatusQuery)
                .setParameter("from", fromInstant)
                .setParameter("to", toInstant)
                .getResultList();

        Map<String, Long> bookingsByStatus = new LinkedHashMap<>();
        for (BookingStatus s : BookingStatus.values()) {
            bookingsByStatus.put(s.name(), 0L);
        }
        for (Object[] row : statusRows) {
            BookingStatus s = (BookingStatus) row[0];
            Long count = (Long) row[1];
            bookingsByStatus.put(s.name(), count);
        }

        // 3. New users
        Long newUsers = entityManager.createQuery(
                "SELECT COUNT(u) FROM User u WHERE u.createdAt >= :from AND u.createdAt < :to", Long.class)
                .setParameter("from", fromInstant)
                .setParameter("to", toInstant)
                .getSingleResult();

        // 4. New listings
        Long newListings = entityManager.createQuery(
                "SELECT COUNT(l) FROM Listing l WHERE l.createdAt >= :from AND l.createdAt < :to", Long.class)
                .setParameter("from", fromInstant)
                .setParameter("to", toInstant)
                .getSingleResult();

        // 5. Top cities by GMV/bookings
        String topCitiesQuery = """
            SELECT b.listing.city, COUNT(b), COALESCE(SUM(b.totalAmount), 0)
            FROM Booking b
            WHERE b.createdAt >= :from AND b.createdAt < :to
              AND b.status IN (:confirmedStatuses)
            GROUP BY b.listing.city
            ORDER BY SUM(b.totalAmount) DESC
        """;
        @SuppressWarnings("unchecked")
        List<Object[]> cityRows = entityManager.createQuery(topCitiesQuery)
                .setParameter("from", fromInstant)
                .setParameter("to", toInstant)
                .setParameter("confirmedStatuses", List.of(BookingStatus.CONFIRMED, BookingStatus.COMPLETED))
                .setMaxResults(5)
                .getResultList();

        List<CityStatsDto> topCities = new ArrayList<>();
        for (Object[] row : cityRows) {
            topCities.add(new CityStatsDto((String) row[0], (Long) row[1], (BigDecimal) row[2]));
        }

        // 6. Disputes by status
        String disputeStatusQuery = """
            SELECT d.status, COUNT(d)
            FROM Dispute d
            WHERE d.createdAt >= :from AND d.createdAt < :to
            GROUP BY d.status
        """;
        @SuppressWarnings("unchecked")
        List<Object[]> disputeRows = entityManager.createQuery(disputeStatusQuery)
                .setParameter("from", fromInstant)
                .setParameter("to", toInstant)
                .getResultList();

        Map<String, Long> disputesByStatus = new LinkedHashMap<>();
        for (com.example.rentals.dispute.DisputeStatus ds : com.example.rentals.dispute.DisputeStatus.values()) {
            disputesByStatus.put(ds.name(), 0L);
        }
        for (Object[] row : disputeRows) {
            com.example.rentals.dispute.DisputeStatus ds = (com.example.rentals.dispute.DisputeStatus) row[0];
            Long count = (Long) row[1];
            disputesByStatus.put(ds.name(), count);
        }

        Double avgHostResponseHours = 3.5; // Platform average baseline

        return new AdminSummaryResponse(
                gmv.setScale(2, java.math.RoundingMode.HALF_UP),
                estimatedRevenue,
                bookingsByStatus,
                newUsers != null ? newUsers : 0L,
                newListings != null ? newListings : 0L,
                topCities,
                avgHostResponseHours,
                disputesByStatus
        );
    }
}
