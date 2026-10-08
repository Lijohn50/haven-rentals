package com.example.rentals.user;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "host_profiles")
@Getter
@Setter
@NoArgsConstructor
public class HostProfile {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "display_name", nullable = false, length = 80)
    private String displayName;

    @Column(length = 1000)
    private String bio;

    @Column(name = "host_cancellation_count", nullable = false)
    private int hostCancellationCount = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public HostProfile(User user, String displayName, String bio) {
        this.user = user;
        this.displayName = displayName.trim();
        this.bio = bio != null ? bio.trim() : null;
        this.hostCancellationCount = 0;
        this.createdAt = Instant.now();
    }
}
