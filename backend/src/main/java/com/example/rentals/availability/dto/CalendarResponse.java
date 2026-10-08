package com.example.rentals.availability.dto;

import java.time.LocalDate;
import java.util.List;

public record CalendarResponse(
        Long listingId,
        LocalDate from,
        LocalDate to,
        List<CalendarDayResponse> days
) {}
