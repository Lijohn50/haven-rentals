package com.example.rentals.payment.sslcommerz;

public record SslCommerzInitResponse(
        String status,
        String redirectUrl,
        String sessionKey,
        String failedReason
) {
    public boolean isSuccess() {
        return "SUCCESS".equalsIgnoreCase(status) && redirectUrl != null && !redirectUrl.isBlank();
    }
}
