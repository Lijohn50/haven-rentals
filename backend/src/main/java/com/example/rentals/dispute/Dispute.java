package com.example.rentals.dispute;

import com.example.rentals.booking.Booking;
import com.example.rentals.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "disputes")
@Getter
@Setter
@NoArgsConstructor
public class Dispute {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "raised_by", nullable = false)
    private User raisedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 30)
    private DisputeCategory category;

    @Column(name = "description", nullable = false, length = 2000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 15)
    private DisputeStatus status = DisputeStatus.OPEN;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_agent_id")
    private User assignedAgent;

    @Enumerated(EnumType.STRING)
    @Column(name = "resolution_type", length = 15)
    private ResolutionType resolutionType;

    @Column(name = "refund_amount", precision = 12, scale = 2)
    private BigDecimal refundAmount;

    @Column(name = "resolution_note", length = 2000)
    private String resolutionNote;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    public Dispute(Booking booking, User raisedBy, DisputeCategory category, String description, Instant createdAt) {
        this.booking = booking;
        this.raisedBy = raisedBy;
        this.category = category;
        this.description = description;
        this.status = DisputeStatus.OPEN;
        this.createdAt = createdAt;
    }
}
