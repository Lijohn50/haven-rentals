package com.example.rentals.payment.sslcommerz;

import com.example.rentals.common.AppProperties;
import com.example.rentals.payment.PaymentGateway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SslCommerzPaymentGatewayTest {

    @Mock
    private SslCommerzService sslCommerzService;

    private AppProperties appProperties;
    private SslCommerzPaymentGateway gateway;

    @BeforeEach
    void setUp() {
        appProperties = new AppProperties();
        appProperties.getSslcommerz().setSandbox(true);
        gateway = new SslCommerzPaymentGateway(sslCommerzService, appProperties);
    }

    @Test
    @DisplayName("charge with tok_success succeeds in sandbox mode")
    void testChargeSuccessInSandbox() {
        PaymentGateway.ChargeResult result = gateway.charge("tok_success", new BigDecimal("1000.00"), "idem-1");
        assertThat(result.success()).isTrue();
        assertThat(result.providerReference()).startsWith("ssl_sim_");
        assertThat(result.failureCode()).isNull();
    }

    @Test
    @DisplayName("charge with decline tokens returns proper failure codes")
    void testChargeDeclineTokens() {
        assertThat(gateway.charge("tok_decline", new BigDecimal("500.00"), "idem-2").failureCode())
                .isEqualTo("CARD_DECLINED");
        assertThat(gateway.charge("tok_insufficient", new BigDecimal("500.00"), "idem-3").failureCode())
                .isEqualTo("INSUFFICIENT_FUNDS");
        assertThat(gateway.charge("tok_timeout", new BigDecimal("500.00"), "idem-4").failureCode())
                .isEqualTo("GATEWAY_TIMEOUT");
    }

    @Test
    @DisplayName("charge with arbitrary/unknown token is REJECTED (Blocker 3 fix)")
    void testArbitraryTokenIsRejected() {
        PaymentGateway.ChargeResult result = gateway.charge("random_arbitrary_token", new BigDecimal("5000.00"), "idem-5");
        assertThat(result.success()).isFalse();
        assertThat(result.failureCode()).isEqualTo("INVALID_TOKEN");
        assertThat(result.providerReference()).isNull();
    }

    @Test
    @DisplayName("charge in production (sandbox=false) rejects all direct charges")
    void testProductionRejectsDirectCharges() {
        appProperties.getSslcommerz().setSandbox(false);

        PaymentGateway.ChargeResult result = gateway.charge("tok_success", new BigDecimal("1000.00"), "idem-6");
        assertThat(result.success()).isFalse();
        assertThat(result.failureCode()).isEqualTo("DIRECT_CHARGE_NOT_SUPPORTED");
    }

    @Test
    @DisplayName("refund with null or blank providerReference returns MISSING_PROVIDER_REFERENCE")
    void testRefundMissingProviderReference() {
        PaymentGateway.RefundResult nullResult = gateway.refund(null, new BigDecimal("100.00"), "idem-ref-1");
        assertThat(nullResult.success()).isFalse();
        assertThat(nullResult.failureCode()).isEqualTo("MISSING_PROVIDER_REFERENCE");

        PaymentGateway.RefundResult blankResult = gateway.refund("   ", new BigDecimal("100.00"), "idem-ref-2");
        assertThat(blankResult.success()).isFalse();
        assertThat(blankResult.failureCode()).isEqualTo("MISSING_PROVIDER_REFERENCE");
    }

    @Test
    @DisplayName("refund with simulated reference succeeds without calling external API")
    void testRefundSimulatedReference() {
        PaymentGateway.RefundResult result = gateway.refund("ssl_sim_12345", new BigDecimal("500.00"), "idem-ref-3");
        assertThat(result.success()).isTrue();
        assertThat(result.providerReference()).startsWith("ssl_ref_");
    }

    @Test
    @DisplayName("refund with real bank_tran_id delegates to SslCommerzService")
    void testRefundRealBankTranId() {
        when(sslCommerzService.refundPayment(eq("BANK_TRX_9999"), any(BigDecimal.class), anyString(), anyString()))
                .thenReturn(new SslCommerzRefundResponse("success", "SSL_REF_888", null));

        PaymentGateway.RefundResult result = gateway.refund("BANK_TRX_9999", new BigDecimal("1500.00"), "idem-ref-4");
        assertThat(result.success()).isTrue();
        assertThat(result.providerReference()).isEqualTo("SSL_REF_888");
    }
}
