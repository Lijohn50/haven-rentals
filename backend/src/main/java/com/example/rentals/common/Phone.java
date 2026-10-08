package com.example.rentals.common;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.util.regex.Pattern;

@Documented
@Constraint(validatedBy = Phone.PhoneValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface Phone {
    String message() default "Must be a valid E.164 phone number (e.g. +1234567890)";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};

    class PhoneValidator implements ConstraintValidator<Phone, String> {
        private static final Pattern E164_PATTERN = Pattern.compile("^\\+[1-9]\\d{6,14}$");

        @Override
        public boolean isValid(String value, ConstraintValidatorContext context) {
            if (value == null || value.isBlank()) {
                return true;
            }
            return E164_PATTERN.matcher(value.trim()).matches();
        }
    }
}
