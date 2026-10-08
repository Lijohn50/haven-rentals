package com.example.rentals.listing;

import com.example.rentals.common.ApiException;
import com.example.rentals.common.AppProperties;
import com.example.rentals.common.BusinessRuleException;
import com.example.rentals.common.CacheConfig;
import com.example.rentals.common.ErrorCode;
import com.example.rentals.common.ResourceNotFoundException;
import com.example.rentals.listing.dto.PhotoLinkRequest;
import com.example.rentals.listing.dto.PhotoResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class PhotoService {

    private final ListingRepository listingRepository;
    private final ListingPhotoRepository photoRepository;
    private final StorageService storageService;
    private final CacheManager cacheManager;
    private final AppProperties appProperties;

    private static final long MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
    private static final int MAX_PHOTOS = 20;

    @Transactional
    public PhotoResponse uploadPhoto(Long hostId, Long listingId, MultipartFile file) {
        Listing listing = findHostListing(hostId, listingId);

        if (file == null || file.isEmpty()) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "File is empty or missing");
        }
        if (file.getSize() > MAX_FILE_BYTES) {
            throw new ApiException(ErrorCode.PAYLOAD_TOO_LARGE, HttpStatus.PAYLOAD_TOO_LARGE, "File exceeds maximum 5MB size");
        }

        int currentCount = photoRepository.countByListingId(listingId);
        if (currentCount >= MAX_PHOTOS) {
            throw new BusinessRuleException("Listing already has the maximum of " + MAX_PHOTOS + " photos");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new ApiException(ErrorCode.INTERNAL_ERROR, "Failed to read uploaded file");
        }

        String detectedFormat = detectFormatByMagicBytes(bytes);
        if (detectedFormat == null) {
            throw new ApiException(ErrorCode.UNSUPPORTED_MEDIA_TYPE, HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "Unsupported image format. Allowed: JPEG, PNG, WebP");
        }

        BufferedImage image;
        try {
            image = ImageIO.read(new ByteArrayInputStream(bytes));
        } catch (Exception e) {
            throw new ApiException(ErrorCode.UNSUPPORTED_MEDIA_TYPE, "Corrupted image file");
        }

        if (image == null) {
            throw new ApiException(ErrorCode.UNSUPPORTED_MEDIA_TYPE, "Invalid image data");
        }

        int width = image.getWidth();
        int height = image.getHeight();
        if (width < 400 || height < 400 || width > 8000 || height > 8000) {
            throw new BusinessRuleException("Image dimensions must be between 400x400 and 8000x8000 pixels");
        }

        // Re-encode to strip EXIF/GPS metadata
        byte[] cleanBytes;
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            ImageIO.write(image, detectedFormat.equals("jpeg") ? "jpg" : detectedFormat, baos);
            cleanBytes = baos.toByteArray();
        } catch (IOException e) {
            cleanBytes = bytes;
        }

        String ext = detectedFormat.equals("jpeg") ? "jpg" : detectedFormat;
        String contentType = "image/" + (detectedFormat.equals("jpg") ? "jpeg" : detectedFormat);
        String storageKey = storageService.store(cleanBytes, ext, contentType);

        boolean isFirst = currentCount == 0;
        ListingPhoto photo = new ListingPhoto(listing, storageKey, contentType, cleanBytes.length, width, height, currentCount, isFirst);
        photo = photoRepository.save(photo);

        evictListingCache(listingId);
        return PhotoResponse.from(photo);
    }

    @Transactional
    public PhotoResponse addPhotoLink(Long hostId, Long listingId, PhotoLinkRequest request) {
        Listing listing = findHostListing(hostId, listingId);

        String url = request.url().trim();

        int currentCount = photoRepository.countByListingId(listingId);
        if (currentCount >= MAX_PHOTOS) {
            throw new BusinessRuleException("Listing already has the maximum of " + MAX_PHOTOS + " photos");
        }

        // storage_key carries a UNIQUE constraint, so the same asset pasted twice would
        // otherwise surface as a constraint violation on flush.
        if (photoRepository.existsByStorageKey(url)) {
            throw new ApiException(ErrorCode.DUPLICATE_RESOURCE, HttpStatus.CONFLICT,
                    "This image has already been added");
        }

        boolean isCover = Boolean.TRUE.equals(request.isCover()) || currentCount == 0;
        if (isCover && currentCount > 0) {
            // Only one cover may exist, and setting one has to clear the incumbent.
            photoRepository.clearCoverPhoto(listingId);
        }

        int width = request.width() == null ? 0 : request.width();
        int height = request.height() == null ? 0 : request.height();

        ListingPhoto photo = new ListingPhoto(
                listing, url, contentTypeFor(url), 0L, width, height, currentCount, isCover);
        photo = photoRepository.save(photo);

        evictListingCache(listingId);
        return PhotoResponse.from(photo);
    }

    private String contentTypeFor(String url) {
        String path = url.toLowerCase();
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".webp")) return "image/webp";
        if (path.endsWith(".gif")) return "image/gif";
        if (path.endsWith(".avif")) return "image/avif";
        return "image/jpeg";
    }

    @Transactional
    public void reorderPhotos(Long hostId, Long listingId, List<Long> photoIds) {
        findHostListing(hostId, listingId);
        List<ListingPhoto> existing = photoRepository.findByListingIdOrderBySortOrderAsc(listingId);

        Set<Long> existingIds = new HashSet<>();
        existing.forEach(p -> existingIds.add(p.getId()));

        if (photoIds.size() != existingIds.size() || !existingIds.containsAll(photoIds)) {
            throw new BusinessRuleException("Photo IDs must match the listing's photos exactly");
        }

        Map<Long, ListingPhoto> map = new HashMap<>();
        existing.forEach(p -> map.put(p.getId(), p));

        for (int i = 0; i < photoIds.size(); i++) {
            ListingPhoto p = map.get(photoIds.get(i));
            p.setSortOrder(i);
            photoRepository.save(p);
        }
        evictListingCache(listingId);
    }

    @Transactional
    public void setCoverPhoto(Long hostId, Long listingId, Long photoId) {
        findHostListing(hostId, listingId);
        ListingPhoto targetPhoto = photoRepository.findByListingIdAndId(listingId, photoId)
                .orElseThrow(() -> new ResourceNotFoundException("Photo not found"));

        photoRepository.clearCoverPhoto(listingId);
        targetPhoto.setCover(true);
        photoRepository.save(targetPhoto);
        evictListingCache(listingId);
    }

    @Transactional
    public void deletePhoto(Long hostId, Long listingId, Long photoId) {
        Listing listing = findHostListing(hostId, listingId);
        ListingPhoto photo = photoRepository.findByListingIdAndId(listingId, photoId)
                .orElseThrow(() -> new ResourceNotFoundException("Photo not found"));

        int count = photoRepository.countByListingId(listingId);
        int minPhotos = appProperties.getUpload().getMinPhotosToSubmit();
        if ((listing.getStatus() == ListingStatus.ACTIVE || listing.getStatus() == ListingStatus.PENDING_REVIEW) && count <= minPhotos) {
            throw new BusinessRuleException("Cannot delete photo: ACTIVE and PENDING_REVIEW listings require at least " + minPhotos + " photos");
        }

        boolean wasCover = photo.isCover();
        String storageKey = photo.getStorageKey();
        boolean external = photo.isExternal();

        photoRepository.delete(photo);

        if (wasCover) {
            List<ListingPhoto> remaining = photoRepository.findByListingIdOrderBySortOrderAsc(listingId);
            if (!remaining.isEmpty()) {
                ListingPhoto newCover = remaining.get(0);
                newCover.setCover(true);
                photoRepository.save(newCover);
            }
        }

        // An externally hosted asset is not ours to delete: this application only holds a
        // link, and removing the Cloudinary copy stays an explicit action in Cloudinary.
        if (!external) {
            storageService.delete(storageKey);
        }
        evictListingCache(listingId);
    }

    private Listing findHostListing(Long hostId, Long listingId) {
        return listingRepository.findByIdAndHostId(listingId, hostId)
                .filter(l -> l.getStatus() != ListingStatus.DELETED)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));
    }

    private String detectFormatByMagicBytes(byte[] bytes) {
        if (bytes.length >= 3 && (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8 && (bytes[2] & 0xFF) == 0xFF) {
            return "jpeg";
        }
        if (bytes.length >= 8 &&
            (bytes[0] & 0xFF) == 0x89 && (bytes[1] & 0xFF) == 0x50 &&
            (bytes[2] & 0xFF) == 0x4E && (bytes[3] & 0xFF) == 0x47) {
            return "png";
        }
        if (bytes.length >= 12 &&
            (bytes[0] & 0xFF) == 0x52 && (bytes[1] & 0xFF) == 0x49 &&
            (bytes[2] & 0xFF) == 0x46 && (bytes[3] & 0xFF) == 0x46 &&
            (bytes[8] & 0xFF) == 0x57 && (bytes[9] & 0xFF) == 0x45 &&
            (bytes[10] & 0xFF) == 0x42 && (bytes[11] & 0xFF) == 0x50) {
            return "webp";
        }
        return null;
    }

    private void evictListingCache(Long listingId) {
        var cache = cacheManager.getCache(CacheConfig.CACHE_LISTING_DETAIL);
        if (cache != null) {
            cache.evict(listingId);
        }
        var searchCache = cacheManager.getCache(CacheConfig.CACHE_SEARCH_RESULTS);
        if (searchCache != null) {
            searchCache.clear();
        }
    }
}
