package com.example.rentals.listing;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "listing_photos")
@Getter
@Setter
@NoArgsConstructor
public class ListingPhoto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "listing_id", nullable = false)
    private Listing listing;

    /**
     * Either a local storage key (served by /api/v1/media/listings/{id}/{key}) or an
     * absolute https delivery URL when the image is hosted externally, e.g. Cloudinary.
     * Callers must not assume it is a bare filename.
     */
    @Column(name = "storage_key", nullable = false, unique = true, length = 500)
    private String storageKey;

    @Column(name = "content_type", nullable = false, length = 30)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(nullable = false)
    private int width;

    @Column(nullable = false)
    private int height;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Column(name = "is_cover", nullable = false)
    private boolean isCover = false;

    public ListingPhoto(Listing listing, String storageKey, String contentType, long sizeBytes, int width, int height, int sortOrder, boolean isCover) {
        this.listing = listing;
        this.storageKey = storageKey;
        this.contentType = contentType;
        this.sizeBytes = sizeBytes;
        this.width = width;
        this.height = height;
        this.sortOrder = sortOrder;
        this.isCover = isCover;
    }

    /** True when the image lives outside this application (e.g. Cloudinary). */
    public boolean isExternal() {
        if (storageKey == null) return false;
        return storageKey.startsWith("https://") || storageKey.startsWith("http://");
    }
}
