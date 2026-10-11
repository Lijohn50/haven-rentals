package com.example.rentals.payment.sslcommerz;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

@JsonIgnoreProperties(ignoreUnknown = true)
public record SslCommerzValidationResponse(
        String status,
        @JsonProperty("tran_date") String tranDate,
        @JsonProperty("tran_id") String tranId,
        @JsonProperty("val_id") String valId,
        BigDecimal amount,
        @JsonProperty("store_amount") BigDecimal storeAmount,
        String currency,
        @JsonProperty("bank_tran_id") String bankTranId,
        @JsonProperty("card_type") String cardType,
        @JsonProperty("card_no") String cardNo,
        @JsonProperty("card_issuer") String cardIssuer,
        @JsonProperty("card_brand") String cardBrand,
        @JsonProperty("error") String error,
        @JsonProperty("currency_type") String currencyType,
        @JsonProperty("currency_amount") BigDecimal currencyAmount,
        @JsonProperty("currency_rate") BigDecimal currencyRate
) {
    public SslCommerzValidationResponse(
            String status, String tranDate, String tranId, String valId,
            BigDecimal amount, BigDecimal storeAmount, String currency,
            String bankTranId, String cardType, String cardNo,
            String cardIssuer, String cardBrand, String error
    ) {
        this(status, tranDate, tranId, valId, amount, storeAmount, currency, bankTranId, cardType, cardNo, cardIssuer, cardBrand, error, null, null, null);
    }

    public boolean isValid() {
        return "VALID".equalsIgnoreCase(status) || "VALIDATED".equalsIgnoreCase(status);
    }

    /**
     * Resolves the effective transaction amount. If payment was processed in a foreign currency
     * (e.g. USD), SSLCommerz populates currency_amount with the original amount.
     */
    public BigDecimal getEffectiveAmount() {
        if (currencyAmount != null && currencyAmount.compareTo(BigDecimal.ZERO) > 0) {
            return currencyAmount;
        }
        return amount;
    }

    /**
     * Resolves the effective transaction currency (e.g. USD from currency_type if present).
     */
    public String getEffectiveCurrency() {
        if (currencyType != null && !currencyType.isBlank()) {
            return currencyType;
        }
        return currency;
    }
}
