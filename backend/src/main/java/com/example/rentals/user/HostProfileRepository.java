package com.example.rentals.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface HostProfileRepository extends JpaRepository<HostProfile, Long> {
    Optional<HostProfile> findByUserId(Long userId);
}
