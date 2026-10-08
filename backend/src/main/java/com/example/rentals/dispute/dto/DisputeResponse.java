package com.example.rentals.dispute.dto;

import com.example.rentals.dispute.Dispute;
import com.example.rentals.dispute.DisputeCategory;
import com.example.rentals.dispute.DisputeStatus;
import com.example.rentals.dispute.ResolutionType;

import java.math.BigDecimal;
import java.time.Instant;

public record DisputeResponse(
        Long id,
        Long bookingId,
        String bookingReference,
        Long raisedById,
        DisputeCategory category,
        String description,
        DisputeStatus status,
        Long assignedAgentId,
        ResolutionType resolutionType,
        BigDecimal refundAmount,
        String resolutionNote,
        Instant createdAt,
        Instant resolvedAt
) {
    public static DisputeResponse from(Dispute d) {
        return new DisputeResponse(
                d.getId(),
                d.getBooking().getId(),
                d.getBooking().getReference(),
                d.getRaisedBy().getId(),
                d.getCategory(),
                d.getDescription(),
                d.getStatus(),
                d.getAssignedAgent() != null ? d.getAssignedAgent().getId() : null,
                d.getResolutionType(),
                d.getRefundAmount(),
                d.getResolutionNote(),
                d.getCreatedAt(),
                d.getResolvedAt()
        );
    }
}
