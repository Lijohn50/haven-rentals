package com.example.rentals.listing.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record PhotoOrderRequest(
        @NotEmpty(message = "Photo IDs list cannot be empty")
        List<Long> photoIds
) {}
