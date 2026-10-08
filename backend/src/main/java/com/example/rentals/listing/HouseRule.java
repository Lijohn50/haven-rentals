package com.example.rentals.listing;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "house_rules")
@Getter
@Setter
@NoArgsConstructor
public class HouseRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "listing_id", nullable = false)
    private Listing listing;

    @Column(name = "rule_text", nullable = false, length = 200)
    private String ruleText;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    public HouseRule(Listing listing, String ruleText, int sortOrder) {
        this.listing = listing;
        this.ruleText = ruleText.trim();
        this.sortOrder = sortOrder;
    }
}
