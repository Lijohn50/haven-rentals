package com.example.rentals.pricing.dto;

import com.example.rentals.pricing.CommissionSetting;

import java.math.BigDecimal;
import java.time.Instant;

public record CommissionSettingResponse(
        Long id,
        BigDecimal guestServiceFeePercent,
        BigDecimal hostCommissionPercent,
        BigDecimal taxPercent,
        Instant effectiveFrom,
        Long createdBy,
        Instant createdAt
) {
    public static CommissionSettingResponse from(CommissionSetting cs) {
        return new CommissionSettingResponse(
                cs.getId(),
                cs.getGuestServiceFeePercent(),
                cs.getHostCommissionPercent(),
                cs.getTaxPercent(),
                cs.getEffectiveFrom(),
                cs.getCreatedBy() != null ? cs.getCreatedBy().getId() : null,
                cs.getCreatedAt()
        );
    }
}
