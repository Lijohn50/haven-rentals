package com.example.rentals.pricing;

import com.example.rentals.pricing.dto.NightLineResponse;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Builder(toBuilder = true)
public class PriceBreakdown {
    private final List<NightLineResponse> nightLines;
    private final BigDecimal nightlySubtotal;
    private final BigDecimal discountTotal;
    private final BigDecimal discountPercent;
    private final BigDecimal cleaningFee;
    private final BigDecimal serviceFee;
    private final BigDecimal taxTotal;
    private final BigDecimal totalAmount;
    private final BigDecimal hostCommission;
    private final BigDecimal hostPayoutAmount;
    private final BigDecimal accommodationTotal;
}
