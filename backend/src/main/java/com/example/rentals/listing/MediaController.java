package com.example.rentals.listing;

import com.example.rentals.common.ApiException;
import com.example.rentals.common.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/v1/media")
@RequiredArgsConstructor
public class MediaController {

    private static final Pattern FILENAME_PATTERN = Pattern.compile("^[0-9a-fA-F-]{36}\\.(jpg|png|webp)$");
    private final StorageService storageService;

    @GetMapping("/listings/{listingId}/{filename}")
    public ResponseEntity<byte[]> getListingMedia(
            @PathVariable Long listingId,
            @PathVariable String filename
    ) {
        if (!FILENAME_PATTERN.matcher(filename).matches()) {
            throw new ApiException(ErrorCode.MALFORMED_REQUEST, "Invalid image filename format");
        }

        byte[] bytes = storageService.load(filename);

        String contentType = MediaType.IMAGE_JPEG_VALUE;
        if (filename.endsWith(".png")) {
            contentType = MediaType.IMAGE_PNG_VALUE;
        } else if (filename.endsWith(".webp")) {
            contentType = "image/webp";
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.parseMediaType(contentType))
                .body(bytes);
    }
}
