package com.example.rentals.availability;

import com.example.rentals.listing.Listing;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "availability_blocks")
@Getter
@Setter
@NoArgsConstructor
public class AvailabilityBlock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "listing_id", nullable = false)
    private Listing listing;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(length = 200)
    private String reason;

    public AvailabilityBlock(Listing listing, LocalDate startDate, LocalDate endDate, String reason) {
        this.listing = listing;
        this.startDate = startDate;
        this.endDate = endDate;
        this.reason = reason;
    }
}
