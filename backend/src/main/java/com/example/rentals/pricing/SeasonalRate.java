package com.example.rentals.pricing;

import com.example.rentals.listing.Listing;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "seasonal_rates")
@Getter
@Setter
@NoArgsConstructor
public class SeasonalRate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "listing_id", nullable = false)
    private Listing listing;

    @Column(nullable = false, length = 60)
    private String name;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "nightly_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal nightlyPrice;

    public SeasonalRate(Listing listing, String name, LocalDate startDate, LocalDate endDate, BigDecimal nightlyPrice) {
        this.listing = listing;
        this.name = name.trim();
        this.startDate = startDate;
        this.endDate = endDate;
        this.nightlyPrice = nightlyPrice;
    }
}
