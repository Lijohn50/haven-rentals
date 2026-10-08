package com.example.rentals.booking;

import com.example.rentals.common.MoneyUtils;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;

@Component("FLEXIBLE")
public class FlexiblePolicy implements CancellationPolicy {

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

        if (hoursBefore >= 24) {
            // 100% of total_amount
            return MoneyUtils.round(booking.getTotalAmount());
        } else {
            // A - round(A / nights)
            BigDecimal a = booking.getTotalAmount().subtract(booking.getServiceFee());
            BigDecimal firstNight = MoneyUtils.divide(a, BigDecimal.valueOf(booking.getNights()));
            BigDecimal refund = a.subtract(firstNight);
            return MoneyUtils.round(refund.max(MoneyUtils.ZERO));
        }
    }
}
