package com.example.rentals.listing;

import com.example.rentals.common.CurrentUserProvider;
import com.example.rentals.common.PageResponse;
import com.example.rentals.listing.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class ListingController {

    private final ListingService listingService;
    private final PhotoService photoService;
    private final CurrentUserProvider currentUser;

    @GetMapping("/listings/{id}")
    public ResponseEntity<ListingResponse> getListing(@PathVariable Long id) {
        return ResponseEntity.ok(listingService.getPublicListing(id, currentUser.getUserIdOrNull()));
    }

    @PostMapping("/host/listings")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<ListingResponse> createDraft(@Valid @RequestBody ListingRequest req) {
        ListingResponse created = listingService.createDraft(currentUser.getUserId(), req);
        return ResponseEntity.created(URI.create("/api/v1/listings/" + created.id())).body(created);
    }

    @GetMapping("/host/listings")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<PageResponse<ListingSummaryResponse>> getHostListings(
            @RequestParam(required = false) ListingStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 50));
        return ResponseEntity.ok(PageResponse.from(listingService.getHostListings(currentUser.getUserId(), status, pageable)));
    }

    @GetMapping("/host/listings/{id}")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<ListingResponse> getHostListing(@PathVariable Long id) {
        return ResponseEntity.ok(listingService.getHostListing(currentUser.getUserId(), id));
    }

    @PutMapping("/host/listings/{id}")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<ListingResponse> updateListing(@PathVariable Long id, @Valid @RequestBody ListingRequest req) {
        return ResponseEntity.ok(listingService.updateListing(currentUser.getUserId(), id, req));
    }

    @DeleteMapping("/host/listings/{id}")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<Void> deleteListing(@PathVariable Long id) {
        listingService.deleteListing(currentUser.getUserId(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/host/listings/{id}/submit")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<Void> submitListing(@PathVariable Long id) {
        listingService.submitListing(currentUser.getUserId(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/host/listings/{id}/pause")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<Void> pauseListing(@PathVariable Long id) {
        listingService.pauseListing(currentUser.getUserId(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/host/listings/{id}/resume")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<Void> resumeListing(@PathVariable Long id) {
        listingService.resumeListing(currentUser.getUserId(), id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/host/listings/{id}/amenities")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<ListingResponse> updateAmenities(@PathVariable Long id, @Valid @RequestBody UpdateAmenitiesRequest req) {
        return ResponseEntity.ok(listingService.updateAmenities(currentUser.getUserId(), id, req.amenityIds()));
    }

    @PutMapping("/host/listings/{id}/house-rules")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<ListingResponse> updateHouseRules(@PathVariable Long id, @Valid @RequestBody HouseRulesRequest req) {
        return ResponseEntity.ok(listingService.updateHouseRules(currentUser.getUserId(), id, req.rules()));
    }

    @PostMapping(value = "/host/listings/{id}/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<PhotoResponse> uploadPhoto(@PathVariable Long id, @RequestParam("file") MultipartFile file) {
        PhotoResponse photo = photoService.uploadPhoto(currentUser.getUserId(), id, file);
        return ResponseEntity.created(URI.create(photo.url())).body(photo);
    }

    /** Attaches a photo the host already uploaded to Cloudinary, by its delivery URL. */
    @PostMapping("/host/listings/{id}/photos/link")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<PhotoResponse> addPhotoLink(
            @PathVariable Long id,
            @Valid @RequestBody PhotoLinkRequest request
    ) {
        PhotoResponse photo = photoService.addPhotoLink(currentUser.getUserId(), id, request);
        return ResponseEntity.created(URI.create(photo.url())).body(photo);
    }

    @PutMapping("/host/listings/{id}/photos/order")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<Void> reorderPhotos(@PathVariable Long id, @Valid @RequestBody PhotoOrderRequest req) {
        photoService.reorderPhotos(currentUser.getUserId(), id, req.photoIds());
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/host/listings/{id}/photos/{photoId}/cover")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<Void> setCoverPhoto(@PathVariable Long id, @PathVariable Long photoId) {
        photoService.setCoverPhoto(currentUser.getUserId(), id, photoId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/host/listings/{id}/photos/{photoId}")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<Void> deletePhoto(@PathVariable Long id, @PathVariable Long photoId) {
        photoService.deletePhoto(currentUser.getUserId(), id, photoId);
        return ResponseEntity.noContent().build();
    }
}
