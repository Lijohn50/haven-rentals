package com.example.rentals.payment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RefundRepository extends JpaRepository<Refund, Long> {
    List<Refund> findByPaymentIdOrderByCreatedAtDesc(Long paymentId);
    List<Refund> findByBookingIdOrderByCreatedAtDesc(Long bookingId);
    Optional<Refund> findByIdempotencyKey(String idempotencyKey);
    List<Refund> findByStatusAndAttemptCountLessThan(RefundStatus status, int maxAttempts);
}
