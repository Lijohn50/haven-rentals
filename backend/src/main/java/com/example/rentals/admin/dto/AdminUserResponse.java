package com.example.rentals.admin.dto;

import com.example.rentals.user.Role;
import com.example.rentals.user.User;
import com.example.rentals.user.UserStatus;

import java.time.Instant;
import java.util.Set;

public record AdminUserResponse(
        Long id,
        String email,
        String firstName,
        String lastName,
        String phone,
        UserStatus status,
        Set<Role> roles,
        boolean emailVerified,
        long tokenVersion,
        int hostCancellationCount,
        Instant createdAt,
        Instant updatedAt
) {
    public static AdminUserResponse from(User u, int hostCancellationCount) {
        return new AdminUserResponse(
                u.getId(),
                u.getEmail(),
                u.getFirstName(),
                u.getLastName(),
                u.getPhone(),
                u.getStatus(),
                u.getRoles(),
                u.isEmailVerified(),
                u.getTokenVersion(),
                hostCancellationCount,
                u.getCreatedAt(),
                u.getUpdatedAt()
        );
    }
}
