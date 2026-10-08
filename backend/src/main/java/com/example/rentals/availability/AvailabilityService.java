package com.example.rentals.availability;

import com.example.rentals.availability.dto.*;
import com.example.rentals.common.*;
import com.example.rentals.listing.Listing;
import com.example.rentals.listing.ListingRepository;
import com.example.rentals.listing.ListingStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class AvailabilityService {

    private final ListingRepository listingRepository;
    private final AvailabilityBlockRepository blockRepository;
    private final Clock clock;
    private final CacheManager cacheManager;

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional(readOnly = true)
    public void checkAvailability(Long listingId, LocalDate checkIn, LocalDate checkOut, int guests) {
        Listing listing = listingRepository.findById(listingId)
                .filter(l -> l.getStatus() != ListingStatus.DELETED)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));

        // 1. checkIn < checkOut and nights <= 365 -> else 400 INVALID_DATE_RANGE
        if (checkIn == null || checkOut == null || !checkIn.isBefore(checkOut)) {
            throw new ApiException(ErrorCode.INVALID_DATE_RANGE, "Check-in date must be strictly before check-out date");
        }
        long nights = ChronoUnit.DAYS.between(checkIn, checkOut);
        if (nights <= 0 || nights > 365) {
            throw new ApiException(ErrorCode.INVALID_DATE_RANGE, "Stay length must be between 1 and 365 nights");
        }

        ZoneId zoneId = ZoneId.of(listing.getTimezone());
        ZonedDateTime nowZoned = clock.instant().atZone(zoneId);
        LocalDate todayInTz = nowZoned.toLocalDate();
        LocalTime nowTimeInTz = nowZoned.toLocalTime();

        // 2. Advance notice
        if (checkIn.isBefore(todayInTz)) {
            throw new BusinessRuleException("Check-in date cannot be in the past");
        }
        if (checkIn.isBefore(todayInTz.plusDays(listing.getAdvanceNoticeDays()))) {
            throw new BusinessRuleException("Check-in date violates the required advance notice of " + listing.getAdvanceNoticeDays() + " days");
        }
        if (listing.getAdvanceNoticeDays() == 0 && checkIn.isEqual(todayInTz) && nowTimeInTz.isAfter(listing.getCheckInTime())) {
            throw new BusinessRuleException("Same-day check-in is not allowed after " + listing.getCheckInTime());
        }

        // 3. Booking window
        if (checkOut.isAfter(todayInTz.plusDays(listing.getBookingWindowDays()))) {
            throw new BusinessRuleException("Check-out date is outside the booking window of " + listing.getBookingWindowDays() + " days");
        }

        // 4. Guests count
        if (guests < 1 || guests > listing.getMaxGuests()) {
            throw new BusinessRuleException("Guest count must be between 1 and " + listing.getMaxGuests());
        }

        // 5. Min and max nights
        if (nights < listing.getMinNights() || nights > listing.getMaxNights()) {
            throw new BusinessRuleException("Stay of " + nights + " nights is outside allowed range of " +
                    listing.getMinNights() + " to " + listing.getMaxNights() + " nights");
        }

        // 6. Overlap with block
        if (blockRepository.existsByListingIdAndStartDateLessThanAndEndDateGreaterThan(listingId, checkOut, checkIn)) {
            throw new ConflictException(ErrorCode.BOOKING_CONFLICT, "The requested dates conflict with blocked host dates");
        }

        // 7. Overlap with active booking
        boolean bookingOverlap = hasActiveBookingOverlap(listingId, checkIn, checkOut);
        if (bookingOverlap) {
            throw new ConflictException(ErrorCode.BOOKING_CONFLICT, "The requested dates are not available");
        }
    }

    public boolean hasActiveBookingOverlap(Long listingId, LocalDate checkIn, LocalDate checkOut) {
        Number count = (Number) entityManager.createNativeQuery("""
            SELECT COUNT(*) FROM bookings b
            WHERE b.listing_id = :listingId
              AND b.status IN ('PENDING_PAYMENT', 'PENDING_APPROVAL', 'CONFIRMED')
              AND b.check_in < :checkOut
              AND b.check_out > :checkIn
        """)
        .setParameter("listingId", listingId)
        .setParameter("checkIn", checkIn)
        .setParameter("checkOut", checkOut)
        .getSingleResult();

        return count != null && count.longValue() > 0;
    }

    @Transactional(readOnly = true)
    public CalendarResponse getCalendar(Long listingId, LocalDate from, LocalDate to) {
        Listing listing = listingRepository.findById(listingId)
                .filter(l -> l.getStatus() != ListingStatus.DELETED)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));

        if (from == null || to == null || from.isAfter(to)) {
            throw new ApiException(ErrorCode.INVALID_DATE_RANGE, "Invalid calendar date range: 'from' must be <= 'to'");
        }

        long daysCount = ChronoUnit.DAYS.between(from, to) + 1;
        if (daysCount > 366) {
            throw new ApiException(ErrorCode.INVALID_DATE_RANGE, "Calendar range cannot exceed 366 days");
        }

        ZoneId zoneId = ZoneId.of(listing.getTimezone());
        ZonedDateTime nowZoned = clock.instant().atZone(zoneId);
        LocalDate todayInTz = nowZoned.toLocalDate();

        if (from.isBefore(todayInTz.minusYears(1))) {
            throw new ApiException(ErrorCode.INVALID_DATE_RANGE, "'from' date cannot be more than 1 year in the past");
        }

        List<AvailabilityBlock> blocks = blockRepository.findOverlappingBlocks(listingId, from, to.plusDays(1));

        @SuppressWarnings("unchecked")
        List<Object[]> bookedRanges = entityManager.createNativeQuery("""
            SELECT check_in, check_out FROM bookings
            WHERE listing_id = :listingId
              AND status IN ('PENDING_PAYMENT', 'PENDING_APPROVAL', 'CONFIRMED')
              AND check_in < :toExclusive
              AND check_out > :from
        """)
        .setParameter("listingId", listingId)
        .setParameter("from", from)
        .setParameter("toExclusive", to.plusDays(1))
        .getResultList();

        List<CalendarDayResponse> days = new ArrayList<>();
        LocalDate cur = from;
        while (!cur.isAfter(to)) {
            CalendarUnavailableReason reason = null;
            boolean available = true;

            if (cur.isBefore(todayInTz)) {
                available = false;
                reason = CalendarUnavailableReason.PAST;
            } else if (cur.isAfter(todayInTz.plusDays(listing.getBookingWindowDays()))) {
                available = false;
                reason = CalendarUnavailableReason.OUTSIDE_WINDOW;
            } else {
                // Check block
                final LocalDate d = cur;
                boolean isBlocked = blocks.stream().anyMatch(b -> !d.isBefore(b.getStartDate()) && d.isBefore(b.getEndDate()));
                if (isBlocked) {
                    available = false;
                    reason = CalendarUnavailableReason.BLOCKED;
                } else {
                    boolean isBooked = bookedRanges.stream().anyMatch(r -> {
                        LocalDate bIn = ((java.sql.Date) r[0]).toLocalDate();
                        LocalDate bOut = ((java.sql.Date) r[1]).toLocalDate();
                        return !d.isBefore(bIn) && d.isBefore(bOut);
                    });
                    if (isBooked) {
                        available = false;
                        reason = CalendarUnavailableReason.BOOKED;
                    }
                }
            }

            days.add(new CalendarDayResponse(cur, available, reason, listing.getBaseNightlyPrice()));
            cur = cur.plusDays(1);
        }

        return new CalendarResponse(listingId, from, to, days);
    }

    @Transactional(readOnly = true)
    public List<BlockResponse> listBlocks(Long hostId, Long listingId) {
        findHostListing(hostId, listingId);
        return blockRepository.findByListingIdOrderByStartDateAsc(listingId)
                .stream()
                .map(BlockResponse::from)
                .toList();
    }

    @Transactional
    public BlockResponse createBlock(Long hostId, Long listingId, BlockRequest req) {
        // Lock listing row
        Listing listing = listingRepository.findByIdForUpdate(listingId)
                .filter(l -> l.getStatus() != ListingStatus.DELETED)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));

        if (!listing.getHost().getId().equals(hostId)) {
            throw new ResourceNotFoundException("Listing not found");
        }

        if (req.startDate() == null || req.endDate() == null || !req.startDate().isBefore(req.endDate())) {
            throw new ApiException(ErrorCode.INVALID_DATE_RANGE, "Start date must be strictly before end date");
        }

        ZoneId zoneId = ZoneId.of(listing.getTimezone());
        LocalDate today = clock.instant().atZone(zoneId).toLocalDate();
        if (req.startDate().isBefore(today)) {
            throw new BusinessRuleException("Block start date cannot be in the past");
        }

        long length = ChronoUnit.DAYS.between(req.startDate(), req.endDate());
        if (length > 730) {
            throw new BusinessRuleException("A block cannot exceed 730 days");
        }

        if (blockRepository.existsByListingIdAndStartDateLessThanAndEndDateGreaterThan(listingId, req.endDate(), req.startDate())) {
            throw new ConflictException("Dates conflict with an existing block");
        }

        if (hasActiveBookingOverlap(listingId, req.startDate(), req.endDate())) {
            throw new ConflictException(ErrorCode.BOOKING_CONFLICT, "Cannot block dates that contain an active booking");
        }

        AvailabilityBlock block = new AvailabilityBlock(listing, req.startDate(), req.endDate(), req.reason());
        block = blockRepository.save(block);

        var searchCache = cacheManager.getCache(CacheConfig.CACHE_SEARCH_RESULTS);
        if (searchCache != null) searchCache.clear();

        return BlockResponse.from(block);
    }

    @Transactional
    public void deleteBlock(Long hostId, Long listingId, Long blockId) {
        findHostListing(hostId, listingId);
        AvailabilityBlock block = blockRepository.findById(blockId)
                .filter(b -> b.getListing().getId().equals(listingId))
                .orElseThrow(() -> new ResourceNotFoundException("Block not found"));

        blockRepository.delete(block);

        var searchCache = cacheManager.getCache(CacheConfig.CACHE_SEARCH_RESULTS);
        if (searchCache != null) searchCache.clear();
    }

    private Listing findHostListing(Long hostId, Long listingId) {
        return listingRepository.findByIdAndHostId(listingId, hostId)
                .filter(l -> l.getStatus() != ListingStatus.DELETED)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));
    }
}
