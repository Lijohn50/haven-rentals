package com.example.rentals.auth;

import com.example.rentals.common.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;
    private final AppProperties appProperties;

    @Async("taskExecutor")
    public void sendVerificationEmail(String toEmail, String rawToken) {
        String verifyUrl = appProperties.getFrontendUrl() + "/verify-email?token=" + rawToken;
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(appProperties.getMail().getFrom());
            message.setTo(toEmail);
            message.setSubject("Verify your Vacation Rental Marketplace email");
            message.setText("Welcome! Please verify your email by clicking the link:\n" + verifyUrl);
            mailSender.send(message);
            log.info("Sent email verification link to {}", toEmail);
        } catch (Exception e) {
            log.warn("Could not send verification email to {}: {}. Token was: {}", toEmail, e.getMessage(), rawToken);
        }
    }

    @Async("taskExecutor")
    public void sendPasswordResetEmail(String toEmail, String rawToken) {
        String resetUrl = appProperties.getFrontendUrl() + "/reset-password?token=" + rawToken;
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(appProperties.getMail().getFrom());
            message.setTo(toEmail);
            message.setSubject("Reset your Vacation Rental Marketplace password");
            message.setText("Click the following link to reset your password:\n" + resetUrl);
            mailSender.send(message);
            log.info("Sent password reset link to {}", toEmail);
        } catch (Exception e) {
            log.warn("Could not send password reset email to {}: {}. Token was: {}", toEmail, e.getMessage(), rawToken);
        }
    }
}
