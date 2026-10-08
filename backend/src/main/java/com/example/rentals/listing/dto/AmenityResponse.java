package com.example.rentals.listing.dto;

import com.example.rentals.listing.Amenity;

public record AmenityResponse(
        Long id,
        String name,
        String category,
        String icon
) {
    public static AmenityResponse from(Amenity amenity) {
        return new AmenityResponse(amenity.getId(), amenity.getName(), amenity.getCategory(), amenity.getIcon());
    }
}
