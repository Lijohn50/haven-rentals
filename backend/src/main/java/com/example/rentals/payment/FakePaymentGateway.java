package com.example.rentals.payment;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@ConditionalOnProperty(name = "app.payment.gateway", havingValue = "fake", matchIfMissing = true)
public class FakePaymentGateway implements PaymentGateway {

    private final Map<String, ChargeResult> chargeIdempotencyCache = new ConcurrentHashMap<>();
    private final Map<String, RefundResult> refundIdempotencyCache = new ConcurrentHashMap<>();
    private final Map<String, Boolean> flakyAttempts = new ConcurrentHashMap<>();

    @Override
    public ChargeResult charge(String token, BigDecimal amount, String idempotencyKey) {
        if (idempotencyKey != null && chargeIdempotencyCache.containsKey(idempotencyKey)) {
            log.info("Returning cached charge result for idempotency key: {}", idempotencyKey);
            return chargeIdempotencyCache.get(idempotencyKey);
        }

        ChargeResult result;
        if ("tok_success".equalsIgnoreCase(token)) {
            result = new ChargeResult(true, "fake_ch_" + UUID.randomUUID(), null);
        } else if ("tok_decline".equalsIgnoreCase(token)) {
            result = new ChargeResult(false, null, "CARD_DECLINED");
        } else if ("tok_insufficient".equalsIgnoreCase(token)) {
            result = new ChargeResult(false, null, "INSUFFICIENT_FUNDS");
        } else if ("tok_timeout".equalsIgnoreCase(token)) {
            result = new ChargeResult(false, null, "GATEWAY_TIMEOUT");
        } else if ("tok_flaky".equalsIgnoreCase(token)) {
            if (flakyAttempts.putIfAbsent(idempotencyKey != null ? idempotencyKey : token, Boolean.TRUE) == null) {
                result = new ChargeResult(false, null, "GATEWAY_TIMEOUT");
            } else {
                result = new ChargeResult(true, "fake_ch_" + UUID.randomUUID(), null);
            }
        } else {
            result = new ChargeResult(false, null, "CARD_DECLINED");
        }

        if (idempotencyKey != null) {
            chargeIdempotencyCache.put(idempotencyKey, result);
        }
        return result;
    }

    @Override
    public RefundResult refund(String providerReference, BigDecimal amount, String idempotencyKey) {
        if (idempotencyKey != null && refundIdempotencyCache.containsKey(idempotencyKey)) {
            return refundIdempotencyCache.get(idempotencyKey);
        }

        RefundResult result = new RefundResult(true, "fake_ref_" + UUID.randomUUID(), null);
        if (idempotencyKey != null) {
            refundIdempotencyCache.put(idempotencyKey, result);
        }
        return result;
    }
}
