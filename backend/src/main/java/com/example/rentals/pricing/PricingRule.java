package com.example.rentals.pricing;

public interface PricingRule {
    int getOrder();
    void apply(PricingContext context);
}
