package com.example.rentals.auth;

import com.example.rentals.auth.dto.LoginRequest;
import com.example.rentals.auth.dto.RegisterRequest;
import com.example.rentals.auth.dto.TokenResponse;
import com.example.rentals.common.ApiException;
import com.example.rentals.common.AppProperties;
import com.example.rentals.common.ConflictException;
import com.example.rentals.common.ErrorCode;
import com.example.rentals.user.Role;
import com.example.rentals.user.User;
import com.example.rentals.user.UserRepository;
import com.example.rentals.user.UserStatus;
import com.example.rentals.user.dto.UserResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final OneTimeTokenRepository oneTimeTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final TokenHasher tokenHasher;
    private final EmailService emailService;
    private final AppProperties appProperties;
    private final Clock clock;
    private final CacheManager cacheManager;

    private static final String DUMMY_HASH = "$2a$12$e80yqVbYwQyCgG5V5dDqGeYx7j1t9oK7wz8mZfC1Uu4L4bZtO0w2m";

    @Transactional
    public UserResponse register(RegisterRequest req) {
        String email = req.email().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ConflictException(ErrorCode.EMAIL_ALREADY_REGISTERED, "An account with this email already exists");
        }

        String localPart = email.split("@")[0].toLowerCase();
        if (req.password().toLowerCase().contains(localPart)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Password must not contain the email address local part");
        }

        User user = new User(
                email,
                passwordEncoder.encode(req.password()),
                req.firstName(),
                req.lastName(),
                req.phone()
        );
        user = userRepository.save(user);

        // Generate email verification token (24 hours)
        String rawToken = tokenHasher.generateSecureRandomToken();
        String tokenHash = tokenHasher.sha256Hex(rawToken);
        Instant expiresAt = clock.instant().plus(24, ChronoUnit.HOURS);
        OneTimeToken ott = new OneTimeToken(user, OneTimeTokenType.EMAIL_VERIFY, tokenHash, expiresAt);
        oneTimeTokenRepository.save(ott);

        emailService.sendVerificationEmail(user.getEmail(), rawToken);

        return UserResponse.from(user);
    }

    @Transactional
    public void verifyEmail(String rawToken) {
        String tokenHash = tokenHasher.sha256Hex(rawToken);
        Instant now = clock.instant();

        OneTimeToken ott = oneTimeTokenRepository.findByTokenHashAndType(tokenHash, OneTimeTokenType.EMAIL_VERIFY)
                .orElseThrow(() -> new ApiException(ErrorCode.INVALID_OR_EXPIRED_TOKEN, "Invalid or expired verification token"));

        if (ott.isUsed() || ott.isExpired(now)) {
            throw new ApiException(ErrorCode.INVALID_OR_EXPIRED_TOKEN, "Invalid or expired verification token");
        }

        ott.setUsedAt(now);
        User user = ott.getUser();
        user.setEmailVerified(true);
        userRepository.save(user);
        evictUserCache(user.getId());
    }

    @Transactional
    public void resendVerification(String email) {
        userRepository.findByEmailIgnoreCase(email.trim().toLowerCase()).ifPresent(user -> {
            if (!user.isEmailVerified() && user.getStatus() == UserStatus.ACTIVE) {
                Instant now = clock.instant();
                oneTimeTokenRepository.invalidateExistingTokens(user.getId(), OneTimeTokenType.EMAIL_VERIFY, now);

                String rawToken = tokenHasher.generateSecureRandomToken();
                String tokenHash = tokenHasher.sha256Hex(rawToken);
                Instant expiresAt = now.plus(24, ChronoUnit.HOURS);
                OneTimeToken ott = new OneTimeToken(user, OneTimeTokenType.EMAIL_VERIFY, tokenHash, expiresAt);
                oneTimeTokenRepository.save(ott);

                emailService.sendVerificationEmail(user.getEmail(), rawToken);
            }
        });
    }

    @Transactional
    public TokenResponse login(LoginRequest req) {
        String email = req.email().trim().toLowerCase();
        Instant now = clock.instant();

        Optional<User> userOpt = userRepository.findByEmailIgnoreCase(email);
        if (userOpt.isEmpty()) {
            passwordEncoder.matches(req.password(), DUMMY_HASH);
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "Invalid email or password");
        }

        User user = userOpt.get();

        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(now)) {
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "Invalid email or password");
        }

        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            int attempts = user.getFailedLoginAttempts() + 1;
            user.setFailedLoginAttempts(attempts);
            if (attempts >= appProperties.getSecurity().getMaxFailedLogins()) {
                user.setLockedUntil(now.plus(appProperties.getSecurity().getLockoutMinutes(), ChronoUnit.MINUTES));
            }
            userRepository.save(user);
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "Invalid email or password");
        }

        if (user.getStatus() == UserStatus.SUSPENDED) {
            throw new ApiException(ErrorCode.ACCOUNT_SUSPENDED, HttpStatus.FORBIDDEN, "Your account has been suspended: " + (user.getSuspensionReason() != null ? user.getSuspensionReason() : "Contact support"));
        }

        if (user.getStatus() == UserStatus.DELETED) {
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "Invalid email or password");
        }

        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        userRepository.save(user);

        return issueTokens(user);
    }

    @Transactional
    public TokenResponse refresh(String rawRefreshToken) {
        String hash = tokenHasher.sha256Hex(rawRefreshToken);
        Instant now = clock.instant();

        RefreshToken refreshToken = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHENTICATED, "Invalid refresh token"));

        User user = refreshToken.getUser();

        if (refreshToken.isRevoked()) {
            log.warn("Refresh token reuse detected for user id {}", user.getId());
            refreshTokenRepository.revokeAllForUser(user.getId(), now);
            user.incrementTokenVersion();
            userRepository.save(user);
            evictUserCache(user.getId());
            throw new ApiException(ErrorCode.REFRESH_TOKEN_REUSED, HttpStatus.UNAUTHORIZED, "Refresh token reused. Please sign in again.");
        }

        if (refreshToken.isExpired(now)) {
            throw new ApiException(ErrorCode.UNAUTHENTICATED, "Refresh token expired");
        }

        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new ApiException(ErrorCode.ACCOUNT_SUSPENDED, HttpStatus.FORBIDDEN, "Account is not active");
        }

        // Rotate
        refreshToken.setRevokedAt(now);
        refreshTokenRepository.save(refreshToken);

        return issueTokens(user);
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        String hash = tokenHasher.sha256Hex(rawRefreshToken);
        refreshTokenRepository.findByTokenHash(hash).ifPresent(rt -> {
            rt.setRevokedAt(clock.instant());
            refreshTokenRepository.save(rt);
            evictUserCache(rt.getUser().getId());
        });
    }

    @Transactional
    public void forgotPassword(String email) {
        userRepository.findByEmailIgnoreCase(email.trim().toLowerCase()).ifPresent(user -> {
            if (user.getStatus() == UserStatus.ACTIVE) {
                Instant now = clock.instant();
                oneTimeTokenRepository.invalidateExistingTokens(user.getId(), OneTimeTokenType.PASSWORD_RESET, now);

                String rawToken = tokenHasher.generateSecureRandomToken();
                String tokenHash = tokenHasher.sha256Hex(rawToken);
                Instant expiresAt = now.plus(60, ChronoUnit.MINUTES);
                OneTimeToken ott = new OneTimeToken(user, OneTimeTokenType.PASSWORD_RESET, tokenHash, expiresAt);
                oneTimeTokenRepository.save(ott);

                emailService.sendPasswordResetEmail(user.getEmail(), rawToken);
            }
        });
    }

    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        String tokenHash = tokenHasher.sha256Hex(rawToken);
        Instant now = clock.instant();

        OneTimeToken ott = oneTimeTokenRepository.findByTokenHashAndType(tokenHash, OneTimeTokenType.PASSWORD_RESET)
                .orElseThrow(() -> new ApiException(ErrorCode.INVALID_OR_EXPIRED_TOKEN, "Invalid or expired reset token"));

        if (ott.isUsed() || ott.isExpired(now)) {
            throw new ApiException(ErrorCode.INVALID_OR_EXPIRED_TOKEN, "Invalid or expired reset token");
        }

        User user = ott.getUser();
        String localPart = user.getEmail().split("@")[0].toLowerCase();
        if (newPassword.toLowerCase().contains(localPart)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Password must not contain the email address local part");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.incrementTokenVersion();
        ott.setUsedAt(now);
        userRepository.save(user);

        refreshTokenRepository.revokeAllForUser(user.getId(), now);
        evictUserCache(user.getId());
    }

    @Transactional
    public void changePassword(Long userId, String currentPassword, String newPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND, "User not found"));

        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Current password does not match");
        }

        if (passwordEncoder.matches(newPassword, user.getPasswordHash())) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "New password must be different from current password");
        }

        String localPart = user.getEmail().split("@")[0].toLowerCase();
        if (newPassword.toLowerCase().contains(localPart)) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Password must not contain the email address local part");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.incrementTokenVersion();
        userRepository.save(user);

        refreshTokenRepository.revokeAllForUser(user.getId(), clock.instant());
        evictUserCache(user.getId());
    }

    private TokenResponse issueTokens(User user) {
        String accessToken = jwtService.generateAccessToken(user);
        String rawRefreshToken = tokenHasher.generateSecureRandomToken();
        String tokenHash = tokenHasher.sha256Hex(rawRefreshToken);
        Instant refreshExp = clock.instant().plus(appProperties.getSecurity().getRefreshTokenDays(), ChronoUnit.DAYS);

        RefreshToken rt = new RefreshToken(user, tokenHash, refreshExp);
        refreshTokenRepository.save(rt);

        long expiresIn = (long) appProperties.getSecurity().getAccessTokenMinutes() * 60;
        return new TokenResponse(accessToken, rawRefreshToken, "Bearer", expiresIn, UserResponse.from(user));
    }

    private void evictUserCache(Long userId) {
        var cache = cacheManager.getCache("userAuth");
        if (cache != null) {
            cache.evict(userId);
        }
    }
}
