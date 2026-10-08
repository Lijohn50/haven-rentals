package com.example.rentals.pricing;

import com.example.rentals.common.MoneyUtils;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
@Order(40)
public class CleaningFeeRule implements PricingRule {

    @Override
    public int getOrder() {
        return 40;
    }

    @Override
    public void apply(PricingContext context) {
        BigDecimal fee = context.getListing().getCleaningFee();
        if (fee == null) {
            fee = MoneyUtils.ZERO;
        } else {
            fee = MoneyUtils.round(fee);
        }
        context.setCleaningFee(fee);
    }
}
