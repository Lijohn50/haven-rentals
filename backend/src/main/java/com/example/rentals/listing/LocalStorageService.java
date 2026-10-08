package com.example.rentals.listing;

import com.example.rentals.common.ApiException;
import com.example.rentals.common.AppProperties;
import com.example.rentals.common.ErrorCode;
import com.example.rentals.common.ResourceNotFoundException;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class LocalStorageService implements StorageService {

    private final AppProperties appProperties;
    private Path rootPath;

    @PostConstruct
    public void init() {
        this.rootPath = Paths.get(appProperties.getStorage().getPath()).toAbsolutePath().normalize();
        try {
            Files.createDirectories(rootPath);
        } catch (IOException e) {
            log.error("Could not initialize storage directory: {}", rootPath, e);
            throw new IllegalStateException("Could not create storage directory", e);
        }
    }

    @Override
    public String store(byte[] bytes, String extension, String contentType) {
        String key = UUID.randomUUID() + "." + extension;
        Path targetPath = rootPath.resolve(key).normalize();
        if (!targetPath.startsWith(rootPath)) {
            throw new ApiException(ErrorCode.INTERNAL_ERROR, "Invalid storage path detected");
        }

        try {
            Files.write(targetPath, bytes);
            return key;
        } catch (IOException e) {
            log.error("Failed to store file {}", key, e);
            throw new ApiException(ErrorCode.INTERNAL_ERROR, "Failed to store image file");
        }
    }

    @Override
    public byte[] load(String storageKey) {
        Path targetPath = rootPath.resolve(storageKey).normalize();
        if (!targetPath.startsWith(rootPath) || !Files.exists(targetPath)) {
            throw new ResourceNotFoundException("Image not found");
        }
        try {
            return Files.readAllBytes(targetPath);
        } catch (IOException e) {
            throw new ResourceNotFoundException("Failed to read image");
        }
    }

    @Override
    public void delete(String storageKey) {
        if (storageKey == null) return;
        Path targetPath = rootPath.resolve(storageKey).normalize();
        if (!targetPath.startsWith(rootPath)) {
            return;
        }
        try {
            Files.deleteIfExists(targetPath);
        } catch (IOException e) {
            log.warn("Failed to delete stored file {}: {}", storageKey, e.getMessage());
        }
    }
}
