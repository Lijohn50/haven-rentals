package com.example.rentals.search.dto;

public record CitySuggestionResponse(
        String city,
        String country,
        long listingCount
) {}
