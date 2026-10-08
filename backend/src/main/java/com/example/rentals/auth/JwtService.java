package com.example.rentals.auth;

import com.example.rentals.common.AppProperties;
import com.example.rentals.user.Role;
import com.example.rentals.user.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class JwtService {

    private static final String ISSUER = "rentals-api";
    private final AppProperties appProperties;
    private final Clock clock;
    private SecretKey signingKey;

    @PostConstruct
    public void init() {
        String secret = appProperties.getSecurity().getJwtSecret();
        if (secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT_SECRET must be at least 32 bytes long");
        }
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateAccessToken(User user) {
        Instant now = clock.instant();
        int minutes = appProperties.getSecurity().getAccessTokenMinutes();
        Instant exp = now.plus(minutes, ChronoUnit.MINUTES);

        List<String> roles = user.getRoles().stream().map(Role::name).collect(Collectors.toList());

        return Jwts.builder()
                .issuer(ISSUER)
                .subject(user.getId().toString())
                .id(UUID.randomUUID().toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .claim("tv", user.getTokenVersion())
                .claim("roles", roles)
                .signWith(signingKey)
                .compact();
    }

    public Claims parseAndValidate(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(signingKey)
                    .requireIssuer(ISSUER)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("JWT validation failed: {}", e.getMessage());
            return null;
        }
    }

    public Long extractUserId(Claims claims) {
        if (claims == null || claims.getSubject() == null) return null;
        try {
            return Long.parseLong(claims.getSubject());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public Integer extractTokenVersion(Claims claims) {
        if (claims == null) return null;
        Object tv = claims.get("tv");
        if (tv instanceof Number n) {
            return n.intValue();
        }
        return null;
    }
}
