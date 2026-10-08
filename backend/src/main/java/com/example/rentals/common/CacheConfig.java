package com.example.rentals.common;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.cache.support.SimpleCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Arrays;
import java.util.concurrent.TimeUnit;

@Configuration
public class CacheConfig {

    public static final String CACHE_AMENITIES = "amenities";
    public static final String CACHE_COMMISSION = "commission";
    public static final String CACHE_LISTING_DETAIL = "listingDetail";
    public static final String CACHE_SEARCH_RESULTS = "searchResults";
    public static final String CACHE_USER_AUTH = "userAuth";
    public static final String CACHE_HOST_DASHBOARD = "hostDashboard";

    @Bean
    public CacheManager cacheManager() {
        SimpleCacheManager manager = new SimpleCacheManager();
        manager.setCaches(Arrays.asList(
                new CaffeineCache(CACHE_AMENITIES, Caffeine.newBuilder().expireAfterWrite(1, TimeUnit.HOURS).maximumSize(100).build()),
                new CaffeineCache(CACHE_COMMISSION, Caffeine.newBuilder().expireAfterWrite(10, TimeUnit.MINUTES).maximumSize(10).build()),
                new CaffeineCache(CACHE_LISTING_DETAIL, Caffeine.newBuilder().expireAfterWrite(60, TimeUnit.SECONDS).maximumSize(1000).build()),
                new CaffeineCache(CACHE_SEARCH_RESULTS, Caffeine.newBuilder().expireAfterWrite(30, TimeUnit.SECONDS).maximumSize(500).build()),
                new CaffeineCache(CACHE_USER_AUTH, Caffeine.newBuilder().expireAfterWrite(30, TimeUnit.SECONDS).maximumSize(2000).build()),
                new CaffeineCache(CACHE_HOST_DASHBOARD, Caffeine.newBuilder().expireAfterWrite(60, TimeUnit.SECONDS).maximumSize(500).build())
        ));
        return manager;
    }
}
