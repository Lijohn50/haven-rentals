package com.example.rentals.pricing;

import com.example.rentals.availability.AvailabilityService;
import com.example.rentals.common.ApiException;
import com.example.rentals.common.ErrorCode;
import com.example.rentals.common.MoneyUtils;
import com.example.rentals.common.ResourceNotFoundException;
import com.example.rentals.listing.Listing;
import com.example.rentals.listing.ListingRepository;
import com.example.rentals.listing.ListingStatus;
import com.example.rentals.pricing.dto.NightLineResponse;
import com.example.rentals.pricing.dto.PriceBreakdownResponse;
import com.example.rentals.pricing.dto.QuoteResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PricingService {

    private final ListingRepository listingRepository;
    private final SeasonalRateRepository seasonalRateRepository;
    private final CommissionService commissionService;
    private final AvailabilityService availabilityService;
    private final List<PricingRule> pricingRules;

    @Transactional(readOnly = true)
    public QuoteResponse getQuote(Long listingId, LocalDate checkIn, LocalDate checkOut, int guests) {
        availabilityService.checkAvailability(listingId, checkIn, checkOut, guests);

        Listing listing = listingRepository.findById(listingId)
                .filter(l -> l.getStatus() != ListingStatus.DELETED)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));

        PriceBreakdown breakdown = calculate(listing, checkIn, checkOut, guests);
        int nights = (int) ChronoUnit.DAYS.between(checkIn, checkOut);

        return new QuoteResponse(
                listing.getId(),
                checkIn,
                checkOut,
                nights,
                guests,
                listing.isInstantBook(),
                PriceBreakdownResponse.from(breakdown)
        );
    }

    public PriceBreakdown calculate(Listing listing, LocalDate checkIn, LocalDate checkOut, int guests) {
        List<SeasonalRate> seasonalRates = seasonalRateRepository.findByListingIdOrderByStartDateAsc(listing.getId());
        CommissionSetting commissionSetting = commissionService.getCurrentSetting();

        PricingContext context = new PricingContext(listing, seasonalRates, commissionSetting, checkIn, checkOut, guests);

        List<PricingRule> sortedRules = pricingRules.stream()
                .sorted(Comparator.comparingInt(PricingRule::getOrder))
                .toList();

        for (PricingRule rule : sortedRules) {
            rule.apply(context);
        }

        // Totals
        BigDecimal subtotal = context.getNightlySubtotal();
        BigDecimal discount = context.getDiscountTotal();
        BigDecimal cleaning = context.getCleaningFee();
        BigDecimal service = context.getServiceFee();
        BigDecimal tax = context.getTaxTotal();

        BigDecimal total = subtotal.subtract(discount).add(cleaning).add(service).add(tax);
        total = MoneyUtils.round(total);

        BigDecimal hostCommPct = commissionSetting != null ? commissionSetting.getHostCommissionPercent() : BigDecimal.ZERO;
        BigDecimal baseForCommission = subtotal.subtract(discount);
        BigDecimal hostCommission = MoneyUtils.percentage(baseForCommission, hostCommPct);

        BigDecimal hostPayout = subtotal.subtract(discount).add(cleaning).subtract(hostCommission);
        hostPayout = MoneyUtils.round(hostPayout);

        BigDecimal accommodationTotal = total.subtract(service);

        // Sanity checks
        if (total.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ApiException(ErrorCode.INTERNAL_ERROR, "Calculated total must be greater than zero");
        }
        if (hostPayout.compareTo(BigDecimal.ZERO) < 0) {
            throw new ApiException(ErrorCode.INTERNAL_ERROR, "Calculated host payout cannot be negative");
        }
        for (NightLineResponse line : context.getNightLines()) {
            if (line.rate().compareTo(new BigDecimal("0.01")) < 0) {
                throw new ApiException(ErrorCode.INTERNAL_ERROR, "Nightly rate cannot be less than 0.01");
            }
        }

        return PriceBreakdown.builder()
                .nightLines(context.getNightLines())
                .nightlySubtotal(subtotal)
                .discountTotal(discount)
                .discountPercent(context.getDiscountPercent())
                .cleaningFee(cleaning)
                .serviceFee(service)
                .taxTotal(tax)
                .totalAmount(total)
                .hostCommission(hostCommission)
                .hostPayoutAmount(hostPayout)
                .accommodationTotal(accommodationTotal)
                .build();
    }
}
