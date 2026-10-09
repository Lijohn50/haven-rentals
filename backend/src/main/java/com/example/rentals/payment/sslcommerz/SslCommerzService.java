package com.example.rentals.payment.sslcommerz;

import com.example.rentals.booking.Booking;
import com.example.rentals.common.ApiException;
import com.example.rentals.common.AppProperties;
import com.example.rentals.common.ErrorCode;
import com.example.rentals.common.MoneyUtils;
import com.example.rentals.payment.Payment;
import com.example.rentals.user.User;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.util.Map;

@Slf4j
@Service
public class SslCommerzService {

    private final AppProperties appProperties;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public SslCommerzService(AppProperties appProperties, ObjectMapper objectMapper) {
        this.appProperties = appProperties;
        this.objectMapper = objectMapper;
        this.restClient = RestClient.builder().build();
    }

    /**
     * Initiates a payment session with SSLCommerz gateway.
     */
    public SslCommerzInitResponse initiateSession(Booking booking, User guest, Payment payment) {
        var sslProps = appProperties.getSslcommerz();
        String tranId = "BK-" + booking.getId() + "-" + payment.getId();
        String backendBase = sslProps.getBackendUrl();

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("store_id", sslProps.getStoreId());
        body.add("store_passwd", sslProps.getStorePassword());
        body.add("total_amount", MoneyUtils.round(booking.getTotalAmount()).toPlainString());
        body.add("currency", "BDT");
        body.add("tran_id", tranId);

        body.add("success_url", backendBase + "/api/v1/payments/sslcommerz/success");
        body.add("fail_url", backendBase + "/api/v1/payments/sslcommerz/fail");
        body.add("cancel_url", backendBase + "/api/v1/payments/sslcommerz/cancel");
        body.add("ipn_url", backendBase + "/api/v1/payments/sslcommerz/ipn");

        // Customer details
        body.add("cus_name", guest.getDisplayName() != null ? guest.getDisplayName() : "Guest");
        body.add("cus_email", guest.getEmail());
        body.add("cus_add1", booking.getListing().getAddress() != null ? booking.getListing().getAddress() : "Dhaka");
        body.add("cus_city", booking.getListing().getCity() != null ? booking.getListing().getCity() : "Dhaka");
        body.add("cus_country", "Bangladesh");
        body.add("cus_phone", guest.getPhone() != null ? guest.getPhone() : "+8801700000000");

        // Product details
        body.add("product_name", booking.getListing().getTitle());
        body.add("product_category", "Vacation Rental");
        body.add("product_profile", "general");
        body.add("shipping_method", "NO");
        body.add("num_of_item", "1");

        try {
            log.info("Initiating SSLCommerz session for booking reference={}, tranId={}", booking.getReference(), tranId);
            String rawResponse = restClient.post()
                    .uri(sslProps.getSessionUrl())
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(body)
                    .retrieve()
                    .body(String.class);

            if (rawResponse == null || rawResponse.isBlank()) {
                throw new ApiException(ErrorCode.GATEWAY_ERROR, "Empty response from SSLCommerz session init");
            }

            Map<String, Object> respMap = objectMapper.readValue(rawResponse, new TypeReference<>() {});
            String status = (String) respMap.get("status");
            String gatewayUrl = (String) respMap.get("GatewayPageURL");
            String sessionKey = (String) respMap.get("sessionkey");
            String failedReason = (String) respMap.get("failedreason");

            if ("SUCCESS".equalsIgnoreCase(status) && gatewayUrl != null && !gatewayUrl.isBlank()) {
                log.info("SSLCommerz session created successfully. GatewayPageURL: {}", gatewayUrl);
                return new SslCommerzInitResponse(status, gatewayUrl, sessionKey, null);
            } else {
                log.error("SSLCommerz session creation failed: status={}, reason={}", status, failedReason);
                return new SslCommerzInitResponse(status, null, sessionKey, failedReason != null ? failedReason : "Gateway session rejected");
            }
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            log.error("Exception calling SSLCommerz session init for tranId={}", tranId, e);
            throw new ApiException(ErrorCode.GATEWAY_ERROR, "Failed to connect to SSLCommerz: " + e.getMessage());
        }
    }

    /**
     * Validates payment server-to-server with SSLCommerz using the validation API.
     */
    public SslCommerzValidationResponse validatePayment(String valId) {
        var sslProps = appProperties.getSslcommerz();
        String uri = UriComponentsBuilder.fromHttpUrl(sslProps.getValidationUrl())
                .queryParam("val_id", valId)
                .queryParam("store_id", sslProps.getStoreId())
                .queryParam("store_passwd", sslProps.getStorePassword())
                .queryParam("v", 1)
                .queryParam("format", "json")
                .toUriString();

        try {
            log.info("Validating payment with SSLCommerz for valId={}", valId);
            SslCommerzValidationResponse response = restClient.get()
                    .uri(uri)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(SslCommerzValidationResponse.class);

            if (response == null) {
                log.error("SSLCommerz validation API returned null response for valId={}", valId);
                return new SslCommerzValidationResponse("FAILED", null, null, valId, null, null, null, null, null, null, null, null, "Null response from validator");
            }
            log.info("SSLCommerz validation result for valId={}: status={}, bank_tran_id={}, amount={}",
                    valId, response.status(), response.bankTranId(), response.amount());
            return response;
        } catch (Exception e) {
            log.error("Error connecting to SSLCommerz validation API for valId={}", valId, e);
            return new SslCommerzValidationResponse("FAILED", null, null, valId, null, null, null, null, null, null, null, null, e.getMessage());
        }
    }

    /**
     * Submits a refund request to SSLCommerz.
     */
    public SslCommerzRefundResponse refundPayment(String bankTranId, BigDecimal amount, String refundRemarks, String refundRefId) {
        var sslProps = appProperties.getSslcommerz();
        String uri = UriComponentsBuilder.fromHttpUrl(sslProps.getRefundUrl())
                .queryParam("refund_amount", MoneyUtils.round(amount).toPlainString())
                .queryParam("refund_remarks", refundRemarks != null ? refundRemarks : "Booking refund")
                .queryParam("bank_tran_id", bankTranId)
                .queryParam("refe_id", refundRefId)
                .queryParam("store_id", sslProps.getStoreId())
                .queryParam("store_passwd", sslProps.getStorePassword())
                .queryParam("v", 1)
                .queryParam("format", "json")
                .toUriString();

        try {
            log.info("Requesting SSLCommerz refund: bankTranId={}, amount={}, refundRefId={}", bankTranId, amount, refundRefId);
            SslCommerzRefundResponse response = restClient.get()
                    .uri(uri)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(SslCommerzRefundResponse.class);

            if (response != null && response.isSuccess()) {
                log.info("SSLCommerz refund succeeded: refId={}", response.refundRefId());
                return response;
            } else {
                log.warn("SSLCommerz refund not successful: reason={}", response != null ? response.errorReason() : "null response");
                return response != null ? response : new SslCommerzRefundResponse("failed", null, "Null response from gateway");
            }
        } catch (Exception e) {
            log.error("Exception calling SSLCommerz refund API for bankTranId={}", bankTranId, e);
            return new SslCommerzRefundResponse("failed", null, e.getMessage());
        }
    }
}
