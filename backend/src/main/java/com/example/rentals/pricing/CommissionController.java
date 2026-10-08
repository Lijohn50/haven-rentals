package com.example.rentals.pricing;

import com.example.rentals.common.CurrentUserProvider;
import com.example.rentals.common.PageResponse;
import com.example.rentals.pricing.dto.CommissionSettingRequest;
import com.example.rentals.pricing.dto.CommissionSettingResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
@RequestMapping("/api/v1/admin/commission-settings")
@RequiredArgsConstructor
public class CommissionController {

    private final CommissionService commissionService;
    private final CurrentUserProvider currentUser;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PageResponse<CommissionSettingResponse>> listCommissionSettings(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 50));
        return ResponseEntity.ok(PageResponse.from(commissionService.listHistory(pageable)));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<CommissionSettingResponse> createCommissionSetting(@Valid @RequestBody CommissionSettingRequest req) {
        CommissionSettingResponse res = commissionService.createSetting(currentUser.getUserId(), req);
        return ResponseEntity.created(URI.create("/api/v1/admin/commission-settings/" + res.id())).body(res);
    }
}
