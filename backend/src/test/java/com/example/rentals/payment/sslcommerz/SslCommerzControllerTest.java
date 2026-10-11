package com.example.rentals.payment.sslcommerz;

import com.example.rentals.booking.Booking;
import com.example.rentals.booking.BookingService;
import com.example.rentals.booking.BookingStatus;
import com.example.rentals.common.ApiException;
import com.example.rentals.common.AppProperties;
import com.example.rentals.common.CurrentUserProvider;
import com.example.rentals.common.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.net.URI;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SslCommerzControllerTest {

    @Mock
    private BookingService bookingService;

    @Mock
    private SslCommerzService sslCommerzService;

    @Mock
    private CurrentUserProvider currentUser;

    private AppProperties appProperties;
    private SslCommerzController controller;

    @BeforeEach
    void setUp() {
        appProperties = new AppProperties();
        appProperties.setFrontendUrl("http://localhost:5173");
        controller = new SslCommerzController(bookingService, sslCommerzService, currentUser, appProperties);
    }

    @Test
    @DisplayName("initiatePayment returns gateway URL response")
    void testInitiatePayment() {
        when(currentUser.getUserId()).thenReturn(100L);
        when(bookingService.initiateSslCommerzPayment(100L, 1L))
                .thenReturn(new SslCommerzInitResponse("SUCCESS", "https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?Q=123", "sess_abc", null));

        ResponseEntity<SslCommerzInitResponse> res = controller.initiatePayment(1L);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody()).isNotNull();
        assertThat(res.getBody().redirectUrl()).contains("sandbox.sslcommerz.com");
    }

    @Test
    @DisplayName("handleSuccess redirects to trip success when validation and tranId match")
    void testHandleSuccessHappyPath() {
        String tranId = "BK-1-10";
        String valId = "VAL_12345";
        BigDecimal amount = new BigDecimal("2500.00");

        SslCommerzValidationResponse valResponse = new SslCommerzValidationResponse(
                "VALID", "2026-10-11", tranId, valId, amount, amount, "BDT", "BANK_TX_1", "VISA", "4111", "BRAC", "VISA", null
        );
        when(sslCommerzService.validatePayment(valId)).thenReturn(valResponse);

        Booking booking = new Booking();
        booking.setReference("BK-REF-100");
        booking.setStatus(BookingStatus.CONFIRMED);
        when(bookingService.finalizeSslCommerzPayment(tranId, valId, amount, "BDT", "BANK_TX_1")).thenReturn(booking);

        ResponseEntity<Void> res = controller.handleSuccess(Map.of("tran_id", tranId, "val_id", valId));

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.SEE_OTHER);
        assertThat(res.getHeaders().getLocation())
                .isEqualTo(URI.create("http://localhost:5173/trips/BK-REF-100?payment=success"));
    }

    @Test
    @DisplayName("handleSuccess REJECTS and redirects to failed when validation tran_id does NOT match (Blocker 2 fix)")
    void testHandleSuccessTranIdMismatchRejected() {
        String callbackTranId = "BK-1-10";
        String attackValidationTranId = "BK-2-99"; // Belongs to a different booking!
        String valId = "VAL_HIJACKED";

        SslCommerzValidationResponse valResponse = new SslCommerzValidationResponse(
                "VALID", "2026-10-11", attackValidationTranId, valId, new BigDecimal("10.00"), new BigDecimal("10.00"), "BDT", "BANK_TX_99", "VISA", "4111", "BRAC", "VISA", null
        );
        when(sslCommerzService.validatePayment(valId)).thenReturn(valResponse);

        Booking booking = new Booking();
        booking.setReference("BK-REF-100");
        when(bookingService.failSslCommerzPayment(eq(callbackTranId), anyString())).thenReturn(booking);

        ResponseEntity<Void> res = controller.handleSuccess(Map.of("tran_id", callbackTranId, "val_id", valId));

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.SEE_OTHER);
        assertThat(res.getHeaders().getLocation())
                .isEqualTo(URI.create("http://localhost:5173/trips/BK-REF-100?payment=failed"));

        verify(bookingService, never()).finalizeSslCommerzPayment(any(), any(), any(), any(), any());
        verify(bookingService).failSslCommerzPayment(eq(callbackTranId), contains("Transaction ID mismatch"));
    }

    @Test
    @DisplayName("handleSuccess redirects to expired when hold expired and late-payment refund issued (Blocker 5 fix)")
    void testHandleSuccessExpiredHoldRedirectsExpired() {
        String tranId = "BK-5-50";
        String valId = "VAL_EXPIRED";
        BigDecimal amount = new BigDecimal("3000.00");

        SslCommerzValidationResponse valResponse = new SslCommerzValidationResponse(
                "VALID", "2026-10-11", tranId, valId, amount, amount, "BDT", "BANK_TX_55", "VISA", "4111", "BRAC", "VISA", null
        );
        when(sslCommerzService.validatePayment(valId)).thenReturn(valResponse);

        Booking booking = new Booking();
        booking.setReference("BK-REF-EXPIRED");
        booking.setStatus(BookingStatus.EXPIRED);
        when(bookingService.finalizeSslCommerzPayment(tranId, valId, amount, "BDT", "BANK_TX_55")).thenReturn(booking);

        ResponseEntity<Void> res = controller.handleSuccess(Map.of("tran_id", tranId, "val_id", valId));

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.SEE_OTHER);
        assertThat(res.getHeaders().getLocation())
                .isEqualTo(URI.create("http://localhost:5173/trips/BK-REF-EXPIRED?payment=expired"));
    }

    @Test
    @DisplayName("handleSuccess with missing params redirects to error_missing_params")
    void testHandleSuccessMissingParams() {
        ResponseEntity<Void> res = controller.handleSuccess(Map.of("tran_id", ""));
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.SEE_OTHER);
        assertThat(res.getHeaders().getLocation().toString()).contains("error_missing_params");
    }

    @Test
    @DisplayName("handleFail marks booking payment failed and redirects to trips with payment=failed")
    void testHandleFail() {
        String tranId = "BK-3-30";
        Booking booking = new Booking();
        booking.setReference("BK-REF-FAIL");
        when(bookingService.failSslCommerzPayment(eq(tranId), anyString())).thenReturn(booking);

        ResponseEntity<Void> res = controller.handleFail(Map.of("tran_id", tranId, "error", "Cancelled by user"));
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.SEE_OTHER);
        assertThat(res.getHeaders().getLocation())
                .isEqualTo(URI.create("http://localhost:5173/trips/BK-REF-FAIL?payment=failed"));
    }

    @Test
    @DisplayName("handleCancel redirects to trips with payment=cancelled")
    void testHandleCancel() {
        String tranId = "BK-4-40";
        Booking booking = new Booking();
        booking.setReference("BK-REF-CANCEL");
        when(bookingService.getBookingForTranId(tranId)).thenReturn(booking);

        ResponseEntity<Void> res = controller.handleCancel(Map.of("tran_id", tranId));
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.SEE_OTHER);
        assertThat(res.getHeaders().getLocation())
                .isEqualTo(URI.create("http://localhost:5173/trips/BK-REF-CANCEL?payment=cancelled"));
    }

    @Test
    @DisplayName("handleIpn successfully processes valid webhook")
    void testHandleIpnHappyPath() {
        String tranId = "BK-7-70";
        String valId = "VAL_IPN_1";
        BigDecimal amount = new BigDecimal("4000.00");

        SslCommerzValidationResponse valResponse = new SslCommerzValidationResponse(
                "VALID", "2026-10-11", tranId, valId, amount, amount, "BDT", "BANK_IPN_1", "VISA", "4111", "BRAC", "VISA", null
        );
        when(sslCommerzService.validatePayment(valId)).thenReturn(valResponse);

        ResponseEntity<String> res = controller.handleIpn(Map.of("tran_id", tranId, "val_id", valId));
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody()).isEqualTo("IPN PROCESSED");

        verify(bookingService).finalizeSslCommerzPayment(tranId, valId, amount, "BDT", "BANK_IPN_1");
    }

    @Test
    @DisplayName("handleIpn REJECTS mismatched tran_id with 400 Bad Request (Blocker 2 & Gap 8 fix)")
    void testHandleIpnTranIdMismatchRejected() {
        String ipnTranId = "BK-7-70";
        String differentTranId = "BK-8-88";
        String valId = "VAL_IPN_ATTACK";

        SslCommerzValidationResponse valResponse = new SslCommerzValidationResponse(
                "VALID", "2026-10-11", differentTranId, valId, new BigDecimal("100.00"), new BigDecimal("100.00"), "BDT", "BANK_IPN_ATTACK", "VISA", "4111", "BRAC", "VISA", null
        );
        when(sslCommerzService.validatePayment(valId)).thenReturn(valResponse);

        ResponseEntity<String> res = controller.handleIpn(Map.of("tran_id", ipnTranId, "val_id", valId));
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(res.getBody()).contains("Transaction ID mismatch");

        verify(bookingService, never()).finalizeSslCommerzPayment(any(), any(), any(), any(), any());
        verify(bookingService).failSslCommerzPayment(eq(ipnTranId), contains("Transaction ID mismatch"));
    }
}
