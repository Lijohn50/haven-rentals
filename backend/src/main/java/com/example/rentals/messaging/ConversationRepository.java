package com.example.rentals.messaging;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    Optional<Conversation> findByListingIdAndGuestId(Long listingId, Long guestId);

    @Query("""
        SELECT c FROM Conversation c
        WHERE c.guest.id = :userId OR c.host.id = :userId
        ORDER BY COALESCE(c.lastMessageAt, c.createdAt) DESC
    """)
    List<Conversation> findUserInbox(@Param("userId") Long userId);
}
