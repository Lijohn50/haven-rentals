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
     * Callback endpoint called by SSLCommerz gateway on successful payment.
     * Supports both POST (form-urlencoded) and GET (query parameters) redirects.
     */
    @RequestMapping(value = "/api/v1/payments/sslcommerz/success", method = {RequestMethod.POST, RequestMethod.GET})
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
            if (!validation.isValid()) {
                log.warn("SSLCommerz validation failed for tranId={}, valId={}: {}", tranId, valId, validation.error());
                Booking booking = bookingService.failSslCommerzPayment(tranId, "Validation failed: " + validation.error());
                String redirectTarget = frontendUrl + "/trips/" + booking.getReference() + "?payment=failed";
                return ResponseEntity.status(HttpStatus.SEE_OTHER)
                        .location(URI.create(redirectTarget))
                        .build();
            }

            // Verify tran_id matches validation response (Blocker 2)
            if (validation.tranId() == null || !validation.tranId().equals(tranId)) {
                log.error("SSLCommerz transaction ID mismatch: callback tranId={}, validation tranId={}", tranId, validation.tranId());
                Booking booking = bookingService.failSslCommerzPayment(tranId, "Transaction ID mismatch");
                String redirectTarget = frontendUrl + "/trips/" + booking.getReference() + "?payment=failed";
                return ResponseEntity.status(HttpStatus.SEE_OTHER)
                        .location(URI.create(redirectTarget))
                        .build();
            }

            Booking booking = bookingService.finalizeSslCommerzPayment(
                    tranId, valId, validation.amount(), validation.currency(), validation.bankTranId());
            log.info("Booking {} payment finalized successfully via SSLCommerz (status={})", booking.getReference(), booking.getStatus());

            String paymentQueryParam = (booking.getStatus() == com.example.rentals.booking.BookingStatus.EXPIRED) ? "expired" : "success";
            String redirectTarget = frontendUrl + "/trips/" + booking.getReference() + "?payment=" + paymentQueryParam;
            return ResponseEntity.status(HttpStatus.SEE_OTHER)
                    .location(URI.create(redirectTarget))
                    .build();
        } catch (Exception e) {
            log.error("Exception handling SSLCommerz success callback for tranId={}", tranId, e);
            try {
                Booking booking = bookingService.getBookingForTranId(tranId);
                return ResponseEntity.status(HttpStatus.SEE_OTHER)
                        .location(URI.create(frontendUrl + "/trips/" + booking.getReference() + "?payment=failed"))
                        .build();
            } catch (Exception ignored) {
                return ResponseEntity.status(HttpStatus.SEE_OTHER)
                        .location(URI.create(frontendUrl + "/search?payment=error"))
                        .build();
            }
        }
    }

    /**
     * Callback endpoint called by SSLCommerz on failed payment.
     * Supports both POST (form-urlencoded) and GET (query parameters) redirects.
     */
    @RequestMapping(value = "/api/v1/payments/sslcommerz/fail", method = {RequestMethod.POST, RequestMethod.GET})
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
     * Callback endpoint called by SSLCommerz on user cancellation.
     * Supports both POST (form-urlencoded) and GET (query parameters) redirects.
     */
    @RequestMapping(value = "/api/v1/payments/sslcommerz/cancel", method = {RequestMethod.POST, RequestMethod.GET})
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
    @RequestMapping(value = "/api/v1/payments/sslcommerz/ipn", method = {RequestMethod.POST, RequestMethod.GET})
    public ResponseEntity<String> handleIpn(@RequestParam Map<String, String> formData) {
        String tranId = formData.get("tran_id");
        String valId = formData.get("val_id");
        log.info("SSLCommerz IPN received: tran_id={}, val_id={}", tranId, valId);

        if (valId == null || tranId == null) {
            return ResponseEntity.badRequest().body("Missing tran_id or val_id");
        }

        try {
            SslCommerzValidationResponse validation = sslCommerzService.validatePayment(valId);
            if (!validation.isValid()) {
                bookingService.failSslCommerzPayment(tranId, "IPN Validation failed: " + validation.error());
                return ResponseEntity.ok("IPN FAILED");
            }

            // Verify tran_id matches validation response (Blocker 2)
            if (validation.tranId() == null || !validation.tranId().equals(tranId)) {
                log.error("SSLCommerz IPN tran_id mismatch: IPN tranId={}, validation tranId={}", tranId, validation.tranId());
                bookingService.failSslCommerzPayment(tranId, "IPN Transaction ID mismatch");
                return ResponseEntity.badRequest().body("Transaction ID mismatch");
            }

            bookingService.finalizeSslCommerzPayment(
                    tranId, valId, validation.amount(), validation.currency(), validation.bankTranId());
            log.info("IPN validated and booking finalized for tranId={}", tranId);
            return ResponseEntity.ok("IPN PROCESSED");
        } catch (Exception e) {
            log.error("Exception processing SSLCommerz IPN for tranId={}", tranId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("IPN ERROR");
        }
    }
}
