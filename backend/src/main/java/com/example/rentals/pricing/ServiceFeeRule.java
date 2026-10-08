package com.example.rentals.pricing;

import com.example.rentals.common.MoneyUtils;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
@Order(50)
public class ServiceFeeRule implements PricingRule {

    @Override
    public int getOrder() {
        return 50;
    }

    @Override
    public void apply(PricingContext context) {
        BigDecimal feePercent = context.getCommissionSetting() != null ?
                context.getCommissionSetting().getGuestServiceFeePercent() : BigDecimal.ZERO;

        BigDecimal base = context.getNightlySubtotal().subtract(context.getDiscountTotal());
        BigDecimal serviceFee = MoneyUtils.percentage(base, feePercent);
        context.setServiceFee(serviceFee);
    }
}
