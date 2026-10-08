package com.example.rentals.payment;

import com.example.rentals.booking.Booking;
import com.example.rentals.common.ApiException;
import com.example.rentals.common.AuditService;
import com.example.rentals.common.BusinessRuleException;
import com.example.rentals.common.ErrorCode;
import com.example.rentals.common.MoneyUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class RefundService {

    private final PaymentRepository paymentRepository;
    private final RefundRepository refundRepository;
    private final PaymentGateway paymentGateway;
    private final AuditService auditService;

    @Transactional(propagation = Propagation.REQUIRED)
    public Refund issueRefund(Booking booking, BigDecimal amount, RefundReason reason, String extraIdempotencyPart) {
        MoneyUtils.validateMoney(amount, "amount", false);

        Payment payment = paymentRepository.findByBookingIdForUpdate(booking.getId())
                .orElseThrow(() -> new BusinessRuleException("No payment found for booking to refund"));

        BigDecimal remaining = payment.getAmount().subtract(payment.getRefundedTotal());
        if (amount.compareTo(remaining) > 0) {
            throw new BusinessRuleException("Refund amount " + amount + " exceeds remaining refundable amount " + remaining);
        }

        String idemKey = "refund-" + booking.getId() + "-" + reason.name();
        if (extraIdempotencyPart != null && !extraIdempotencyPart.isBlank()) {
            idemKey += "-" + extraIdempotencyPart;
        }
        final String refundIdempotencyKey = idemKey;

        Optional<Refund> existing = refundRepository.findByIdempotencyKey(refundIdempotencyKey);
        if (existing.isPresent() && existing.get().getStatus() == RefundStatus.SUCCEEDED) {
            return existing.get();
        }

        Refund refund = existing.orElseGet(() -> new Refund(payment, booking, amount, reason, refundIdempotencyKey));
        refund.setAttemptCount(refund.getAttemptCount() + 1);
        refund = refundRepository.save(refund);

        PaymentGateway.RefundResult result = paymentGateway.refund(payment.getProviderReference(), amount, idemKey);

        if (result.success()) {
            refund.setStatus(RefundStatus.SUCCEEDED);
            payment.setRefundedTotal(payment.getRefundedTotal().add(amount));

            if (payment.getRefundedTotal().compareTo(payment.getAmount()) >= 0) {
                payment.setStatus(PaymentStatus.REFUNDED);
            } else {
                payment.setStatus(PaymentStatus.PARTIALLY_REFUNDED);
            }

            paymentRepository.save(payment);
            refund = refundRepository.save(refund);

            auditService.record(booking.getGuest().getId(), "REFUND_ISSUED", "Refund", refund.getId(),
                    Map.of("bookingId", booking.getId(), "amount", amount, "reason", reason.name()));
        } else {
            refund.setStatus(RefundStatus.FAILED);
            refund = refundRepository.save(refund);
            log.error("Refund gateway failed for booking id={}, reason={}, failureCode={}", booking.getId(), reason, result.failureCode());
        }

        return refund;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public Refund issueRefund(Long paymentId, BigDecimal amount, RefundReason reason, String extraIdempotencyPart) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new BusinessRuleException("Payment not found"));
        return issueRefund(payment.getBooking(), amount, reason, extraIdempotencyPart);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void retryRefund(Long refundId) {
        Refund refund = refundRepository.findById(refundId).orElse(null);
        if (refund == null || refund.getStatus() == RefundStatus.SUCCEEDED || refund.getAttemptCount() >= 5) {
            return;
        }

        Payment payment = refund.getPayment();
        refund.setAttemptCount(refund.getAttemptCount() + 1);

        PaymentGateway.RefundResult result = paymentGateway.refund(
                payment.getProviderReference(), refund.getAmount(), refund.getIdempotencyKey());

        if (result.success()) {
            refund.setStatus(RefundStatus.SUCCEEDED);
            payment.setRefundedTotal(payment.getRefundedTotal().add(refund.getAmount()));
            if (payment.getRefundedTotal().compareTo(payment.getAmount()) >= 0) {
                payment.setStatus(PaymentStatus.REFUNDED);
            } else {
                payment.setStatus(PaymentStatus.PARTIALLY_REFUNDED);
            }
            paymentRepository.save(payment);
            auditService.record(refund.getBooking().getGuest().getId(), "REFUND_ISSUED", "Refund", refund.getId(),
                    Map.of("bookingId", refund.getBooking().getId(), "amount", refund.getAmount(), "reason", refund.getReason().name()));
        } else {
            refund.setStatus(RefundStatus.FAILED);
            log.error("Retry refund failed for refund id={}, failureCode={}", refund.getId(), result.failureCode());
        }
        refundRepository.save(refund);
    }
}
