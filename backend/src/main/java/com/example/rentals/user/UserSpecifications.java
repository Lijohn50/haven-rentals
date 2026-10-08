package com.example.rentals.user;

import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

public final class UserSpecifications {

    private UserSpecifications() {}

    /** Case-insensitive partial match over email, first name and last name. */
    public static Specification<User> matchesText(String search) {
        if (search == null || search.isBlank()) return null;
        String escaped = escapeLikePattern(search.trim().toLowerCase());
        return (root, query, cb) -> {
            String pattern = "%" + escaped + "%";
            return cb.or(
                    cb.like(cb.lower(root.get("email")), pattern, '\\'),
                    cb.like(cb.lower(root.get("firstName")), pattern, '\\'),
                    cb.like(cb.lower(root.get("lastName")), pattern, '\\')
            );
        };
    }

    public static Specification<User> hasRole(Role role) {
        if (role == null) return null;
        return (root, query, cb) -> cb.isMember(role, root.get("roles"));
    }

    public static Specification<User> hasStatus(UserStatus status) {
        if (status == null) return null;
        return (root, query, cb) -> cb.equal(root.get("status"), status);
    }

    /**
     * The role predicate joins the {@code user_roles} collection, so the page query can
     * return duplicate rows without this.
     */
    public static Specification<User> distinct() {
        return (root, query, cb) -> {
            if (query != null) query.distinct(true);
            return cb.conjunction();
        };
    }

    private static String escapeLikePattern(String text) {
        return text.replace("\\", "\\\\")
                   .replace("%", "\\%")
                   .replace("_", "\\_");
    }
}
