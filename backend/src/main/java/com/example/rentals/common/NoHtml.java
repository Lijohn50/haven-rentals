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
@Constraint(validatedBy = NoHtml.NoHtmlValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.TYPE_USE})
@Retention(RetentionPolicy.RUNTIME)
public @interface NoHtml {
    String message() default "HTML tags are not allowed";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};

    class NoHtmlValidator implements ConstraintValidator<NoHtml, String> {
        private static final Pattern HTML_PATTERN = Pattern.compile("<(\"[^\"]*\"|'[^']*'|[^'\">])*>");

        @Override
        public boolean isValid(String value, ConstraintValidatorContext context) {
            if (value == null) {
                return true;
            }
            return !HTML_PATTERN.matcher(value).find();
        }
    }
}
