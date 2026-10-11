package com.example.rentals.messaging;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    @Query("""
        SELECT c FROM Conversation c
        JOIN FETCH c.listing
        JOIN FETCH c.guest g
        LEFT JOIN FETCH g.hostProfile
        JOIN FETCH c.host h
        LEFT JOIN FETCH h.hostProfile
        WHERE c.listing.id = :listingId AND c.guest.id = :guestId
    """)
    Optional<Conversation> findByListingIdAndGuestId(@Param("listingId") Long listingId, @Param("guestId") Long guestId);

    @Query("""
        SELECT c FROM Conversation c
        JOIN FETCH c.listing
        JOIN FETCH c.guest g
        LEFT JOIN FETCH g.hostProfile
        JOIN FETCH c.host h
        LEFT JOIN FETCH h.hostProfile
        WHERE c.guest.id = :userId OR c.host.id = :userId
        ORDER BY COALESCE(c.lastMessageAt, c.createdAt) DESC
    """)
    List<Conversation> findUserInbox(@Param("userId") Long userId);

    @Query("""
        SELECT c FROM Conversation c
        JOIN FETCH c.listing
        JOIN FETCH c.guest g
        LEFT JOIN FETCH g.hostProfile
        JOIN FETCH c.host h
        LEFT JOIN FETCH h.hostProfile
        WHERE c.id = :id
    """)
    Optional<Conversation> findByIdWithDetails(@Param("id") Long id);
}
