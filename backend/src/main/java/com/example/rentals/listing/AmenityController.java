package com.example.rentals.listing;

import com.example.rentals.common.CacheConfig;
import com.example.rentals.listing.dto.AmenityResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/amenities")
@RequiredArgsConstructor
public class AmenityController {

    private final AmenityRepository amenityRepository;

    @GetMapping
    @Cacheable(CacheConfig.CACHE_AMENITIES)
    public ResponseEntity<List<AmenityResponse>> getAmenities() {
        List<AmenityResponse> list = amenityRepository.findByActiveTrueOrderByCategoryAscNameAsc()
                .stream()
                .map(AmenityResponse::from)
                .toList();
        return ResponseEntity.ok(list);
    }
}
