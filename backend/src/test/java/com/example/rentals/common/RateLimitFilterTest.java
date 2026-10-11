package com.example.rentals.common;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimitFilterTest {

    private RateLimitFilter filter;

    @BeforeEach
    void setUp() {
        filter = new RateLimitFilter();
    }

    @Test
    @DisplayName("shouldFilter applies rate limiting to SSLCommerz initiate endpoint (Gap 7 fix)")
    void testRateLimitAppliesToSslInitiate() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/bookings/42/sslcommerz/initiate");
        request.setRemoteAddr("192.168.1.100");

        // First 10 requests succeed (HTTP 200)
        for (int i = 0; i < 10; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain filterChain = new MockFilterChain();
            filter.doFilter(request, response, filterChain);
            assertThat(response.getStatus()).isEqualTo(200);
        }

        // 11th request is throttled (HTTP 429)
        MockHttpServletResponse throttledResponse = new MockHttpServletResponse();
        MockFilterChain filterChain = new MockFilterChain();
        filter.doFilter(request, throttledResponse, filterChain);
        assertThat(throttledResponse.getStatus()).isEqualTo(429);
        assertThat(throttledResponse.getContentAsString()).contains("RATE_LIMITED");
    }

    @Test
    @DisplayName("Non-sensitive endpoints bypass rate limiting")
    void testNonSensitiveEndpointsBypassRateLimiter() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/listings/1");
        request.setRemoteAddr("192.168.1.100");

        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain filterChain = new MockFilterChain();
        filter.doFilter(request, response, filterChain);
        assertThat(response.getStatus()).isEqualTo(200);
    }
}
