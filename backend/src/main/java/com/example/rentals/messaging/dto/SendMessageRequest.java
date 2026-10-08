package com.example.rentals.messaging.dto;

import com.example.rentals.common.NoHtml;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SendMessageRequest(
        @NotBlank(message = "Message body is required")
        @Size(min = 1, max = 2000, message = "Message must be between 1 and 2000 characters")
        @NoHtml
        String body
) {}
