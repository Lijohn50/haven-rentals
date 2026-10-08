package com.example.rentals.payment;

import com.example.rentals.common.CurrentUserProvider;
import com.example.rentals.common.PageResponse;
import com.example.rentals.payment.dto.PaymentResponse;
import com.example.rentals.payment.dto.PayoutResponse;
import com.example.rentals.payment.dto.PayoutSummaryResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;
    private final PayoutService payoutService;
    private final CurrentUserProvider currentUser;

    @GetMapping("/bookings/{id}/payment")
    public ResponseEntity<PaymentResponse> getBookingPayment(@PathVariable Long id) {
        return ResponseEntity.ok(paymentService.getBookingPayment(id, currentUser.getUserId()));
    }

    @GetMapping("/host/payouts")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<PageResponse<PayoutResponse>> getHostPayouts(
            @RequestParam(required = false) PayoutStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 50));
        return ResponseEntity.ok(PageResponse.from(payoutService.getHostPayouts(currentUser.getUserId(), status, pageable)));
    }

    @GetMapping("/host/payouts/summary")
    @PreAuthorize("hasRole('HOST')")
    public ResponseEntity<PayoutSummaryResponse> getHostPayoutSummary() {
        return ResponseEntity.ok(payoutService.getHostPayoutSummary(currentUser.getUserId()));
    }
}
