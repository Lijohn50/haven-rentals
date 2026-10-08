package com.example.rentals.booking.dto;

import java.math.BigDecimal;

public record CancellationPreviewResponse(
        BigDecimal refundAmount,
        BigDecimal nonRefundableAmount,
        String policyName,
        String explanation
) {}
