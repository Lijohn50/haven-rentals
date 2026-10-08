package com.example.rentals.booking.dto;

import com.example.rentals.booking.BookingStatusHistory;

import java.time.Instant;

public record BookingHistoryResponse(
        String fromStatus,
        String toStatus,
        String actorType,
        String reason,
        Instant createdAt
) {
    public static BookingHistoryResponse from(BookingStatusHistory h) {
        return new BookingHistoryResponse(
                h.getFromStatus(),
                h.getToStatus(),
                h.getActorType(),
                h.getReason(),
                h.getCreatedAt()
        );
    }
}
