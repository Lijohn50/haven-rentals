package com.example.rentals.listing.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

import java.util.List;

public record HouseRulesRequest(
        @Size(max = 15, message = "Maximum 15 house rules allowed")
        List<@Valid HouseRuleItemDto> rules
) {}
