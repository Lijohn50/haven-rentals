package com.example.rentals.common;

import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;

public final class AuditLogSpecifications {

    private AuditLogSpecifications() {}

    public static Specification<AuditLog> hasActor(Long actorId) {
        if (actorId == null) return null;
        return (root, query, cb) -> cb.equal(root.get("actorId"), actorId);
    }

    public static Specification<AuditLog> hasEntityType(String entityType) {
        if (entityType == null || entityType.isBlank()) return null;
        return (root, query, cb) -> cb.equal(root.get("entityType"), entityType.trim());
    }

    public static Specification<AuditLog> hasAction(String action) {
        if (action == null || action.isBlank()) return null;
        return (root, query, cb) -> cb.equal(root.get("action"), action.trim());
    }

    public static Specification<AuditLog> createdFrom(Instant from) {
        if (from == null) return null;
        return (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("createdAt"), from);
    }

    public static Specification<AuditLog> createdTo(Instant to) {
        if (to == null) return null;
        return (root, query, cb) -> cb.lessThanOrEqualTo(root.get("createdAt"), to);
    }

    /**
     * Newest first, with the id as a tiebreaker: several entries share a {@code createdAt}
     * when written in the same batch, and without a stable tiebreaker paging can repeat or
     * skip them.
     */
    public static Specification<AuditLog> newestFirst() {
        return (root, query, cb) -> {
            if (query != null) {
                query.orderBy(cb.desc(root.get("createdAt")), cb.desc(root.get("id")));
            }
            return cb.conjunction();
        };
    }
}