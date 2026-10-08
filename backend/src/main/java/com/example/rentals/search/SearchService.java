package com.example.rentals.search;

import com.example.rentals.common.*;
import com.example.rentals.listing.Listing;
import com.example.rentals.listing.ListingRepository;
import com.example.rentals.listing.ListingStatus;
import com.example.rentals.pricing.PriceBreakdown;
import com.example.rentals.pricing.PricingService;
import com.example.rentals.search.dto.CitySuggestionResponse;
import com.example.rentals.search.dto.SearchResultResponse;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class SearchService {

    private final ListingRepository listingRepository;
    private final PricingService pricingService;
    private final Clock clock;

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional(readOnly = true)
    @Cacheable(value = CacheConfig.CACHE_SEARCH_RESULTS, key = "#criteria.toString()")
    public PageResponse<SearchResultResponse> search(SearchCriteria criteria) {
        validateSearchCriteria(criteria);

        Specification<Listing> spec = Specification.where(ListingSpecifications.isActiveAndHostActive());

        if (criteria.city() != null) {
            spec = spec.and(ListingSpecifications.hasCity(criteria.city()));
        }
        if (criteria.country() != null) {
            spec = spec.and(ListingSpecifications.hasCountry(criteria.country()));
        }
        if (criteria.guests() > 0) {
            spec = spec.and(ListingSpecifications.hasGuests(criteria.guests()));
        }
        if (criteria.minPrice() != null || criteria.maxPrice() != null) {
            spec = spec.and(ListingSpecifications.hasPriceRange(criteria.minPrice(), criteria.maxPrice()));
        }
        if (criteria.amenityIds() != null && !criteria.amenityIds().isEmpty()) {
            spec = spec.and(ListingSpecifications.hasAllAmenities(criteria.amenityIds()));
        }
        if (criteria.checkIn() != null && criteria.checkOut() != null) {
            spec = spec.and(ListingSpecifications.hasDatesAvailable(criteria.checkIn(), criteria.checkOut()));
        }
        if (criteria.propertyType() != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("propertyType"), criteria.propertyType()));
        }
        if (criteria.minBedrooms() != null) {
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("bedrooms"), criteria.minBedrooms()));
        }
        if (criteria.minRating() != null) {
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("averageRating"), criteria.minRating()));
        }
        if (criteria.instantBook() != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("instantBook"), criteria.instantBook()));
        }

        Sort sort = buildSort(criteria.sort());
        Pageable pageable = PageRequest.of(criteria.page(), criteria.size(), sort);

        Page<Listing> page = listingRepository.findAll(spec, pageable);

        Integer nights = null;
        if (criteria.checkIn() != null && criteria.checkOut() != null) {
            nights = (int) ChronoUnit.DAYS.between(criteria.checkIn(), criteria.checkOut());
        }

        final Integer stayNights = nights;
        List<SearchResultResponse> dtos = new ArrayList<>();
        for (Listing listing : page.getContent()) {
            BigDecimal totalPrice = null;
            if (stayNights != null) {
                try {
                    PriceBreakdown pb = pricingService.calculate(listing, criteria.checkIn(), criteria.checkOut(), criteria.guests());
                    totalPrice = pb.getTotalAmount();
                } catch (Exception e) {
                    log.debug("Could not calculate stay price for listing {}: {}", listing.getId(), e.getMessage());
                }
            }
            dtos.add(SearchResultResponse.from(listing, totalPrice, stayNights));
        }

        return PageResponse.of(dtos, page.getNumber(), page.getSize(), page.getTotalElements());
    }

    @Transactional(readOnly = true)
    public List<CitySuggestionResponse> getCitySuggestions(String prefix, int limit) {
        int max = Math.min(Math.max(1, limit), 20);
        String escaped = prefix != null ? ListingSpecifications.escapeLikePattern(prefix.trim().toLowerCase()) : "";

        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
            SELECT l.city, l.country, COUNT(l.id) as cnt
            FROM listings l
            JOIN users u ON l.host_id = u.id
            WHERE l.status = 'ACTIVE'
              AND u.status = 'ACTIVE'
              AND LOWER(l.city) LIKE CONCAT(:prefix, '%')
            GROUP BY l.city, l.country
            ORDER BY cnt DESC, l.city ASC
            LIMIT :limit
        """)
        .setParameter("prefix", escaped)
        .setParameter("limit", max)
        .getResultList();

        List<CitySuggestionResponse> result = new ArrayList<>();
        for (Object[] r : rows) {
            result.add(new CitySuggestionResponse((String) r[0], (String) r[1], ((Number) r[2]).longValue()));
        }
        return result;
    }

    private void validateSearchCriteria(SearchCriteria c) {
        if (c.page() < 0) {
            throw new ApiException(ErrorCode.MALFORMED_REQUEST, "Page number cannot be negative");
        }
        if (c.size() < 1 || c.size() > 50) {
            throw new ApiException(ErrorCode.INVALID_PAGE_SIZE, "Page size must be between 1 and 50");
        }
        if (c.minPrice() != null && c.maxPrice() != null && c.minPrice().compareTo(c.maxPrice()) > 0) {
            throw new ApiException(ErrorCode.MALFORMED_REQUEST, "minPrice must be less than or equal to maxPrice");
        }
        if ((c.checkIn() != null && c.checkOut() == null) || (c.checkIn() == null && c.checkOut() != null)) {
            throw new ApiException(ErrorCode.INVALID_DATE_RANGE, "Both checkIn and checkOut must be provided together");
        }
        if (c.checkIn() != null && c.checkOut() != null) {
            if (!c.checkIn().isBefore(c.checkOut())) {
                throw new ApiException(ErrorCode.INVALID_DATE_RANGE, "checkIn must be strictly before checkOut");
            }
            LocalDate todayUtc = LocalDate.now(clock);
            if (c.checkIn().isBefore(todayUtc)) {
                throw new ApiException(ErrorCode.INVALID_DATE_RANGE, "checkIn date cannot be in the past");
            }
            long nights = ChronoUnit.DAYS.between(c.checkIn(), c.checkOut());
            if (nights > 365) {
                throw new ApiException(ErrorCode.INVALID_DATE_RANGE, "Search stay length cannot exceed 365 nights");
            }
        }
    }

    private Sort buildSort(SearchSort searchSort) {
        SearchSort s = searchSort != null ? searchSort : SearchSort.RATING_DESC;
        Sort base = switch (s) {
            case PRICE_ASC -> Sort.by(Sort.Direction.ASC, "baseNightlyPrice");
            case PRICE_DESC -> Sort.by(Sort.Direction.DESC, "baseNightlyPrice");
            case RATING_DESC -> Sort.by(Sort.Direction.DESC, "averageRating");
            case NEWEST -> Sort.by(Sort.Direction.DESC, "createdAt");
        };
        // ID as tiebreaker for stable pagination
        return base.and(Sort.by(Sort.Direction.ASC, "id"));
    }
}
