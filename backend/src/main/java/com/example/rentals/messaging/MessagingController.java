package com.example.rentals.messaging;

import com.example.rentals.common.CurrentUser;
import com.example.rentals.messaging.dto.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Tag(name = "Messaging", description = "Guest-host messaging and inbox management")
@RestController
@RequestMapping("/api/v1/conversations")
@RequiredArgsConstructor
public class MessagingController {

    private final MessagingService messagingService;

    @Operation(summary = "Start conversation or send initial message to host")
    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ConversationResponse> startConversation(
            @CurrentUser Long userId,
            @Valid @RequestBody StartConversationRequest request
    ) {
        ConversationResponse response = messagingService.startConversation(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Operation(summary = "Get current user conversation inbox")
    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<ConversationResponse>> getInbox(@CurrentUser Long userId) {
        return ResponseEntity.ok(messagingService.getInbox(userId));
    }

    @Operation(summary = "Get total unread message count")
    @GetMapping("/unread-count")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Integer>> getUnreadCount(@CurrentUser Long userId) {
        return ResponseEntity.ok(messagingService.getUnreadCount(userId));
    }

    @Operation(summary = "Get conversation details")
    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ConversationResponse> getConversation(
            @CurrentUser Long userId,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(messagingService.getConversation(userId, id));
    }

    @Operation(summary = "Get messages in conversation with cursor pagination")
    @GetMapping("/{id}/messages")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MessagePageResponse> getMessages(
            @CurrentUser Long userId,
            @PathVariable Long id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant before,
            @RequestParam(defaultValue = "30") int limit
    ) {
        return ResponseEntity.ok(messagingService.getMessages(userId, id, before, limit));
    }

    @Operation(summary = "Send message in conversation")
    @PostMapping("/{id}/messages")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MessageResponse> sendMessage(
            @CurrentUser Long userId,
            @PathVariable Long id,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody SendMessageRequest request
    ) {
        MessageResponse response = messagingService.sendMessage(userId, id, request, idempotencyKey);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Operation(summary = "Mark conversation messages as read")
    @PostMapping("/{id}/read")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> markRead(
            @CurrentUser Long userId,
            @PathVariable Long id
    ) {
        messagingService.markRead(userId, id);
        return ResponseEntity.noContent().build();
    }
}
