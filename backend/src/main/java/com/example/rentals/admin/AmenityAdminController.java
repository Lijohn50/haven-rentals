package com.example.rentals.admin;

import com.example.rentals.admin.dto.AmenityRequest;
import com.example.rentals.common.ConflictException;
import com.example.rentals.common.ErrorCode;
import com.example.rentals.common.ResourceNotFoundException;
import com.example.rentals.listing.Amenity;
import com.example.rentals.listing.AmenityRepository;
import com.example.rentals.listing.dto.AmenityResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@Slf4j
@Tag(name = "Admin Amenities", description = "Admin CRUD for system amenities")
@RestController
@RequestMapping("/api/v1/admin/amenities")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AmenityAdminController {

    private final AmenityRepository amenityRepository;
    private final CacheManager cacheManager;

    @Operation(summary = "Create new amenity")
    @PostMapping
    @Transactional
    public ResponseEntity<AmenityResponse> createAmenity(@Valid @RequestBody AmenityRequest req) {
        String trimmedName = req.name().trim();
        if (amenityRepository.existsByNameIgnoreCase(trimmedName)) {
            throw new ConflictException(ErrorCode.DUPLICATE_RESOURCE, "An amenity with this name already exists");
        }

        Amenity amenity = new Amenity(
                trimmedName,
                req.category().trim(),
                req.icon().trim()
        );
        amenity.setActive(req.active() != null ? req.active() : true);
        amenity = amenityRepository.save(amenity);
        evictAmenitiesCache();

        return ResponseEntity.status(HttpStatus.CREATED).body(AmenityResponse.from(amenity));
    }

    @Operation(summary = "Update amenity")
    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<AmenityResponse> updateAmenity(
            @PathVariable Long id,
            @Valid @RequestBody AmenityRequest req
    ) {
        Amenity amenity = amenityRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Amenity not found"));

        String trimmedName = req.name().trim();
        if (!amenity.getName().equalsIgnoreCase(trimmedName) && amenityRepository.existsByNameIgnoreCase(trimmedName)) {
            throw new ConflictException(ErrorCode.DUPLICATE_RESOURCE, "An amenity with this name already exists");
        }

        amenity.setName(trimmedName);
        amenity.setCategory(req.category().trim());
        amenity.setIcon(req.icon().trim());
        if (req.active() != null) {
            amenity.setActive(req.active());
        }

        amenity = amenityRepository.save(amenity);
        evictAmenitiesCache();

        return ResponseEntity.ok(AmenityResponse.from(amenity));
    }

    @Operation(summary = "Delete or deactivate amenity")
    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteAmenity(@PathVariable Long id) {
        Amenity amenity = amenityRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Amenity not found"));

        long usageCount = amenityRepository.countListingsUsingAmenity(id);
        if (usageCount > 0) {
            amenity.setActive(false);
            amenityRepository.save(amenity);
            log.info("Amenity id={} is in use by {} listings, deactivated instead of hard deleted", id, usageCount);
        } else {
            amenityRepository.delete(amenity);
            log.info("Amenity id={} deleted", id);
        }

        evictAmenitiesCache();
        return ResponseEntity.noContent().build();
    }

    private void evictAmenitiesCache() {
        try {
            var cache = cacheManager.getCache("amenities");
            if (cache != null) {
                cache.clear();
            }
        } catch (Exception e) {
            log.warn("Failed to evict amenities cache: {}", e.getMessage());
        }
    }
}
