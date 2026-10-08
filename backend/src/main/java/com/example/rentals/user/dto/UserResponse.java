package com.example.rentals.user.dto;

import com.example.rentals.user.Role;
import com.example.rentals.user.User;

import java.util.Set;
import java.util.stream.Collectors;

public record UserResponse(
        Long id,
        String email,
        String firstName,
        String lastName,
        String phone,
        Set<String> roles,
        boolean host,
        boolean emailVerified,
        String hostDisplayName
) {
    public static UserResponse from(User user) {
        String hostName = user.getHostProfile() != null ? user.getHostProfile().getDisplayName() : null;
        Set<String> roleNames = user.getRoles().stream().map(Role::name).collect(Collectors.toSet());
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getPhone(),
                roleNames,
                user.hasRole(Role.HOST),
                user.isEmailVerified(),
                hostName
        );
    }
}
