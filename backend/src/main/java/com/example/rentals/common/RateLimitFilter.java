package com.example.rentals.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_REQUESTS_PER_MINUTE = 10;
    private final Map<String, WindowCounter> requestCounts = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !(path.startsWith("/api/v1/auth/login") ||
                 path.startsWith("/api/v1/auth/register") ||
                 path.startsWith("/api/v1/auth/forgot-password"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String ip = getClientIp(request);
        long currentMinute = Instant.now().getEpochSecond() / 60;
        String key = ip + ":" + currentMinute;

        WindowCounter counter = requestCounts.computeIfAbsent(key, k -> new WindowCounter(currentMinute));
        if (counter.incrementAndGet() > MAX_REQUESTS_PER_MINUTE) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
            response.setHeader("Retry-After", "60");

            Map<String, Object> problem = new LinkedHashMap<>();
            problem.put("status", 429);
            problem.put("title", "Too Many Requests");
            problem.put("detail", "Rate limit exceeded. Try again in 1 minute.");
            problem.put("code", ErrorCode.RATE_LIMITED.name());
            problem.put("timestamp", Instant.now().toString());
            problem.put("path", request.getRequestURI());

            response.getWriter().write(objectMapper.writeValueAsString(problem));
            return;
        }

        // Cleanup old keys periodically
        if (requestCounts.size() > 5000) {
            requestCounts.entrySet().removeIf(e -> e.getValue().minute < currentMinute - 1);
        }

        filterChain.doFilter(request, response);
    }

    private String getClientIp(HttpServletRequest request) {
        String xf = request.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) {
            return xf.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private static class WindowCounter {
        final long minute;
        final AtomicInteger count = new AtomicInteger(0);

        WindowCounter(long minute) {
            this.minute = minute;
        }

        int incrementAndGet() {
            return count.incrementAndGet();
        }
    }
}
