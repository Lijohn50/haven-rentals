package com.example.rentals.booking;

import com.example.rentals.availability.AvailabilityService;
import com.example.rentals.booking.dto.*;
import com.example.rentals.common.*;
import com.example.rentals.listing.Listing;
import com.example.rentals.listing.ListingRepository;
import com.example.rentals.listing.ListingStatus;
import com.example.rentals.payment.*;
import com.example.rentals.pricing.PriceBreakdown;
import com.example.rentals.pricing.PricingService;
import com.example.rentals.pricing.dto.PriceBreakdownResponse;
import com.example.rentals.pricing.dto.QuoteResponse;
import com.example.rentals.user.User;
import com.example.rentals.user.UserRepository;
import com.example.rentals.user.UserStatus;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class BookingService {

    private final BookingRepository bookingRepository;
    private final BookingStatusHistoryRepository historyRepository;
    private final ListingRepository listingRepository;
    private final UserRepository userRepository;
    private final AvailabilityService availabilityService;
    private final PricingService pricingService;
    private final PaymentService paymentService;
    private final PaymentGateway paymentGateway;
    private final RefundService refundService;
    private final PayoutService payoutService;
    private final CancellationPolicyResolver policyResolver;
    private final BookingReferenceGenerator referenceGenerator;
    private final AuditService auditService;
    private final AppProperties appProperties;
    private final Clock clock;
    private final CacheManager cacheManager;
    /**
     * Spring Boot's auto-configured mapper. It must not be replaced with a bare
     * `new ObjectMapper()`: that one has no JavaTimeModule, so converting the price
     * breakdown threw "Java 8 date/time type java.time.LocalDate not supported by default"
     * on every booking and surfaced to the guest as a 500 on the continue-to-payment step.
     */
    private final ObjectMapper objectMapper;
    private final PlatformTransactionManager transactionManager;

    /**
     * `payBooking` must keep the gateway call outside a database transaction, so it cannot be
     * annotated with `@Transactional` itself. Calling the `@Transactional` helpers below with
     * `this` bypasses the Spring proxy, which left the pessimistic write lock in
     * `findByIdForUpdate` running without a transaction
     * ("Query requires transaction be in progress"). TransactionTemplate makes both
     * boundaries explicit instead of relying on proxy interception.
     */
    private TransactionTemplate tx() {
        return new TransactionTemplate(transactionManager);
    }

    @Transactional
    public BookingResponse createHold(Long guestId, CreateBookingRequest req, String idempotencyKey) {
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<Booking> existing = bookingRepository.findByGuestIdAndIdempotencyKey(guestId, idempotencyKey);
            if (existing.isPresent()) {
                return toResponse(existing.get(), guestId);
            }
        }

        User guest = userRepository.findById(guestId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!guest.isEmailVerified()) {
            throw new ApiException(ErrorCode.EMAIL_NOT_VERIFIED, HttpStatus.FORBIDDEN, "Email must be verified before booking");
        }

        int activeHolds = bookingRepository.countByGuestIdAndStatus(guestId, BookingStatus.PENDING_PAYMENT);
        if (activeHolds >= 3) {
            throw new BusinessRuleException("Maximum 3 pending booking holds allowed at a time");
        }

        // Lock listing row
        Listing listing = listingRepository.findByIdForUpdate(req.listingId())
                .filter(l -> l.getStatus() != ListingStatus.DELETED)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));

        if (listing.getStatus() != ListingStatus.ACTIVE || listing.getHost().getStatus() != UserStatus.ACTIVE) {
            throw new ConflictException(ErrorCode.LISTING_NOT_BOOKABLE, "Listing is not currently active for booking");
        }

        if (listing.getHost().getId().equals(guestId)) {
            throw new BusinessRuleException("Hosts cannot book their own listings");
        }

        availabilityService.checkAvailability(listing.getId(), req.checkIn(), req.checkOut(), req.guests());

        PriceBreakdown priceBreakdown = pricingService.calculate(listing, req.checkIn(), req.checkOut(), req.guests());

        if (priceBreakdown.getTotalAmount().compareTo(req.expectedTotal()) != 0) {
            QuoteResponse newQuote = new QuoteResponse(
                    listing.getId(),
                    req.checkIn(),
                    req.checkOut(),
                    (int) ChronoUnit.DAYS.between(req.checkIn(), req.checkOut()),
                    req.guests(),
                    listing.isInstantBook(),
                    PriceBreakdownResponse.from(priceBreakdown)
            );
            throw new ConflictException(ErrorCode.PRICE_CHANGED, "Listing price has changed. Please review new quote.",
                    Map.of("newQuote", newQuote));
        }

        Instant now = clock.instant();
        Instant expiresAt = now.plus(appProperties.getBooking().getPaymentHoldMinutes(), ChronoUnit.MINUTES);

        Booking booking = new Booking();
        booking.setReference(referenceGenerator.generate());
        booking.setListing(listing);
        booking.setGuest(guest);
        booking.setHost(listing.getHost());
        booking.setIdempotencyKey(idempotencyKey);
        booking.setCheckIn(req.checkIn());
        booking.setCheckOut(req.checkOut());
        booking.setNights((int) ChronoUnit.DAYS.between(req.checkIn(), req.checkOut()));
        booking.setGuestsCount(req.guests());
        booking.setStatus(BookingStatus.PENDING_PAYMENT);
        booking.setInstantBook(listing.isInstantBook());
        booking.setGuestMessage(req.message());

        booking.setNightlySubtotal(priceBreakdown.getNightlySubtotal());
        booking.setDiscountTotal(priceBreakdown.getDiscountTotal());
        booking.setCleaningFee(priceBreakdown.getCleaningFee());
        booking.setServiceFee(priceBreakdown.getServiceFee());
        booking.setTaxTotal(priceBreakdown.getTaxTotal());
        booking.setTotalAmount(priceBreakdown.getTotalAmount());
        booking.setHostCommission(priceBreakdown.getHostCommission());
        booking.setHostPayoutAmount(priceBreakdown.getHostPayoutAmount());

        Map<String, Object> breakdownMap = objectMapper.convertValue(
                PriceBreakdownResponse.from(priceBreakdown), new TypeReference<Map<String, Object>>() {});
        booking.setPriceBreakdown(breakdownMap);

        booking.setCancellationPolicy(listing.getCancellationPolicy());
        booking.setListingTimezone(listing.getTimezone());
        booking.setCheckInTime(listing.getCheckInTime());
        booking.setCheckOutTime(listing.getCheckOutTime());
        booking.setExpiresAt(expiresAt);

        booking = bookingRepository.save(booking);

        recordHistory(booking, null, BookingStatus.PENDING_PAYMENT.name(), guestId, "GUEST", "Booking hold created");

        var searchCache = cacheManager.getCache(CacheConfig.CACHE_SEARCH_RESULTS);
        if (searchCache != null) searchCache.clear();

        return toResponse(booking, guestId);
    }

    public BookingResponse payBooking(Long guestId, Long bookingId, PayBookingRequest req) {
        if (req.paymentToken().matches("^\\d{13,19}$")) {
            throw new ApiException(ErrorCode.MALFORMED_REQUEST, "Raw card numbers are not accepted. Use simulated token.");
        }

        // Step 1: Pre-charge transaction
        Booking booking = tx().execute(status -> getValidPendingBooking(guestId, bookingId));
        Payment payment = tx().execute(status -> paymentService.createPendingPayment(booking));

        // Step 2: Payment Gateway call outside transaction
        PaymentGateway.ChargeResult result = paymentGateway.charge(req.paymentToken(), booking.getTotalAmount(), payment.getIdempotencyKey());

        // Step 3: Post-charge transaction
        return tx().execute(status -> finalizePayment(bookingId, guestId, payment.getId(), result));
    }

    @Transactional
    public Booking getValidPendingBooking(Long guestId, Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

        if (!booking.getGuest().getId().equals(guestId)) {
            throw new ResourceNotFoundException("Booking not found");
        }

        if (booking.getStatus() != BookingStatus.PENDING_PAYMENT) {
            throw new ConflictException(ErrorCode.INVALID_STATE_TRANSITION, "Booking is not in PENDING_PAYMENT status");
        }

        if (booking.getExpiresAt() != null && booking.getExpiresAt().isBefore(clock.instant())) {
            throw new ConflictException(ErrorCode.BOOKING_EXPIRED, "Booking hold has expired");
        }

        return booking;
    }

    @Transactional
    public BookingResponse finalizePayment(Long bookingId, Long guestId, Long paymentId, PaymentGateway.ChargeResult result) {
        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

        User guest = booking.getGuest();
        Instant now = clock.instant();

        if (result.success()) {
            // Check if expired in the meantime
            if (booking.getExpiresAt() != null && booking.getExpiresAt().isBefore(now)) {
                log.warn("Payment succeeded but hold expired for booking id={}", bookingId);
                refundService.issueRefund(booking, booking.getTotalAmount(), RefundReason.LATE_PAYMENT, null);
                throw new ConflictException(ErrorCode.BOOKING_EXPIRED, "Payment received after hold expired; refund has been issued");
            }

            if (booking.isInstantBook()) {
                booking.transitionTo(BookingStatus.CONFIRMED, guest);
                ZoneId zoneId = ZoneId.of(booking.getListingTimezone());
                Instant checkInInstant = booking.getCheckIn().atTime(booking.getCheckInTime()).atZone(zoneId).toInstant();
                Instant scheduledPayout = checkInInstant.plus(appProperties.getPayout().getReleaseDelayHours(), ChronoUnit.HOURS);
                payoutService.createPayout(booking, scheduledPayout.isBefore(now) ? now : scheduledPayout);
            } else {
                booking.transitionTo(BookingStatus.PENDING_APPROVAL, guest);
                booking.setExpiresAt(now.plus(appProperties.getBooking().getHostResponseHours(), ChronoUnit.HOURS));
            }

            recordHistory(booking, BookingStatus.PENDING_PAYMENT.name(), booking.getStatus().name(), guestId, "GUEST", "Payment succeeded");
        } else {
            booking.transitionTo(BookingStatus.PAYMENT_FAILED, guest);
            recordHistory(booking, BookingStatus.PENDING_PAYMENT.name(), BookingStatus.PAYMENT_FAILED.name(), guestId, "GUEST", "Payment failed: " + result.failureCode());
            bookingRepository.save(booking);

            throw new ApiException(ErrorCode.PAYMENT_FAILED, HttpStatus.PAYMENT_REQUIRED,
                    "Payment was declined: " + result.failureCode(), Map.of("failureCode", result.failureCode()));
        }

        booking = bookingRepository.save(booking);

        var searchCache = cacheManager.getCache(CacheConfig.CACHE_SEARCH_RESULTS);
        if (searchCache != null) searchCache.clear();
        evictHostDashboard();

        return toResponse(booking, guestId);
    }

    @Transactional
    public BookingResponse cancelByGuest(Long guestId, Long bookingId, CancelRequest req) {
        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

        if (!booking.getGuest().getId().equals(guestId)) {
            throw new ResourceNotFoundException("Booking not found");
        }

        if (booking.getStatus() != BookingStatus.PENDING_APPROVAL && booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new ConflictException(ErrorCode.INVALID_STATE_TRANSITION, "Cannot cancel booking in status: " + booking.getStatus());
        }

        ZoneId zoneId = ZoneId.of(booking.getListingTimezone());
        Instant checkInInstant = booking.getCheckIn().atTime(booking.getCheckInTime()).atZone(zoneId).toInstant();
        Instant now = clock.instant();

        if (!now.isBefore(checkInInstant)) {
            throw new ConflictException(ErrorCode.CANCELLATION_NOT_ALLOWED, "Stay has already started; cancellation is not allowed. Open a dispute instead.");
        }

        BigDecimal refundAmount;
        if (booking.getStatus() == BookingStatus.PENDING_APPROVAL) {
            refundAmount = booking.getTotalAmount();
        } else {
            CancellationPolicy policy = policyResolver.resolve(booking.getCancellationPolicy());
            refundAmount = policy.calculateRefund(booking, now);
        }

        String fromStatus = booking.getStatus().name();
        booking.transitionTo(BookingStatus.CANCELLED_BY_GUEST, booking.getGuest());
        booking.setRefundAmount(refundAmount);
        booking.setCancellationReason(req != null ? req.reason() : null);

        booking = bookingRepository.save(booking);
        recordHistory(booking, fromStatus, BookingStatus.CANCELLED_BY_GUEST.name(), guestId, "GUEST", req != null ? req.reason() : null);

        if (refundAmount.compareTo(BigDecimal.ZERO) > 0) {
            refundService.issueRefund(booking, refundAmount, RefundReason.GUEST_CANCELLATION, null);
        }
        payoutService.adjustPayoutOnCancellation(booking, refundAmount);

        var searchCache = cacheManager.getCache(CacheConfig.CACHE_SEARCH_RESULTS);
        if (searchCache != null) searchCache.clear();
        evictHostDashboard();

        return toResponse(booking, guestId);
    }

    @Transactional
    public BookingResponse hostCancel(Long hostId, Long bookingId, CancelRequest req) {
        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

        if (!booking.getHost().getId().equals(hostId)) {
            throw new ResourceNotFoundException("Booking not found");
        }

        if (booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new ConflictException(ErrorCode.INVALID_STATE_TRANSITION, "Hosts can only cancel CONFIRMED bookings. For pending requests use decline.");
        }

        if (req == null || req.reason() == null || req.reason().trim().length() < 10) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Host cancellation reason must be at least 10 characters");
        }

        ZoneId zoneId = ZoneId.of(booking.getListingTimezone());
        Instant checkInInstant = booking.getCheckIn().atTime(booking.getCheckInTime()).atZone(zoneId).toInstant();
        Instant now = clock.instant();

        if (!now.isBefore(checkInInstant)) {
            throw new ConflictException(ErrorCode.CANCELLATION_NOT_ALLOWED, "Cannot cancel booking after check-in time has passed");
        }

        BigDecimal refundAmount = booking.getTotalAmount();
        String fromStatus = booking.getStatus().name();

        booking.transitionTo(BookingStatus.CANCELLED_BY_HOST, booking.getHost());
        booking.setRefundAmount(refundAmount);
        booking.setCancellationReason(req.reason().trim());

        if (booking.getHost().getHostProfile() != null) {
            booking.getHost().getHostProfile().setHostCancellationCount(
                    booking.getHost().getHostProfile().getHostCancellationCount() + 1);
        }

        booking = bookingRepository.save(booking);
        recordHistory(booking, fromStatus, BookingStatus.CANCELLED_BY_HOST.name(), hostId, "HOST", req.reason());

        refundService.issueRefund(booking, refundAmount, RefundReason.HOST_CANCELLATION, null);
        payoutService.adjustPayoutOnCancellation(booking, refundAmount);

        auditService.record(hostId, "BOOKING_CANCELLED_BY_HOST", "Booking", booking.getId(),
                Map.of("reason", req.reason(), "refundAmount", refundAmount));

        var searchCache = cacheManager.getCache(CacheConfig.CACHE_SEARCH_RESULTS);
        if (searchCache != null) searchCache.clear();
        evictHostDashboard();

        return toResponse(booking, hostId);
    }

    /**
     * The cached dashboard embeds pending-request counts, upcoming
     * check-ins and recent bookings, so any booking transition must
     * drop it immediately instead of waiting out its 60 second TTL.
     */
    private void evictHostDashboard() {
        var dashboardCache = cacheManager.getCache(CacheConfig.CACHE_HOST_DASHBOARD);
        if (dashboardCache != null) dashboardCache.clear();
    }

    @Transactional
    public BookingResponse hostApprove(Long hostId, Long bookingId) {
        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

        if (!booking.getHost().getId().equals(hostId)) {
            throw new ResourceNotFoundException("Booking not found");
        }

        if (booking.getStatus() != BookingStatus.PENDING_APPROVAL) {
            throw new ConflictException(ErrorCode.INVALID_STATE_TRANSITION, "Booking is not in PENDING_APPROVAL status");
        }

        Instant now = clock.instant();
        if (booking.getExpiresAt() != null && booking.getExpiresAt().isBefore(now)) {
            throw new ConflictException(ErrorCode.BOOKING_EXPIRED, "Approval request deadline has expired");
        }

        booking.transitionTo(BookingStatus.CONFIRMED, booking.getHost());

        ZoneId zoneId = ZoneId.of(booking.getListingTimezone());
        Instant checkInInstant = booking.getCheckIn().atTime(booking.getCheckInTime()).atZone(zoneId).toInstant();
        Instant scheduledPayout = checkInInstant.plus(appProperties.getPayout().getReleaseDelayHours(), ChronoUnit.HOURS);
        payoutService.createPayout(booking, scheduledPayout.isBefore(now) ? now : scheduledPayout);

        recordHistory(booking, BookingStatus.PENDING_APPROVAL.name(), BookingStatus.CONFIRMED.name(), hostId, "HOST", "Host approved booking request");
        booking = bookingRepository.save(booking);

        evictHostDashboard();

        return toResponse(booking, hostId);
    }

    @Transactional
    public BookingResponse hostDecline(Long hostId, Long bookingId, DeclineRequest req) {
        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

        if (!booking.getHost().getId().equals(hostId)) {
            throw new ResourceNotFoundException("Booking not found");
        }

        if (booking.getStatus() != BookingStatus.PENDING_APPROVAL) {
            throw new ConflictException(ErrorCode.INVALID_STATE_TRANSITION, "Booking is not in PENDING_APPROVAL status");
        }

        booking.transitionTo(BookingStatus.DECLINED, booking.getHost());
        booking.setDeclineReason(req.reason().trim());
        booking.setRefundAmount(booking.getTotalAmount());

        recordHistory(booking, BookingStatus.PENDING_APPROVAL.name(), BookingStatus.DECLINED.name(), hostId, "HOST", req.reason());
        booking = bookingRepository.save(booking);

        refundService.issueRefund(booking, booking.getTotalAmount(), RefundReason.HOST_DECLINED, null);

        var searchCache = cacheManager.getCache(CacheConfig.CACHE_SEARCH_RESULTS);
        if (searchCache != null) searchCache.clear();
        evictHostDashboard();

        return toResponse(booking, hostId);
    }

    @Transactional(readOnly = true)
    public CancellationPreviewResponse getCancellationPreview(Long userId, Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

        if (!booking.getGuest().getId().equals(userId) && !booking.getHost().getId().equals(userId)) {
            throw new ResourceNotFoundException("Booking not found");
        }

        Instant now = clock.instant();
        BigDecimal refundAmount;
        if (booking.getStatus() == BookingStatus.PENDING_APPROVAL || booking.getHost().getId().equals(userId)) {
            refundAmount = booking.getTotalAmount();
        } else {
            CancellationPolicy policy = policyResolver.resolve(booking.getCancellationPolicy());
            refundAmount = policy.calculateRefund(booking, now);
        }

        BigDecimal nonRefundable = booking.getTotalAmount().subtract(refundAmount).max(BigDecimal.ZERO);
        return new CancellationPreviewResponse(
                refundAmount,
                nonRefundable,
                booking.getCancellationPolicy().name(),
                "Refund calculated according to " + booking.getCancellationPolicy() + " cancellation policy."
        );
    }

    @Transactional(readOnly = true)
    public Page<BookingResponse> getGuestBookings(Long guestId, BookingStatus status, Pageable pageable) {
        Page<Booking> page = (status != null) ?
                bookingRepository.findByGuestIdAndStatusOrderByCreatedAtDesc(guestId, status, pageable) :
                bookingRepository.findByGuestIdOrderByCreatedAtDesc(guestId, pageable);
        return page.map(b -> toResponse(b, guestId));
    }

    @Transactional(readOnly = true)
    public Page<BookingResponse> getHostBookings(Long hostId, BookingStatus status, Long listingId, Pageable pageable) {
        Specification<Booking> spec = BookingSpecifications.newestFirst()
                .and(BookingSpecifications.hasHost(hostId))
                .and(BookingSpecifications.hasStatus(status))
                .and(BookingSpecifications.hasListing(listingId));
        return bookingRepository.findAll(spec, pageable)
                .map(b -> toResponse(b, hostId));
    }

    @Transactional(readOnly = true)
    public BookingResponse getBooking(Long bookingId, Long currentUserId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
        validateBookingAccess(booking, currentUserId);
        return toResponse(booking, currentUserId);
    }

    @Transactional(readOnly = true)
    public BookingResponse getBookingByReference(String reference, Long currentUserId) {
        Booking booking = bookingRepository.findByReference(reference)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
        validateBookingAccess(booking, currentUserId);
        return toResponse(booking, currentUserId);
    }

    /**
     * Staff (admin/support) read access: authorization happens at the controller
     * via role checks, so no ownership validation is done here. The response
     * carries the full status history and no guest/host-only action list.
     */
    @Transactional(readOnly = true)
    public BookingResponse getBookingForStaff(Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
        return toResponse(booking, null);
    }

    @Transactional(readOnly = true)
    public BookingResponse getBookingByReferenceForStaff(String reference) {
        Booking booking = bookingRepository.findByReference(reference)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
        return toResponse(booking, null);
    }

    private void validateBookingAccess(Booking booking, Long currentUserId) {
        if (currentUserId == null) throw new ResourceNotFoundException("Booking not found");
        User user = userRepository.findById(currentUserId).orElse(null);
        boolean isStaff = user != null && (user.hasRole(com.example.rentals.user.Role.ADMIN) || user.hasRole(com.example.rentals.user.Role.SUPPORT_AGENT));
        if (!booking.getGuest().getId().equals(currentUserId) && !booking.getHost().getId().equals(currentUserId) && !isStaff) {
            throw new ResourceNotFoundException("Booking not found");
        }
    }

    private void recordHistory(Booking booking, String from, String to, Long actorId, String actorType, String reason) {
        BookingStatusHistory h = new BookingStatusHistory(booking, from, to, actorId, actorType, reason);
        historyRepository.save(h);
    }

    private BookingResponse toResponse(Booking b, Long currentUserId) {
        List<BookingStatusHistory> histories = historyRepository.findByBookingIdOrderByCreatedAtAsc(b.getId());
        List<BookingHistoryResponse> historyResponses = histories.stream().map(BookingHistoryResponse::from).toList();
        List<BookingAction> actions = computeAllowedActions(b, currentUserId);
        return BookingResponse.from(b, currentUserId, actions, historyResponses);
    }

    private List<BookingAction> computeAllowedActions(Booking b, Long userId) {
        if (userId == null) return List.of();
        List<BookingAction> actions = new ArrayList<>();
        boolean isGuest = userId.equals(b.getGuest().getId());
        boolean isHost = userId.equals(b.getHost().getId());

        if (isGuest) {
            if (b.getStatus() == BookingStatus.PENDING_PAYMENT) {
                actions.add(BookingAction.PAY);
            }
            if (b.getStatus() == BookingStatus.PENDING_APPROVAL || b.getStatus() == BookingStatus.CONFIRMED) {
                actions.add(BookingAction.CANCEL);
            }
            if (b.getStatus() == BookingStatus.COMPLETED) {
                actions.add(BookingAction.REVIEW);
                actions.add(BookingAction.OPEN_DISPUTE);
            }
            actions.add(BookingAction.MESSAGE);
        } else if (isHost) {
            if (b.getStatus() == BookingStatus.PENDING_APPROVAL) {
                actions.add(BookingAction.APPROVE);
                actions.add(BookingAction.DECLINE);
            }
            if (b.getStatus() == BookingStatus.CONFIRMED) {
                actions.add(BookingAction.CANCEL);
            }
            if (b.getStatus() == BookingStatus.COMPLETED) {
                actions.add(BookingAction.REVIEW);
            }
            actions.add(BookingAction.MESSAGE);
        }
        return actions;
    }
}
