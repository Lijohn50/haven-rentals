package com.example.rentals.common;

import org.springframework.http.HttpStatus;

public class BusinessRuleException extends ApiException {
    public BusinessRuleException(String message) {
        super(ErrorCode.BUSINESS_RULE_VIOLATION, HttpStatus.UNPROCESSABLE_ENTITY, message);
    }

    public BusinessRuleException(ErrorCode errorCode, String message) {
        super(errorCode, errorCode.getDefaultStatus(), message);
    }
}
