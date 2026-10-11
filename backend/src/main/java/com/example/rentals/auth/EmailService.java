package com.example.rentals.auth;

import com.example.rentals.common.AppProperties;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;
    private final AppProperties appProperties;

    @Async("taskExecutor")
    public void sendVerificationEmail(String toEmail, String rawToken) {
        String frontendUrl = appProperties.getFrontendUrl();
        String verifyUrl = frontendUrl + "/verify-email?token=" + rawToken;
        String subject = "Verify your email address · Haven";

        String textContent = """
                Welcome to Haven!

                Please verify your email address to unlock booking, host messaging, and listing properties:
                %s

                This verification link is valid for 24 hours.

                If you didn't create an account with Haven, you can safely ignore this email.

                — Haven Vacation Rentals (%s)
                """.formatted(verifyUrl, frontendUrl);

        String htmlContent = buildEmailHtml(
                "Confirm your email address · Haven",
                "Please verify your email address to get started with Haven.",
                "Welcome to Haven!",
                "Thanks for creating an account. Please confirm your email address by clicking the button below to unlock booking whole homes, messaging hosts, and listing properties.",
                "Verify Email Address",
                verifyUrl,
                "<strong>Security Notice:</strong> This verification link will expire in <strong>24 hours</strong>.",
                "If the button above does not work, copy and paste this link into your browser:",
                "If you did not create an account on Haven, you can safely ignore this email.",
                frontendUrl
        );

        sendMimeEmail(toEmail, subject, textContent, htmlContent, rawToken, "verification");
    }

    @Async("taskExecutor")
    public void sendPasswordResetEmail(String toEmail, String rawToken) {
        String frontendUrl = appProperties.getFrontendUrl();
        String resetUrl = frontendUrl + "/reset-password?token=" + rawToken;
        String subject = "Reset your Haven password";

        String textContent = """
                Reset your Haven password

                We received a request to reset your password. Please click the link below to choose a new password:
                %s

                This link will expire in 15 minutes.

                If you didn't request a password reset, you can safely ignore this email. Your account remains secure.

                — Haven Vacation Rentals (%s)
                """.formatted(resetUrl, frontendUrl);

        String htmlContent = buildEmailHtml(
                "Reset your Haven password",
                "Reset your password for Haven Vacation Rentals.",
                "Reset your password",
                "We received a request to reset the password for your Haven account. Click the button below to choose a new, secure password.",
                "Reset Password",
                resetUrl,
                "<strong>Security Notice:</strong> This reset link will expire in <strong>15 minutes</strong>.",
                "If the button above does not work, copy and paste this link into your browser:",
                "If you did not request a password reset, you can safely ignore this email. Your account remains secure.",
                frontendUrl
        );

        sendMimeEmail(toEmail, subject, textContent, htmlContent, rawToken, "password reset");
    }

    private void sendMimeEmail(String toEmail, String subject, String textContent, String htmlContent, String rawToken, String type) {
        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(
                    mimeMessage,
                    MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED,
                    StandardCharsets.UTF_8.name()
            );

            String fromAddress = appProperties.getMail().getFrom();
            try {
                helper.setFrom(fromAddress, "Haven Vacation Rentals");
            } catch (Exception e) {
                helper.setFrom(fromAddress);
            }

            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(textContent, htmlContent);

            mailSender.send(mimeMessage);
            log.info("Sent {} email to {}", type, toEmail);
        } catch (Exception e) {
            log.warn("Could not send {} email to {}: {}. Token was: {}", type, toEmail, e.getMessage(), rawToken);
        }
    }

    private String buildEmailHtml(String title,
                                  String preheader,
                                  String heading,
                                  String bodyText,
                                  String buttonText,
                                  String buttonUrl,
                                  String alertText,
                                  String fallbackNote,
                                  String securityNote,
                                  String frontendUrl) {
        return """
                <!DOCTYPE html>
                <html lang="en">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <meta http-equiv="X-UA-Compatible" content="IE=edge">
                  <title>%s</title>
                </head>
                <body style="margin: 0; padding: 0; background-color: #F8F6F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1B1C1D; -webkit-font-smoothing: antialiased;">
                  <div style="display: none; font-size: 1px; color: #F8F6F2; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
                    %s
                  </div>
                  <table role="presentation" width="100%%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8F6F2; padding: 40px 16px;">
                    <tr>
                      <td align="center">
                        <table role="presentation" width="100%%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px;">
                          <!-- Header / Brand -->
                          <tr>
                            <td align="center" style="padding-bottom: 28px;">
                              <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                  <td style="background-color: #0D736B; color: #FFFFFF; font-weight: 800; font-size: 16px; width: 36px; height: 36px; text-align: center; border-radius: 10px; line-height: 36px; font-family: sans-serif;">
                                    H
                                  </td>
                                  <td style="padding-left: 10px; font-size: 22px; font-weight: 700; color: #0D736B; letter-spacing: -0.4px; font-family: sans-serif;">
                                    Haven
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>

                          <!-- Content Card -->
                          <tr>
                            <td style="background-color: #FFFFFF; border-radius: 20px; border: 1px solid #E5E0D8; padding: 36px 32px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);">
                              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #1B1C1D; letter-spacing: -0.3px; line-height: 1.3;">
                                %s
                              </h1>
                              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #4B5563;">
                                %s
                              </p>

                              <!-- Action CTA Button -->
                              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0 24px 0; width: 100%%;">
                                <tr>
                                  <td align="center">
                                    <a href="%s" target="_blank" style="display: inline-block; background-color: #0D736B; color: #FFFFFF; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 36px; border-radius: 12px; box-shadow: 0 4px 12px rgba(13, 115, 107, 0.25);">
                                      %s
                                    </a>
                                  </td>
                                </tr>
                              </table>

                              <!-- Notice Box -->
                              <div style="background-color: #F8F6F2; border-radius: 12px; border-left: 4px solid #0D736B; padding: 12px 16px; margin: 24px 0; font-size: 13px; color: #4B5563; line-height: 1.5;">
                                %s
                              </div>

                              <!-- Fallback Link -->
                              <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #F3F4F6; font-size: 12px; line-height: 1.6; color: #9CA3AF;">
                                <p style="margin: 0 0 6px 0;">%s</p>
                                <a href="%s" style="color: #0D736B; word-break: break-all; text-decoration: underline;">%s</a>
                              </div>
                            </td>
                          </tr>

                          <!-- Footer -->
                          <tr>
                            <td align="center" style="padding-top: 24px; font-size: 12px; line-height: 1.6; color: #9CA3AF;">
                              <p style="margin: 0 0 8px 0;">%s</p>
                              <p style="margin: 0;">
                                © 2026 Haven Vacation Rentals · <a href="%s" style="color: #6B7280; text-decoration: underline;">stay-have.me</a>
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """.formatted(
                title,
                preheader,
                heading,
                bodyText,
                buttonUrl,
                buttonText,
                alertText,
                fallbackNote,
                buttonUrl,
                buttonUrl,
                securityNote,
                frontendUrl
        );
    }
}
