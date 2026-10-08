package com.example.rentals.listing;

import com.example.rentals.common.*;
import com.example.rentals.listing.dto.*;
import com.example.rentals.user.Role;
import com.example.rentals.user.User;
import com.example.rentals.user.UserRepository;
import com.example.rentals.user.UserStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ListingService {

    private final ListingRepository listingRepository;
    private final AmenityRepository amenityRepository;
    private final HouseRuleRepository houseRuleRepository;
    private final ListingPhotoRepository photoRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;
    private final CacheManager cacheManager;
    private final Clock clock;
    private final AppProperties appProperties;

    @Transactional(readOnly = true)
    public ListingResponse getPublicListing(Long id, Long currentUserId) {
        Listing listing = listingRepository.findById(id)
                .filter(l -> l.getStatus() != ListingStatus.DELETED)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));

        if (listing.getStatus() == ListingStatus.ACTIVE) {
            // The public view of a live listing is identical for every
            // visitor, so it can be cached. The non-active branch below is
            // gated to the host or an admin and must never be cached, or a
            // random visitor would be served an unlisted listing.
            var cache = cacheManager.getCache(CacheConfig.CACHE_LISTING_DETAIL);
            if (cache != null) {
                ListingResponse cached = cache.get(id, ListingResponse.class);
                if (cached != null) {
                    return cached;
                }
            }
            ListingResponse response = ListingResponse.from(listing);
            if (cache != null) {
                cache.put(id, response);
            }
            return response;
        }

        if (currentUserId != null) {
            User user = userRepository.findById(currentUserId).orElse(null);
            if (user != null && (listing.getHost().getId().equals(currentUserId) || user.hasRole(Role.ADMIN))) {
                return ListingResponse.from(listing);
            }
        }

        throw new ResourceNotFoundException("Listing not found");
    }

    @Transactional
    public ListingResponse createDraft(Long hostId, ListingRequest req) {
        User host = userRepository.findById(hostId)
                .orElseThrow(() -> new ResourceNotFoundException("Host not found"));

        if (!host.hasRole(Role.HOST) || host.getStatus() != UserStatus.ACTIVE) {
            throw new ApiException(ErrorCode.FORBIDDEN, "Only active hosts can create listings");
        }

        int activeCount = listingRepository.countByHostIdAndStatusNot(hostId, ListingStatus.DELETED);
        if (activeCount >= 50) {
            throw new BusinessRuleException("A host may have at most 50 non-deleted listings");
        }

        validateListingBusinessRules(req);

        Listing listing = new Listing();
        listing.setHost(host);
        listing.setStatus(ListingStatus.DRAFT);
        applyRequestToListing(listing, req);

        listing = listingRepository.save(listing);
        auditService.record(hostId, "LISTING_CREATED", "Listing", listing.getId(), Map.of("title", listing.getTitle()));

        return ListingResponse.from(listing);
    }

    @Transactional(readOnly = true)
    public Page<ListingSummaryResponse> getHostListings(Long hostId, ListingStatus status, Pageable pageable) {
        Page<Listing> page;
        if (status != null) {
            page = listingRepository.findByHostIdAndStatus(hostId, status, pageable);
        } else {
            page = listingRepository.findByHostIdAndStatusNot(hostId, ListingStatus.DELETED, pageable);
        }
        return page.map(ListingSummaryResponse::from);
    }

    @Transactional(readOnly = true)
    public ListingResponse getHostListing(Long hostId, Long listingId) {
        Listing listing = listingRepository.findByIdAndHostId(listingId, hostId)
                .filter(l -> l.getStatus() != ListingStatus.DELETED)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));
        return ListingResponse.from(listing);
    }

    @Transactional
    public ListingResponse updateListing(Long hostId, Long listingId, ListingRequest req) {
        Listing listing = listingRepository.findByIdAndHostId(listingId, hostId)
                .filter(l -> l.getStatus() != ListingStatus.DELETED)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));

        if (listing.getStatus() == ListingStatus.PENDING_REVIEW) {
            throw new ConflictException(ErrorCode.INVALID_STATE_TRANSITION, "Cannot edit listing while under review");
        }

        validateListingBusinessRules(req);

        boolean coreLocationChanged = !listing.getCountry().equalsIgnoreCase(req.country()) ||
                                      !listing.getCity().equalsIgnoreCase(req.city()) ||
                                      !listing.getAddressLine().equalsIgnoreCase(req.addressLine()) ||
                                      listing.getPropertyType() != req.propertyType() ||
                                      listing.getLatitude().compareTo(req.latitude()) != 0 ||
                                      listing.getLongitude().compareTo(req.longitude()) != 0;

        applyRequestToListing(listing, req);

        if (listing.getStatus() == ListingStatus.ACTIVE && coreLocationChanged) {
            log.info("Listing {} core location changed; moving from ACTIVE to PENDING_REVIEW", listingId);
            listing.setStatus(ListingStatus.PENDING_REVIEW);
        }

        listing = listingRepository.save(listing);
        evictListingCache(listingId);

        return ListingResponse.from(listing);
    }

    @Transactional
    public void submitListing(Long hostId, Long listingId) {
        Listing listing = listingRepository.findByIdAndHostId(listingId, hostId)
                .filter(l -> l.getStatus() != ListingStatus.DELETED)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));

        User host = listing.getHost();
        if (!host.isEmailVerified()) {
            throw new ApiException(ErrorCode.EMAIL_NOT_VERIFIED, HttpStatus.FORBIDDEN, "Email must be verified before submitting listing");
        }

        int photoCount = photoRepository.countByListingId(listingId);
        int minPhotos = appProperties.getUpload().getMinPhotosToSubmit();
        if (photoCount < minPhotos) {
            throw new BusinessRuleException("Listing must have at least " + minPhotos + " photos to be submitted for review");
        }

        Optional<ListingPhoto> cover = photoRepository.findByListingIdAndIsCoverTrue(listingId);
        if (cover.isEmpty()) {
            List<ListingPhoto> photos = photoRepository.findByListingIdOrderBySortOrderAsc(listingId);
            if (!photos.isEmpty()) {
                photos.get(0).setCover(true);
                photoRepository.save(photos.get(0));
            }
        }

        listing.submit();
        listingRepository.save(listing);
        auditService.record(hostId, "LISTING_SUBMITTED", "Listing", listingId, Map.of());
        evictListingCache(listingId);
    }

    @Transactional
    public void pauseListing(Long hostId, Long listingId) {
        Listing listing = listingRepository.findByIdAndHostId(listingId, hostId)
                .filter(l -> l.getStatus() != ListingStatus.DELETED)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));
        listing.pause();
        listingRepository.save(listing);
        evictListingCache(listingId);
    }

    @Transactional
    public void resumeListing(Long hostId, Long listingId) {
        Listing listing = listingRepository.findByIdAndHostId(listingId, hostId)
                .filter(l -> l.getStatus() != ListingStatus.DELETED)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));
        listing.resume();
        listingRepository.save(listing);
        evictListingCache(listingId);
    }

    @Transactional
    public void deleteListing(Long hostId, Long listingId) {
        Listing listing = listingRepository.findByIdAndHostId(listingId, hostId)
                .filter(l -> l.getStatus() != ListingStatus.DELETED)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));

        listing.softDelete();
        listingRepository.save(listing);
        auditService.record(hostId, "LISTING_DELETED", "Listing", listingId, Map.of());
        evictListingCache(listingId);
    }

    @Transactional
    public ListingResponse updateAmenities(Long hostId, Long listingId, Set<Long> amenityIds) {
        Listing listing = listingRepository.findByIdAndHostId(listingId, hostId)
                .filter(l -> l.getStatus() != ListingStatus.DELETED)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));

        Set<Amenity> amenities = new HashSet<>();
        if (amenityIds != null && !amenityIds.isEmpty()) {
            List<Amenity> found = amenityRepository.findAllById(amenityIds);
            for (Amenity a : found) {
                if (a.isActive()) {
                    amenities.add(a);
                }
            }
        }
        listing.setAmenities(amenities);
        listing = listingRepository.save(listing);
        evictListingCache(listingId);
        return ListingResponse.from(listing);
    }

    @Transactional
    public ListingResponse updateHouseRules(Long hostId, Long listingId, List<HouseRuleItemDto> rules) {
        Listing listing = listingRepository.findByIdAndHostId(listingId, hostId)
                .filter(l -> l.getStatus() != ListingStatus.DELETED)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));

        houseRuleRepository.deleteByListingId(listingId);
        List<HouseRule> houseRules = new ArrayList<>();
        if (rules != null) {
            int order = 0;
            for (HouseRuleItemDto dto : rules) {
                houseRules.add(new HouseRule(listing, dto.text(), dto.sortOrder() != 0 ? dto.sortOrder() : order++));
            }
        }
        houseRuleRepository.saveAll(houseRules);
        listing.setHouseRules(houseRules);
        evictListingCache(listingId);
        return ListingResponse.from(listing);
    }

    private void validateListingBusinessRules(ListingRequest req) {
        MoneyUtils.validateMoney(req.baseNightlyPrice(), "baseNightlyPrice", false);
        if (req.cleaningFee() != null) {
            MoneyUtils.validateMoney(req.cleaningFee(), "cleaningFee", true);
        }
        if (req.minNights() != null && req.maxNights() != null && req.maxNights() < req.minNights()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "maxNights must be greater than or equal to minNights");
        }
        if (req.weeklyDiscountPercent() != null && req.monthlyDiscountPercent() != null) {
            if (req.monthlyDiscountPercent().compareTo(req.weeklyDiscountPercent()) < 0) {
                throw new ApiException(ErrorCode.VALIDATION_ERROR, "monthlyDiscountPercent must be greater than or equal to weeklyDiscountPercent");
            }
        }
    }

    private void applyRequestToListing(Listing listing, ListingRequest req) {
        listing.setTitle(req.title().trim());
        listing.setDescription(req.description().trim());
        listing.setPropertyType(req.propertyType());
        listing.setAddressLine(req.addressLine().trim());
        listing.setCity(req.city().trim());
        listing.setStateRegion(req.stateRegion() != null ? req.stateRegion().trim() : null);
        listing.setCountry(req.country().trim().toUpperCase());
        listing.setPostalCode(req.postalCode() != null ? req.postalCode().trim() : null);
        listing.setLatitude(req.latitude());
        listing.setLongitude(req.longitude());
        listing.setTimezone(req.timezone().trim());
        listing.setMaxGuests(req.maxGuests());
        listing.setBedrooms(req.bedrooms());
        listing.setBeds(req.beds());
        listing.setBathrooms(req.bathrooms());
        listing.setBaseNightlyPrice(req.baseNightlyPrice());
        if (req.weekendMultiplier() != null) listing.setWeekendMultiplier(req.weekendMultiplier());
        if (req.cleaningFee() != null) listing.setCleaningFee(req.cleaningFee());
        if (req.weeklyDiscountPercent() != null) listing.setWeeklyDiscountPercent(req.weeklyDiscountPercent());
        if (req.monthlyDiscountPercent() != null) listing.setMonthlyDiscountPercent(req.monthlyDiscountPercent());
        if (req.minNights() != null) listing.setMinNights(req.minNights());
        if (req.maxNights() != null) listing.setMaxNights(req.maxNights());
        if (req.advanceNoticeDays() != null) listing.setAdvanceNoticeDays(req.advanceNoticeDays());
        if (req.bookingWindowDays() != null) listing.setBookingWindowDays(req.bookingWindowDays());
        if (req.checkInTime() != null) listing.setCheckInTime(req.checkInTime());
        if (req.checkOutTime() != null) listing.setCheckOutTime(req.checkOutTime());
        listing.setCancellationPolicy(req.cancellationPolicy());
        listing.setInstantBook(req.instantBook());
    }

    private void evictListingCache(Long listingId) {
        var cache = cacheManager.getCache(CacheConfig.CACHE_LISTING_DETAIL);
        if (cache != null) cache.evict(listingId);
        var searchCache = cacheManager.getCache(CacheConfig.CACHE_SEARCH_RESULTS);
        if (searchCache != null) searchCache.clear();
    }
}
