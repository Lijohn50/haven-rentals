package com.example.rentals.availability;

import com.example.rentals.availability.dto.BlockRequest;
import com.example.rentals.common.BusinessRuleException;
import com.example.rentals.common.ConflictException;
import com.example.rentals.common.ErrorCode;
import com.example.rentals.listing.Listing;
import com.example.rentals.listing.ListingRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.*;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AvailabilityServiceTest {

    @Mock
    private AvailabilityBlockRepository blockRepository;

    @Mock
    private ListingRepository listingRepository;

    @Mock
    private EntityManager entityManager;

    @Mock
    private Clock clock;

    @InjectMocks
    private AvailabilityService availabilityService;

    private Listing listing;
    private Instant fixedInstant;

    @BeforeEach
    void setUp() {
        fixedInstant = Instant.parse("2026-10-01T12:00:00Z");
        lenient().when(clock.instant()).thenReturn(fixedInstant);

        listing = new Listing();
        listing.setId(1L);
        listing.setTimezone("America/New_York");
        listing.setMinNights(2);
        listing.setMaxNights(14);
        listing.setAdvanceNoticeDays(1);
        listing.setBookingWindowDays(90);
    }

    @Test
    @DisplayName("checkAvailability rejects checkIn in the past")
    void testCheckInInPastRejected() {
        LocalDate pastCheckIn = LocalDate.of(2026, 9, 30);
        LocalDate checkOut = LocalDate.of(2026, 10, 5);

        assertThatThrownBy(() -> availabilityService.checkAvailability(listing.getId(), pastCheckIn, checkOut, 2))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("cannot be in the past");
    }

    @Test
    @DisplayName("checkAvailability rejects stay shorter than minNights")
    void testShorterThanMinNightsRejected() {
        // minNights is 2, stay is 1 night
        LocalDate checkIn = LocalDate.of(2026, 10, 10);
        LocalDate checkOut = LocalDate.of(2026, 10, 11);

        assertThatThrownBy(() -> availabilityService.checkAvailability(listing.getId(), checkIn, checkOut, 2))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("Minimum stay");
    }

    @Test
    @DisplayName("checkAvailability rejects stay longer than maxNights")
    void testLongerThanMaxNightsRejected() {
        // maxNights is 14, stay is 15 nights
        LocalDate checkIn = LocalDate.of(2026, 10, 10);
        LocalDate checkOut = LocalDate.of(2026, 10, 25);

        assertThatThrownBy(() -> availabilityService.checkAvailability(listing.getId(), checkIn, checkOut, 2))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("Maximum stay");
    }

    @Test
    @DisplayName("checkAvailability throws ConflictException when overlapping availability block exists")
    void testOverlappingBlockConflict() {
        LocalDate checkIn = LocalDate.of(2026, 10, 10);
        LocalDate checkOut = LocalDate.of(2026, 10, 15);

        when(blockRepository.findOverlappingBlocks(listing.getId(), checkIn, checkOut))
                .thenReturn(List.of(new AvailabilityBlock(listing, checkIn, checkOut, "Blocked")));

        assertThatThrownBy(() -> availabilityService.checkAvailability(listing.getId(), checkIn, checkOut, 2))
                .isInstanceOf(ConflictException.class)
                .satisfies(e -> {
                    ConflictException ce = (ConflictException) e;
                    org.assertj.core.api.Assertions.assertThat(ce.getErrorCode()).isEqualTo(ErrorCode.BOOKING_CONFLICT);
                });
    }

    @Test
    @DisplayName("createBlock rejects block in the past")
    void testCreateBlockInPast() {
        when(listingRepository.findByIdAndHostId(1L, 10L)).thenReturn(Optional.of(listing));

        BlockRequest req = new BlockRequest(
                LocalDate.of(2026, 9, 1),
                LocalDate.of(2026, 9, 5),
                "Past block"
        );

        assertThatThrownBy(() -> availabilityService.createBlock(10L, 1L, req))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("cannot start in the past");
    }
}
