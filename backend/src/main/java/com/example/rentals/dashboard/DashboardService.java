package com.example.rentals.dashboard;

import com.example.rentals.availability.AvailabilityBlock;
import com.example.rentals.availability.AvailabilityBlockRepository;
import com.example.rentals.booking.Booking;
import com.example.rentals.booking.BookingRepository;
import com.example.rentals.booking.BookingStatus;
import com.example.rentals.booking.dto.BookingResponse;
import com.example.rentals.common.BusinessRuleException;
import com.example.rentals.common.MoneyUtils;
import com.example.rentals.dashboard.dto.EarningsResponse;
import com.example.rentals.dashboard.dto.HostDashboardResponse;
import com.example.rentals.dashboard.dto.ListingMetricsResponse;
import com.example.rentals.dashboard.dto.MyTripsResponse;
import com.example.rentals.listing.Listing;
import com.example.rentals.listing.ListingPhoto;
import com.example.rentals.listing.ListingRepository;
import com.example.rentals.listing.ListingStatus;
import com.example.rentals.listing.dto.PhotoResponse;
import com.example.rentals.payment.PayoutStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class DashboardService {

    private final DashboardRepository dashboardRepository;
    private final BookingRepository bookingRepository;
    private final ListingRepository listingRepository;
    private final AvailabilityBlockRepository availabilityBlockRepository;
    private final Clock clock;

    @Transactional(readOnly = true)
    @Cacheable(value = "hostDashboard", key = "#hostId + '_' + #from + '_' + #to")
    public HostDashboardResponse getHostDashboard(Long hostId, LocalDate from, LocalDate to) {
        LocalDate today = LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC);
        LocalDate effectiveFrom = from != null ? from : today.withDayOfMonth(1);
        LocalDate effectiveTo = to != null ? to : today.withDayOfMonth(today.lengthOfMonth());

        validateDateRange(effectiveFrom, effectiveTo, today);

        // 1. Earnings
        Instant startOfMonth = today.withDayOfMonth(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        BigDecimal paidTotal = dashboardRepository.sumPayoutsByStatus(hostId, PayoutStatus.PAID);
        BigDecimal pendingTotal = dashboardRepository.sumPayoutsByStatus(hostId, PayoutStatus.SCHEDULED);
        BigDecimal heldTotal = dashboardRepository.sumPayoutsByStatus(hostId, PayoutStatus.HELD);
        BigDecimal thisMonthPaid = dashboardRepository.sumPayoutsPaidSince(hostId, startOfMonth);

        EarningsResponse earnings = new EarningsResponse(paidTotal, pendingTotal, heldTotal, thisMonthPaid);

        // 2. Listing Metrics
        List<ListingMetricsResponse> listingMetrics = computeListingMetrics(hostId, effectiveFrom, effectiveTo);

        // 3. Overall Occupancy
        long totalBookedNights = 0;
        long totalAvailableNights = 0;
        BigDecimal sumRatings = BigDecimal.ZERO;
        int ratedListingsCount = 0;

        for (ListingMetricsResponse lm : listingMetrics) {
            totalBookedNights += lm.bookedNights();
            long available = (ChronoUnit.DAYS.between(effectiveFrom, effectiveTo)) - lm.blockedNights();
            if (available > 0) {
                totalAvailableNights += available;
            }
            if (lm.averageRating() != null && lm.averageRating().compareTo(BigDecimal.ZERO) > 0) {
                sumRatings = sumRatings.add(lm.averageRating());
                ratedListingsCount++;
            }
        }

        BigDecimal overallOccupancy = BigDecimal.ZERO;
        if (totalAvailableNights > 0) {
            overallOccupancy = BigDecimal.valueOf(totalBookedNights)
                    .multiply(BigDecimal.valueOf(100))
                    .divide(BigDecimal.valueOf(totalAvailableNights), 1, RoundingMode.HALF_UP);
            if (overallOccupancy.compareTo(BigDecimal.valueOf(100.0)) > 0) {
                overallOccupancy = BigDecimal.valueOf(100.0);
            }
        }

        BigDecimal avgRating = ratedListingsCount > 0
                ? sumRatings.divide(BigDecimal.valueOf(ratedListingsCount), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // 4. Upcoming check-ins and pending requests
        long upcomingCheckIns = dashboardRepository.countUpcomingCheckIns(hostId, today, today.plusDays(7));
        long pendingRequests = dashboardRepository.countPendingRequests(hostId);
        Instant oldestPendingExpiry = dashboardRepository.findOldestPendingExpiry(hostId);

        // 5. Recent Bookings
        List<Booking> recentBookingEntities = dashboardRepository.findRecentBookings(hostId, 5);
        List<BookingResponse> recentBookings = recentBookingEntities.stream()
                .map(b -> BookingResponse.from(b, hostId))
                .toList();

        return new HostDashboardResponse(
                effectiveFrom,
                effectiveTo,
                earnings,
                overallOccupancy,
                upcomingCheckIns,
                pendingRequests,
                oldestPendingExpiry,
                recentBookings,
                avgRating,
                listingMetrics
        );
    }

    @Transactional(readOnly = true)
    public List<ListingMetricsResponse> getHostListingMetrics(Long hostId, LocalDate from, LocalDate to) {
        LocalDate today = LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC);
        LocalDate effectiveFrom = from != null ? from : today.withDayOfMonth(1);
        LocalDate effectiveTo = to != null ? to : today.withDayOfMonth(today.lengthOfMonth());

        validateDateRange(effectiveFrom, effectiveTo, today);
        return computeListingMetrics(hostId, effectiveFrom, effectiveTo);
    }

    @Transactional(readOnly = true)
    public MyTripsResponse getMyTrips(Long userId) {
        LocalDate today = LocalDate.ofInstant(clock.instant(), ZoneOffset.UTC);
        List<Booking> userBookings = bookingRepository.findByGuestIdOrderByCreatedAtDesc(userId, Pageable.unpaged()).getContent();

        List<BookingResponse> upcoming = new ArrayList<>();
        List<BookingResponse> past = new ArrayList<>();
        List<BookingResponse> cancelled = new ArrayList<>();

        for (Booking b : userBookings) {
            BookingResponse res = BookingResponse.from(b, userId);
            BookingStatus s = b.getStatus();

            if (s == BookingStatus.COMPLETED) {
                past.add(res);
            } else if (b.isCancelled() || s == BookingStatus.DECLINED || s == BookingStatus.EXPIRED || s == BookingStatus.PAYMENT_FAILED) {
                cancelled.add(res);
            } else if (!b.getCheckOut().isBefore(today)) {
                upcoming.add(res);
            } else {
                past.add(res);
            }
        }

        return new MyTripsResponse(upcoming, past, cancelled);
    }

    private List<ListingMetricsResponse> computeListingMetrics(Long hostId, LocalDate from, LocalDate to) {
        List<Listing> listings = listingRepository.findByHostIdAndStatusNot(hostId, ListingStatus.DELETED, Pageable.unpaged()).getContent();
        List<Booking> overlappingBookings = dashboardRepository.findOverlappingBookingsForHost(hostId, from, to);

        long rangeNights = Math.max(1, ChronoUnit.DAYS.between(from, to));
        List<ListingMetricsResponse> metrics = new ArrayList<>();

        for (Listing l : listings) {
            long bookedNights = 0;
            BigDecimal revenue = BigDecimal.ZERO;
            long bookingCount = 0;

            for (Booking b : overlappingBookings) {
                if (b.getListing().getId().equals(l.getId())) {
                    LocalDate clipStart = b.getCheckIn().isBefore(from) ? from : b.getCheckIn();
                    LocalDate clipEnd = b.getCheckOut().isAfter(to) ? to : b.getCheckOut();
                    long nights = Math.max(0, ChronoUnit.DAYS.between(clipStart, clipEnd));

                    if (nights > 0) {
                        bookedNights += nights;
                        bookingCount++;
                        // Fractional revenue based on clipped nights
                        if (b.getNights() > 0 && b.getHostPayoutAmount() != null) {
                            BigDecimal nightlyPayout = b.getHostPayoutAmount().divide(BigDecimal.valueOf(b.getNights()), 4, RoundingMode.HALF_UP);
                            revenue = revenue.add(nightlyPayout.multiply(BigDecimal.valueOf(nights)));
                        }
                    }
                }
            }

            // Blocked nights
            List<AvailabilityBlock> blocks = availabilityBlockRepository.findOverlappingBlocks(l.getId(), from, to);
            long blockedNights = 0;
            for (AvailabilityBlock ab : blocks) {
                LocalDate clipStart = ab.getStartDate().isBefore(from) ? from : ab.getStartDate();
                LocalDate clipEnd = ab.getEndDate().isAfter(to) ? to : ab.getEndDate();
                blockedNights += Math.max(0, ChronoUnit.DAYS.between(clipStart, clipEnd));
            }

            long denominator = rangeNights - blockedNights;
            BigDecimal occupancyRate = BigDecimal.ZERO;
            if (denominator > 0) {
                occupancyRate = BigDecimal.valueOf(bookedNights)
                        .multiply(BigDecimal.valueOf(100))
                        .divide(BigDecimal.valueOf(denominator), 1, RoundingMode.HALF_UP);
                if (occupancyRate.compareTo(BigDecimal.valueOf(100.0)) > 0) {
                    occupancyRate = BigDecimal.valueOf(100.0);
                }
            }

            String coverPhoto = l.getPhotos().isEmpty() ? null : PhotoResponse.from(l.getPhotos().get(0)).url();

            metrics.add(new ListingMetricsResponse(
                    l.getId(),
                    l.getTitle(),
                    coverPhoto,
                    bookingCount,
                    bookedNights,
                    blockedNights,
                    occupancyRate,
                    MoneyUtils.round(revenue),
                    l.getAverageRating()
            ));
        }

        return metrics;
    }

    private void validateDateRange(LocalDate from, LocalDate to, LocalDate today) {
        if (from.isAfter(to)) {
            throw new BusinessRuleException("from date must be before or equal to to date");
        }
        if (ChronoUnit.DAYS.between(from, to) > 366) {
            throw new BusinessRuleException("Date range cannot exceed 366 days");
        }
        if (from.isBefore(today.minusYears(5))) {
            throw new BusinessRuleException("Date cannot be more than 5 years in the past");
        }
    }
}
