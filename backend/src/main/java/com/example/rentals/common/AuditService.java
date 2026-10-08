package com.example.rentals.common;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    @Transactional(propagation = Propagation.REQUIRED)
    public void record(Long actorId, String action, String entityType, Long entityId, Map<String, Object> details) {
        try {
            AuditLog logEntry = new AuditLog(actorId, action, entityType, entityId, details);
            auditLogRepository.save(logEntry);
            log.info("Audit logged: action={}, entityType={}, entityId={}, actorId={}", action, entityType, entityId, actorId);
        } catch (Exception e) {
            log.error("Failed to write audit log for action={}", action, e);
        }
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public void log(Long actorId, String action, String entityType, Long entityId, Map<String, Object> details) {
        record(actorId, action, entityType, entityId, details);
    }

    @Transactional(readOnly = true)
    public Page<AuditLog> query(Long actorId, String entityType, String action, Instant from, Instant to, Pageable pageable) {
        Specification<AuditLog> spec = AuditLogSpecifications.newestFirst()
                .and(AuditLogSpecifications.hasActor(actorId))
                .and(AuditLogSpecifications.hasEntityType(entityType))
                .and(AuditLogSpecifications.hasAction(action))
                .and(AuditLogSpecifications.createdFrom(from))
                .and(AuditLogSpecifications.createdTo(to));
        return auditLogRepository.findAll(spec, pageable);
    }
}
