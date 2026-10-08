package com.example.rentals.notification;

import com.example.rentals.common.CurrentUser;
import com.example.rentals.common.PageResponse;
import com.example.rentals.notification.dto.NotificationResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Tag(name = "Notifications", description = "In-app notifications management")
@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @Operation(summary = "Get user notifications")
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PageResponse<NotificationResponse>> getNotifications(
            @CurrentUser Long userId,
            @RequestParam(required = false) Boolean unreadOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(notificationService.getMyNotifications(userId, unreadOnly, page, size));
    }

    @Operation(summary = "Get unread notification count")
    @GetMapping("/unread-count")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Integer>> getUnreadCount(@CurrentUser Long userId) {
        return ResponseEntity.ok(notificationService.getUnreadCount(userId));
    }

    @Operation(summary = "Mark single notification as read")
    @PatchMapping("/{id}/read")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> markAsRead(
            @CurrentUser Long userId,
            @PathVariable Long id
    ) {
        notificationService.markAsRead(userId, id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Mark all notifications as read")
    @PatchMapping("/read-all")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> markAllAsRead(@CurrentUser Long userId) {
        notificationService.markAllAsRead(userId);
        return ResponseEntity.noContent().build();
    }
}
