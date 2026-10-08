package com.example.rentals.common;

import java.math.BigDecimal;
import java.math.RoundingMode;

public final class MoneyUtils {

    public static final RoundingMode DEFAULT_ROUNDING = RoundingMode.HALF_UP;
    public static final int SCALE = 2;
    public static final BigDecimal ZERO = BigDecimal.ZERO.setScale(SCALE, DEFAULT_ROUNDING);
    public static final BigDecimal ONE_HUNDRED = new BigDecimal("100.00");

    private MoneyUtils() {
    }

    public static BigDecimal round(BigDecimal value) {
        if (value == null) {
            return ZERO;
        }
        return value.setScale(SCALE, DEFAULT_ROUNDING);
    }

    public static BigDecimal percentage(BigDecimal base, BigDecimal percent) {
        if (base == null || percent == null) {
            return ZERO;
        }
        return round(base.multiply(percent).divide(ONE_HUNDRED, 4, DEFAULT_ROUNDING));
    }

    public static BigDecimal divide(BigDecimal numerator, BigDecimal denominator) {
        if (denominator == null || denominator.compareTo(BigDecimal.ZERO) == 0) {
            return ZERO;
        }
        return round(numerator.divide(denominator, 4, DEFAULT_ROUNDING));
    }

    public static boolean hasValidScaleAndPositive(BigDecimal amount) {
        if (amount == null) return false;
        return amount.scale() <= SCALE && amount.compareTo(BigDecimal.ZERO) > 0;
    }

    public static boolean hasValidScaleAndNonNegative(BigDecimal amount) {
        if (amount == null) return false;
        return amount.scale() <= SCALE && amount.compareTo(BigDecimal.ZERO) >= 0;
    }

    public static void validateMoney(BigDecimal amount, String fieldName, boolean allowZero) {
        if (amount == null) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, fieldName + " is required");
        }
        if (amount.scale() > SCALE) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, fieldName + " must not have more than 2 decimal places");
        }
        if (allowZero ? amount.compareTo(BigDecimal.ZERO) < 0 : amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, fieldName + (allowZero ? " must be non-negative" : " must be positive"));
        }
    }
}
