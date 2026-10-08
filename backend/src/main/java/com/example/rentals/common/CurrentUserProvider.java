package com.example.rentals.common;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class CurrentUserProvider {

    public Long getUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            throw new ApiException(ErrorCode.UNAUTHENTICATED, "User is not authenticated");
        }
        if (auth.getPrincipal() instanceof AuthenticatedUserPrincipal principal) {
            return principal.getId();
        }
        try {
            return Long.parseLong(auth.getName());
        } catch (NumberFormatException e) {
            throw new ApiException(ErrorCode.UNAUTHENTICATED, "Invalid authentication principal");
        }
    }

    public Long getUserIdOrNull() {
        try {
            return getUserId();
        } catch (Exception e) {
            return null;
        }
    }

    public Set<String> getRoles() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return Collections.emptySet();
        }
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .map(role -> role.startsWith("ROLE_") ? role.substring(5) : role)
                .collect(Collectors.toUnmodifiableSet());
    }

    public boolean hasRole(String role) {
        return getRoles().contains(role);
    }

    public boolean isAdmin() {
        return hasRole("ADMIN");
    }

    public boolean isSupportAgent() {
        return hasRole("SUPPORT_AGENT");
    }

    public boolean isHost() {
        return hasRole("HOST");
    }
}