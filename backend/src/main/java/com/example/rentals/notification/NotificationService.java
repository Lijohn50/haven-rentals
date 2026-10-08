package com.example.rentals.notification;

import com.example.rentals.common.PageResponse;
import com.example.rentals.common.ResourceNotFoundException;
import com.example.rentals.notification.dto.NotificationResponse;
import com.example.rentals.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final Clock clock;

    /**
     * REQUIRES_NEW keeps the INSERT out of the caller's transaction. Callers such as
     * ReminderJob.run() are read-only, and plain REQUIRED joined that transaction, so every
     * reminder failed with "could not execute INSERT in a read-only transaction".
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void createNotification(User user, NotificationType type, String title, String body, String link) {
        try {
            if (type == NotificationType.NEW_MESSAGE && link != null) {
                boolean alreadyUnread = notificationRepository.existsByUserIdAndTypeAndLinkAndReadAtIsNull(
                        user.getId(), type, link);
                if (alreadyUnread) {
                    return; // Throttled: do not flood with unread message notifications
                }
            }

            Instant now = clock.instant();
            Notification notification = new Notification(user, type, title, body, link, now);
            notificationRepository.save(notification);
        } catch (Exception e) {
            log.error("Failed to create notification for user {}: {}", user.getId(), e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public PageResponse<NotificationResponse> getMyNotifications(Long userId, Boolean unreadOnly, int page, int size) {
        int validatedSize = Math.min(Math.max(1, size), 50);
        int validatedPage = Math.max(0, page);
        Pageable pageable = PageRequest.of(validatedPage, validatedSize);

        Page<Notification> p;
        if (Boolean.TRUE.equals(unreadOnly)) {
            p = notificationRepository.findByUserIdAndReadAtIsNullOrderByCreatedAtDesc(userId, pageable);
        } else {
            p = notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
        }

        return PageResponse.from(p.map(NotificationResponse::from));
    }

    @Transactional(readOnly = true)
    public Map<String, Integer> getUnreadCount(Long userId) {
        long count = notificationRepository.countByUserIdAndReadAtIsNull(userId);
        return Map.of("total", (int) count);
    }

    @Transactional
    public void markAsRead(Long userId, Long notificationId) {
        Notification notification = notificationRepository.findByIdAndUserId(notificationId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));
        if (notification.getReadAt() == null) {
            notification.setReadAt(clock.instant());
            notificationRepository.save(notification);
        }
    }

    @Transactional
    public void markAllAsRead(Long userId) {
        notificationRepository.markAllAsRead(userId, clock.instant());
    }

    @Transactional
    public int deleteOldReadNotifications(int days) {
        Instant cutoff = clock.instant().minus(days, ChronoUnit.DAYS);
        return notificationRepository.deleteOldReadNotifications(cutoff);
    }
}
