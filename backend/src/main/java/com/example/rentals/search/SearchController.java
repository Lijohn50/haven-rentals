package com.example.rentals.search;

import com.example.rentals.common.PageResponse;
import com.example.rentals.listing.PropertyType;
import com.example.rentals.search.dto.CitySuggestionResponse;
import com.example.rentals.search.dto.SearchResultResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/search")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;

    @GetMapping
    public ResponseEntity<PageResponse<SearchResultResponse>> search(
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String country,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkIn,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkOut,
            @RequestParam(defaultValue = "1") int guests,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) List<Long> amenityIds,
            @RequestParam(required = false) PropertyType propertyType,
            @RequestParam(required = false) Integer minBedrooms,
            @RequestParam(required = false) BigDecimal minRating,
            @RequestParam(required = false) Boolean instantBook,
            @RequestParam(defaultValue = "RATING_DESC") SearchSort sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        SearchCriteria criteria = new SearchCriteria(
                city, country, checkIn, checkOut, guests, minPrice, maxPrice,
                amenityIds, propertyType, minBedrooms, minRating, instantBook, sort, page, size
        );
        return ResponseEntity.ok(searchService.search(criteria));
    }

    @GetMapping("/suggestions/cities")
    public ResponseEntity<List<CitySuggestionResponse>> getCitySuggestions(
            @RequestParam(defaultValue = "") String prefix,
            @RequestParam(defaultValue = "5") int limit
    ) {
        return ResponseEntity.ok(searchService.getCitySuggestions(prefix, limit));
    }
}
