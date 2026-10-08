package com.example.rentals.admin;

import com.example.rentals.admin.dto.AdminUserResponse;
import com.example.rentals.common.AuditService;
import com.example.rentals.admin.dto.ReasonRequest;
import com.example.rentals.admin.dto.RolesRequest;
import com.example.rentals.auth.RefreshTokenRepository;
import com.example.rentals.booking.Booking;
import com.example.rentals.booking.BookingRepository;
import com.example.rentals.booking.BookingStatus;
import com.example.rentals.booking.BookingStatusHistory;
import com.example.rentals.booking.BookingStatusHistoryRepository;
import com.example.rentals.common.BusinessRuleException;
import com.example.rentals.common.PageResponse;
import com.example.rentals.common.ResourceNotFoundException;
import com.example.rentals.listing.Listing;
import com.example.rentals.listing.ListingRepository;
import com.example.rentals.listing.ListingStatus;
import com.example.rentals.payment.Payment;
import com.example.rentals.payment.PaymentRepository;
import com.example.rentals.payment.RefundReason;
import com.example.rentals.payment.RefundService;
import com.example.rentals.user.Role;
import com.example.rentals.user.User;
import com.example.rentals.user.UserRepository;
import com.example.rentals.user.UserSpecifications;
import com.example.rentals.user.UserStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final ListingRepository listingRepository;
    private final BookingRepository bookingRepository;
    private final BookingStatusHistoryRepository bookingStatusHistoryRepository;
    private final PaymentRepository paymentRepository;
    private final RefundService refundService;
    private final AuditService auditService;
    private final CacheManager cacheManager;
    private final Clock clock;

    @Transactional(readOnly = true)
    public PageResponse<AdminUserResponse> searchUsers(String query, Role role, UserStatus status, int page, int size) {
        int validatedSize = Math.min(Math.max(1, size), 50);
        int validatedPage = Math.max(0, page);
        // The sort is mandatory: an unsorted PageRequest lets Postgres return rows in any
        // order, so paging through the admin list can repeat or skip accounts.
        Pageable pageable = PageRequest.of(validatedPage, validatedSize, Sort.by(Sort.Direction.ASC, "id"));

        Specification<User> spec = UserSpecifications.distinct()
                .and(UserSpecifications.matchesText(query))
                .and(UserSpecifications.hasRole(role))
                .and(UserSpecifications.hasStatus(status));

        Page<User> p = userRepository.findAll(spec, pageable);
        return PageResponse.from(p.map(u -> AdminUserResponse.from(u, hostCancellationCount(u.getId()))));
    }

    private int hostCancellationCount(Long userId) {
        return Math.toIntExact(bookingRepository.countByHostIdAndStatus(userId, BookingStatus.CANCELLED_BY_HOST));
    }

    @Transactional(readOnly = true)
    public AdminUserResponse getUserDetail(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return AdminUserResponse.from(user, hostCancellationCount(user.getId()));
    }

    @Transactional
    public AdminUserResponse suspendUser(Long adminId, Long targetUserId, ReasonRequest req) {
        if (adminId.equals(targetUserId)) {
            throw new BusinessRuleException("An administrator cannot suspend their own account");
        }

        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (target.hasRole(Role.ADMIN)) {
            throw new BusinessRuleException("Cannot suspend an administrator account");
        }

        if (target.getStatus() == UserStatus.SUSPENDED) {
            return AdminUserResponse.from(target, hostCancellationCount(target.getId()));
        }

        String reason = req.reason().trim();
        Instant now = clock.instant();

        cascadeAccountShutdown(targetUserId, reason);

        target.setStatus(UserStatus.SUSPENDED);
        target.setSuspensionReason(reason);
        target.setTokenVersion(target.getTokenVersion() + 1);
        refreshTokenRepository.revokeAllForUser(targetUserId, now);
        target = userRepository.save(target);

        evictUserAuthCache();
        evictSearchCache();
        auditService.log(adminId, "USER_SUSPENDED", "User", targetUserId,
                Map.of("reason", reason));

        return AdminUserResponse.from(target, hostCancellationCount(target.getId()));
    }

    @Transactional
    public AdminUserResponse unsuspendUser(Long adminId, Long targetUserId) {
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (target.getStatus() != UserStatus.SUSPENDED) {
            return AdminUserResponse.from(target, hostCancellationCount(target.getId()));
        }

        target.setStatus(UserStatus.ACTIVE);
        target = userRepository.save(target);

        evictUserAuthCache();
        evictSearchCache();
        auditService.log(adminId, "USER_UNSUSPENDED", "User", targetUserId, Map.of());

        return AdminUserResponse.from(target, hostCancellationCount(target.getId()));
    }

    @Transactional
    public AdminUserResponse changeRoles(Long adminId, Long targetUserId, RolesRequest req) {
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Set<Role> requested = req.roles();

        // Cannot remove ADMIN from self
        if (adminId.equals(targetUserId) && target.hasRole(Role.ADMIN) && !requested.contains(Role.ADMIN)) {
            throw new BusinessRuleException("Cannot remove the ADMIN role from your own account");
        }

        // Cannot remove the last active admin
        if (target.hasRole(Role.ADMIN) && !requested.contains(Role.ADMIN)) {
            long activeAdmins = userRepository.countActiveAdmins();
            if (activeAdmins <= 1) {
                throw new BusinessRuleException("Cannot remove the last active administrator on the platform");
            }
        }

        Set<Role> updated = new HashSet<>();
        // GUEST always stays
        updated.add(Role.GUEST);

        // Retain HOST if previously present (HOST cannot be granted here, only preserved)
        if (target.hasRole(Role.HOST)) {
            updated.add(Role.HOST);
        }

        // Apply requested staff roles
        if (requested.contains(Role.SUPPORT_AGENT)) {
            updated.add(Role.SUPPORT_AGENT);
        }
        if (requested.contains(Role.ADMIN)) {
            updated.add(Role.ADMIN);
        }

        target.setRoles(updated);
        target.setTokenVersion(target.getTokenVersion() + 1);
        target = userRepository.save(target);

        evictUserAuthCache();
        auditService.log(adminId, "ROLE_CHANGED", "User", targetUserId,
                Map.of("newRoles", updated.toString()));

        return AdminUserResponse.from(target, hostCancellationCount(target.getId()));
    }

    @Transactional
    public AdminUserResponse deleteUser(Long adminId, Long targetUserId, ReasonRequest req) {
        if (adminId.equals(targetUserId)) {
            throw new BusinessRuleException("An administrator cannot delete their own account");
        }

        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (target.hasRole(Role.ADMIN)) {
            throw new BusinessRuleException("Cannot delete an administrator account");
        }

        if (target.getStatus() == UserStatus.DELETED) {
            return AdminUserResponse.from(target, hostCancellationCount(target.getId()));
        }

        String reason = req.reason().trim();
        Instant now = clock.instant();

        // Same cascade as a suspension: sessions die, listings stop selling, and the
        // bookings that still need a decision are resolved so no guest is left holding a
        // payment against a host that can no longer respond.
        cascadeAccountShutdown(targetUserId, reason);

        // Soft delete rather than DELETE: bookings, reviews and payouts all reference this
        // row. The personal fields are overwritten so the removed person is no longer
        // identifiable, and the placeholder email frees the address for re-registration.
        target.setStatus(UserStatus.DELETED);
        target.setEmail("deleted-" + targetUserId + "@deleted.invalid");
        target.setFirstName("Deleted");
        target.setLastName("User");
        target.setPhone(null);
        target.setSuspensionReason(reason);
        target.setTokenVersion(target.getTokenVersion() + 1);
        refreshTokenRepository.revokeAllForUser(targetUserId, now);
        target = userRepository.save(target);

        evictUserAuthCache();
        evictSearchCache();
        auditService.log(adminId, "USER_DELETED", "User", targetUserId,
                Map.of("reason", reason, "email", target.getEmail()));

        return AdminUserResponse.from(target, hostCancellationCount(target.getId()));
    }

    /**
     * Winds down everything a departing account leaves behind: live listings are suspended,
     * host requests are declined with a refund, and guest holds expire so dates free up.
     */
    private void cascadeAccountShutdown(Long targetUserId, String reason) {
        // Suspend all listings of this host
        List<Listing> hostListings = listingRepository.findByHostIdAndStatusNot(targetUserId, ListingStatus.DELETED, Pageable.unpaged()).getContent();
        for (Listing l : hostListings) {
            if (l.getStatus() == ListingStatus.ACTIVE || l.getStatus() == ListingStatus.PAUSED) {
                l.suspend("Host account removed: " + reason);
                listingRepository.save(l);
            }
        }

        // Auto-decline PENDING_APPROVAL bookings where target is host
        List<Booking> hostPendingBookings = bookingRepository.findByHostIdAndStatus(targetUserId, BookingStatus.PENDING_APPROVAL, Pageable.unpaged()).getContent();
        for (Booking b : hostPendingBookings) {
            b.transitionTo(BookingStatus.DECLINED, null);
            bookingRepository.save(b);

            BookingStatusHistory history = new BookingStatusHistory(b, BookingStatus.PENDING_APPROVAL.name(), BookingStatus.DECLINED.name(), null, "SYSTEM", "Host account removed");
            bookingStatusHistoryRepository.save(history);

            paymentRepository.findByBookingId(b.getId()).ifPresent(payment -> {
                refundService.issueRefund(payment.getId(), b.getTotalAmount(), RefundReason.HOST_DECLINED, "auto-decline-" + b.getId());
            });
        }

        // Expire PENDING_PAYMENT bookings where target is guest
        List<Booking> guestPendingBookings = bookingRepository.findByGuestIdAndStatus(targetUserId, BookingStatus.PENDING_PAYMENT, Pageable.unpaged()).getContent();
        for (Booking b : guestPendingBookings) {
            b.transitionTo(BookingStatus.EXPIRED, null);
            bookingRepository.save(b);

            BookingStatusHistory history = new BookingStatusHistory(b, BookingStatus.PENDING_PAYMENT.name(), BookingStatus.EXPIRED.name(), null, "SYSTEM", "Guest account removed");
            bookingStatusHistoryRepository.save(history);
        }
    }

    private void evictUserAuthCache() {
        try {
            var cache = cacheManager.getCache("userAuth");
            if (cache != null) cache.clear();
        } catch (Exception e) {
            log.warn("Failed to evict userAuth cache: {}", e.getMessage());
        }
    }

    /**
     * Suspending or deleting a host removes their listings from search
     * (the search spec filters on host-active), and unsuspending adds them
     * back, so the search cache cannot outlive the account change.
     */
    private void evictSearchCache() {
        try {
            var cache = cacheManager.getCache("searchResults");
            if (cache != null) cache.clear();
        } catch (Exception e) {
            log.warn("Failed to evict searchResults cache: {}", e.getMessage());
        }
    }
}
