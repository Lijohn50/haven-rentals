package com.example.rentals.common;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Getter
@Setter
@Validated
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private Booking booking = new Booking();
    private Payout payout = new Payout();
    private Review review = new Review();
    private Dispute dispute = new Dispute();
    private Security security = new Security();
    private Upload upload = new Upload();
    private Cors cors = new Cors();
    private Storage storage = new Storage();
    private Ai ai = new Ai();
    private Mail mail = new Mail();

    private String frontendUrl = "http://localhost:3000";

    @Getter
    @Setter
    public static class Booking {
        @Min(1)
        private int paymentHoldMinutes = 15;
        @Min(1)
        private int hostResponseHours = 24;
    }

    @Getter
    @Setter
    public static class Payout {
        @Min(1)
        private int releaseDelayHours = 24;
    }

    @Getter
    @Setter
    public static class Review {
        @Min(1)
        private int windowDays = 14;
    }

    @Getter
    @Setter
    public static class Dispute {
        @Min(1)
        private int windowDays = 14;
    }

    @Getter
    @Setter
    public static class Security {
        @NotBlank
        private String jwtSecret = "dev-secret-key-must-be-at-least-32-bytes-long-123456";
        @Min(1)
        private int maxFailedLogins = 5;
        @Min(1)
        private int lockoutMinutes = 15;
        @Min(1)
        private int accessTokenMinutes = 15;
        @Min(1)
        private int refreshTokenDays = 7;
    }

    @Getter
    @Setter
    public static class Upload {
        @Min(1024)
        private long maxPhotoBytes = 5242880;
        @Min(1)
        private int maxPhotosPerListing = 20;
        @Min(1)
        private int minPhotosToSubmit = 3;
    }

    @Getter
    @Setter
    public static class Cors {
        private String origins = "http://localhost:3000";
    }

    @Getter
    @Setter
    public static class Storage {
        private String path = "./uploads";
    }

    @Getter
    @Setter
    public static class Ai {
        private boolean enabled = false;
        private String apiKey = "";
    }

    @Getter
    @Setter
    public static class Mail {
        /** Sender shown to the recipient. Real SMTP relays reject mail without one. */
        @NotBlank
        private String from = "no-reply@haven.test";
    }
}
