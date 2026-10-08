package com.example.rentals.booking;

import com.example.rentals.common.ConflictException;
import com.example.rentals.common.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BookingStateMachineTest {

    @ParameterizedTest(name = "Valid transition from {0} to {1}")
    @CsvSource({
            "PENDING_PAYMENT, CONFIRMED",
            "PENDING_PAYMENT, PENDING_APPROVAL",
            "PENDING_PAYMENT, PAYMENT_FAILED",
            "PENDING_PAYMENT, EXPIRED",
            "PENDING_APPROVAL, CONFIRMED",
            "PENDING_APPROVAL, DECLINED",
            "PENDING_APPROVAL, EXPIRED",
            "PENDING_APPROVAL, CANCELLED_BY_GUEST",
            "CONFIRMED, CANCELLED_BY_GUEST",
            "CONFIRMED, CANCELLED_BY_HOST",
            "CONFIRMED, COMPLETED"
    })
    void testValidStateTransitions(BookingStatus from, BookingStatus to) {
        Booking booking = new Booking();
        booking.setStatus(from);

        booking.transitionTo(to, null);

        assertThat(booking.getStatus()).isEqualTo(to);
    }

    @ParameterizedTest(name = "Invalid transition from {0} to {1} is rejected")
    @CsvSource({
            "PENDING_PAYMENT, COMPLETED",
            "PENDING_PAYMENT, CANCELLED_BY_GUEST",
            "PENDING_PAYMENT, DECLINED",
            "PENDING_APPROVAL, COMPLETED",
            "PENDING_APPROVAL, PAYMENT_FAILED",
            "CONFIRMED, PENDING_PAYMENT",
            "CONFIRMED, PENDING_APPROVAL",
            "CONFIRMED, EXPIRED",
            "COMPLETED, CONFIRMED",
            "COMPLETED, CANCELLED_BY_GUEST",
            "CANCELLED_BY_GUEST, CONFIRMED",
            "CANCELLED_BY_HOST, COMPLETED",
            "DECLINED, CONFIRMED",
            "EXPIRED, CONFIRMED"
    })
    void testInvalidStateTransitions(BookingStatus from, BookingStatus to) {
        Booking booking = new Booking();
        booking.setStatus(from);

        assertThatThrownBy(() -> booking.transitionTo(to, null))
                .isInstanceOf(ConflictException.class)
                .satisfies(e -> {
                    ConflictException ce = (ConflictException) e;
                    assertThat(ce.getErrorCode()).isEqualTo(ErrorCode.INVALID_STATE_TRANSITION);
                });
    }

    @Test
    @DisplayName("isCancelled helper method returns true for CANCELLED_BY_GUEST and CANCELLED_BY_HOST")
    void testIsCancelledHelper() {
        Booking b = new Booking();
        b.setStatus(BookingStatus.CONFIRMED);
        assertThat(b.isCancelled()).isFalse();

        b.setStatus(BookingStatus.CANCELLED_BY_GUEST);
        assertThat(b.isCancelled()).isTrue();

        b.setStatus(BookingStatus.CANCELLED_BY_HOST);
        assertThat(b.isCancelled()).isTrue();
    }
}
