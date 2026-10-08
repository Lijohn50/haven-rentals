package com.example.rentals.listing;

public interface StorageService {
    String store(byte[] bytes, String extension, String contentType);
    byte[] load(String storageKey);
    void delete(String storageKey);
}
