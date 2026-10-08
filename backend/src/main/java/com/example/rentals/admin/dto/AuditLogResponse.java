package com.example.rentals.admin.dto;

import com.example.rentals.common.AuditLog;

import java.time.Instant;
import java.util.Map;

public record AuditLogResponse(
        Long id,
        Long actorId,
        String action,
        String entityType,
        Long entityId,
        Map<String, Object> details,
        Instant createdAt
) {
    public static AuditLogResponse from(AuditLog log) {
        return new AuditLogResponse(
                log.getId(),
                log.getActorId(),
                log.getAction(),
                log.getEntityType(),
                log.getEntityId(),
                log.getDetails(),
                log.getCreatedAt()
        );
    }
}
