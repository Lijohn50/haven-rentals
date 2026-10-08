package com.example.rentals.pricing;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;

@Repository
public interface CommissionSettingRepository extends JpaRepository<CommissionSetting, Long> {

    Optional<CommissionSetting> findFirstByEffectiveFromLessThanEqualOrderByEffectiveFromDesc(Instant now);

    boolean existsByEffectiveFrom(Instant effectiveFrom);

    Page<CommissionSetting> findAllByOrderByEffectiveFromDesc(Pageable pageable);
}
