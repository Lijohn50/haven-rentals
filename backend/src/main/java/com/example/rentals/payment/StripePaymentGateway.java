package com.example.rentals.payment;

import com.example.rentals.common.MoneyUtils;
import com.stripe.Stripe;
import com.stripe.exception.ApiConnectionException;
import com.stripe.exception.CardException;
import com.stripe.exception.RateLimitException;
import com.stripe.exception.StripeException;
import com.stripe.model.Charge;
import com.stripe.model.Refund;
import com.stripe.net.RequestOptions;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

/**
 * Real card gateway backed by Stripe. The charge token is produced by Stripe.js
 * in the browser, so raw card data never touches this server. Active only when
 * {@code app.payment.gateway=stripe}; the fake gateway is the default.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "app.payment.gateway", havingValue = "stripe")
public class StripePaymentGateway implements PaymentGateway {

    private final String currency;

    public StripePaymentGateway(
            @Value("${app.stripe.api-key}") String apiKey,
            @Value("${app.payment.currency}") String currency) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException(
                    "app.payment.gateway=stripe requires a non-empty STRIPE_API_KEY");
        }
        Stripe.apiKey = apiKey;
        this.currency = currency == null ? "usd" : currency.toLowerCase();
    }

    @Override
    public ChargeResult charge(String token, BigDecimal amount, String idempotencyKey) {
        try {
            Map<String, Object> params = new HashMap<>();
            params.put("amount", MoneyUtils.round(amount).movePointRight(2).longValueExact());
            params.put("currency", currency);
            params.put("source", token);
            params.put("description", "Booking payment");

            RequestOptions options = RequestOptions.builder()
                    .setIdempotencyKey(idempotencyKey)
                    .build();

            Charge charge = Charge.create(params, options);
            if (Boolean.TRUE.equals(charge.getPaid()) && "succeeded".equals(charge.getStatus())) {
                return new ChargeResult(true, charge.getId(), null);
            }
            // A charge object that was created but not paid (e.g. blocked by
            // Radar). Issuer declines normally arrive as a CardException below.
            log.warn(
                    "Stripe charge not paid: status={}, outcomeType={}",
                    charge.getStatus(),
                    charge.getOutcome() != null ? charge.getOutcome().getType() : null);
            return new ChargeResult(false, null, "CARD_DECLINED");
        } catch (CardException e) {
            log.warn("Stripe card charge declined: {}", e.getMessage());
            return new ChargeResult(false, null, mapFailureCode(e.getCode()));
        } catch (ApiConnectionException | RateLimitException e) {
            log.warn("Stripe unreachable while charging: {}", e.getMessage());
            return new ChargeResult(false, null, "GATEWAY_TIMEOUT");
        } catch (StripeException e) {
            log.error("Stripe charge request failed", e);
            return new ChargeResult(false, null, "CARD_DECLINED");
        }
    }

    @Override
    public RefundResult refund(String providerReference, BigDecimal amount, String idempotencyKey) {
        try {
            Map<String, Object> params = new HashMap<>();
            params.put("charge", providerReference);
            params.put("amount", MoneyUtils.round(amount).movePointRight(2).longValueExact());

            RequestOptions options = RequestOptions.builder()
                    .setIdempotencyKey(idempotencyKey)
                    .build();

            Refund refund = Refund.create(params, options);
            return new RefundResult(true, refund.getId(), null);
        } catch (ApiConnectionException | RateLimitException e) {
            log.warn("Stripe unreachable while refunding charge {}: {}", providerReference, e.getMessage());
            return new RefundResult(false, null, "GATEWAY_TIMEOUT");
        } catch (StripeException e) {
            log.error("Stripe refund failed for charge {}", providerReference, e);
            return new RefundResult(false, null, "CARD_DECLINED");
        }
    }

    private String mapFailureCode(String code) {
        if (code == null) {
            return "CARD_DECLINED";
        }
        return switch (code) {
            case "insufficient_funds" -> "INSUFFICIENT_FUNDS";
            default -> "CARD_DECLINED";
        };
    }
}
