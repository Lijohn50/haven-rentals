package com.example.rentals.payment;

import java.math.BigDecimal;

public interface PaymentGateway {

    record ChargeResult(boolean success, String providerReference, String failureCode) {}
    record RefundResult(boolean success, String providerReference, String failureCode) {}

    ChargeResult charge(String token, BigDecimal amount, String idempotencyKey);
    RefundResult refund(String providerReference, BigDecimal amount, String idempotencyKey);
}
