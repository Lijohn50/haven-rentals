package com.example.rentals.booking;

import com.example.rentals.booking.dto.*;
import com.example.rentals.common.CurrentUserProvider;
import com.example.rentals.common.PageResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class BookingController {

    private final BookingService bookingService;
    private final CurrentUserProvider currentUser;

    @PostMapping("/bookings")
    public ResponseEntity<BookingResponse> createHold(
            @Valid @RequestBody CreateBookingRequest req,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey
    ) {
        BookingResponse res = bookingService.createHold(currentUser.getUserId(), req, idempotencyKey);
        return ResponseEntity.created(URI.create("/api/v1/bookings/" + res.id())).body(res);
    }

    @PostMapping("/bookings/{id}/pay")
    public ResponseEntity<BookingResponse> payBooking(
            @PathVariable Long id,
            @Valid @RequestBody PayBookingRequest req
    ) {
        return ResponseEntity.ok(bookingService.payBooking(currentUser.getUserId(), id, req));
    }

    @GetMapping("/bookings/mine")
    public ResponseEntity<PageResponse<BookingResponse>> getMyBookings(
            @RequestParam(required = false) BookingStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 50));
        return ResponseEntity.ok(PageResponse.from(bookingService.getGuestBookings(currentUser.getUserId(), status, pageable)));
    }

    @GetMapping("/bookings/{id}")
    public ResponseEntity<BookingResponse> getBooking(@PathVariable Long id) {
        return ResponseEntity.ok(bookingService.getBooking(id, currentUser.getUserId()));
    }

    @GetMapping("/bookings/reference/{reference}")
    public ResponseEntity<BookingResponse> getBookingByReference(@PathVariable String reference) {
        return ResponseEntity.ok(bookingService.getBookingByReference(reference, currentUser.getUserId()));
    }

    @GetMapping("/bookings/{id}/cancellation-preview")
    public ResponseEntity<CancellationPreviewResponse> getCancellationPreview(@PathVariable Long id) {
        return ResponseEntity.ok(bookingService.getCancellationPreview(currentUser.getUserId(), id));
    }

    @PostMapping("/bookings/{id}/cancel")
    public ResponseEntity<BookingResponse> cancelByGuest(
            @PathVariable Long id,
            @RequestBody(required = false) CancelRequest req
    ) {
        return ResponseEntity.ok(bookingService.cancelByGuest(currentUser.getUserId(), id, req));
    }

    @GetMapping("/host/bookings")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<PageResponse<BookingResponse>> getHostBookings(
            @RequestParam(required = false) BookingStatus status,
            @RequestParam(required = false) Long listingId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 50));
        return ResponseEntity.ok(PageResponse.from(bookingService.getHostBookings(currentUser.getUserId(), status, listingId, pageable)));
    }

    @PostMapping("/host/bookings/{id}/approve")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<BookingResponse> hostApprove(@PathVariable Long id) {
        return ResponseEntity.ok(bookingService.hostApprove(currentUser.getUserId(), id));
    }

    @PostMapping("/host/bookings/{id}/decline")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<BookingResponse> hostDecline(@PathVariable Long id, @Valid @RequestBody DeclineRequest req) {
        return ResponseEntity.ok(bookingService.hostDecline(currentUser.getUserId(), id, req));
    }

    @PostMapping("/host/bookings/{id}/cancel")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<BookingResponse> hostCancel(@PathVariable Long id, @Valid @RequestBody CancelRequest req) {
        return ResponseEntity.ok(bookingService.hostCancel(currentUser.getUserId(), id, req));
    }
}
