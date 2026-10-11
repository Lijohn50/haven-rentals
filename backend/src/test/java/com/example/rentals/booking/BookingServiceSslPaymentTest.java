package com.example.rentals.booking;

import com.example.rentals.availability.AvailabilityService;
import com.example.rentals.common.ApiException;
import com.example.rentals.common.AppProperties;
import com.example.rentals.common.AuditService;
import com.example.rentals.listing.Listing;
import com.example.rentals.listing.ListingRepository;
import com.example.rentals.payment.*;
import com.example.rentals.payment.sslcommerz.SslCommerzService;
import com.example.rentals.pricing.PricingService;
import com.example.rentals.user.User;
import com.example.rentals.user.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.CacheManager;
import org.springframework.transaction.PlatformTransactionManager;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BookingServiceSslPaymentTest {

    @Mock private BookingRepository bookingRepository;
    @Mock private BookingStatusHistoryRepository historyRepository;
    @Mock private ListingRepository listingRepository;
    @Mock private UserRepository userRepository;
    @Mock private AvailabilityService availabilityService;
    @Mock private PricingService pricingService;
    @Mock private PaymentService paymentService;
    @Mock private PaymentRepository paymentRepository;
    @Mock private PaymentGateway paymentGateway;
    @Mock private SslCommerzService sslCommerzService;
    @Mock private RefundService refundService;
    @Mock private PayoutService payoutService;
    @Mock private CancellationPolicyResolver policyResolver;
    @Mock private BookingReferenceGenerator referenceGenerator;
    @Mock private AuditService auditService;
    @Mock private Clock clock;
    @Mock private CacheManager cacheManager;
    @Mock private ObjectMapper objectMapper;
    @Mock private PlatformTransactionManager transactionManager;

    private AppProperties appProperties;
    private BookingService bookingService;

    private Booking booking;
    private Payment payment;
    private User guest;
    private Listing listing;
    private final Instant now = Instant.parse("2026-10-11T12:00:00Z");

    @BeforeEach
    void setUp() {
        appProperties = new AppProperties();
        lenient().when(clock.instant()).thenReturn(now);

        bookingService = new BookingService(
                bookingRepository, historyRepository, listingRepository, userRepository,
                availabilityService, pricingService, paymentService, paymentRepository,
                paymentGateway, sslCommerzService, refundService, payoutService,
                policyResolver, referenceGenerator, auditService, appProperties,
                clock, cacheManager, objectMapper, transactionManager
        );

        guest = new User();
        guest.setId(10L);
        guest.setEmail("guest@example.com");

        listing = new Listing();
        listing.setId(100L);
        listing.setTitle("Seaside Villa");

        booking = new Booking();
        booking.setId(1L);
        booking.setReference("BK-1001");
        booking.setGuest(guest);
        booking.setListing(listing);
        booking.setStatus(BookingStatus.PENDING_PAYMENT);
        booking.setTotalAmount(new BigDecimal("5000.00"));
        booking.setExpiresAt(now.plusSeconds(900)); // expires in 15 mins
        booking.setCheckIn(LocalDate.of(2026, 11, 1));
        booking.setCheckOut(LocalDate.of(2026, 11, 5));
        booking.setCheckInTime(LocalTime.of(15, 0));
        booking.setCheckOutTime(LocalTime.of(11, 0));
        booking.setListingTimezone("Asia/Dhaka");
        booking.setInstantBook(true);

        payment = new Payment(booking, new BigDecimal("5000.00"), PaymentStatus.PENDING, "BK-1-100");
        payment.setId(100L);

        lenient().when(bookingRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(booking));
        lenient().when(bookingRepository.save(any(Booking.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(paymentRepository.findByBookingIdForUpdate(1L)).thenReturn(Optional.of(payment));
        lenient().when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    @DisplayName("Currency mismatch throws exception and fails payment (Blocker 1 fix)")
    void testCurrencyMismatchRejected() {
        assertThatThrownBy(() -> bookingService.finalizeSslCommerzPayment(
                "BK-1-100", "VAL_1", new BigDecimal("5000.00"), "EUR", "BANK_1"
        ))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Payment currency must be USD");

        assertThat(booking.getStatus()).isEqualTo(BookingStatus.PAYMENT_FAILED);
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.FAILED);
    }

    @Test
    @DisplayName("USD payment succeeds when currency is USD")
    void testUsdPaymentSucceeds() {
        Booking result = bookingService.finalizeSslCommerzPayment(
                "BK-1-100", "VAL_USD", new BigDecimal("5000.00"), "USD", "BANK_TRX_USD"
        );

        assertThat(result.getStatus()).isEqualTo(BookingStatus.CONFIRMED);
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.SUCCEEDED);
        assertThat(payment.getProviderReference()).isEqualTo("BANK_TRX_USD");
    }

    @Test
    @DisplayName("Amount mismatch throws exception and fails payment (Blocker 1 fix)")
    void testAmountMismatchRejected() {
        // Validation amount is 1 BDT instead of 5000 BDT
        assertThatThrownBy(() -> bookingService.finalizeSslCommerzPayment(
                "BK-1-100", "VAL_1", new BigDecimal("1.00"), "BDT", "BANK_1"
        ))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Payment amount mismatch");

        assertThat(booking.getStatus()).isEqualTo(BookingStatus.PAYMENT_FAILED);
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.FAILED);
    }

    @Test
    @DisplayName("Successful payment stores bank_tran_id as providerReference (Blocker 4 fix)")
    void testBankTranIdStoredAsProviderReference() {
        Booking result = bookingService.finalizeSslCommerzPayment(
                "BK-1-100", "VAL_123", new BigDecimal("5000.00"), "BDT", "BANK_TRX_999"
        );

        assertThat(result.getStatus()).isEqualTo(BookingStatus.CONFIRMED);
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.SUCCEEDED);
        assertThat(payment.getProviderReference()).isEqualTo("BANK_TRX_999");
        verify(paymentRepository).save(payment);
    }

    @Test
    @DisplayName("Late payment saves payment SUCCEEDED with bankTranId, marks EXPIRED, and issues refund (Blocker 5 fix)")
    void testLatePaymentIssuesRefundWithValidProviderReference() {
        // Booking hold expired 10 minutes ago
        booking.setExpiresAt(now.minusSeconds(600));

        Booking result = bookingService.finalizeSslCommerzPayment(
                "BK-1-100", "VAL_LATE", new BigDecimal("5000.00"), "BDT", "BANK_TRX_LATE"
        );

        assertThat(result.getStatus()).isEqualTo(BookingStatus.EXPIRED);
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.SUCCEEDED);
        assertThat(payment.getProviderReference()).isEqualTo("BANK_TRX_LATE");

        verify(paymentRepository).save(payment);
        verify(refundService).issueRefund(eq(booking), eq(new BigDecimal("5000.00")), eq(RefundReason.LATE_PAYMENT), isNull());
    }

    @Test
    @DisplayName("Already confirmed booking returns idempotently without re-processing")
    void testAlreadyConfirmedReturnsIdempotently() {
        booking.setStatus(BookingStatus.CONFIRMED);

        Booking result = bookingService.finalizeSslCommerzPayment(
                "BK-1-100", "VAL_123", new BigDecimal("5000.00"), "BDT", "BANK_1"
        );

        assertThat(result.getStatus()).isEqualTo(BookingStatus.CONFIRMED);
        verify(paymentRepository, never()).save(any());
    }
}
