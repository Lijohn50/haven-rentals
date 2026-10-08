package com.example.rentals.payment.dto;

import com.example.rentals.payment.Payout;
import com.example.rentals.payment.PayoutStatus;

import java.math.BigDecimal;
import java.time.Instant;

public record PayoutResponse(
        Long id,
        Long hostId,
        Long bookingId,
        BigDecimal amount,
        PayoutStatus status,
        Instant scheduledFor,
        Instant paidAt
) {
    public static PayoutResponse from(Payout payout) {
        return new PayoutResponse(
                payout.getId(),
                payout.getHost().getId(),
                payout.getBooking().getId(),
                payout.getAmount(),
                payout.getStatus(),
                payout.getScheduledFor(),
                payout.getPaidAt()
        );
    }
}
