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
import java.nio.charset.StandardCharsets;

@Documented
@Constraint(validatedBy = StrongPassword.StrongPasswordValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface StrongPassword {
    String message() default "Password must be 8-72 bytes, contain at least one letter and one digit, and have no leading/trailing whitespace";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};

    class StrongPasswordValidator implements ConstraintValidator<StrongPassword, String> {

        @Override
        public boolean isValid(String value, ConstraintValidatorContext context) {
            if (value == null) {
                return false;
            }
            if (value.startsWith(" ") || value.endsWith(" ")) {
                return false;
            }
            byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
            if (bytes.length < 8 || bytes.length > 72) {
                return false;
            }
            boolean hasLetter = false;
            boolean hasDigit = false;
            for (char c : value.toCharArray()) {
                if (Character.isLetter(c)) hasLetter = true;
                if (Character.isDigit(c)) hasDigit = true;
            }
            return hasLetter && hasDigit;
        }
    }
}
