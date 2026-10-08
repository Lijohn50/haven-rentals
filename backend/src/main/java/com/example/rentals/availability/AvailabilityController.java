package com.example.rentals.availability;

import com.example.rentals.availability.dto.BlockRequest;
import com.example.rentals.availability.dto.BlockResponse;
import com.example.rentals.availability.dto.CalendarResponse;
import com.example.rentals.common.CurrentUserProvider;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class AvailabilityController {

    private final AvailabilityService availabilityService;
    private final CurrentUserProvider currentUser;

    @GetMapping("/listings/{id}/calendar")
    public ResponseEntity<CalendarResponse> getCalendar(
            @PathVariable Long id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ResponseEntity.ok(availabilityService.getCalendar(id, from, to));
    }

    @GetMapping("/host/listings/{id}/blocks")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<List<BlockResponse>> listBlocks(@PathVariable Long id) {
        return ResponseEntity.ok(availabilityService.listBlocks(currentUser.getUserId(), id));
    }

    @PostMapping("/host/listings/{id}/blocks")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<BlockResponse> createBlock(
            @PathVariable Long id,
            @Valid @RequestBody BlockRequest req
    ) {
        BlockResponse res = availabilityService.createBlock(currentUser.getUserId(), id, req);
        return ResponseEntity.created(URI.create("/api/v1/host/listings/" + id + "/blocks/" + res.id())).body(res);
    }

    @DeleteMapping("/host/listings/{id}/blocks/{blockId}")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<Void> deleteBlock(
            @PathVariable Long id,
            @PathVariable Long blockId
    ) {
        availabilityService.deleteBlock(currentUser.getUserId(), id, blockId);
        return ResponseEntity.noContent().build();
    }
}
