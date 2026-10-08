package com.example.rentals.dispute.dto;

import com.example.rentals.booking.dto.BookingHistoryResponse;
import com.example.rentals.booking.dto.BookingResponse;
import com.example.rentals.messaging.dto.MessageResponse;
import com.example.rentals.payment.dto.PaymentResponse;

import java.util.List;

public record SupportDisputeDetailResponse(
        DisputeResponse dispute,
        BookingResponse booking,
        PaymentResponse payment,
        List<BookingHistoryResponse> statusHistory,
        List<MessageResponse> messages
) {
}
