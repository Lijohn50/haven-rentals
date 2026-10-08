package com.example.rentals.dashboard.dto;

import java.math.BigDecimal;

public record EarningsResponse(
        BigDecimal paidTotal,
        BigDecimal pendingTotal,
        BigDecimal heldTotal,
        BigDecimal thisMonthPaid
) {
}
