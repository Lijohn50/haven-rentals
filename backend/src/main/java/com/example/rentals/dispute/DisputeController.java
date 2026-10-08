package com.example.rentals.dispute;

import com.example.rentals.common.CurrentUser;
import com.example.rentals.common.PageResponse;
import com.example.rentals.dispute.dto.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Disputes", description = "Dispute resolution and management for guests, hosts, and support agents")
@RestController
@RequiredArgsConstructor
public class DisputeController {

    private final DisputeService disputeService;

    @Operation(summary = "Open dispute on a booking")
    @PostMapping("/api/v1/bookings/{bookingId}/disputes")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<DisputeResponse> openDispute(
            @CurrentUser Long userId,
            @PathVariable Long bookingId,
            @Valid @RequestBody CreateDisputeRequest request
    ) {
        DisputeResponse response = disputeService.openDispute(userId, bookingId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Operation(summary = "Get user disputes")
    @GetMapping("/api/v1/disputes/mine")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PageResponse<DisputeResponse>> getMyDisputes(
            @CurrentUser Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(disputeService.getMyDisputes(userId, page, size));
    }

    @Operation(summary = "Get support dispute queue")
    @GetMapping("/api/v1/support/disputes")
    @PreAuthorize("hasAnyRole('SUPPORT_AGENT', 'ADMIN')")
    public ResponseEntity<PageResponse<DisputeResponse>> getSupportDisputes(
            @RequestParam(required = false) DisputeStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(disputeService.getSupportDisputes(status, page, size));
    }

    @Operation(summary = "Get full dispute detail for support review")
    @GetMapping("/api/v1/support/disputes/{id}")
    @PreAuthorize("hasAnyRole('SUPPORT_AGENT', 'ADMIN')")
    public ResponseEntity<SupportDisputeDetailResponse> getSupportDisputeDetail(
            @CurrentUser Long userId,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(disputeService.getSupportDisputeDetail(userId, id));
    }

    @Operation(summary = "Assign dispute to support agent")
    @PatchMapping("/api/v1/support/disputes/{id}/assign")
    @PreAuthorize("hasAnyRole('SUPPORT_AGENT', 'ADMIN')")
    public ResponseEntity<DisputeResponse> assignDispute(
            @CurrentUser Long userId,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(disputeService.assignDispute(userId, id));
    }

    @Operation(summary = "Resolve dispute with refund decision")
    @PostMapping("/api/v1/support/disputes/{id}/resolve")
    @PreAuthorize("hasAnyRole('SUPPORT_AGENT', 'ADMIN')")
    public ResponseEntity<DisputeResponse> resolveDispute(
            @CurrentUser Long userId,
            @PathVariable Long id,
            @Valid @RequestBody ResolveDisputeRequest request
    ) {
        return ResponseEntity.ok(disputeService.resolveDispute(userId, id, request));
    }

    @Operation(summary = "Reject dispute")
    @PostMapping("/api/v1/support/disputes/{id}/reject")
    @PreAuthorize("hasAnyRole('SUPPORT_AGENT', 'ADMIN')")
    public ResponseEntity<DisputeResponse> rejectDispute(
            @CurrentUser Long userId,
            @PathVariable Long id,
            @Valid @RequestBody RejectDisputeRequest request
    ) {
        return ResponseEntity.ok(disputeService.rejectDispute(userId, id, request));
    }
}
