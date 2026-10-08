package com.example.rentals.dispute.dto;

import com.example.rentals.common.NoHtml;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RejectDisputeRequest(
        @NotBlank(message = "Rejection note is required")
        @Size(min = 10, max = 2000, message = "Rejection note must be between 10 and 2000 characters")
        @NoHtml
        String note
) {
}
