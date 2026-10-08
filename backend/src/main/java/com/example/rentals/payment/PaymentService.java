package com.example.rentals.payment;

import com.example.rentals.booking.Booking;
import com.example.rentals.booking.BookingRepository;
import com.example.rentals.common.ApiException;
import com.example.rentals.common.ErrorCode;
import com.example.rentals.common.ResourceNotFoundException;
import com.example.rentals.payment.dto.PaymentResponse;
import com.example.rentals.payment.dto.RefundResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final RefundRepository refundRepository;
    private final BookingRepository bookingRepository;

    @Transactional
    public Payment createPendingPayment(Booking booking) {
        String idemKey = "pay-" + booking.getId();
        return paymentRepository.findByIdempotencyKey(idemKey)
                .orElseGet(() -> {
                    Payment payment = new Payment(booking, booking.getTotalAmount(), PaymentStatus.PENDING, idemKey);
                    return paymentRepository.save(payment);
                });
    }

    @Transactional(readOnly = true)
    public PaymentResponse getBookingPayment(Long bookingId, Long userId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

        if (!booking.getGuest().getId().equals(userId)) {
            throw new ResourceNotFoundException("Booking not found");
        }

        Payment payment = paymentRepository.findByBookingId(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("No payment found for booking"));

        List<RefundResponse> refunds = refundRepository.findByPaymentIdOrderByCreatedAtDesc(payment.getId())
                .stream()
                .map(RefundResponse::from)
                .toList();

        return PaymentResponse.from(payment, refunds);
    }
}
