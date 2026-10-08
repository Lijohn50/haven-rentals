package com.example.rentals.admin.dto;

import com.example.rentals.user.Role;
import jakarta.validation.constraints.NotEmpty;

import java.util.Set;

public record RolesRequest(
        @NotEmpty(message = "Roles set cannot be empty")
        Set<Role> roles
) {
}
