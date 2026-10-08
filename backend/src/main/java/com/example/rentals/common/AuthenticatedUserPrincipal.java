package com.example.rentals.common;

import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Set;
import java.util.stream.Collectors;

@Getter
public class AuthenticatedUserPrincipal implements UserDetails {
    private final Long id;
    private final String email;
    private final String password;
    private final boolean active;
    private final int tokenVersion;
    private final Collection<? extends GrantedAuthority> authorities;

    public AuthenticatedUserPrincipal(Long id, String email, String password, boolean active, int tokenVersion, Set<String> roles) {
        this.id = id;
        this.email = email;
        this.password = password;
        this.active = active;
        this.tokenVersion = tokenVersion;
        this.authorities = roles.stream()
                .map(r -> new SimpleGrantedAuthority("ROLE_" + r))
                .collect(Collectors.toUnmodifiableSet());
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return active;
    }
}
