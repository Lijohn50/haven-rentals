package com.example.rentals.common;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long>, JpaSpecificationExecutor<AuditLog> {
    /**
     * The optional filters live in {@link AuditLogSpecifications} rather than JPQL: every
     * filter here is nullable, and a `:param IS NULL` guard does not stop Postgres from
     * failing to infer the JDBC type of an untyped null bind. That made the admin audit log
     * return 500 for every request, filtered or not.
     */
}
