package com.example.rentals.pricing;

import com.example.rentals.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "commission_settings")
@Getter
@Setter
@NoArgsConstructor
public class CommissionSetting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "guest_service_fee_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal guestServiceFeePercent;

    @Column(name = "host_commission_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal hostCommissionPercent;

    @Column(name = "tax_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal taxPercent;

    @Column(name = "effective_from", nullable = false, unique = true)
    private Instant effectiveFrom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public CommissionSetting(BigDecimal guestServiceFeePercent, BigDecimal hostCommissionPercent, BigDecimal taxPercent, Instant effectiveFrom, User createdBy) {
        this.guestServiceFeePercent = guestServiceFeePercent;
        this.hostCommissionPercent = hostCommissionPercent;
        this.taxPercent = taxPercent;
        this.effectiveFrom = effectiveFrom;
        this.createdBy = createdBy;
        this.createdAt = Instant.now();
    }
}
