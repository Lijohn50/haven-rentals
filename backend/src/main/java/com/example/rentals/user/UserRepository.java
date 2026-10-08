package com.example.rentals.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    /**
     * Text/role/status search lives in {@link UserSpecifications} rather than JPQL: a
     * `cast(:param as String) IS NULL` guard does not stop Postgres failing to infer the
     * JDBC type of an untyped null bind, which surfaced as a 500 on the admin user list
     * whenever `query` was omitted. Building the predicates in the Criteria API means an
     * absent filter is never bound at all.
     */
    @Query("SELECT COUNT(u) FROM User u JOIN u.roles r WHERE r = 'ADMIN' AND u.status = 'ACTIVE'")
    long countActiveAdmins();
}
