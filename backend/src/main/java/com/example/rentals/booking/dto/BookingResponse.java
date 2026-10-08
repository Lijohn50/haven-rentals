package com.example.rentals.booking.dto;

import com.example.rentals.booking.Booking;
import com.example.rentals.booking.BookingStatus;
import com.example.rentals.listing.CancellationPolicyType;
import com.example.rentals.listing.Listing;
import com.example.rentals.listing.ListingPhoto;
import com.example.rentals.listing.dto.PhotoResponse;
import com.example.rentals.user.User;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;

public record BookingResponse(
        String reference,
        Long id,
        BookingStatus status,
        BookingListingSummary listing,
        BookingGuestSummary guest,
        BookingHostSummary host,
        LocalDate checkIn,
        LocalDate checkOut,
        int nights,
        int guests,
        Map<String, Object> priceBreakdown,
        BigDecimal refundAmount,
        CancellationPolicyType cancellationPolicy,
        String cancellationPolicyDescription,
        Instant checkInDateTime,
        Instant checkOutDateTime,
        Instant expiresAt,
        Instant confirmedAt,
        Instant completedAt,
        Instant cancelledAt,
        BigDecimal hostPayoutAmount,
        boolean instantBook,
        List<BookingAction> allowedActions,
        List<BookingHistoryResponse> history
) {
    public record BookingListingSummary(Long id, String title, String city, String country, String coverPhotoUrl) {}
    public record BookingGuestSummary(Long id, String firstName, String lastName, String phone) {}
    public record BookingHostSummary(Long id, String displayName) {}

    public static BookingResponse from(Booking b, Long currentUserId) {
        return from(b, currentUserId, List.of(), List.of());
    }

    public static BookingResponse from(Booking b, Long currentUserId, List<BookingAction> actions, List<BookingHistoryResponse> history) {
        Listing l = b.getListing();
        String cover = null;
        if (l.getPhotos() != null) {
            cover = l.getPhotos().stream()
                    .filter(ListingPhoto::isCover)
                    .findFirst()
                    .map(PhotoResponse::from)
                    .map(PhotoResponse::url)
                    .orElse(l.getPhotos().isEmpty() ? null : PhotoResponse.from(l.getPhotos().get(0)).url());
        }
        BookingListingSummary listingSummary = new BookingListingSummary(l.getId(), l.getTitle(), l.getCity(), l.getCountry(), cover);

        User g = b.getGuest();
        boolean isGuest = currentUserId != null && currentUserId.equals(g.getId());
        boolean isHost = currentUserId != null && currentUserId.equals(b.getHost().getId());
        boolean isConfirmedOrLater = (b.getStatus() == BookingStatus.CONFIRMED || b.getStatus() == BookingStatus.COMPLETED);

        // Host sees guest's last name & phone only after CONFIRMED
        String guestLastName = (isGuest || (isHost && isConfirmedOrLater)) ? g.getLastName() : null;
        String guestPhone = (isGuest || (isHost && isConfirmedOrLater)) ? g.getPhone() : null;
        BookingGuestSummary guestSummary = new BookingGuestSummary(g.getId(), g.getFirstName(), guestLastName, guestPhone);

        User h = b.getHost();
        String hostName = h.getHostProfile() != null ? h.getHostProfile().getDisplayName() : h.getFirstName();
        BookingHostSummary hostSummary = new BookingHostSummary(h.getId(), hostName);

        ZoneId zoneId = ZoneId.of(b.getListingTimezone());
        Instant checkInInstant = b.getCheckIn().atTime(b.getCheckInTime()).atZone(zoneId).toInstant();
        Instant checkOutInstant = b.getCheckOut().atTime(b.getCheckOutTime()).atZone(zoneId).toInstant();

        String policyDesc = switch (b.getCancellationPolicy()) {
            case FLEXIBLE -> "Full refund up to 24 hours before check-in";
            case MODERATE -> "Full refund up to 5 days before check-in, 50% refund up to 24 hours before";
            case STRICT -> "50% refund up to 7 days before check-in";
        };

        return new BookingResponse(
                b.getReference(),
                b.getId(),
                b.getStatus(),
                listingSummary,
                guestSummary,
                hostSummary,
                b.getCheckIn(),
                b.getCheckOut(),
                b.getNights(),
                b.getGuestsCount(),
                b.getPriceBreakdown(),
                b.getRefundAmount(),
                b.getCancellationPolicy(),
                policyDesc,
                checkInInstant,
                checkOutInstant,
                b.getExpiresAt(),
                b.getConfirmedAt(),
                b.getCompletedAt(),
                b.getCancelledAt(),
                b.getHostPayoutAmount(),
                b.isInstantBook(),
                actions,
                history != null ? history : List.of()
        );
    }
}
