package com.example.rentals.payment;

import com.example.rentals.booking.Booking;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "payments")
@Getter
@Setter
@NoArgsConstructor
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PaymentStatus status;

    @Column(name = "idempotency_key", nullable = false, unique = true, length = 80)
    private String idempotencyKey;

    @Column(name = "provider_reference", length = 80)
    private String providerReference;

    @Column(name = "failure_code", length = 40)
    private String failureCode;

    @Column(name = "refunded_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal refundedTotal = BigDecimal.ZERO;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Version
    @Column(nullable = false)
    private Long version;

    public Payment(Booking booking, BigDecimal amount, PaymentStatus status, String idempotencyKey) {
        this.booking = booking;
        this.amount = amount;
        this.status = status;
        this.idempotencyKey = idempotencyKey;
        this.refundedTotal = BigDecimal.ZERO;
        this.createdAt = Instant.now();
    }
}
