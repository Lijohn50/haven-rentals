package com.example.rentals.availability.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CalendarDayResponse(
        LocalDate date,
        boolean available,
        CalendarUnavailableReason reason,
        BigDecimal nightlyPrice
) {}
