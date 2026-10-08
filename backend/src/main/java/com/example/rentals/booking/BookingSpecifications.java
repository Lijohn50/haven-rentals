package com.example.rentals.booking;

import org.springframework.data.jpa.domain.Specification;

public final class BookingSpecifications {

    private BookingSpecifications() {}

    public static Specification<Booking> hasHost(Long hostId) {
        return (root, query, cb) -> cb.equal(root.get("host").get("id"), hostId);
    }

    public static Specification<Booking> hasStatus(BookingStatus status) {
        if (status == null) return null;
        return (root, query, cb) -> cb.equal(root.get("status"), status);
    }

    public static Specification<Booking> hasListing(Long listingId) {
        if (listingId == null) return null;
        return (root, query, cb) -> cb.equal(root.get("listing").get("id"), listingId);
    }

    /** Newest first, with the id as a tiebreaker so paging stays stable within a second. */
    public static Specification<Booking> newestFirst() {
        return (root, query, cb) -> {
            if (query != null) {
                query.orderBy(cb.desc(root.get("createdAt")), cb.desc(root.get("id")));
            }
            return cb.conjunction();
        };
    }
}