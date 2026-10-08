package com.example.rentals.pricing;

import com.example.rentals.common.MoneyUtils;
import com.example.rentals.pricing.dto.NightLineResponse;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.util.ArrayList;
import java.util.List;

@Component
@Order(20)
public class WeekendRule implements PricingRule {

    @Override
    public int getOrder() {
        return 20;
    }

    @Override
    public void apply(PricingContext context) {
        BigDecimal multiplier = context.getListing().getWeekendMultiplier();
        if (multiplier == null || multiplier.compareTo(BigDecimal.ONE) <= 0) {
            return;
        }

        List<NightLineResponse> updated = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;

        for (NightLineResponse line : context.getNightLines()) {
            DayOfWeek dow = line.date().getDayOfWeek();
            boolean isWeekend = (dow == DayOfWeek.FRIDAY || dow == DayOfWeek.SATURDAY);
            BigDecimal rate = line.rate();

            if (isWeekend) {
                rate = MoneyUtils.round(rate.multiply(multiplier));
            }

            subtotal = subtotal.add(rate);
            updated.add(new NightLineResponse(line.date(), rate, isWeekend, line.isSeasonal(), line.seasonName()));
        }

        context.setNightLines(updated);
        context.setNightlySubtotal(subtotal);
    }
}
