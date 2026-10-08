package com.example.rentals.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;

@Repository
public interface OneTimeTokenRepository extends JpaRepository<OneTimeToken, Long> {

    Optional<OneTimeToken> findByTokenHashAndType(String tokenHash, OneTimeTokenType type);

    @Modifying
    @Query("UPDATE OneTimeToken t SET t.usedAt = :now WHERE t.user.id = :userId AND t.type = :type AND t.usedAt IS NULL")
    void invalidateExistingTokens(@Param("userId") Long userId, @Param("type") OneTimeTokenType type, @Param("now") Instant now);

    @Modifying
    @Query("DELETE FROM OneTimeToken t WHERE t.expiresAt < :now OR t.usedAt IS NOT NULL")
    int deleteExpiredOrUsedTokens(@Param("now") Instant now);
}
