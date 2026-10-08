package com.example.rentals.auth;

import com.example.rentals.common.AuthenticatedUserPrincipal;
import com.example.rentals.user.Role;
import com.example.rentals.user.User;
import com.example.rentals.user.UserRepository;
import com.example.rentals.user.UserStatus;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final CacheManager cacheManager;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        if (StringUtils.hasText(authHeader) && authHeader.startsWith("Bearer ")) {
            String jwt = authHeader.substring(7);
            Claims claims = jwtService.parseAndValidate(jwt);
            if (claims != null) {
                Long userId = jwtService.extractUserId(claims);
                Integer tokenVersion = jwtService.extractTokenVersion(claims);

                if (userId != null && tokenVersion != null) {
                    User user = loadUserCached(userId);
                    if (user != null && user.getStatus() == UserStatus.ACTIVE && user.getTokenVersion() == tokenVersion) {
                        AuthenticatedUserPrincipal principal = new AuthenticatedUserPrincipal(
                                user.getId(),
                                user.getEmail(),
                                user.getPasswordHash(),
                                true,
                                user.getTokenVersion(),
                                user.getRoles().stream().map(Role::name).collect(Collectors.toSet())
                        );

                        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                                principal,
                                null,
                                principal.getAuthorities()
                        );
                        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                        SecurityContextHolder.getContext().setAuthentication(authentication);
                    }
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    private User loadUserCached(Long userId) {
        Cache cache = cacheManager.getCache("userAuth");
        if (cache != null) {
            User cachedUser = cache.get(userId, User.class);
            if (cachedUser != null) {
                return cachedUser;
            }
        }

        Optional<User> opt = userRepository.findById(userId);
        if (opt.isPresent()) {
            User user = opt.get();
            // initialize roles
            user.getRoles().size();
            if (cache != null) {
                cache.put(userId, user);
            }
            return user;
        }
        return null;
    }
}
