package com.example.rentals.booking;

import com.example.rentals.listing.CancellationPolicyType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

class CancellationPolicyTest {

    private Booking booking;
    private Instant checkInInstant;

    @BeforeEach
    void setUp() {
        LocalDate checkIn = LocalDate.of(2026, 12, 1);
        LocalDate checkOut = LocalDate.of(2026, 12, 5); // 4 nights
        LocalTime checkInTime = LocalTime.of(15, 0);

        checkInInstant = checkIn.atTime(checkInTime).atZone(ZoneId.of("America/New_York")).toInstant();

        booking = new Booking();
        booking.setCheckIn(checkIn);
        booking.setCheckOut(checkOut);
        booking.setNights(4);
        booking.setListingTimezone("America/New_York");
        booking.setCheckInTime(checkInTime);
        booking.setCheckOutTime(LocalTime.of(11, 0));

        // totalAmount = 1000.00, serviceFee = 100.00 -> A = 900.00
        booking.setNightlySubtotal(new BigDecimal("800.00"));
        booking.setCleaningFee(new BigDecimal("50.00"));
        booking.setServiceFee(new BigDecimal("100.00"));
        booking.setTaxTotal(new BigDecimal("50.00"));
        booking.setTotalAmount(new BigDecimal("1000.00"));
    }

    @Test
    @DisplayName("FlexiblePolicy: >= 24h gives 100% full refund of totalAmount")
    void testFlexiblePolicyFullRefund() {
        FlexiblePolicy policy = new FlexiblePolicy();
        booking.setCancellationPolicy(CancellationPolicyType.FLEXIBLE);

        // Exactly 24 hours before check-in
        Instant now = checkInInstant.minus(24, ChronoUnit.HOURS);
        BigDecimal refund = policy.calculateRefund(booking, now);

        assertThat(refund).isEqualByComparingTo(new BigDecimal("1000.00"));
    }

    @Test
    @DisplayName("FlexiblePolicy: < 24h gives A - round(A / nights) (first night kept)")
    void testFlexiblePolicyUnder24Hours() {
        FlexiblePolicy policy = new FlexiblePolicy();
        booking.setCancellationPolicy(CancellationPolicyType.FLEXIBLE);

        // 23 hours 59 minutes before check-in
        Instant now = checkInInstant.minus(23, ChronoUnit.HOURS).minus(59, ChronoUnit.MINUTES);
        BigDecimal refund = policy.calculateRefund(booking, now);

        // A = 1000 - 100 = 900. nights = 4. 900 / 4 = 225.00. Refund = 900 - 225 = 675.00
        assertThat(refund).isEqualByComparingTo(new BigDecimal("675.00"));
    }

    @Test
    @DisplayName("ModeratePolicy: >= 120h gives 100% refund, 24h-120h gives 50% of A, < 24h gives 0")
    void testModeratePolicyBoundaries() {
        ModeratePolicy policy = new ModeratePolicy();
        booking.setCancellationPolicy(CancellationPolicyType.MODERATE);

        // >= 120h (exactly 5 days before)
        Instant now120h = checkInInstant.minus(120, ChronoUnit.HOURS);
        assertThat(policy.calculateRefund(booking, now120h)).isEqualByComparingTo(new BigDecimal("1000.00"));

        // Between 24h and 120h (e.g. 72h before) -> round(A * 0.50) = 900 * 0.50 = 450.00
        Instant now72h = checkInInstant.minus(72, ChronoUnit.HOURS);
        assertThat(policy.calculateRefund(booking, now72h)).isEqualByComparingTo(new BigDecimal("450.00"));

        // < 24h (e.g. 10h before) -> 0
        Instant now10h = checkInInstant.minus(10, ChronoUnit.HOURS);
        assertThat(policy.calculateRefund(booking, now10h)).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    @DisplayName("StrictPolicy: >= 168h (7 days) gives 50% of A, < 168h gives 0")
    void testStrictPolicyBoundaries() {
        StrictPolicy policy = new StrictPolicy();
        booking.setCancellationPolicy(CancellationPolicyType.STRICT);

        // Exactly 168 hours before
        Instant now168h = checkInInstant.minus(168, ChronoUnit.HOURS);
        assertThat(policy.calculateRefund(booking, now168h)).isEqualByComparingTo(new BigDecimal("450.00"));

        // 167 hours before -> 0
        Instant now167h = checkInInstant.minus(167, ChronoUnit.HOURS);
        assertThat(policy.calculateRefund(booking, now167h)).isEqualByComparingTo(BigDecimal.ZERO);
    }
}
