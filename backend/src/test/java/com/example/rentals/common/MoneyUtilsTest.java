package com.example.rentals.common;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MoneyUtilsTest {

    @Test
    @DisplayName("Valid money with 2 decimal places is accepted")
    void testValidMoney() {
        BigDecimal amount = new BigDecimal("150.50");
        MoneyUtils.validateMoney(amount, "amount", false);
        assertThat(amount.scale()).isLessThanOrEqualTo(2);
    }

    @Test
    @DisplayName("Valid money with integer is accepted")
    void testIntegerMoney() {
        BigDecimal amount = new BigDecimal("100");
        MoneyUtils.validateMoney(amount, "amount", false);
        assertThat(amount).isEqualTo(new BigDecimal("100"));
    }

    @Test
    @DisplayName("Zero money rejected when allowZero is false")
    void testZeroRejected() {
        assertThatThrownBy(() -> MoneyUtils.validateMoney(BigDecimal.ZERO, "amount", false))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("must be greater than zero");
    }

    @Test
    @DisplayName("Zero money accepted when allowZero is true")
    void testZeroAccepted() {
        MoneyUtils.validateMoney(BigDecimal.ZERO, "amount", true);
    }

    @ParameterizedTest
    @ValueSource(strings = {"-0.01", "-100.00", "-50"})
    @DisplayName("Negative money is always rejected")
    void testNegativeRejected(String val) {
        BigDecimal negative = new BigDecimal(val);
        assertThatThrownBy(() -> MoneyUtils.validateMoney(negative, "amount", true))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("cannot be negative");
    }

    @Test
    @DisplayName("More than 2 decimal places is rejected, not rounded")
    void testMoreThanTwoDecimalsRejected() {
        BigDecimal threeDecimals = new BigDecimal("100.123");
        assertThatThrownBy(() -> MoneyUtils.validateMoney(threeDecimals, "amount", false))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("more than 2 decimal places");
    }

    @Test
    @DisplayName("HALF_UP rounding rounds .005 up to .01")
    void testHalfUpRounding() {
        BigDecimal input = new BigDecimal("10.005");
        BigDecimal rounded = MoneyUtils.round(input);
        assertThat(rounded).isEqualTo(new BigDecimal("10.01"));
    }

    @Test
    @DisplayName("HALF_UP rounding rounds .004 down to .00")
    void testHalfUpDown() {
        BigDecimal input = new BigDecimal("10.004");
        BigDecimal rounded = MoneyUtils.round(input);
        assertThat(rounded).isEqualTo(new BigDecimal("10.00"));
    }
}
