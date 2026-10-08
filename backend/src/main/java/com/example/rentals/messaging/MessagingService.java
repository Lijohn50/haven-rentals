package com.example.rentals.messaging;

import com.example.rentals.common.*;
import com.example.rentals.listing.Listing;
import com.example.rentals.listing.ListingRepository;
import com.example.rentals.listing.ListingStatus;
import com.example.rentals.messaging.dto.*;
import com.example.rentals.user.User;
import com.example.rentals.user.UserRepository;
import com.example.rentals.user.UserStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class MessagingService {

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final ListingRepository listingRepository;
    private final UserRepository userRepository;
    private final Clock clock;

    @Transactional
    public ConversationResponse startConversation(Long guestId, StartConversationRequest req) {
        User guest = userRepository.findById(guestId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!guest.isEmailVerified()) {
            throw new ApiException(ErrorCode.EMAIL_NOT_VERIFIED, HttpStatus.FORBIDDEN, "Email must be verified before messaging");
        }
        if (guest.getStatus() != UserStatus.ACTIVE) {
            throw new ApiException(ErrorCode.ACCOUNT_SUSPENDED, HttpStatus.FORBIDDEN, "Account suspended");
        }

        Listing listing = listingRepository.findById(req.listingId())
                .filter(l -> l.getStatus() != ListingStatus.DELETED)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found"));

        if (listing.getHost().getId().equals(guestId)) {
            throw new BusinessRuleException("Hosts cannot message their own listing");
        }

        if (listing.getStatus() != ListingStatus.ACTIVE) {
            throw new BusinessRuleException("Can only start a conversation on an active listing");
        }

        Conversation conv = conversationRepository.findByListingIdAndGuestId(req.listingId(), guestId)
                .orElseGet(() -> {
                    Conversation c = new Conversation(listing, guest, listing.getHost());
                    return conversationRepository.save(c);
                });

        sendMessageInternal(guestId, conv, req.message().trim(), null);

        int unread = messageRepository.countByConversationIdAndSenderIdNotAndReadAtIsNull(conv.getId(), guestId);
        return ConversationResponse.from(conv, guestId, unread);
    }

    @Transactional(readOnly = true)
    public List<ConversationResponse> getInbox(Long userId) {
        List<Conversation> convs = conversationRepository.findUserInbox(userId);
        List<ConversationResponse> responses = new ArrayList<>();

        for (Conversation c : convs) {
            int unread = messageRepository.countByConversationIdAndSenderIdNotAndReadAtIsNull(c.getId(), userId);
            responses.add(ConversationResponse.from(c, userId, unread));
        }
        return responses;
    }

    @Transactional(readOnly = true)
    public ConversationResponse getConversation(Long userId, Long conversationId) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));

        validateParticipant(conv, userId);
        int unread = messageRepository.countByConversationIdAndSenderIdNotAndReadAtIsNull(conv.getId(), userId);
        return ConversationResponse.from(conv, userId, unread);
    }

    @Transactional(readOnly = true)
    public MessagePageResponse getMessages(Long userId, Long conversationId, Instant before, int limit) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));
        validateParticipant(conv, userId);

        int pageSize = Math.min(Math.max(1, limit), 50);
        Pageable pageable = PageRequest.of(0, pageSize + 1);

        List<MessageDocument> docs;
        if (before != null) {
            docs = messageRepository.findByConversationIdAndSentAtLessThanOrderBySentAtDesc(conversationId, before, pageable);
        } else {
            docs = messageRepository.findByConversationIdOrderBySentAtDesc(conversationId, pageable);
        }

        boolean hasMore = docs.size() > pageSize;
        if (hasMore) {
            docs = docs.subList(0, pageSize);
        }

        Instant nextCursor = null;
        if (hasMore && !docs.isEmpty()) {
            nextCursor = docs.get(docs.size() - 1).getSentAt();
        }

        List<MessageResponse> responses = docs.stream().map(MessageResponse::from).toList();
        return new MessagePageResponse(responses, hasMore, nextCursor);
    }

    @Transactional
    public MessageResponse sendMessage(Long userId, Long conversationId, SendMessageRequest req, String idempotencyKey) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));
        validateParticipant(conv, userId);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!user.isEmailVerified()) {
            throw new ApiException(ErrorCode.EMAIL_NOT_VERIFIED, HttpStatus.FORBIDDEN, "Email must be verified before messaging");
        }
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new ApiException(ErrorCode.ACCOUNT_SUSPENDED, HttpStatus.FORBIDDEN, "Account suspended");
        }

        return sendMessageInternal(userId, conv, req.body().trim(), idempotencyKey);
    }

    @Transactional
    public void markRead(Long userId, Long conversationId) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));
        validateParticipant(conv, userId);

        Instant now = clock.instant();
        List<MessageDocument> unread = messageRepository.findByConversationIdAndSenderIdNotAndReadAtIsNull(conversationId, userId);
        for (MessageDocument doc : unread) {
            doc.setReadAt(now);
            messageRepository.save(doc);
        }
    }

    @Transactional(readOnly = true)
    public Map<String, Integer> getUnreadCount(Long userId) {
        List<Conversation> convs = conversationRepository.findUserInbox(userId);
        int total = 0;
        for (Conversation c : convs) {
            total += messageRepository.countByConversationIdAndSenderIdNotAndReadAtIsNull(c.getId(), userId);
        }
        return Map.of("total", total);
    }

    private MessageResponse sendMessageInternal(Long userId, Conversation conv, String body, String idempotencyKey) {
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<MessageDocument> existing = messageRepository.findByConversationIdAndClientKey(conv.getId(), idempotencyKey);
            if (existing.isPresent()) {
                return MessageResponse.from(existing.get());
            }
        }

        // Anti-spam: max 5 identical messages per minute
        Instant oneMinuteAgo = clock.instant().minus(1, ChronoUnit.MINUTES);
        long identicalCount = messageRepository.countByConversationIdAndSenderIdAndBodyAndSentAtAfter(
                conv.getId(), userId, body, oneMinuteAgo);
        if (identicalCount >= 5) {
            throw new ApiException(ErrorCode.RATE_LIMITED, HttpStatus.TOO_MANY_REQUESTS, "Duplicate message rate limit reached. Please wait.");
        }

        Instant now = clock.instant();
        MessageDocument doc = new MessageDocument(conv.getId(), userId, body, idempotencyKey, now);
        doc = messageRepository.save(doc);

        try {
            conv.setLastMessageAt(now);
            String preview = body.length() > 120 ? body.substring(0, 117) + "..." : body;
            conv.setLastMessagePreview(preview);
            conversationRepository.save(conv);
        } catch (Exception e) {
            log.warn("Failed to update conversation preview in PostgreSQL: {}", e.getMessage());
        }

        return MessageResponse.from(doc);
    }

    private void validateParticipant(Conversation conv, Long userId) {
        User user = userRepository.findById(userId).orElse(null);
        boolean isStaff = user != null && (user.hasRole(com.example.rentals.user.Role.ADMIN) || user.hasRole(com.example.rentals.user.Role.SUPPORT_AGENT));
        if (!conv.getGuest().getId().equals(userId) && !conv.getHost().getId().equals(userId) && !isStaff) {
            throw new ResourceNotFoundException("Conversation not found");
        }
    }
}
