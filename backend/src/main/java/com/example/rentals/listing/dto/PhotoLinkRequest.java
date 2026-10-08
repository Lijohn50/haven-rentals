package com.example.rentals.listing.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Registers a photo that is already hosted externally (currently Cloudinary). The host
 * pastes the delivery URL it was given by Cloudinary; the file itself is never uploaded to
 * this application.
 */
public record PhotoLinkRequest(
        @NotBlank(message = "A photo URL is required")
        @Size(max = 500, message = "Use at most 500 characters")
        @Pattern(
                regexp = "^https://[a-z0-9.-]+\\.cloudinary\\.com/.+",
                message = "Use an https Cloudinary URL, for example https://res.cloudinary.com/<cloud>/image/upload/<public-id>.jpg"
        )
        String url,

        // Cloudinary can report the original dimensions; they are optional because the
        // listing card only needs them to avoid layout shift.
        @Min(value = 0, message = "Width cannot be negative")
        @Max(value = 20000, message = "Width looks implausible")
        Integer width,

        @Min(value = 0, message = "Height cannot be negative")
        @Max(value = 20000, message = "Height looks implausible")
        Integer height,

        Boolean isCover
) {
}