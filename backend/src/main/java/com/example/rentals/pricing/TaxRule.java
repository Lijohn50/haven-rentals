package com.example.rentals.pricing;

import com.example.rentals.common.MoneyUtils;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
@Order(60)
public class TaxRule implements PricingRule {

    @Override
    public int getOrder() {
        return 60;
    }

    @Override
    public void apply(PricingContext context) {
        BigDecimal taxPercent = context.getCommissionSetting() != null ?
                context.getCommissionSetting().getTaxPercent() : BigDecimal.ZERO;

        BigDecimal base = context.getNightlySubtotal()
                .subtract(context.getDiscountTotal())
                .add(context.getCleaningFee());

        BigDecimal taxTotal = MoneyUtils.percentage(base, taxPercent);
        context.setTaxTotal(taxTotal);
    }
}
