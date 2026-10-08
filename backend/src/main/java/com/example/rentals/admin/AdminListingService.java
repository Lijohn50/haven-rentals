package com.example.rentals.admin;

import com.example.rentals.admin.dto.ReasonRequest;
import com.example.rentals.common.AppProperties;
import com.example.rentals.common.AuditService;
import com.example.rentals.booking.BookingService;
import com.example.rentals.booking.dto.BookingResponse;
import com.example.rentals.common.BusinessRuleException;
import com.example.rentals.common.PageResponse;
import com.example.rentals.common.ResourceNotFoundException;
import com.example.rentals.listing.Listing;
import com.example.rentals.listing.ListingRepository;
import com.example.rentals.listing.ListingStatus;
import com.example.rentals.listing.dto.ListingResponse;
import com.example.rentals.listing.dto.ListingSummaryResponse;
import com.example.rentals.notification.NotificationService;
import com.example.rentals.notification.NotificationType;
import com.example.rentals.user.UserStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminListingService {

    private final ListingRepository listingRepository;
    private final AuditService auditService;
    private final NotificationService notificationService;
    private final CacheManager cacheManager;
    private final AppProperties appProperties;
    private final BookingService bookingService;

    @Transactional(readOnly = true)
    public PageResponse<ListingSummaryResponse> getPendingListings(int page, int size) {
        int validatedSize = Math.min(Math.max(1, size), 50);
        int validatedPage = Math.max(0, page);
        Pageable pageable = PageRequest.of(validatedPage, validatedSize);

        Page<Listing> p = listingRepository.findByStatusOrderByCreatedAtAsc(ListingStatus.PENDING_REVIEW, pageable);
        return PageResponse.from(p.map(ListingSummaryResponse::from));
    }

    @Transactional(readOnly = true)
    public ListingResponse getListingDetail(Long id) {
        Listing listing = listingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));
        return ListingResponse.from(listing);
    }

    @Transactional
    public ListingResponse approveListing(Long adminId, Long listingId) {
        Listing listing = listingRepository.findById(listingId)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));

        if (listing.getHost().getStatus() != UserStatus.ACTIVE) {
            throw new BusinessRuleException("Cannot approve listing whose host is not ACTIVE");
        }

        int minPhotos = appProperties.getUpload().getMinPhotosToSubmit();
        if (listing.getPhotos().size() < minPhotos) {
            throw new BusinessRuleException("Listing must have at least " + minPhotos + " photos to be approved");
        }

        if (listing.getBaseNightlyPrice() == null || listing.getBaseNightlyPrice().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessRuleException("Listing base nightly price must be greater than zero");
        }

        listing.approve();
        listing = listingRepository.save(listing);

        evictListingCaches(listingId);
        auditService.log(adminId, "LISTING_APPROVED", "Listing", listingId, Map.of("title", listing.getTitle()));

        notificationService.createNotification(
                listing.getHost(),
                NotificationType.LISTING_APPROVED,
                "Listing Approved",
                "Your listing '" + listing.getTitle() + "' has been approved and is now active!",
                "/host/listings"
        );

        return ListingResponse.from(listing);
    }

    @Transactional
    public ListingResponse rejectListing(Long adminId, Long listingId, ReasonRequest req) {
        Listing listing = listingRepository.findById(listingId)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));

        String reason = req.reason().trim();
        listing.reject(reason);
        listing = listingRepository.save(listing);

        evictListingCaches(listingId);
        auditService.log(adminId, "LISTING_REJECTED", "Listing", listingId,
                Map.of("title", listing.getTitle(), "reason", reason));

        notificationService.createNotification(
                listing.getHost(),
                NotificationType.LISTING_REJECTED,
                "Listing Not Approved",
                "Your listing '" + listing.getTitle() + "' requires changes: " + reason,
                "/host/listings"
        );

        return ListingResponse.from(listing);
    }

    @Transactional
    public ListingResponse suspendListing(Long adminId, Long listingId, ReasonRequest req) {
        Listing listing = listingRepository.findById(listingId)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));

        String reason = req.reason().trim();
        listing.suspend(reason);
        listing = listingRepository.save(listing);

        evictListingCaches(listingId);
        auditService.log(adminId, "LISTING_SUSPENDED", "Listing", listingId,
                Map.of("title", listing.getTitle(), "reason", reason));

        notificationService.createNotification(
                listing.getHost(),
                NotificationType.LISTING_SUSPENDED,
                "Listing Suspended",
                "Your listing '" + listing.getTitle() + "' was suspended: " + reason,
                "/host/listings"
        );

        return ListingResponse.from(listing);
    }

    @Transactional
    public ListingResponse reinstateListing(Long adminId, Long listingId) {
        Listing listing = listingRepository.findById(listingId)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));

        if (listing.getHost().getStatus() != UserStatus.ACTIVE) {
            throw new BusinessRuleException("Cannot reinstate listing whose host is not ACTIVE");
        }

        listing.reinstate();
        listing = listingRepository.save(listing);

        evictListingCaches(listingId);
        auditService.log(adminId, "LISTING_REINSTATED", "Listing", listingId, Map.of("title", listing.getTitle()));

        notificationService.createNotification(
                listing.getHost(),
                NotificationType.LISTING_APPROVED,
                "Listing Reinstated",
                "Your listing '" + listing.getTitle() + "' is active again.",
                "/host/listings"
        );

        return ListingResponse.from(listing);
    }

    @Transactional(readOnly = true)
    public BookingResponse getBookingDetail(Long bookingId) {
        // Delegated so the staff view carries the full status history,
        // exactly like the guest/host read paths.
        return bookingService.getBookingForStaff(bookingId);
    }

    @Transactional(readOnly = true)
    public BookingResponse getBookingByReference(String reference) {
        return bookingService.getBookingByReferenceForStaff(reference);
    }

    private void evictListingCaches(Long listingId) {
        try {
            var detailCache = cacheManager.getCache("listingDetail");
            if (detailCache != null) detailCache.evict(listingId);
            var searchCache = cacheManager.getCache("searchResults");
            if (searchCache != null) searchCache.clear();
        } catch (Exception e) {
            log.warn("Cache eviction error: {}", e.getMessage());
        }
    }
}
