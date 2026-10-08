package com.example.rentals.common;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

/**
 * Append-only. `audit_logs` has a BEFORE UPDATE OR DELETE trigger (`trg_audit_immutable`)
 * that raises unconditionally, so any UPDATE Hibernate generates fails the whole transaction.
 * The audit entry for a refund is written inside the same transaction as the refund, so that
 * failure surfaced as a 500 on cancel and rolled the refund back with it.
 *
 * `@Immutable` plus `updatable = false` on every column makes Hibernate skip dirty checking for
 * this entity, so an UPDATE cannot be emitted even when the insert happens inside a batched,
 * identity-generated flush.
 */
@Immutable
@Entity
@Table(name = "audit_logs")
@Getter
@Setter
@NoArgsConstructor
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "actor_id", updatable = false)
    private Long actorId;

    @Column(name = "action", nullable = false, length = 60, updatable = false)
    private String action;

    @Column(name = "entity_type", nullable = false, length = 40, updatable = false)
    private String entityType;

    @Column(name = "entity_id", updatable = false)
    private Long entityId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "details", columnDefinition = "jsonb", updatable = false)
    private Map<String, Object> details;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public AuditLog(Long actorId, String action, String entityType, Long entityId, Map<String, Object> details) {
        this.actorId = actorId;
        this.action = action;
        this.entityType = entityType;
        this.entityId = entityId;
        this.details = details;
        this.createdAt = Instant.now();
    }
}
