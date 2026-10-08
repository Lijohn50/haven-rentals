package com.example.rentals.dashboard;

import com.example.rentals.common.CurrentUser;
import com.example.rentals.dashboard.dto.HostDashboardResponse;
import com.example.rentals.dashboard.dto.ListingMetricsResponse;
import com.example.rentals.dashboard.dto.MyTripsResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@Tag(name = "Dashboard", description = "Host performance dashboards and guest trip grouping")
@RestController
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @Operation(summary = "Get host summary dashboard")
    @GetMapping("/api/v1/host/dashboard")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<HostDashboardResponse> getHostDashboard(
            @CurrentUser Long hostId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ResponseEntity.ok(dashboardService.getHostDashboard(hostId, from, to));
    }

    @Operation(summary = "Get host per-listing metrics")
    @GetMapping("/api/v1/host/dashboard/listings")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<List<ListingMetricsResponse>> getHostListingMetrics(
            @CurrentUser Long hostId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ResponseEntity.ok(dashboardService.getHostListingMetrics(hostId, from, to));
    }

    @Operation(summary = "Get guest trips grouped by upcoming, past, and cancelled")
    @GetMapping("/api/v1/dashboard/trips")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MyTripsResponse> getMyTrips(@CurrentUser Long userId) {
        return ResponseEntity.ok(dashboardService.getMyTrips(userId));
    }
}
