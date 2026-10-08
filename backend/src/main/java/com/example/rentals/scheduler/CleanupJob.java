package com.example.rentals.scheduler;

import com.example.rentals.auth.OneTimeTokenRepository;
import com.example.rentals.auth.RefreshTokenRepository;
import com.example.rentals.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class CleanupJob {

    private final OneTimeTokenRepository oneTimeTokenRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final NotificationService notificationService;
    private final Clock clock;

    @Scheduled(cron = "0 0 3 * * *", zone = "UTC")
    @Transactional
    public void run() {
        Instant now = clock.instant();
        log.info("Starting nightly platform cleanup at {}", now);

        try {
            int tokensDeleted = oneTimeTokenRepository.deleteExpiredOrUsedTokens(now);
            log.info("Cleaned up {} expired/used one-time tokens", tokensDeleted);
        } catch (Exception e) {
            log.error("Failed cleaning one-time tokens: {}", e.getMessage());
        }

        try {
            Instant thirtyDaysAgo = now.minus(30, ChronoUnit.DAYS);
            int refreshDeleted = refreshTokenRepository.deleteOldRevokedTokens(thirtyDaysAgo);
            log.info("Cleaned up {} old revoked refresh tokens", refreshDeleted);
        } catch (Exception e) {
            log.error("Failed cleaning refresh tokens: {}", e.getMessage());
        }

        try {
            int notifsDeleted = notificationService.deleteOldReadNotifications(90);
            log.info("Cleaned up {} old read notifications", notifsDeleted);
        } catch (Exception e) {
            log.error("Failed cleaning old notifications: {}", e.getMessage());
        }

        log.info("Nightly platform cleanup completed");
    }
}
