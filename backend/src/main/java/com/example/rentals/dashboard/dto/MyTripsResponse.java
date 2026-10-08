package com.example.rentals.dashboard.dto;

import com.example.rentals.booking.dto.BookingResponse;

import java.util.List;

public record MyTripsResponse(
        List<BookingResponse> upcoming,
        List<BookingResponse> past,
        List<BookingResponse> cancelled
) {
}
