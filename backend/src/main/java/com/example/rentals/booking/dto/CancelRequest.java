package com.example.rentals.booking.dto;

import com.example.rentals.common.NoHtml;
import jakarta.validation.constraints.Size;

public record CancelRequest(
        @Size(max = 500, message = "Cancellation reason must not exceed 500 characters")
        @NoHtml
        String reason
) {}
