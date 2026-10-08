package com.example.rentals.listing.dto;

import com.example.rentals.common.CountryCode;
import com.example.rentals.common.NoHtml;
import com.example.rentals.common.TimezoneId;
import com.example.rentals.listing.CancellationPolicyType;
import com.example.rentals.listing.PropertyType;
import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalTime;

public record ListingRequest(
        @NotBlank(message = "Title is required")
        @Size(min = 10, max = 120, message = "Title must be between 10 and 120 characters")
        @NoHtml
        String title,

        @NotBlank(message = "Description is required")
        @Size(min = 50, max = 5000, message = "Description must be between 50 and 5000 characters")
        @NoHtml
        String description,

        @NotNull(message = "Property type is required")
        PropertyType propertyType,

        @NotBlank(message = "Address line is required")
        @Size(min = 5, max = 200, message = "Address line must be between 5 and 200 characters")
        @NoHtml
        String addressLine,

        @NotBlank(message = "City is required")
        @Size(min = 1, max = 100, message = "City must be between 1 and 100 characters")
        @NoHtml
        String city,

        @Size(max = 100, message = "State/region must not exceed 100 characters")
        @NoHtml
        String stateRegion,

        @NotBlank(message = "Country is required")
        @CountryCode
        String country,

        @Size(max = 20, message = "Postal code must not exceed 20 characters")
        String postalCode,

        @NotNull(message = "Latitude is required")
        @DecimalMin(value = "-90.0", message = "Latitude must be between -90 and 90")
        @DecimalMax(value = "90.0", message = "Latitude must be between -90 and 90")
        BigDecimal latitude,

        @NotNull(message = "Longitude is required")
        @DecimalMin(value = "-180.0", message = "Longitude must be between -180 and 180")
        @DecimalMax(value = "180.0", message = "Longitude must be between -180 and 180")
        BigDecimal longitude,

        @NotBlank(message = "Timezone is required")
        @TimezoneId
        String timezone,

        @NotNull(message = "Max guests is required")
        @Min(value = 1, message = "Max guests must be at least 1")
        @Max(value = 50, message = "Max guests cannot exceed 50")
        Integer maxGuests,

        @NotNull(message = "Bedrooms count is required")
        @Min(value = 0, message = "Bedrooms must be non-negative")
        @Max(value = 50, message = "Bedrooms cannot exceed 50")
        Integer bedrooms,

        @NotNull(message = "Beds count is required")
        @Min(value = 1, message = "Beds must be at least 1")
        @Max(value = 100, message = "Beds cannot exceed 100")
        Integer beds,

        @NotNull(message = "Bathrooms count is required")
        @DecimalMin(value = "0.0", message = "Bathrooms must be at least 0")
        @DecimalMax(value = "50.0", message = "Bathrooms cannot exceed 50")
        BigDecimal bathrooms,

        @NotNull(message = "Base nightly price is required")
        @DecimalMin(value = "1.00", message = "Base nightly price must be at least 1.00")
        @DecimalMax(value = "100000.00", message = "Base nightly price cannot exceed 100000.00")
        BigDecimal baseNightlyPrice,

        @DecimalMin(value = "1.00", message = "Weekend multiplier must be at least 1.00")
        @DecimalMax(value = "3.00", message = "Weekend multiplier cannot exceed 3.00")
        BigDecimal weekendMultiplier,

        @DecimalMin(value = "0.00", message = "Cleaning fee cannot be negative")
        @DecimalMax(value = "10000.00", message = "Cleaning fee cannot exceed 10000.00")
        BigDecimal cleaningFee,

        @DecimalMin(value = "0.00", message = "Weekly discount must be between 0 and 90")
        @DecimalMax(value = "90.00", message = "Weekly discount must be between 0 and 90")
        BigDecimal weeklyDiscountPercent,

        @DecimalMin(value = "0.00", message = "Monthly discount must be between 0 and 90")
        @DecimalMax(value = "90.00", message = "Monthly discount must be between 0 and 90")
        BigDecimal monthlyDiscountPercent,

        @Min(value = 1, message = "Min nights must be at least 1")
        Integer minNights,

        @Max(value = 365, message = "Max nights cannot exceed 365")
        Integer maxNights,

        @Min(value = 0, message = "Advance notice must be at least 0 days")
        @Max(value = 60, message = "Advance notice cannot exceed 60 days")
        Integer advanceNoticeDays,

        @Min(value = 30, message = "Booking window must be at least 30 days")
        @Max(value = 730, message = "Booking window cannot exceed 730 days")
        Integer bookingWindowDays,

        @JsonFormat(pattern = "HH:mm")
        LocalTime checkInTime,

        @JsonFormat(pattern = "HH:mm")
        LocalTime checkOutTime,

        @NotNull(message = "Cancellation policy is required")
        CancellationPolicyType cancellationPolicy,

        @NotNull(message = "Instant book flag is required")
        Boolean instantBook
) {}
