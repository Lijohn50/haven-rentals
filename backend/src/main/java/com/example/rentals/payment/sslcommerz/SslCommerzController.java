package com.example.rentals.payment.sslcommerz;

import com.example.rentals.booking.Booking;
import com.example.rentals.booking.BookingService;
import com.example.rentals.common.AppProperties;
import com.example.rentals.common.CurrentUserProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.Map;

@Slf4j
@RestController
@RequiredArgsConstructor
public class SslCommerzController {

    private final BookingService bookingService;
    private final SslCommerzService sslCommerzService;
    private final CurrentUserProvider currentUser;
    private final AppProperties appProperties;

    /**
     * Authenticated endpoint called by frontend to initiate an SSLCommerz hosted payment session.
     */
    @PostMapping("/api/v1/bookings/{id}/sslcommerz/initiate")
    public ResponseEntity<SslCommerzInitResponse> initiatePayment(@PathVariable Long id) {
        log.info("Initiating SSLCommerz payment session for booking id={} by user={}", id, currentUser.getUserId());
        SslCommerzInitResponse response = bookingService.initiateSslCommerzPayment(currentUser.getUserId(), id);
        return ResponseEntity.ok(response);
    }

    /**
     * Public callback endpoint called by SSLCommerz gateway on successful payment.
     * SSLCommerz POSTs form-urlencoded parameters here via browser redirect.
     */
    @PostMapping(value = "/api/v1/payments/sslcommerz/success", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public ResponseEntity<Void> handleSuccess(@RequestParam Map<String, String> formData) {
        String tranId = formData.get("tran_id");
        String valId = formData.get("val_id");
        log.info("SSLCommerz success callback received: tran_id={}, val_id={}", tranId, valId);

        String frontendUrl = appProperties.getFrontendUrl();

        if (valId == null || valId.isBlank() || tranId == null || tranId.isBlank()) {
            log.error("Missing tran_id or val_id in SSLCommerz success callback: {}", formData);
            return ResponseEntity.status(HttpStatus.SEE_OTHER)
                    .location(URI.create(frontendUrl + "/search?payment=error_missing_params"))
                    .build();
        }

        try {
            // Mandatory server-to-server validation
            SslCommerzValidationResponse validation = sslCommerzService.validatePayment(valId);
            if (validation.isValid()) {
                Booking booking = bookingService.finalizeSslCommerzPayment(tranId, valId, validation.amount());
                log.info("Booking {} payment finalized successfully via SSLCommerz", booking.getReference());

                String redirectTarget = frontendUrl + "/trips/" + booking.getReference() + "?payment=success";
                return ResponseEntity.status(HttpStatus.SEE_OTHER)
                        .location(URI.create(redirectTarget))
                        .build();
            } else {
                log.warn("SSLCommerz validation failed for tranId={}, valId={}: {}", tranId, valId, validation.error());
                Booking booking = bookingService.failSslCommerzPayment(tranId, "Validation failed: " + validation.error());
                String redirectTarget = frontendUrl + "/trips/" + booking.getReference() + "?payment=failed";
                return ResponseEntity.status(HttpStatus.SEE_OTHER)
                        .location(URI.create(redirectTarget))
                        .build();
            }
        } catch (Exception e) {
            log.error("Exception handling SSLCommerz success callback for tranId={}", tranId, e);
            try {
                Booking booking = bookingService.getBookingForTranId(tranId);
                return ResponseEntity.status(HttpStatus.SEE_OTHER)
                        .location(URI.create(frontendUrl + "/trips/" + booking.getReference() + "?payment=error"))
                        .build();
            } catch (Exception ignored) {
                return ResponseEntity.status(HttpStatus.SEE_OTHER)
                        .location(URI.create(frontendUrl + "/search?payment=error"))
                        .build();
            }
        }
    }

    /**
     * Public callback endpoint called by SSLCommerz on failed payment.
     */
    @PostMapping(value = "/api/v1/payments/sslcommerz/fail", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public ResponseEntity<Void> handleFail(@RequestParam Map<String, String> formData) {
        String tranId = formData.get("tran_id");
        String error = formData.getOrDefault("error", "Payment failed or was declined by provider");
        log.warn("SSLCommerz fail callback received: tran_id={}, error={}", tranId, error);

        String frontendUrl = appProperties.getFrontendUrl();
        try {
            Booking booking = bookingService.failSslCommerzPayment(tranId, error);
            String redirectTarget = frontendUrl + "/trips/" + booking.getReference() + "?payment=failed";
            return ResponseEntity.status(HttpStatus.SEE_OTHER)
                    .location(URI.create(redirectTarget))
                    .build();
        } catch (Exception e) {
            log.error("Exception handling SSLCommerz fail callback for tranId={}", tranId, e);
            return ResponseEntity.status(HttpStatus.SEE_OTHER)
                    .location(URI.create(frontendUrl + "/search?payment=failed"))
                    .build();
        }
    }

    /**
     * Public callback endpoint called by SSLCommerz on user cancellation.
     */
    @PostMapping(value = "/api/v1/payments/sslcommerz/cancel", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public ResponseEntity<Void> handleCancel(@RequestParam Map<String, String> formData) {
        String tranId = formData.get("tran_id");
        log.info("SSLCommerz cancel callback received for tran_id={}", tranId);

        String frontendUrl = appProperties.getFrontendUrl();
        try {
            Booking booking = bookingService.getBookingForTranId(tranId);
            String redirectTarget = frontendUrl + "/trips/" + booking.getReference() + "?payment=cancelled";
            return ResponseEntity.status(HttpStatus.SEE_OTHER)
                    .location(URI.create(redirectTarget))
                    .build();
        } catch (Exception e) {
            log.error("Exception handling SSLCommerz cancel callback for tranId={}", tranId, e);
            return ResponseEntity.status(HttpStatus.SEE_OTHER)
                    .location(URI.create(frontendUrl + "/search?payment=cancelled"))
                    .build();
        }
    }

    /**
     * Instant Payment Notification (IPN) webhook called asynchronously by SSLCommerz server.
     */
    @PostMapping(value = "/api/v1/payments/sslcommerz/ipn", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public ResponseEntity<String> handleIpn(@RequestParam Map<String, String> formData) {
        String tranId = formData.get("tran_id");
        String valId = formData.get("val_id");
        log.info("SSLCommerz IPN received: tran_id={}, val_id={}", tranId, valId);

        if (valId == null || tranId == null) {
            return ResponseEntity.badRequest().body("Missing tran_id or val_id");
        }

        try {
            SslCommerzValidationResponse validation = sslCommerzService.validatePayment(valId);
            if (validation.isValid()) {
                bookingService.finalizeSslCommerzPayment(tranId, valId, validation.amount());
                log.info("IPN validated and booking finalized for tranId={}", tranId);
                return ResponseEntity.ok("IPN PROCESSED");
            } else {
                bookingService.failSslCommerzPayment(tranId, "IPN Validation failed: " + validation.error());
                return ResponseEntity.ok("IPN FAILED");
            }
        } catch (Exception e) {
            log.error("Exception processing SSLCommerz IPN for tranId={}", tranId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("IPN ERROR");
        }
    }
}
