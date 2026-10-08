package com.example.rentals.listing;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "amenities")
@Getter
@Setter
@NoArgsConstructor
public class Amenity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 60)
    private String name;

    @Column(nullable = false, length = 40)
    private String category;

    @Column(length = 40)
    private String icon;

    @Column(nullable = false)
    private boolean active = true;

    public Amenity(String name, String category, String icon) {
        this.name = name.trim();
        this.category = category.trim();
        this.icon = icon;
        this.active = true;
    }
}
