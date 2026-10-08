package com.example.rentals.auth;

import com.example.rentals.common.ErrorCode;
import com.example.rentals.common.RequestIdFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Component
public class ApiAuthenticationHandlers implements AuthenticationEntryPoint, AccessDeniedHandler {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException authException) throws IOException {
        writeProblem(response, request, HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHENTICATED, "Full authentication is required to access this resource");
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException accessDeniedException) throws IOException {
        writeProblem(response, request, HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, "You do not have permission to access this resource");
    }

    private void writeProblem(HttpServletResponse response, HttpServletRequest request, HttpStatus status, ErrorCode code, String detail) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);

        String traceId = MDC.get(RequestIdFilter.TRACE_ID_MDC_KEY);
        if (traceId == null) {
            traceId = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", status.value());
        body.put("title", status.getReasonPhrase());
        body.put("detail", detail);
        body.put("code", code.name());
        body.put("traceId", traceId);
        body.put("timestamp", Instant.now().toString());
        body.put("path", request.getRequestURI());

        response.getWriter().write(objectMapper.writeValueAsString(body));
    }
}
