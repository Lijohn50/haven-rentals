package com.example.rentals.payment;

import com.example.rentals.booking.Booking;
import com.example.rentals.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "payouts")
@Getter
@Setter
@NoArgsConstructor
public class Payout {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "host_id", nullable = false)
    private User host;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", nullable = false, unique = true)
    private Booking booking;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private PayoutStatus status;

    @Column(name = "scheduled_for", nullable = false)
    private Instant scheduledFor;

    @Column(name = "paid_at")
    private Instant paidAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Version
    @Column(nullable = false)
    private Long version;

    public Payout(User host, Booking booking, BigDecimal amount, Instant scheduledFor) {
        this.host = host;
        this.booking = booking;
        this.amount = amount;
        this.status = PayoutStatus.SCHEDULED;
        this.scheduledFor = scheduledFor;
        this.createdAt = Instant.now();
    }
}
