package com.example.rentals.search;

import com.example.rentals.availability.AvailabilityBlock;
import com.example.rentals.listing.Amenity;
import com.example.rentals.listing.Listing;
import com.example.rentals.listing.ListingStatus;
import com.example.rentals.user.UserStatus;
import jakarta.persistence.criteria.*;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class ListingSpecifications {

    private ListingSpecifications() {}

    public static Specification<Listing> isActiveAndHostActive() {
        return (root, query, cb) -> cb.and(
                cb.equal(root.get("status"), ListingStatus.ACTIVE),
                cb.equal(root.get("host").get("status"), UserStatus.ACTIVE)
        );
    }

    public static Specification<Listing> hasCity(String city) {
        if (city == null || city.isBlank()) return null;
        String escaped = escapeLikePattern(city.trim().toLowerCase());
        return (root, query, cb) -> cb.like(cb.lower(root.get("city")), "%" + escaped + "%", '\\');
    }

    public static Specification<Listing> hasCountry(String country) {
        if (country == null || country.isBlank()) return null;
        return (root, query, cb) -> cb.equal(cb.upper(root.get("country")), country.trim().toUpperCase());
    }

    public static Specification<Listing> hasGuests(int guests) {
        return (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("maxGuests"), guests);
    }

    public static Specification<Listing> hasPriceRange(BigDecimal min, BigDecimal max) {
        return (root, query, cb) -> {
            Predicate p = cb.conjunction();
            if (min != null) {
                p = cb.and(p, cb.greaterThanOrEqualTo(root.get("baseNightlyPrice"), min));
            }
            if (max != null) {
                p = cb.and(p, cb.lessThanOrEqualTo(root.get("baseNightlyPrice"), max));
            }
            return p;
        };
    }

    public static Specification<Listing> hasAllAmenities(List<Long> amenityIds) {
        if (amenityIds == null || amenityIds.isEmpty()) return null;
        return (root, query, cb) -> {
            query.distinct(true);
            Subquery<Long> subquery = query.subquery(Long.class);
            Root<Listing> subRoot = subquery.from(Listing.class);
            Join<Listing, Amenity> amenityJoin = subRoot.join("amenities");

            subquery.select(subRoot.get("id"))
                    .where(
                            cb.equal(subRoot.get("id"), root.get("id")),
                            amenityJoin.get("id").in(amenityIds)
                    )
                    .groupBy(subRoot.get("id"))
                    .having(cb.equal(cb.count(amenityJoin.get("id")), (long) amenityIds.size()));

            return cb.exists(subquery);
        };
    }

    public static Specification<Listing> hasDatesAvailable(LocalDate checkIn, LocalDate checkOut) {
        if (checkIn == null || checkOut == null) return null;
        return (root, query, cb) -> {
            int nights = (int) java.time.temporal.ChronoUnit.DAYS.between(checkIn, checkOut);

            Predicate nightsPredicate = cb.and(
                    cb.lessThanOrEqualTo(root.get("minNights"), nights),
                    cb.greaterThanOrEqualTo(root.get("maxNights"), nights)
            );

            // Subquery: check no overlapping blocks
            Subquery<Long> blockSub = query.subquery(Long.class);
            Root<AvailabilityBlock> blockRoot = blockSub.from(AvailabilityBlock.class);
            blockSub.select(blockRoot.get("id"))
                    .where(
                            cb.equal(blockRoot.get("listing").get("id"), root.get("id")),
                            cb.lessThan(blockRoot.get("startDate"), checkOut),
                            cb.greaterThan(blockRoot.get("endDate"), checkIn)
                    );

            return cb.and(nightsPredicate, cb.not(cb.exists(blockSub)));
        };
    }

    public static String escapeLikePattern(String text) {
        return text.replace("\\", "\\\\")
                   .replace("%", "\\%")
                   .replace("_", "\\_");
    }
}
