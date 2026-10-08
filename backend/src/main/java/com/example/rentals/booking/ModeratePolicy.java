package com.example.rentals.booking;

import com.example.rentals.common.MoneyUtils;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;

@Component("MODERATE")
public class ModeratePolicy implements CancellationPolicy {

    @Override
    public BigDecimal calculateRefund(Booking booking, Instant now) {
        ZoneId zoneId = ZoneId.of(booking.getListingTimezone());
        ZonedDateTime checkInZoned = booking.getCheckIn().atTime(booking.getCheckInTime()).atZone(zoneId);
        Instant checkInInstant = checkInZoned.toInstant();

        if (!now.isBefore(checkInInstant)) {
            return MoneyUtils.ZERO;
        }

        Duration duration = Duration.between(now, checkInInstant);
        long hoursBefore = duration.toHours();

        if (hoursBefore >= 120) {
            return MoneyUtils.round(booking.getTotalAmount());
        } else if (hoursBefore >= 24) {
            BigDecimal a = booking.getTotalAmount().subtract(booking.getServiceFee());
            return MoneyUtils.percentage(a, new BigDecimal("50.00"));
        } else {
            return MoneyUtils.ZERO;
        }
    }
}
