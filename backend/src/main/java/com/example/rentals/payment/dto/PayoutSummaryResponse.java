package com.example.rentals.payment.dto;

import java.math.BigDecimal;

public record PayoutSummaryResponse(
        BigDecimal pendingAmount,
        BigDecimal paidAmount,
        BigDecimal heldAmount,
        int scheduledCount
) {}
