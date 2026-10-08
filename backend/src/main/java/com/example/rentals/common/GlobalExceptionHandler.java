package com.example.rentals.common;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.time.Instant;
import java.util.*;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> handleApiException(ApiException ex, HttpServletRequest request) {
        log.warn("API Exception [{}]: {}", ex.getErrorCode(), ex.getMessage());
        return buildResponse(ex.getStatus(), ex.getErrorCode(), ex.getMessage(), request, null, ex.getDetails());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        List<Map<String, String>> fieldErrors = new ArrayList<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            Map<String, String> err = new HashMap<>();
            err.put("field", fe.getField());
            err.put("message", fe.getDefaultMessage());
            fieldErrors.add(err);
        }
        return buildResponse(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, "Validation failed", request, fieldErrors, null);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Map<String, Object>> handleConstraintViolation(ConstraintViolationException ex, HttpServletRequest request) {
        List<Map<String, String>> fieldErrors = new ArrayList<>();
        ex.getConstraintViolations().forEach(cv -> {
            Map<String, String> err = new HashMap<>();
            err.put("field", cv.getPropertyPath().toString());
            err.put("message", cv.getMessage());
            fieldErrors.add(err);
        });
        return buildResponse(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, "Validation failed", request, fieldErrors, null);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Map<String, Object>> handleBadRequest(Exception ex, HttpServletRequest request) {
        return buildResponse(HttpStatus.BAD_REQUEST, ErrorCode.MALFORMED_REQUEST, "Malformed request or invalid parameter type", request, null, null);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleDataIntegrity(DataIntegrityViolationException ex, HttpServletRequest request) {
        String msg = ex.getMostSpecificCause() != null ? ex.getMostSpecificCause().getMessage() : ex.getMessage();
        if (msg != null && (msg.contains("no_overlapping_bookings") || msg.contains("no_overlapping_blocks") || msg.contains("conflicting key value"))) {
            return buildResponse(HttpStatus.CONFLICT, ErrorCode.BOOKING_CONFLICT, "The requested dates are not available", request, null, null);
        }
        if (msg != null && msg.contains("uq_users_email")) {
            return buildResponse(HttpStatus.CONFLICT, ErrorCode.EMAIL_ALREADY_REGISTERED, "An account with this email already exists", request, null, null);
        }
        return buildResponse(HttpStatus.CONFLICT, ErrorCode.DUPLICATE_RESOURCE, "Database constraint violation", request, null, null);
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<Map<String, Object>> handleOptimisticLock(ObjectOptimisticLockingFailureException ex, HttpServletRequest request) {
        return buildResponse(HttpStatus.CONFLICT, ErrorCode.CONCURRENT_MODIFICATION, "The resource was modified concurrently. Please retry.", request, null, null);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException ex, HttpServletRequest request) {
        return buildResponse(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, "Access denied", request, null, null);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, Object>> handleAuth(AuthenticationException ex, HttpServletRequest request) {
        return buildResponse(HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHENTICATED, "Authentication required", request, null, null);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Map<String, Object>> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex, HttpServletRequest request) {
        return buildResponse(HttpStatus.METHOD_NOT_ALLOWED, ErrorCode.MALFORMED_REQUEST, ex.getMessage(), request, null, null);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleMaxUpload(MaxUploadSizeExceededException ex, HttpServletRequest request) {
        return buildResponse(HttpStatus.PAYLOAD_TOO_LARGE, ErrorCode.PAYLOAD_TOO_LARGE, "Uploaded file exceeds maximum allowed size (5MB)", request, null, null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGenericException(Exception ex, HttpServletRequest request) {
        String traceId = MDC.get(RequestIdFilter.TRACE_ID_MDC_KEY);
        log.error("Unhandled server error [traceId={}]: {}", traceId, ex.getMessage(), ex);
        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR, "An internal server error occurred", request, null, null);
    }

    private ResponseEntity<Map<String, Object>> buildResponse(HttpStatus status, ErrorCode code, String detail,
                                                              HttpServletRequest request,
                                                              List<Map<String, String>> fieldErrors,
                                                              Map<String, Object> extraDetails) {
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
        body.put("path", request != null ? request.getRequestURI() : "");

        if (fieldErrors != null && !fieldErrors.isEmpty()) {
            body.put("fieldErrors", fieldErrors);
        }
        if (extraDetails != null && !extraDetails.isEmpty()) {
            body.putAll(extraDetails);
        }

        return ResponseEntity.status(status).body(body);
    }
}
