package com.example.rentals.pricing;

import com.example.rentals.common.ApiException;
import com.example.rentals.common.BusinessRuleException;
import com.example.rentals.common.ConflictException;
import com.example.rentals.common.CurrentUserProvider;
import com.example.rentals.common.ErrorCode;
import com.example.rentals.common.MoneyUtils;
import com.example.rentals.common.ResourceNotFoundException;
import com.example.rentals.listing.Listing;
import com.example.rentals.listing.ListingRepository;
import com.example.rentals.listing.ListingStatus;
import com.example.rentals.pricing.dto.QuoteResponse;
import com.example.rentals.pricing.dto.SeasonalRateRequest;
import com.example.rentals.pricing.dto.SeasonalRateResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class SeasonalRateController {

    private final PricingService pricingService;
    private final SeasonalRateRepository seasonalRateRepository;
    private final ListingRepository listingRepository;
    private final CurrentUserProvider currentUser;
    private final Clock clock;

    @GetMapping("/listings/{id}/quote")
    public ResponseEntity<QuoteResponse> getQuote(
            @PathVariable Long id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkIn,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkOut,
            @RequestParam(defaultValue = "1") int guests
    ) {
        return ResponseEntity.ok(pricingService.getQuote(id, checkIn, checkOut, guests));
    }

    @GetMapping("/host/listings/{id}/seasonal-rates")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<List<SeasonalRateResponse>> listSeasonalRates(@PathVariable Long id) {
        findHostListing(currentUser.getUserId(), id);
        List<SeasonalRateResponse> list = seasonalRateRepository.findByListingIdOrderByStartDateAsc(id)
                .stream()
                .map(SeasonalRateResponse::from)
                .toList();
        return ResponseEntity.ok(list);
    }

    @PostMapping("/host/listings/{id}/seasonal-rates")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<SeasonalRateResponse> createSeasonalRate(
            @PathVariable Long id,
            @Valid @RequestBody SeasonalRateRequest req
    ) {
        Listing listing = findHostListing(currentUser.getUserId(), id);
        validateSeasonalRate(listing, req);

        if (seasonalRateRepository.existsByListingIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(id, req.endDate(), req.startDate())) {
            throw new ConflictException(ErrorCode.DUPLICATE_RESOURCE, "Dates overlap with an existing seasonal rate");
        }

        SeasonalRate rate = new SeasonalRate(listing, req.name(), req.startDate(), req.endDate(), req.nightlyPrice());
        rate = seasonalRateRepository.save(rate);

        return ResponseEntity.created(URI.create("/api/v1/host/listings/" + id + "/seasonal-rates/" + rate.getId()))
                .body(SeasonalRateResponse.from(rate));
    }

    @PutMapping("/host/listings/{id}/seasonal-rates/{rateId}")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<SeasonalRateResponse> updateSeasonalRate(
            @PathVariable Long id,
            @PathVariable Long rateId,
            @Valid @RequestBody SeasonalRateRequest req
    ) {
        Listing listing = findHostListing(currentUser.getUserId(), id);
        SeasonalRate rate = seasonalRateRepository.findById(rateId)
                .filter(r -> r.getListing().getId().equals(id))
                .orElseThrow(() -> new ResourceNotFoundException("Seasonal rate not found"));

        validateSeasonalRate(listing, req);

        rate.setName(req.name());
        rate.setStartDate(req.startDate());
        rate.setEndDate(req.endDate());
        rate.setNightlyPrice(req.nightlyPrice());

        rate = seasonalRateRepository.save(rate);
        return ResponseEntity.ok(SeasonalRateResponse.from(rate));
    }

    @DeleteMapping("/host/listings/{id}/seasonal-rates/{rateId}")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<Void> deleteSeasonalRate(
            @PathVariable Long id,
            @PathVariable Long rateId
    ) {
        findHostListing(currentUser.getUserId(), id);
        SeasonalRate rate = seasonalRateRepository.findById(rateId)
                .filter(r -> r.getListing().getId().equals(id))
                .orElseThrow(() -> new ResourceNotFoundException("Seasonal rate not found"));

        seasonalRateRepository.delete(rate);
        return ResponseEntity.noContent().build();
    }

    private Listing findHostListing(Long hostId, Long listingId) {
        return listingRepository.findByIdAndHostId(listingId, hostId)
                .filter(l -> l.getStatus() != ListingStatus.DELETED)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));
    }

    private void validateSeasonalRate(Listing listing, SeasonalRateRequest req) {
        MoneyUtils.validateMoney(req.nightlyPrice(), "nightlyPrice", false);
        if (req.startDate() == null || req.endDate() == null || req.startDate().isAfter(req.endDate())) {
            throw new ApiException(ErrorCode.INVALID_DATE_RANGE, "Start date must be on or before end date");
        }

        ZoneId zoneId = ZoneId.of(listing.getTimezone());
        LocalDate today = clock.instant().atZone(zoneId).toLocalDate();
        if (req.endDate().isBefore(today)) {
            throw new BusinessRuleException("End date cannot be in the past");
        }

        long length = ChronoUnit.DAYS.between(req.startDate(), req.endDate()) + 1;
        if (length > 366) {
            throw new BusinessRuleException("Seasonal rate cannot exceed 366 days");
        }
    }
}
