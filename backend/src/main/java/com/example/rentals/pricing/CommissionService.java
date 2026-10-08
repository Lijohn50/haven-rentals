package com.example.rentals.pricing;

import com.example.rentals.common.*;
import com.example.rentals.pricing.dto.CommissionSettingRequest;
import com.example.rentals.pricing.dto.CommissionSettingResponse;
import com.example.rentals.user.User;
import com.example.rentals.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class CommissionService {

    private final CommissionSettingRepository commissionRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;
    private final CacheManager cacheManager;
    private final Clock clock;

    @Transactional(readOnly = true)
    public CommissionSetting getCurrentSetting() {
        var cache = cacheManager.getCache(CacheConfig.CACHE_COMMISSION);
        if (cache != null) {
            CommissionSetting cached = cache.get("current", CommissionSetting.class);
            if (cached != null) return cached;
        }

        Instant now = clock.instant();
        CommissionSetting setting = commissionRepository.findFirstByEffectiveFromLessThanEqualOrderByEffectiveFromDesc(now)
                .orElseGet(() -> new CommissionSetting(
                        new BigDecimal("10.00"),
                        new BigDecimal("3.00"),
                        new BigDecimal("8.00"),
                        Instant.EPOCH,
                        null
                ));

        if (cache != null) {
            cache.put("current", setting);
        }
        return setting;
    }

    @Transactional(readOnly = true)
    public Page<CommissionSettingResponse> listHistory(Pageable pageable) {
        return commissionRepository.findAllByOrderByEffectiveFromDesc(pageable)
                .map(CommissionSettingResponse::from);
    }

    @Transactional
    public CommissionSettingResponse createSetting(Long adminId, CommissionSettingRequest req) {
        MoneyUtils.validateMoney(req.guestServiceFeePercent(), "guestServiceFeePercent", true);
        MoneyUtils.validateMoney(req.hostCommissionPercent(), "hostCommissionPercent", true);
        MoneyUtils.validateMoney(req.taxPercent(), "taxPercent", true);

        Instant now = clock.instant();
        if (req.effectiveFrom().isBefore(now.plus(1, ChronoUnit.MINUTES))) {
            throw new BusinessRuleException("effectiveFrom must be at least 1 minute in the future");
        }

        if (commissionRepository.existsByEffectiveFrom(req.effectiveFrom())) {
            throw new ConflictException("A commission setting with effectiveFrom=" + req.effectiveFrom() + " already exists");
        }

        User admin = userRepository.findById(adminId).orElse(null);
        CommissionSetting setting = new CommissionSetting(
                req.guestServiceFeePercent(),
                req.hostCommissionPercent(),
                req.taxPercent(),
                req.effectiveFrom(),
                admin
        );
        setting = commissionRepository.save(setting);

        auditService.record(adminId, "COMMISSION_CHANGED", "CommissionSetting", setting.getId(),
                Map.of("guestFee", req.guestServiceFeePercent(), "hostCommission", req.hostCommissionPercent(), "tax", req.taxPercent()));

        var cache = cacheManager.getCache(CacheConfig.CACHE_COMMISSION);
        if (cache != null) cache.clear();

        return CommissionSettingResponse.from(setting);
    }
}
