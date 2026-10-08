package com.example.rentals.admin;

import com.example.rentals.admin.dto.*;
import com.example.rentals.booking.dto.BookingResponse;
import com.example.rentals.common.AuditLog;
import com.example.rentals.common.AuditService;
import com.example.rentals.common.CurrentUser;
import com.example.rentals.common.PageResponse;
import com.example.rentals.listing.dto.ListingResponse;
import com.example.rentals.listing.dto.ListingSummaryResponse;
import com.example.rentals.user.Role;
import com.example.rentals.user.UserStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;

@Tag(name = "Admin", description = "Platform administration, moderation, reports, and audit")
@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminController {

    private final AdminListingService adminListingService;
    private final AdminUserService adminUserService;
    private final AdminReportService adminReportService;
    private final AuditService auditService;

    @Operation(summary = "Platform metrics summary")
    @GetMapping("/summary")
    public ResponseEntity<AdminSummaryResponse> getSummary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ResponseEntity.ok(adminReportService.getSummary(from, to));
    }

    @Operation(summary = "Get pending listings moderation queue")
    @GetMapping("/listings/pending")
    public ResponseEntity<PageResponse<ListingSummaryResponse>> getPendingListings(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(adminListingService.getPendingListings(page, size));
    }

    @Operation(summary = "Get any listing detail")
    @GetMapping("/listings/{id}")
    public ResponseEntity<ListingResponse> getListingDetail(@PathVariable Long id) {
        return ResponseEntity.ok(adminListingService.getListingDetail(id));
    }

    @Operation(summary = "Approve pending listing")
    @PostMapping("/listings/{id}/approve")
    public ResponseEntity<ListingResponse> approveListing(
            @CurrentUser Long adminId,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(adminListingService.approveListing(adminId, id));
    }

    @Operation(summary = "Reject pending listing")
    @PostMapping("/listings/{id}/reject")
    public ResponseEntity<ListingResponse> rejectListing(
            @CurrentUser Long adminId,
            @PathVariable Long id,
            @Valid @RequestBody ReasonRequest request
    ) {
        return ResponseEntity.ok(adminListingService.rejectListing(adminId, id, request));
    }

    @Operation(summary = "Suspend listing")
    @PostMapping("/listings/{id}/suspend")
    public ResponseEntity<ListingResponse> suspendListing(
            @CurrentUser Long adminId,
            @PathVariable Long id,
            @Valid @RequestBody ReasonRequest request
    ) {
        return ResponseEntity.ok(adminListingService.suspendListing(adminId, id, request));
    }

    @Operation(summary = "Reinstate suspended listing")
    @PostMapping("/listings/{id}/reinstate")
    public ResponseEntity<ListingResponse> reinstateListing(
            @CurrentUser Long adminId,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(adminListingService.reinstateListing(adminId, id));
    }

    @Operation(summary = "Search users")
    @GetMapping("/users")
    public ResponseEntity<PageResponse<AdminUserResponse>> searchUsers(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) Role role,
            @RequestParam(required = false) UserStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(adminUserService.searchUsers(query, role, status, page, size));
    }

    @Operation(summary = "Get user details")
    @GetMapping("/users/{id}")
    public ResponseEntity<AdminUserResponse> getUserDetail(@PathVariable Long id) {
        return ResponseEntity.ok(adminUserService.getUserDetail(id));
    }

    @Operation(summary = "Suspend user account")
    @PostMapping("/users/{id}/suspend")
    public ResponseEntity<AdminUserResponse> suspendUser(
            @CurrentUser Long adminId,
            @PathVariable Long id,
            @Valid @RequestBody ReasonRequest request
    ) {
        return ResponseEntity.ok(adminUserService.suspendUser(adminId, id, request));
    }

    @Operation(summary = "Unsuspend user account")
    @PostMapping("/users/{id}/unsuspend")
    public ResponseEntity<AdminUserResponse> unsuspendUser(
            @CurrentUser Long adminId,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(adminUserService.unsuspendUser(adminId, id));
    }

    @Operation(summary = "Update user roles")
    @PatchMapping("/users/{id}/roles")
    public ResponseEntity<AdminUserResponse> changeRoles(
            @CurrentUser Long adminId,
            @PathVariable Long id,
            @Valid @RequestBody RolesRequest request
    ) {
        return ResponseEntity.ok(adminUserService.changeRoles(adminId, id, request));
    }

    @Operation(
            summary = "Remove a user account",
            description = "Soft delete: the row is retained for audit and booking history, but the "
                    + "account can never sign in again and all of its listings stop being bookable."
    )
    @DeleteMapping("/users/{id}")
    public ResponseEntity<AdminUserResponse> deleteUser(
            @CurrentUser Long adminId,
            @PathVariable Long id,
            @Valid @RequestBody ReasonRequest request
    ) {
        return ResponseEntity.ok(adminUserService.deleteUser(adminId, id, request));
    }

    @Operation(summary = "Inspect any booking")
    @GetMapping("/bookings/{id}")
    public ResponseEntity<BookingResponse> getBookingDetail(@PathVariable Long id) {
        return ResponseEntity.ok(adminListingService.getBookingDetail(id));
    }

    @Operation(summary = "Inspect any booking by reference")
    @GetMapping("/bookings/reference/{reference}")
    public ResponseEntity<BookingResponse> getBookingByReference(@PathVariable String reference) {
        return ResponseEntity.ok(adminListingService.getBookingByReference(reference));
    }

    @Operation(summary = "Query immutable audit logs")
    @GetMapping("/audit")
    public ResponseEntity<PageResponse<AuditLogResponse>> getAuditLogs(
            @RequestParam(required = false) Long actor,
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        int validatedSize = Math.min(Math.max(1, size), 50);
        int validatedPage = Math.max(0, page);
        Page<AuditLog> p = auditService.query(actor, entityType, action, from, to, PageRequest.of(validatedPage, validatedSize));
        return ResponseEntity.ok(PageResponse.from(p.map(AuditLogResponse::from)));
    }
}
