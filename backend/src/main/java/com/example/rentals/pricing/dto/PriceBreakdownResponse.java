package com.example.rentals.pricing.dto;

import com.example.rentals.pricing.PriceBreakdown;

import java.math.BigDecimal;
import java.util.List;

public record PriceBreakdownResponse(
        List<NightLineResponse> nightLines,
        BigDecimal nightlySubtotal,
        BigDecimal discountTotal,
        BigDecimal discountPercent,
        BigDecimal cleaningFee,
        BigDecimal serviceFee,
        BigDecimal taxTotal,
        BigDecimal totalAmount,
        BigDecimal hostCommission,
        BigDecimal hostPayoutAmount,
        BigDecimal accommodationTotal
) {
    public static PriceBreakdownResponse from(PriceBreakdown pb) {
        return new PriceBreakdownResponse(
                pb.getNightLines(),
                pb.getNightlySubtotal(),
                pb.getDiscountTotal(),
                pb.getDiscountPercent(),
                pb.getCleaningFee(),
                pb.getServiceFee(),
                pb.getTaxTotal(),
                pb.getTotalAmount(),
                pb.getHostCommission(),
                pb.getHostPayoutAmount(),
                pb.getAccommodationTotal()
        );
    }
}
