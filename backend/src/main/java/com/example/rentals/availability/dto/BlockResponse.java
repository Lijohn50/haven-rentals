package com.example.rentals.availability.dto;

import com.example.rentals.availability.AvailabilityBlock;

import java.time.LocalDate;

public record BlockResponse(
        Long id,
        Long listingId,
        LocalDate startDate,
        LocalDate endDate,
        String reason
) {
    public static BlockResponse from(AvailabilityBlock block) {
        return new BlockResponse(
                block.getId(),
                block.getListing().getId(),
                block.getStartDate(),
                block.getEndDate(),
                block.getReason()
        );
    }
}
