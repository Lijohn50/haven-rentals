package com.example.rentals.payment.dto;

import com.example.rentals.payment.Refund;
import com.example.rentals.payment.RefundReason;
import com.example.rentals.payment.RefundStatus;

import java.math.BigDecimal;
import java.time.Instant;

public record RefundResponse(
        Long id,
        Long paymentId,
        Long bookingId,
        BigDecimal amount,
        RefundReason reason,
        RefundStatus status,
        Instant createdAt
) {
    public static RefundResponse from(Refund refund) {
        return new RefundResponse(
                refund.getId(),
                refund.getPayment().getId(),
                refund.getBooking().getId(),
                refund.getAmount(),
                refund.getReason(),
                refund.getStatus(),
                refund.getCreatedAt()
        );
    }
}
