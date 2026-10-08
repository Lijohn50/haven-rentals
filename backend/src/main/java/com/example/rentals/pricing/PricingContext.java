package com.example.rentals.pricing;

import com.example.rentals.listing.Listing;
import com.example.rentals.pricing.dto.NightLineResponse;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class PricingContext {
    private final Listing listing;
    private final List<SeasonalRate> seasonalRates;
    private final CommissionSetting commissionSetting;
    private final LocalDate checkIn;
    private final LocalDate checkOut;
    private final int nights;
    private final int guests;

    private List<NightLineResponse> nightLines = new ArrayList<>();
    private BigDecimal nightlySubtotal = BigDecimal.ZERO;
    private BigDecimal discountTotal = BigDecimal.ZERO;
    private BigDecimal discountPercent = BigDecimal.ZERO;
    private BigDecimal cleaningFee = BigDecimal.ZERO;
    private BigDecimal serviceFee = BigDecimal.ZERO;
    private BigDecimal taxTotal = BigDecimal.ZERO;
    private BigDecimal totalAmount = BigDecimal.ZERO;
    private BigDecimal hostCommission = BigDecimal.ZERO;
    private BigDecimal hostPayoutAmount = BigDecimal.ZERO;

    public PricingContext(Listing listing, List<SeasonalRate> seasonalRates, CommissionSetting commissionSetting, LocalDate checkIn, LocalDate checkOut, int guests) {
        this.listing = listing;
        this.seasonalRates = seasonalRates;
        this.commissionSetting = commissionSetting;
        this.checkIn = checkIn;
        this.checkOut = checkOut;
        this.nights = (int) java.time.temporal.ChronoUnit.DAYS.between(checkIn, checkOut);
        this.guests = guests;
    }
}
