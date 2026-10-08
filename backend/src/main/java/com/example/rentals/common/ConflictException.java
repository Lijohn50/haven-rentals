package com.example.rentals.common;

import org.springframework.http.HttpStatus;

import java.util.Map;

public class ConflictException extends ApiException {
    public ConflictException(String message) {
        super(ErrorCode.DUPLICATE_RESOURCE, HttpStatus.CONFLICT, message);
    }

    public ConflictException(ErrorCode errorCode, String message) {
        super(errorCode, HttpStatus.CONFLICT, message);
    }

    public ConflictException(ErrorCode errorCode, String message, Map<String, Object> details) {
        super(errorCode, HttpStatus.CONFLICT, message, details);
    }
}
