package com.example.rentals.messaging;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "messages")
@CompoundIndexes({
        @CompoundIndex(name = "idx_conv_sent", def = "{'conversationId': 1, 'sentAt': -1}"),
        @CompoundIndex(name = "idx_conv_sender_read", def = "{'conversationId': 1, 'senderId': 1, 'readAt': 1}")
})
@Getter
@Setter
@NoArgsConstructor
public class MessageDocument {

    @Id
    private String id;

    private Long conversationId;
    private Long senderId;
    private String body;
    private String clientKey;
    private Instant sentAt;
    private Instant readAt;

    public MessageDocument(Long conversationId, Long senderId, String body, String clientKey, Instant sentAt) {
        this.conversationId = conversationId;
        this.senderId = senderId;
        this.body = body;
        this.clientKey = clientKey;
        this.sentAt = sentAt;
    }
}
