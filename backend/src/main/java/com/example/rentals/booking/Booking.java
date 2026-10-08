package com.example.rentals.booking;

import com.example.rentals.common.ConflictException;
import com.example.rentals.common.ErrorCode;
import com.example.rentals.listing.CancellationPolicyType;
import com.example.rentals.listing.Listing;
import com.example.rentals.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Map;

@Entity
@Table(name = "bookings")
@Getter
@Setter
@NoArgsConstructor
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 12)
    private String reference;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "listing_id", nullable = false)
    private Listing listing;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "guest_id", nullable = false)
    private User guest;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "host_id", nullable = false)
    private User host;

    @Column(name = "idempotency_key", length = 64)
    private String idempotencyKey;

    @Column(name = "check_in", nullable = false)
    private LocalDate checkIn;

    @Column(name = "check_out", nullable = false)
    private LocalDate checkOut;

    @Column(nullable = false)
    private int nights;

    @Column(name = "guests_count", nullable = false)
    private int guestsCount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BookingStatus status;

    @Column(name = "instant_book", nullable = false)
    private boolean instantBook;

    @Column(name = "guest_message", length = 1000)
    private String guestMessage;

    // Price snapshot
    @Column(name = "nightly_subtotal", nullable = false, precision = 12, scale = 2)
    private BigDecimal nightlySubtotal;

    @Column(name = "discount_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal discountTotal;

    @Column(name = "cleaning_fee", nullable = false, precision = 12, scale = 2)
    private BigDecimal cleaningFee;

    @Column(name = "service_fee", nullable = false, precision = 12, scale = 2)
    private BigDecimal serviceFee;

    @Column(name = "tax_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal taxTotal;

    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "host_commission", nullable = false, precision = 12, scale = 2)
    private BigDecimal hostCommission;

    @Column(name = "host_payout_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal hostPayoutAmount;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "price_breakdown", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> priceBreakdown;

    // Snapshots
    @Enumerated(EnumType.STRING)
    @Column(name = "cancellation_policy", nullable = false, length = 10)
    private CancellationPolicyType cancellationPolicy;

    @Column(name = "listing_timezone", nullable = false, length = 50)
    private String listingTimezone;

    @Column(name = "check_in_time", nullable = false)
    private LocalTime checkInTime;

    @Column(name = "check_out_time", nullable = false)
    private LocalTime checkOutTime;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "confirmed_at")
    private Instant confirmedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cancelled_by")
    private User cancelledBy;

    @Column(name = "cancellation_reason", length = 500)
    private String cancellationReason;

    @Column(name = "decline_reason", length = 500)
    private String declineReason;

    @Column(name = "refund_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal refundAmount = BigDecimal.ZERO;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Version
    @Column(nullable = false)
    private Long version;

    @PrePersist
    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    public Instant getCheckInDateTime() {
        return checkIn.atTime(checkInTime).atZone(ZoneId.of(listingTimezone)).toInstant();
    }

    public Instant getCheckOutDateTime() {
        return checkOut.atTime(checkOutTime).atZone(ZoneId.of(listingTimezone)).toInstant();
    }

    public boolean isCancelled() {
        return status == BookingStatus.CANCELLED_BY_GUEST || status == BookingStatus.CANCELLED_BY_HOST;
    }

    public void transitionTo(BookingStatus newStatus, User actor) {
        boolean valid = switch (this.status) {
            case PENDING_PAYMENT -> (newStatus == BookingStatus.CONFIRMED ||
                                     newStatus == BookingStatus.PENDING_APPROVAL ||
                                     newStatus == BookingStatus.PAYMENT_FAILED ||
                                     newStatus == BookingStatus.EXPIRED);
            case PENDING_APPROVAL -> (newStatus == BookingStatus.CONFIRMED ||
                                      newStatus == BookingStatus.DECLINED ||
                                      newStatus == BookingStatus.EXPIRED ||
                                      newStatus == BookingStatus.CANCELLED_BY_GUEST);
            case CONFIRMED -> (newStatus == BookingStatus.CANCELLED_BY_GUEST ||
                               newStatus == BookingStatus.CANCELLED_BY_HOST ||
                               newStatus == BookingStatus.COMPLETED);
            default -> false;
        };

        if (!valid) {
            throw new ConflictException(ErrorCode.INVALID_STATE_TRANSITION,
                    "Cannot transition booking from " + this.status + " to " + newStatus);
        }

        Instant now = Instant.now();
        this.status = newStatus;

        if (newStatus == BookingStatus.CONFIRMED) {
            this.confirmedAt = now;
            this.expiresAt = null;
        } else if (newStatus == BookingStatus.COMPLETED) {
            this.completedAt = now;
        } else if (newStatus == BookingStatus.CANCELLED_BY_GUEST || newStatus == BookingStatus.CANCELLED_BY_HOST) {
            this.cancelledAt = now;
            this.cancelledBy = actor;
            this.expiresAt = null;
        } else if (newStatus == BookingStatus.DECLINED || newStatus == BookingStatus.EXPIRED || newStatus == BookingStatus.PAYMENT_FAILED) {
            this.expiresAt = null;
        }
    }
}
