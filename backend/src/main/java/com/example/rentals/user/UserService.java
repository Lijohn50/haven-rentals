package com.example.rentals.user;

import com.example.rentals.auth.RefreshTokenRepository;
import com.example.rentals.common.*;
import com.example.rentals.user.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final HostProfileRepository hostProfileRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;
    private final CacheManager cacheManager;
    private final Clock clock;

    @Transactional(readOnly = true)
    public UserResponse getMe(Long userId) {
        User user = findUser(userId);
        return UserResponse.from(user);
    }

    @Transactional
    public UserResponse updateProfile(Long userId, UpdateProfileRequest req) {
        User user = findUser(userId);
        if (req.firstName() != null && !req.firstName().isBlank()) {
            user.setFirstName(req.firstName().trim());
        }
        if (req.lastName() != null && !req.lastName().isBlank()) {
            user.setLastName(req.lastName().trim());
        }
        if (req.phone() != null) {
            user.setPhone(req.phone().trim());
        }
        user = userRepository.save(user);
        evictCache(userId);
        return UserResponse.from(user);
    }

    @Transactional
    public UserResponse becomeHost(Long userId, BecomeHostRequest req) {
        User user = findUser(userId);
        if (!user.isEmailVerified()) {
            throw new ApiException(ErrorCode.EMAIL_NOT_VERIFIED, HttpStatus.FORBIDDEN, "Email must be verified before becoming a host");
        }
        if (user.hasRole(Role.HOST)) {
            throw new ConflictException("User is already registered as a host");
        }

        HostProfile profile = new HostProfile(user, req.displayName(), req.bio());
        hostProfileRepository.save(profile);

        user.addRole(Role.HOST);
        user.setHostProfile(profile);
        user = userRepository.save(user);

        auditService.record(userId, "HOST_ONBOARDED", "User", userId, Map.of("displayName", req.displayName()));
        evictCache(userId);

        return UserResponse.from(user);
    }

    @Transactional
    public void deleteAccount(Long userId, DeleteAccountRequest req) {
        User user = findUser(userId);
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "Incorrect password");
        }

        // Soft delete user
        user.setStatus(UserStatus.DELETED);
        user.setEmail("deleted-" + userId + "@deleted.invalid");
        user.setFirstName("Deleted");
        user.setLastName("User");
        user.setPhone(null);
        user.incrementTokenVersion();
        userRepository.save(user);

        refreshTokenRepository.revokeAllForUser(userId, clock.instant());
        evictCache(userId);
        auditService.record(userId, "USER_DELETED", "User", userId, Map.of());
    }

    @Transactional(readOnly = true)
    public PublicHostResponse getPublicHost(Long hostId) {
        User user = userRepository.findById(hostId)
                .orElseThrow(() -> new ResourceNotFoundException("Host not found"));
        if (!user.hasRole(Role.HOST) || user.getStatus() != UserStatus.ACTIVE) {
            throw new ResourceNotFoundException("Host not found");
        }

        HostProfile profile = user.getHostProfile();
        String displayName = profile != null ? profile.getDisplayName() : user.getFirstName();
        String bio = profile != null ? profile.getBio() : null;

        return new PublicHostResponse(
                user.getId(),
                displayName,
                bio,
                user.getCreatedAt(),
                0,
                BigDecimal.ZERO,
                0
        );
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private void evictCache(Long userId) {
        var cache = cacheManager.getCache(CacheConfig.CACHE_USER_AUTH);
        if (cache != null) {
            cache.evict(userId);
        }
    }
}
