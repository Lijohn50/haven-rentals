package com.example.rentals.dispute.dto;

import com.example.rentals.common.NoHtml;
import com.example.rentals.dispute.ResolutionType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record ResolveDisputeRequest(
        @NotNull(message = "Resolution type is required")
        ResolutionType resolutionType,

        @DecimalMin(value = "0.00", message = "Refund amount cannot be negative")
        @Digits(integer = 10, fraction = 2, message = "Refund amount can have at most 2 decimal places")
        BigDecimal refundAmount,

        @NotBlank(message = "Resolution note is required")
        @Size(min = 10, max = 2000, message = "Resolution note must be between 10 and 2000 characters")
        @NoHtml
        String note
) {
}
