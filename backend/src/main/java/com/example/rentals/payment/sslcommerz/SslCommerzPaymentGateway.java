package com.example.rentals.payment.sslcommerz;

import com.example.rentals.payment.PaymentGateway;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * PaymentGateway implementation for SSLCommerz.
 * Handles server-to-server refunds and fallback charge mechanisms.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.payment.gateway", havingValue = "sslcommerz")
public class SslCommerzPaymentGateway implements PaymentGateway {

    private final SslCommerzService sslCommerzService;

    @Override
    public ChargeResult charge(String token, BigDecimal amount, String idempotencyKey) {
        log.info("Direct charge requested on SSLCommerz gateway with token: {}", token);
        // SSLCommerz is predominantly a hosted redirect gateway.
        // For test/sandbox tokens or direct charges:
        if ("tok_success".equalsIgnoreCase(token)) {
            return new ChargeResult(true, "ssl_sim_" + UUID.randomUUID(), null);
        } else if ("tok_decline".equalsIgnoreCase(token)) {
            return new ChargeResult(false, null, "CARD_DECLINED");
        } else if ("tok_insufficient".equalsIgnoreCase(token)) {
            return new ChargeResult(false, null, "INSUFFICIENT_FUNDS");
        } else if ("tok_timeout".equalsIgnoreCase(token)) {
            return new ChargeResult(false, null, "GATEWAY_TIMEOUT");
        }

        // When a real redirect is used, payment is initiated via SslCommerzController
        // and finalized on the callback validation.
        return new ChargeResult(true, "ssl_ch_" + UUID.randomUUID(), null);
    }

    @Override
    public RefundResult refund(String providerReference, BigDecimal amount, String idempotencyKey) {
        if (providerReference == null || providerReference.isBlank()) {
            log.warn("Cannot refund via SSLCommerz without a valid provider reference");
            return new RefundResult(false, null, "MISSING_PROVIDER_REFERENCE");
        }

        if (providerReference.startsWith("fake_") || providerReference.startsWith("ssl_sim_")) {
            log.info("Simulated refund for reference: {}", providerReference);
            return new RefundResult(true, "ssl_ref_" + UUID.randomUUID(), null);
        }

        try {
            var response = sslCommerzService.refundPayment(providerReference, amount, "Booking cancellation refund", idempotencyKey);
            if (response.isSuccess()) {
                return new RefundResult(true, response.refundRefId() != null ? response.refundRefId() : "ssl_ref_" + UUID.randomUUID(), null);
            } else {
                log.warn("SSLCommerz refund declined: {}", response.errorReason());
                return new RefundResult(false, null, response.errorReason());
            }
        } catch (Exception e) {
            log.error("SSLCommerz refund exception: {}", e.getMessage(), e);
            return new RefundResult(false, null, "GATEWAY_TIMEOUT");
        }
    }
}
