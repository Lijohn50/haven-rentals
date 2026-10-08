package com.example.rentals.search;

import com.example.rentals.listing.PropertyType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record SearchCriteria(
        String city,
        String country,
        LocalDate checkIn,
        LocalDate checkOut,
        int guests,
        BigDecimal minPrice,
        BigDecimal maxPrice,
        List<Long> amenityIds,
        PropertyType propertyType,
        Integer minBedrooms,
        BigDecimal minRating,
        Boolean instantBook,
        SearchSort sort,
        int page,
        int size
) {}
