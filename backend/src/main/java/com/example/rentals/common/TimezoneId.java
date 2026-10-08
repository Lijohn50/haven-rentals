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
import java.time.ZoneId;

@Documented
@Constraint(validatedBy = TimezoneId.TimezoneIdValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface TimezoneId {
    String message() default "Must be a valid IANA timezone identifier";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};

    class TimezoneIdValidator implements ConstraintValidator<TimezoneId, String> {
        @Override
        public boolean isValid(String value, ConstraintValidatorContext context) {
            if (value == null) {
                return true;
            }
            try {
                ZoneId.of(value);
                return true;
            } catch (Exception e) {
                return false;
            }
        }
    }
}
