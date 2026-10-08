package com.example.rentals.listing.dto;

import jakarta.validation.constraints.Size;

import java.util.Set;

public record UpdateAmenitiesRequest(
        @Size(max = 50, message = "Maximum 50 amenities allowed")
        Set<Long> amenityIds
) {}
