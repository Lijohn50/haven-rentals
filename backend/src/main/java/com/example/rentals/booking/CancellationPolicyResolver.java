package com.example.rentals.booking;

import com.example.rentals.listing.CancellationPolicyType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class CancellationPolicyResolver {

    private final Map<String, CancellationPolicy> policies;

    public CancellationPolicy resolve(CancellationPolicyType type) {
        String key = (type != null ? type.name() : "MODERATE");
        CancellationPolicy policy = policies.get(key);
        if (policy == null) {
            policy = policies.get("MODERATE");
        }
        return policy;
    }
}
