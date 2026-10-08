package com.example.rentals.payment.dto;

import com.example.rentals.common.MoneyUtils;
import com.example.rentals.payment.Payment;
import com.example.rentals.payment.PaymentStatus;

import java.math.BigDecimal;
import java.util.List;

public record PaymentResponse(
        Long id,
        Long bookingId,
        BigDecimal amount,
        PaymentStatus status,
        String failureCode,
        BigDecimal refundedTotal,
        BigDecimal refundableAmount,
        List<RefundResponse> refunds
) {
    public static PaymentResponse from(Payment payment, List<RefundResponse> refunds) {
        BigDecimal refundable = MoneyUtils.round(payment.getAmount().subtract(payment.getRefundedTotal()).max(BigDecimal.ZERO));
        return new PaymentResponse(
                payment.getId(),
                payment.getBooking().getId(),
                payment.getAmount(),
                payment.getStatus(),
                payment.getFailureCode(),
                payment.getRefundedTotal(),
                refundable,
                refunds != null ? refunds : List.of()
        );
    }
}
