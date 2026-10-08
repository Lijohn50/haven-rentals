package com.example.rentals.messaging;

import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface MessageRepository extends MongoRepository<MessageDocument, String> {

    Optional<MessageDocument> findByConversationIdAndClientKey(Long conversationId, String clientKey);

    List<MessageDocument> findByConversationIdAndSentAtLessThanOrderBySentAtDesc(
            Long conversationId, Instant before, Pageable pageable
    );

    List<MessageDocument> findByConversationIdOrderBySentAtDesc(
            Long conversationId, Pageable pageable
    );

    int countByConversationIdAndSenderIdNotAndReadAtIsNull(Long conversationId, Long senderId);

    long countByConversationIdAndSenderIdAndBodyAndSentAtAfter(
            Long conversationId, Long senderId, String body, Instant after
    );

    List<MessageDocument> findByConversationIdAndSenderIdNotAndReadAtIsNull(Long conversationId, Long senderId);
}
