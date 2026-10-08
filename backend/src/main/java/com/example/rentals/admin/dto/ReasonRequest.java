package com.example.rentals.admin.dto;

import com.example.rentals.common.NoHtml;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReasonRequest(
        @NotBlank(message = "Reason is required")
        @Size(min = 10, max = 500, message = "Reason must be between 10 and 500 characters")
        @NoHtml
        String reason
) {
}
