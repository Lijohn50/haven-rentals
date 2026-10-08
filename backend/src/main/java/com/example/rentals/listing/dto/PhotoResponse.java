package com.example.rentals.listing.dto;

import com.example.rentals.listing.ListingPhoto;

public record PhotoResponse(
        Long id,
        String url,
        int width,
        int height,
        int sortOrder,
        boolean isCover
) {
    public static PhotoResponse from(ListingPhoto photo) {
        // Externally hosted photos already carry a resolvable absolute URL, so they must be
        // returned untouched rather than wrapped in the local media path.
        String url = photo.isExternal()
                ? photo.getStorageKey()
                : "/api/v1/media/listings/" + photo.getListing().getId() + "/" + photo.getStorageKey();
        return new PhotoResponse(
                photo.getId(),
                url,
                photo.getWidth(),
                photo.getHeight(),
                photo.getSortOrder(),
                photo.isCover()
        );
    }
}
