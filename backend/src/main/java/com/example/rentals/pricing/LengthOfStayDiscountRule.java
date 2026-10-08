package com.example.rentals.pricing;

import com.example.rentals.common.MoneyUtils;
import com.example.rentals.pricing.dto.NightLineResponse;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
@Order(30)
public class LengthOfStayDiscountRule implements PricingRule {

    @Override
    public int getOrder() {
        return 30;
    }

    @Override
    public void apply(PricingContext context) {
        BigDecimal subtotal = BigDecimal.ZERO;
        for (NightLineResponse line : context.getNightLines()) {
            subtotal = subtotal.add(line.rate());
        }
        context.setNightlySubtotal(subtotal);

        int nights = context.getNights();
        BigDecimal weeklyPct = context.getListing().getWeeklyDiscountPercent() != null ?
                context.getListing().getWeeklyDiscountPercent() : BigDecimal.ZERO;
        BigDecimal monthlyPct = context.getListing().getMonthlyDiscountPercent() != null ?
                context.getListing().getMonthlyDiscountPercent() : BigDecimal.ZERO;

        BigDecimal appliedPct = BigDecimal.ZERO;
        if (nights >= 28 && monthlyPct.compareTo(BigDecimal.ZERO) > 0) {
            appliedPct = monthlyPct;
        } else if (nights >= 7 && weeklyPct.compareTo(BigDecimal.ZERO) > 0) {
            appliedPct = weeklyPct;
        }

        BigDecimal discount = MoneyUtils.percentage(subtotal, appliedPct);
        context.setDiscountPercent(appliedPct);
        context.setDiscountTotal(discount);
    }
}
