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
        @JsonProperty("error") String error
) {
    public boolean isValid() {
        return "VALID".equalsIgnoreCase(status) || "VALIDATED".equalsIgnoreCase(status);
    }
}
