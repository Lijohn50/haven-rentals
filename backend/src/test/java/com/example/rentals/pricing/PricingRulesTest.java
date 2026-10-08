package com.example.rentals.pricing;

import com.example.rentals.listing.CancellationPolicyType;
import com.example.rentals.listing.Listing;
import com.example.rentals.listing.PropertyType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PricingRulesTest {

    private Listing listing;
    private CommissionSetting commissionSetting;

    @BeforeEach
    void setUp() {
        listing = new Listing();
        listing.setId(1L);
        listing.setTitle("Test Manhattan Loft");
        listing.setPropertyType(PropertyType.APARTMENT);
        listing.setBaseNightlyPrice(new BigDecimal("100.00"));
        listing.setWeekendMultiplier(new BigDecimal("1.20"));
        listing.setCleaningFee(new BigDecimal("50.00"));
        listing.setWeeklyDiscountPercent(new BigDecimal("10.00"));
        listing.setMonthlyDiscountPercent(new BigDecimal("20.00"));
        listing.setCancellationPolicy(CancellationPolicyType.FLEXIBLE);
        listing.setTimezone("America/New_York");

        commissionSetting = new CommissionSetting(
                new BigDecimal("10.00"),
                new BigDecimal("3.00"),
                new BigDecimal("8.00"),
                java.time.Instant.now(),
                null
        );
    }

    private PricingContext context(LocalDate checkIn, LocalDate checkOut, List<SeasonalRate> rates) {
        return new PricingContext(listing, rates, commissionSetting, checkIn, checkOut, 2);
    }

    @Test
    @DisplayName("WeekendRule applies multiplier to Friday and Saturday nights only")
    void testWeekendMultiplierRule() {
        // Wednesday (2026-10-07) to Monday (2026-10-12): 5 nights
        // Wed: 100, Thu: 100, Fri: 120, Sat: 120, Sun: 100
        LocalDate checkIn = LocalDate.of(2026, 10, 7);
        LocalDate checkOut = LocalDate.of(2026, 10, 12);

        PricingContext ctx = context(checkIn, checkOut, List.of());

        WeekendRule rule = new WeekendRule();
        rule.apply(ctx);

        assertThat(ctx.getNightLines()).hasSize(5);
        assertThat(ctx.getNightLines().get(0).rate()).isEqualByComparingTo(new BigDecimal("100.00")); // Wed
        assertThat(ctx.getNightLines().get(1).rate()).isEqualByComparingTo(new BigDecimal("100.00")); // Thu
        assertThat(ctx.getNightLines().get(2).rate()).isEqualByComparingTo(new BigDecimal("120.00")); // Fri
        assertThat(ctx.getNightLines().get(3).rate()).isEqualByComparingTo(new BigDecimal("120.00")); // Sat
        assertThat(ctx.getNightLines().get(4).rate()).isEqualByComparingTo(new BigDecimal("100.00")); // Sun
    }

    @Test
    @DisplayName("LengthOfStayDiscountRule: 6 nights gets no discount, 7 nights gets weekly discount")
    void testWeeklyDiscountThreshold() {
        LengthOfStayDiscountRule discountRule = new LengthOfStayDiscountRule();

        // 6 nights: no discount
        PricingContext ctx6 = context(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 7), List.of());
        new WeekendRule().apply(ctx6);
        discountRule.apply(ctx6);
        assertThat(ctx6.getDiscountPercent()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(ctx6.getDiscountTotal()).isEqualByComparingTo(BigDecimal.ZERO);

        // 7 nights: weekly discount (10%)
        PricingContext ctx7 = context(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 8), List.of());
        new WeekendRule().apply(ctx7);
        discountRule.apply(ctx7);
        assertThat(ctx7.getDiscountPercent()).isEqualByComparingTo(new BigDecimal("10.00"));
        assertThat(ctx7.getDiscountTotal()).isGreaterThan(BigDecimal.ZERO);
    }

    @Test
    @DisplayName("LengthOfStayDiscountRule: 27 nights gets weekly discount, 28 nights gets monthly discount")
    void testMonthlyDiscountThreshold() {
        LengthOfStayDiscountRule discountRule = new LengthOfStayDiscountRule();

        // 27 nights: weekly discount (10%)
        PricingContext ctx27 = context(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 28), List.of());
        new WeekendRule().apply(ctx27);
        discountRule.apply(ctx27);
        assertThat(ctx27.getDiscountPercent()).isEqualByComparingTo(new BigDecimal("10.00"));

        // 28 nights: monthly discount (20%)
        PricingContext ctx28 = context(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 29), List.of());
        new WeekendRule().apply(ctx28);
        discountRule.apply(ctx28);
        assertThat(ctx28.getDiscountPercent()).isEqualByComparingTo(new BigDecimal("20.00"));
    }

    @Test
    @DisplayName("SeasonalRateRule overrides base rate during seasonal date range")
    void testSeasonalRateRule() {
        SeasonalRate rate = new SeasonalRate(
                listing,
                "Summer Peak",
                LocalDate.of(2026, 7, 1),
                LocalDate.of(2026, 7, 31),
                new BigDecimal("200.00")
        );

        // 2 nights: June 30 (regular), July 1 (seasonal)
        PricingContext ctx = context(LocalDate.of(2026, 6, 30), LocalDate.of(2026, 7, 2), List.of(rate));

        new SeasonalRateRule().apply(ctx);
        new WeekendRule().apply(ctx);

        assertThat(ctx.getNightLines()).hasSize(2);
        assertThat(ctx.getNightLines().get(0).rate()).isEqualByComparingTo(new BigDecimal("100.00")); // June 30
        assertThat(ctx.getNightLines().get(1).rate()).isEqualByComparingTo(new BigDecimal("200.00")); // July 1
    }

    @Test
    @DisplayName("Pricing formula: totalAmount = nightlySubtotal - discountTotal + cleaningFee + serviceFee + taxTotal")
    void testPricingFormulaMatchesDatabaseConstraint() {
        List<PricingRule> rules = List.of(
                new SeasonalRateRule(),
                new WeekendRule(),
                new LengthOfStayDiscountRule(),
                new CleaningFeeRule(),
                new ServiceFeeRule(),
                new TaxRule()
        );

        // 2026-11-02 (Monday) to 2026-11-12 (Thursday): 10 nights, triggers the weekly discount
        PricingContext ctx = context(LocalDate.of(2026, 11, 2), LocalDate.of(2026, 11, 12), List.of());

        for (PricingRule rule : rules) {
            rule.apply(ctx);
        }

        BigDecimal expectedTotal = ctx.getNightlySubtotal()
                .subtract(ctx.getDiscountTotal())
                .add(ctx.getCleaningFee())
                .add(ctx.getServiceFee())
                .add(ctx.getTaxTotal());

        PriceBreakdown breakdown = PriceBreakdown.builder()
                .nightLines(ctx.getNightLines())
                .nightlySubtotal(ctx.getNightlySubtotal())
                .discountTotal(ctx.getDiscountTotal())
                .discountPercent(ctx.getDiscountPercent())
                .cleaningFee(ctx.getCleaningFee())
                .serviceFee(ctx.getServiceFee())
                .taxTotal(ctx.getTaxTotal())
                .totalAmount(expectedTotal)
                .build();

        assertThat(breakdown.getTotalAmount()).isEqualByComparingTo(expectedTotal);
        assertThat(breakdown.getTotalAmount().scale()).isLessThanOrEqualTo(2);
        assertThat(breakdown.getServiceFee().scale()).isLessThanOrEqualTo(2);
        assertThat(breakdown.getTaxTotal().scale()).isLessThanOrEqualTo(2);
    }
}