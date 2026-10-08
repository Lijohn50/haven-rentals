package com.example.rentals.messaging.dto;

import java.time.Instant;
import java.util.List;

public record MessagePageResponse(
        List<MessageResponse> content,
        boolean hasMore,
        Instant nextCursor
) {}
