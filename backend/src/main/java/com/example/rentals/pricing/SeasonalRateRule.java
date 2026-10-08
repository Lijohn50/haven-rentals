package com.example.rentals.pricing;

import com.example.rentals.common.MoneyUtils;
import com.example.rentals.pricing.dto.NightLineResponse;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Component
@Order(10)
public class SeasonalRateRule implements PricingRule {

    @Override
    public int getOrder() {
        return 10;
    }

    @Override
    public void apply(PricingContext context) {
        List<NightLineResponse> lines = new ArrayList<>();
        LocalDate cur = context.getCheckIn();

        while (cur.isBefore(context.getCheckOut())) {
            final LocalDate date = cur;
            SeasonalRate season = null;
            if (context.getSeasonalRates() != null) {
                season = context.getSeasonalRates().stream()
                        .filter(s -> !date.isBefore(s.getStartDate()) && !date.isAfter(s.getEndDate()))
                        .findFirst()
                        .orElse(null);
            }

            BigDecimal rate = (season != null) ? season.getNightlyPrice() : context.getListing().getBaseNightlyPrice();
            rate = MoneyUtils.round(rate);

            boolean isSeasonal = season != null;
            String seasonName = season != null ? season.getName() : null;

            lines.add(new NightLineResponse(date, rate, false, isSeasonal, seasonName));
            cur = cur.plusDays(1);
        }

        context.setNightLines(lines);
    }
}
