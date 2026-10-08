package com.example.rentals.auth;

import com.example.rentals.common.AuthenticatedUserPrincipal;
import com.example.rentals.user.Role;
import com.example.rentals.user.User;
import com.example.rentals.user.UserRepository;
import com.example.rentals.user.UserStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with email: " + email));
        return toPrincipal(user);
    }

    public UserDetails loadUserById(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with id: " + userId));
        return toPrincipal(user);
    }

    private AuthenticatedUserPrincipal toPrincipal(User user) {
        return new AuthenticatedUserPrincipal(
                user.getId(),
                user.getEmail(),
                user.getPasswordHash(),
                user.getStatus() == UserStatus.ACTIVE,
                user.getTokenVersion(),
                user.getRoles().stream().map(Role::name).collect(Collectors.toSet())
        );
    }
}
