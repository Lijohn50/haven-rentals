package com.example.rentals.pricing.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record NightLineResponse(
        LocalDate date,
        BigDecimal rate,
        boolean isWeekend,
        boolean isSeasonal,
        String seasonName
) {}
