package com.example.rentals.booking;

import java.math.BigDecimal;
import java.time.Instant;

public interface CancellationPolicy {
    BigDecimal calculateRefund(Booking booking, Instant now);
}
