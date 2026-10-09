package com.example.rentals.payment.sslcommerz;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record SslCommerzRefundResponse(
        String status,
        @JsonProperty("refund_ref_id") String refundRefId,
        @JsonProperty("errorReason") String errorReason
) {
    public boolean isSuccess() {
        return "success".equalsIgnoreCase(status);
    }
}
