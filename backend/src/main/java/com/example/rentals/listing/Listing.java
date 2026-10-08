package com.example.rentals.listing;

import com.example.rentals.common.ConflictException;
import com.example.rentals.common.ErrorCode;
import com.example.rentals.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "listings")
@Getter
@Setter
@NoArgsConstructor
public class Listing {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "host_id", nullable = false)
    private User host;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "property_type", nullable = false, length = 20)
    private PropertyType propertyType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ListingStatus status = ListingStatus.DRAFT;

    @Column(name = "rejection_reason", length = 500)
    private String rejectionReason;

    @Column(name = "address_line", nullable = false, length = 200)
    private String addressLine;

    @Column(nullable = false, length = 100)
    private String city;

    @Column(name = "state_region", length = 100)
    private String stateRegion;

    @Column(nullable = false, length = 2)
    private String country;

    @Column(name = "postal_code", length = 20)
    private String postalCode;

    @Column(nullable = false, precision = 9, scale = 6)
    private BigDecimal latitude;

    @Column(nullable = false, precision = 9, scale = 6)
    private BigDecimal longitude;

    @Column(nullable = false, length = 50)
    private String timezone;

    @Column(name = "max_guests", nullable = false)
    private int maxGuests;

    @Column(nullable = false)
    private int bedrooms;

    @Column(nullable = false)
    private int beds;

    @Column(nullable = false, precision = 3, scale = 1)
    private BigDecimal bathrooms;

    @Column(name = "base_nightly_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal baseNightlyPrice;

    @Column(name = "weekend_multiplier", nullable = false, precision = 4, scale = 2)
    private BigDecimal weekendMultiplier = new BigDecimal("1.00");

    @Column(name = "cleaning_fee", nullable = false, precision = 12, scale = 2)
    private BigDecimal cleaningFee = BigDecimal.ZERO;

    @Column(name = "weekly_discount_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal weeklyDiscountPercent = BigDecimal.ZERO;

    @Column(name = "monthly_discount_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal monthlyDiscountPercent = BigDecimal.ZERO;

    @Column(name = "min_nights", nullable = false)
    private int minNights = 1;

    @Column(name = "max_nights", nullable = false)
    private int maxNights = 365;

    @Column(name = "advance_notice_days", nullable = false)
    private int advanceNoticeDays = 0;

    @Column(name = "booking_window_days", nullable = false)
    private int bookingWindowDays = 365;

    @Column(name = "check_in_time", nullable = false)
    private LocalTime checkInTime = LocalTime.of(15, 0);

    @Column(name = "check_out_time", nullable = false)
    private LocalTime checkOutTime = LocalTime.of(11, 0);

    @Enumerated(EnumType.STRING)
    @Column(name = "cancellation_policy", nullable = false, length = 10)
    private CancellationPolicyType cancellationPolicy = CancellationPolicyType.MODERATE;

    @Column(name = "instant_book", nullable = false)
    private boolean instantBook = false;

    @Column(name = "average_rating", nullable = false, precision = 3, scale = 2)
    private BigDecimal averageRating = BigDecimal.ZERO;

    @Column(name = "review_count", nullable = false)
    private int reviewCount = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Version
    @Column(nullable = false)
    private Long version;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "listing_amenities",
        joinColumns = @JoinColumn(name = "listing_id"),
        inverseJoinColumns = @JoinColumn(name = "amenity_id")
    )
    private Set<Amenity> amenities = new HashSet<>();

    @OneToMany(mappedBy = "listing", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("sortOrder ASC")
    private List<ListingPhoto> photos = new ArrayList<>();

    @OneToMany(mappedBy = "listing", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("sortOrder ASC")
    private List<HouseRule> houseRules = new ArrayList<>();

    public void submit() {
        if (status != ListingStatus.DRAFT && status != ListingStatus.REJECTED) {
            throw new ConflictException(ErrorCode.INVALID_STATE_TRANSITION,
                    "Cannot submit listing from status: " + status);
        }
        this.status = ListingStatus.PENDING_REVIEW;
        this.rejectionReason = null;
        this.updatedAt = Instant.now();
    }

    public void approve() {
        if (status != ListingStatus.PENDING_REVIEW) {
            throw new ConflictException(ErrorCode.INVALID_STATE_TRANSITION,
                    "Cannot approve listing from status: " + status);
        }
        this.status = ListingStatus.ACTIVE;
        this.updatedAt = Instant.now();
    }

    public void reject(String reason) {
        if (status != ListingStatus.PENDING_REVIEW) {
            throw new ConflictException(ErrorCode.INVALID_STATE_TRANSITION,
                    "Cannot reject listing from status: " + status);
        }
        this.status = ListingStatus.REJECTED;
        this.rejectionReason = reason;
        this.updatedAt = Instant.now();
    }

    public void pause() {
        if (status != ListingStatus.ACTIVE) {
            throw new ConflictException(ErrorCode.INVALID_STATE_TRANSITION,
                    "Cannot pause listing from status: " + status);
        }
        this.status = ListingStatus.PAUSED;
        this.updatedAt = Instant.now();
    }

    public void resume() {
        if (status != ListingStatus.PAUSED) {
            throw new ConflictException(ErrorCode.INVALID_STATE_TRANSITION,
                    "Cannot resume listing from status: " + status);
        }
        this.status = ListingStatus.ACTIVE;
        this.updatedAt = Instant.now();
    }

    public void suspend(String reason) {
        if (status != ListingStatus.ACTIVE && status != ListingStatus.PAUSED) {
            throw new ConflictException(ErrorCode.INVALID_STATE_TRANSITION,
                    "Cannot suspend listing from status: " + status);
        }
        this.status = ListingStatus.SUSPENDED;
        this.rejectionReason = reason;
        this.updatedAt = Instant.now();
    }

    public void reinstate() {
        if (status != ListingStatus.SUSPENDED) {
            throw new ConflictException(ErrorCode.INVALID_STATE_TRANSITION,
                    "Cannot reinstate listing from status: " + status);
        }
        this.status = ListingStatus.ACTIVE;
        this.rejectionReason = null;
        this.updatedAt = Instant.now();
    }

    public void softDelete() {
        if (status == ListingStatus.DELETED) {
            throw new ConflictException(ErrorCode.INVALID_STATE_TRANSITION, "Listing is already deleted");
        }
        this.status = ListingStatus.DELETED;
        this.deletedAt = Instant.now();
        this.updatedAt = Instant.now();
    }
}
