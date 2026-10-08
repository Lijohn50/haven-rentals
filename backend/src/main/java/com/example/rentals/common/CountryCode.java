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
import java.util.Locale;
import java.util.Set;

@Documented
@Constraint(validatedBy = CountryCode.CountryCodeValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface CountryCode {
    String message() default "Must be a valid ISO-3166 alpha-2 uppercase country code";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};

    class CountryCodeValidator implements ConstraintValidator<CountryCode, String> {
        private static final Set<String> ISO_COUNTRIES = Set.of(Locale.getISOCountries());

        @Override
        public boolean isValid(String value, ConstraintValidatorContext context) {
            if (value == null) {
                return true;
            }
            return value.length() == 2 && value.equals(value.toUpperCase(Locale.ROOT)) && ISO_COUNTRIES.contains(value);
        }
    }
}
