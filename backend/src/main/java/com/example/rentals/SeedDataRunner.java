package com.example.rentals;

import com.example.rentals.availability.AvailabilityBlock;
import com.example.rentals.availability.AvailabilityBlockRepository;
import com.example.rentals.booking.*;
import com.example.rentals.common.MoneyUtils;
import com.example.rentals.dispute.Dispute;
import com.example.rentals.dispute.DisputeCategory;
import com.example.rentals.dispute.DisputeRepository;
import com.example.rentals.listing.*;
import com.example.rentals.messaging.Conversation;
import com.example.rentals.messaging.ConversationRepository;
import com.example.rentals.messaging.MessageDocument;
import com.example.rentals.messaging.MessageRepository;
import com.example.rentals.payment.*;
import com.example.rentals.pricing.SeasonalRate;
import com.example.rentals.pricing.SeasonalRateRepository;
import com.example.rentals.review.Review;
import com.example.rentals.review.ReviewDirection;
import com.example.rentals.review.ReviewRepository;
import com.example.rentals.review.ReviewStatus;
import com.example.rentals.user.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.awt.Color;
import java.awt.Font;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

import javax.imageio.ImageIO;

@Slf4j
@Component
@Profile("dev")
@RequiredArgsConstructor
public class SeedDataRunner implements ApplicationRunner {

    private static final int SEED_PHOTO_WIDTH = 800;
    private static final int SEED_PHOTO_HEIGHT = 600;
    private static final Color[] SEED_PHOTO_PALETTE = {
            new Color(0x0F766E), new Color(0xB45309), new Color(0x1D4ED8),
            new Color(0x9D174D), new Color(0x3F6212), new Color(0x7C3AED),
    };

    private final UserRepository userRepository;
    private final HostProfileRepository hostProfileRepository;
    private final ListingRepository listingRepository;
    private final AmenityRepository amenityRepository;
    private final ListingPhotoRepository listingPhotoRepository;
    private final HouseRuleRepository houseRuleRepository;
    private final AvailabilityBlockRepository availabilityBlockRepository;
    private final SeasonalRateRepository seasonalRateRepository;
    private final BookingRepository bookingRepository;
    private final BookingStatusHistoryRepository bookingStatusHistoryRepository;
    private final PaymentRepository paymentRepository;
    private final PayoutRepository payoutRepository;
    private final ReviewRepository reviewRepository;
    private final DisputeRepository disputeRepository;
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final StorageService storageService;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (userRepository.findByEmailIgnoreCase("admin@rentals.test").isPresent()) {
            log.info("Seed data already present. Skipping initialization.");
            printDemoCredentials();
            return;
        }

        log.info("Seeding initial development marketplace data...");
        Instant now = clock.instant();
        String encodedPassword = passwordEncoder.encode("Password123!");

        // 1. Users
        User admin = createUser("admin@rentals.test", encodedPassword, "Admin", "User", "+15550000001", Set.of(Role.GUEST, Role.ADMIN));
        User support = createUser("support@rentals.test", encodedPassword, "Support", "Agent", "+15550000002", Set.of(Role.GUEST, Role.SUPPORT_AGENT));
        User host1 = createUser("host1@rentals.test", encodedPassword, "Sarah", "Connor", "+15550000003", Set.of(Role.GUEST, Role.HOST));
        User host2 = createUser("host2@rentals.test", encodedPassword, "James", "Miller", "+15550000004", Set.of(Role.GUEST, Role.HOST));
        User guest1 = createUser("guest1@rentals.test", encodedPassword, "Alice", "Smith", "+15550000005", Set.of(Role.GUEST));
        User guest2 = createUser("guest2@rentals.test", encodedPassword, "Bob", "Jones", "+15550000006", Set.of(Role.GUEST));

        createHostProfile(host1, "Sarah's Hospitality", "Superhost hosting boutique luxury apartments for over 5 years.");
        createHostProfile(host2, "Miller Vacation Stays", "Passionate about providing cozy beachfront and urban retreats.");

        // 2. Fetch reference amenities
        List<Amenity> allAmenities = amenityRepository.findAll();
        Set<Amenity> popularAmenities = new HashSet<>(allAmenities.stream().limit(10).toList());

        // 3. Listings (12 listings across 4 cities: New York, Miami, San Francisco, Austin)
        // Status distribution: 8 ACTIVE, 2 PENDING_REVIEW, 1 DRAFT, 1 PAUSED
        List<Listing> seededListings = new ArrayList<>();

        // Listing 1: Luxury Manhattan Loft (ACTIVE, INSTANT BOOK, FLEXIBLE)
        Listing l1 = createListing(host1, "Luxury Manhattan Loft with Skyline Views",
                "Stunning modern loft in downtown Manhattan. Walking distance to central subway lines, gourmet dining, and high-end shopping.",
                PropertyType.APARTMENT, ListingStatus.ACTIVE, "120 Broadway", "New York", "NY", "US", "10005",
                new BigDecimal("40.7078"), new BigDecimal("-74.0119"), "America/New_York", 4, 2, 2, new BigDecimal("2.0"),
                new BigDecimal("280.00"), new BigDecimal("1.15"), new BigDecimal("60.00"),
                new BigDecimal("10.00"), new BigDecimal("20.00"), 2, 30, CancellationPolicyType.FLEXIBLE, true, popularAmenities);
        seededListings.add(l1);

        // Listing 2: Central Park Brownstone Oasis (ACTIVE, REQUEST, MODERATE)
        Listing l2 = createListing(host1, "Charming Central Park Brownstone Oasis",
                "Historic brownstone featuring original exposed brick and private garden terrace right by Central Park.",
                PropertyType.HOUSE, ListingStatus.ACTIVE, "240 W 73rd St", "New York", "NY", "US", "10023",
                new BigDecimal("40.7794"), new BigDecimal("-73.9818"), "America/New_York", 6, 3, 3, new BigDecimal("2.5"),
                new BigDecimal("350.00"), new BigDecimal("1.20"), new BigDecimal("80.00"),
                new BigDecimal("12.00"), new BigDecimal("25.00"), 3, 60, CancellationPolicyType.MODERATE, false, popularAmenities);
        seededListings.add(l2);

        // Listing 3: South Beach Oceanfront Villa (ACTIVE, INSTANT, STRICT)
        Listing l3 = createListing(host2, "South Beach Oceanfront Villa with Private Pool",
                "Direct beach access with panoramic Atlantic Ocean views. Features private heated pool and luxury chef kitchen.",
                PropertyType.VILLA, ListingStatus.ACTIVE, "1020 Ocean Dr", "Miami", "FL", "US", "33139",
                new BigDecimal("25.7806"), new BigDecimal("-80.1303"), "America/New_York", 8, 4, 5, new BigDecimal("4.0"),
                new BigDecimal("550.00"), new BigDecimal("1.25"), new BigDecimal("120.00"),
                new BigDecimal("15.00"), new BigDecimal("30.00"), 3, 90, CancellationPolicyType.STRICT, true, popularAmenities);
        seededListings.add(l3);

        // Listing 4: Modern Brickell High-Rise Condo (ACTIVE, INSTANT, MODERATE)
        Listing l4 = createListing(host2, "Modern Brickell Condo with Bay Views",
                "Chic high-rise condo in the heart of Miami's financial and dining district. Rooftop infinity pool and gym.",
                PropertyType.CONDO, ListingStatus.ACTIVE, "1451 Brickell Ave", "Miami", "FL", "US", "33131",
                new BigDecimal("25.7590"), new BigDecimal("-80.1925"), "America/New_York", 3, 1, 2, new BigDecimal("1.5"),
                new BigDecimal("195.00"), new BigDecimal("1.10"), new BigDecimal("50.00"),
                new BigDecimal("8.00"), new BigDecimal("15.00"), 1, 30, CancellationPolicyType.MODERATE, true, popularAmenities);
        seededListings.add(l4);

        // Listing 5: SF Victorian Pacific Heights (ACTIVE, REQUEST, STRICT)
        Listing l5 = createListing(host1, "Historic Victorian Home in Pacific Heights",
                "Classic San Francisco architectural charm with updated contemporary interior, bay window breakfast nook.",
                PropertyType.HOUSE, ListingStatus.ACTIVE, "2100 Vallejo St", "San Francisco", "CA", "US", "94123",
                new BigDecimal("37.7946"), new BigDecimal("-122.4312"), "America/Los_Angeles", 5, 3, 3, new BigDecimal("2.0"),
                new BigDecimal("420.00"), new BigDecimal("1.20"), new BigDecimal("90.00"),
                new BigDecimal("10.00"), new BigDecimal("20.00"), 2, 45, CancellationPolicyType.STRICT, false, popularAmenities);
        seededListings.add(l5);

        // Listing 6: SoMa Designer Loft (ACTIVE, INSTANT, FLEXIBLE)
        Listing l6 = createListing(host1, "SoMa Tech Loft with Workspace",
                "Spacious open-concept loft with ultra-fast gigabit fiber, ergonomic standing desk, and outdoor patio.",
                PropertyType.APARTMENT, ListingStatus.ACTIVE, "450 4th St", "San Francisco", "CA", "US", "94107",
                new BigDecimal("37.7818"), new BigDecimal("-122.3996"), "America/Los_Angeles", 2, 1, 1, new BigDecimal("1.0"),
                new BigDecimal("225.00"), new BigDecimal("1.05"), new BigDecimal("45.00"),
                new BigDecimal("5.00"), new BigDecimal("15.00"), 1, 30, CancellationPolicyType.FLEXIBLE, true, popularAmenities);
        seededListings.add(l6);

        // Listing 7: South Congress Hip Bungalow (ACTIVE, INSTANT, MODERATE)
        Listing l7 = createListing(host2, "South Congress Hip Bungalow with Fire Pit",
                "Walk to famous Austin live music venues and food trucks. Private fenced yard with string lights and fire pit.",
                PropertyType.HOUSE, ListingStatus.ACTIVE, "1600 S Congress Ave", "Austin", "TX", "US", "78704",
                new BigDecimal("30.2492"), new BigDecimal("-97.7497"), "America/Chicago", 4, 2, 2, new BigDecimal("1.5"),
                new BigDecimal("185.00"), new BigDecimal("1.15"), new BigDecimal("40.00"),
                new BigDecimal("10.00"), new BigDecimal("20.00"), 2, 60, CancellationPolicyType.MODERATE, true, popularAmenities);
        seededListings.add(l7);

        // Listing 8: Lake Austin Hill Country Retreat (ACTIVE, REQUEST, STRICT)
        Listing l8 = createListing(host2, "Lake Austin Hill Country Waterfront Retreat",
                "Private boat dock, outdoor kitchen, and tranquil hillside nature views only 25 minutes from downtown Austin.",
                PropertyType.CABIN, ListingStatus.ACTIVE, "3800 Westlake Dr", "Austin", "TX", "US", "78746",
                new BigDecimal("30.3340"), new BigDecimal("-97.7950"), "America/Chicago", 10, 5, 6, new BigDecimal("4.5"),
                new BigDecimal("680.00"), new BigDecimal("1.30"), new BigDecimal("150.00"),
                new BigDecimal("15.00"), new BigDecimal("25.00"), 3, 120, CancellationPolicyType.STRICT, false, popularAmenities);
        seededListings.add(l8);

        // Listing 9: Pending Review 1 (PENDING_REVIEW)
        Listing l9 = createListing(host1, "Sunlit Brooklyn Heights Studio",
                "Cozy quiet studio on tree-lined street near the Promenade.",
                PropertyType.APARTMENT, ListingStatus.PENDING_REVIEW, "55 Pierrepont St", "New York", "NY", "US", "11201",
                new BigDecimal("40.6950"), new BigDecimal("-73.9950"), "America/New_York", 2, 1, 1, new BigDecimal("1.0"),
                new BigDecimal("140.00"), new BigDecimal("1.00"), new BigDecimal("35.00"),
                BigDecimal.ZERO, BigDecimal.ZERO, 1, 30, CancellationPolicyType.FLEXIBLE, false, popularAmenities);
        seededListings.add(l9);

        // Listing 10: Pending Review 2 (PENDING_REVIEW)
        Listing l10 = createListing(host2, "Wynwood Arts District Loft",
                "Industrial loft decorated with local street art murals.",
                PropertyType.APARTMENT, ListingStatus.PENDING_REVIEW, "250 NW 24th St", "Miami", "FL", "US", "33127",
                new BigDecimal("25.8000"), new BigDecimal("-80.1980"), "America/New_York", 4, 2, 2, new BigDecimal("2.0"),
                new BigDecimal("210.00"), new BigDecimal("1.10"), new BigDecimal("50.00"),
                BigDecimal.ZERO, BigDecimal.ZERO, 2, 30, CancellationPolicyType.MODERATE, false, popularAmenities);
        seededListings.add(l10);

        // Listing 11: Draft (DRAFT)
        Listing l11 = createListing(host1, "Marina District Studio in Progress",
                "Work in progress draft description.",
                PropertyType.APARTMENT, ListingStatus.DRAFT, "3100 Fillmore St", "San Francisco", "CA", "US", "94123",
                new BigDecimal("37.8000"), new BigDecimal("-122.4350"), "America/Los_Angeles", 2, 1, 1, new BigDecimal("1.0"),
                new BigDecimal("150.00"), new BigDecimal("1.00"), new BigDecimal("30.00"),
                BigDecimal.ZERO, BigDecimal.ZERO, 1, 30, CancellationPolicyType.FLEXIBLE, false, popularAmenities);
        seededListings.add(l11);

        // Listing 12: Paused (PAUSED)
        Listing l12 = createListing(host2, "Downtown Austin Studio (Temporarily Paused)",
                "Currently paused for scheduled winter renovations.",
                PropertyType.APARTMENT, ListingStatus.PAUSED, "800 Brazos St", "Austin", "TX", "US", "78701",
                new BigDecimal("30.2700"), new BigDecimal("-97.7400"), "America/Chicago", 2, 1, 1, new BigDecimal("1.0"),
                new BigDecimal("160.00"), new BigDecimal("1.10"), new BigDecimal("40.00"),
                BigDecimal.ZERO, BigDecimal.ZERO, 1, 30, CancellationPolicyType.MODERATE, false, popularAmenities);
        seededListings.add(l12);

        // Seasonal Rate for Miami Villa (Winter high season)
        SeasonalRate winterRate = new SeasonalRate(
                l3,
                "Winter Sun Season",
                LocalDate.of(2026, 12, 15),
                LocalDate.of(2027, 2, 28),
                new BigDecimal("750.00")
        );
        seasonalRateRepository.save(winterRate);

        // Availability Block for Host maintenance on Listing 1
        LocalDate blockStart = LocalDate.ofInstant(now, ZoneOffset.UTC).plusDays(60);
        AvailabilityBlock block = new AvailabilityBlock(l1, blockStart, blockStart.plusDays(4), "Scheduled AC Maintenance");
        availabilityBlockRepository.save(block);

        // 4. Seed Bookings in diverse statuses
        LocalDate today = LocalDate.ofInstant(now, ZoneOffset.UTC);

        // Booking 1: COMPLETED with published 2-way blind reviews (Listing 1, Guest 1)
        LocalDate b1In = today.minusDays(10);
        LocalDate b1Out = today.minusDays(6);
        Booking b1 = createBooking(l1, guest1, b1In, b1Out, 2,
                new BigDecimal("1120.00"), new BigDecimal("60.00"), new BigDecimal("118.00"), new BigDecimal("99.84"), new BigDecimal("1397.84"),
                BookingStatus.COMPLETED, "BK-CMPL0001", now.minus(12, java.time.temporal.ChronoUnit.DAYS));
        b1.setConfirmedAt(now.minus(12, java.time.temporal.ChronoUnit.DAYS));
        b1.setCompletedAt(now.minus(6, java.time.temporal.ChronoUnit.DAYS));
        bookingRepository.save(b1);
        recordHistory(b1, BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED, "SYSTEM", now.minus(12, java.time.temporal.ChronoUnit.DAYS));
        recordHistory(b1, BookingStatus.CONFIRMED, BookingStatus.COMPLETED, "SYSTEM", now.minus(6, java.time.temporal.ChronoUnit.DAYS));
        createPaymentAndPayout(b1, PaymentStatus.SUCCEEDED, PayoutStatus.PAID, now.minus(12, java.time.temporal.ChronoUnit.DAYS));

        // Create reviews for Booking 1 (Published)
        Review r1Guest = new Review(b1, l1, guest1, host1, ReviewDirection.GUEST_TO_HOST, 5, 5, 5, 5,
                "Spectacular apartment! Views of Manhattan are breathtaking and host Sarah was exceptionally welcoming.",
                now.plus(8, java.time.temporal.ChronoUnit.DAYS));
        r1Guest.publish(now.minus(5, java.time.temporal.ChronoUnit.DAYS));
        reviewRepository.save(r1Guest);

        Review r1Host = new Review(b1, l1, host1, guest1, ReviewDirection.HOST_TO_GUEST, 5, null, null, null,
                "Alice was a wonderful guest! Left the loft immaculate and respected all house rules. Welcome back anytime!",
                now.plus(8, java.time.temporal.ChronoUnit.DAYS));
        r1Host.publish(now.minus(5, java.time.temporal.ChronoUnit.DAYS));
        reviewRepository.save(r1Host);

        l1.setAverageRating(new BigDecimal("5.00"));
        l1.setReviewCount(1);
        listingRepository.save(l1);

        // Booking 2: CONFIRMED future stay (Listing 3 Miami, Guest 1)
        LocalDate b2In = today.plusDays(5);
        LocalDate b2Out = today.plusDays(10);
        Booking b2 = createBooking(l3, guest1, b2In, b2Out, 4,
                new BigDecimal("2750.00"), new BigDecimal("120.00"), new BigDecimal("287.00"), new BigDecimal("252.56"), new BigDecimal("3409.56"),
                BookingStatus.CONFIRMED, "BK-CONF0002", now.minus(1, java.time.temporal.ChronoUnit.DAYS));
        b2.setConfirmedAt(now.minus(1, java.time.temporal.ChronoUnit.DAYS));
        bookingRepository.save(b2);
        recordHistory(b2, BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED, "SYSTEM", now.minus(1, java.time.temporal.ChronoUnit.DAYS));
        createPaymentAndPayout(b2, PaymentStatus.SUCCEEDED, PayoutStatus.SCHEDULED, now.minus(1, java.time.temporal.ChronoUnit.DAYS));

        // Booking 3: PENDING_APPROVAL awaiting host decision (Listing 2 NY, Guest 2)
        LocalDate b3In = today.plusDays(15);
        LocalDate b3Out = today.plusDays(18);
        Booking b3 = createBooking(l2, guest2, b3In, b3Out, 2,
                new BigDecimal("1050.00"), new BigDecimal("80.00"), new BigDecimal("113.00"), new BigDecimal("99.44"), new BigDecimal("1342.44"),
                BookingStatus.PENDING_APPROVAL, "BK-APPR0003", now);
        b3.setExpiresAt(now.plus(23, java.time.temporal.ChronoUnit.HOURS));
        bookingRepository.save(b3);
        recordHistory(b3, BookingStatus.PENDING_PAYMENT, BookingStatus.PENDING_APPROVAL, "SYSTEM", now);
        createPaymentAndPayout(b3, PaymentStatus.SUCCEEDED, PayoutStatus.SCHEDULED, now);

        // Booking 4: PENDING_PAYMENT hold active (Listing 4 Miami, Guest 2)
        LocalDate b4In = today.plusDays(25);
        LocalDate b4Out = today.plusDays(28);
        Booking b4 = createBooking(l4, guest2, b4In, b4Out, 2,
                new BigDecimal("585.00"), new BigDecimal("50.00"), new BigDecimal("63.50"), new BigDecimal("55.88"), new BigDecimal("754.38"),
                BookingStatus.PENDING_PAYMENT, "BK-HOLD0004", now);
        b4.setExpiresAt(now.plus(12, java.time.temporal.ChronoUnit.MINUTES));
        bookingRepository.save(b4);

        // Booking 5: CANCELLED_BY_GUEST with partial refund (Listing 5 SF, Guest 1)
        LocalDate b5In = today.plusDays(40);
        LocalDate b5Out = today.plusDays(44);
        Booking b5 = createBooking(l5, guest1, b5In, b5Out, 2,
                new BigDecimal("1680.00"), new BigDecimal("90.00"), new BigDecimal("177.00"), new BigDecimal("155.76"), new BigDecimal("2102.76"),
                BookingStatus.CANCELLED_BY_GUEST, "BK-CNCG0005", now.minus(5, java.time.temporal.ChronoUnit.DAYS));
        b5.setCancelledAt(now.minus(2, java.time.temporal.ChronoUnit.DAYS));
        b5.setCancellationReason("Plans changed unexpectedly");
        b5.setRefundAmount(new BigDecimal("962.88"));
        bookingRepository.save(b5);
        recordHistory(b5, BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED, "SYSTEM", now.minus(5, java.time.temporal.ChronoUnit.DAYS));
        recordHistory(b5, BookingStatus.CONFIRMED, BookingStatus.CANCELLED_BY_GUEST, "GUEST", now.minus(2, java.time.temporal.ChronoUnit.DAYS));
        createPaymentAndPayout(b5, PaymentStatus.PARTIALLY_REFUNDED, PayoutStatus.CANCELLED, now.minus(5, java.time.temporal.ChronoUnit.DAYS));

        // Booking 6: Completed Stay with an OPEN DISPUTE (Listing 7 Austin, Guest 1)
        LocalDate b6In = today.minusDays(5);
        LocalDate b6Out = today.minusDays(2);
        Booking b6 = createBooking(l7, guest1, b6In, b6Out, 2,
                new BigDecimal("555.00"), new BigDecimal("40.00"), new BigDecimal("59.50"), new BigDecimal("52.36"), new BigDecimal("706.86"),
                BookingStatus.COMPLETED, "BK-DISP0006", now.minus(8, java.time.temporal.ChronoUnit.DAYS));
        b6.setConfirmedAt(now.minus(8, java.time.temporal.ChronoUnit.DAYS));
        b6.setCompletedAt(now.minus(2, java.time.temporal.ChronoUnit.DAYS));
        bookingRepository.save(b6);
        recordHistory(b6, BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED, "SYSTEM", now.minus(8, java.time.temporal.ChronoUnit.DAYS));
        recordHistory(b6, BookingStatus.CONFIRMED, BookingStatus.COMPLETED, "SYSTEM", now.minus(2, java.time.temporal.ChronoUnit.DAYS));
        createPaymentAndPayout(b6, PaymentStatus.SUCCEEDED, PayoutStatus.HELD, now.minus(8, java.time.temporal.ChronoUnit.DAYS));

        // Create the dispute for Booking 6
        Dispute dispute = new Dispute(
                b6,
                guest1,
                DisputeCategory.CLEANLINESS,
                "Upon arrival, the backyard fire pit was dirty and kitchen dishes had food residue. Requesting a partial refund.",
                now.minus(1, java.time.temporal.ChronoUnit.DAYS)
        );
        disputeRepository.save(dispute);

        // 5. Sample conversation and messages
        Conversation conv = new Conversation(l1, guest1, host1);
        conv.setLastMessageAt(now.minus(1, java.time.temporal.ChronoUnit.HOURS));
        conv.setLastMessagePreview("Thanks Sarah! Can you confirm if late check-in is okay?");
        conv = conversationRepository.save(conv);

        MessageDocument m1 = new MessageDocument(conv.getId(), guest1.getId(), "Hi Sarah! Excited to stay at your Manhattan loft.", null, now.minus(3, java.time.temporal.ChronoUnit.HOURS));
        MessageDocument m2 = new MessageDocument(conv.getId(), host1.getId(), "Hi Alice, welcome! Feel free to ask any questions prior to arrival.", null, now.minus(2, java.time.temporal.ChronoUnit.HOURS));
        MessageDocument m3 = new MessageDocument(conv.getId(), guest1.getId(), "Thanks Sarah! Can you confirm if late check-in is okay?", null, now.minus(1, java.time.temporal.ChronoUnit.HOURS));
        messageRepository.saveAll(List.of(m1, m2, m3));

        log.info("Marketplace seed data successfully created.");
        printDemoCredentials();
    }

    private void printDemoCredentials() {
        log.info("======================================================================");
        log.info("             VACATION RENTAL MARKETPLACE DEMO ACCOUNTS                ");
        log.info("======================================================================");
        log.info(" Default Password for all accounts: Password123!                      ");
        log.info(" Admin:         admin@rentals.test    (Roles: GUEST, ADMIN)           ");
        log.info(" Support:       support@rentals.test  (Roles: GUEST, SUPPORT_AGENT)   ");
        log.info(" Host 1:        host1@rentals.test    (Roles: GUEST, HOST)            ");
        log.info(" Host 2:        host2@rentals.test    (Roles: GUEST, HOST)            ");
        log.info(" Guest 1:       guest1@rentals.test   (Roles: GUEST)                  ");
        log.info(" Guest 2:       guest2@rentals.test   (Roles: GUEST)                  ");
        log.info(" API Docs:      http://localhost:8080/swagger-ui.html                 ");
        log.info("======================================================================");
    }

    private User createUser(String email, String password, String first, String last, String phone, Set<Role> roles) {
        User u = new User(email, password, first, last, phone);
        u.setEmailVerified(true);
        u.setRoles(new HashSet<>(roles));
        return userRepository.save(u);
    }

    /**
     * Writes a real image through {@link StorageService} so the returned UUID key both
     * satisfies MediaController's filename pattern and actually resolves on disk.
     */
    private String seedPhoto(long listingId, int index) {
        BufferedImage image = new BufferedImage(SEED_PHOTO_WIDTH, SEED_PHOTO_HEIGHT, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        try {
            Color from = SEED_PHOTO_PALETTE[Math.floorMod((int) listingId, SEED_PHOTO_PALETTE.length)];
            Color to = SEED_PHOTO_PALETTE[Math.floorMod((int) listingId + index, SEED_PHOTO_PALETTE.length)];
            graphics.setPaint(new GradientPaint(0, 0, from, SEED_PHOTO_WIDTH, SEED_PHOTO_HEIGHT, to));
            graphics.fillRect(0, 0, SEED_PHOTO_WIDTH, SEED_PHOTO_HEIGHT);
            graphics.setColor(new Color(255, 255, 255, 90));
            for (int band = 0; band < 4; band++) {
                graphics.fillRect(0, 120 + band * 110, SEED_PHOTO_WIDTH, 34);
            }
            graphics.setColor(Color.WHITE);
            graphics.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 40));
            graphics.drawString("Listing " + listingId + " · photo " + index, 40, SEED_PHOTO_HEIGHT - 40);
        } finally {
            graphics.dispose();
        }

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            if (!ImageIO.write(image, "jpg", out)) {
                throw new IllegalStateException("No JPEG writer available");
            }
            return storageService.store(out.toByteArray(), "jpg", "image/jpeg");
        } catch (IOException e) {
            throw new UncheckedIOException("Could not generate seed photo", e);
        }
    }

    private void createHostProfile(User host, String displayName, String bio) {
        HostProfile hp = new HostProfile(host, displayName, bio);
        hostProfileRepository.save(hp);
    }

    private Listing createListing(
            User host, String title, String description, PropertyType type, ListingStatus status,
            String address, String city, String state, String country, String zip,
            BigDecimal lat, BigDecimal lon, String tz, int guests, int bedrooms, int beds, BigDecimal baths,
            BigDecimal price, BigDecimal weekend, BigDecimal cleaning, BigDecimal weeklyDisc, BigDecimal monthlyDisc,
            int minNights, int maxNights, CancellationPolicyType policy, boolean instant, Set<Amenity> amenities
    ) {
        Listing l = new Listing();
        l.setHost(host);
        l.setTitle(title);
        l.setDescription(description);
        l.setPropertyType(type);
        l.setStatus(status);
        l.setAddressLine(address);
        l.setCity(city);
        l.setStateRegion(state);
        l.setCountry(country);
        l.setPostalCode(zip);
        l.setLatitude(lat);
        l.setLongitude(lon);
        l.setTimezone(tz);
        l.setMaxGuests(guests);
        l.setBedrooms(bedrooms);
        l.setBeds(beds);
        l.setBathrooms(baths);
        l.setBaseNightlyPrice(price);
        l.setWeekendMultiplier(weekend);
        l.setCleaningFee(cleaning);
        l.setWeeklyDiscountPercent(weeklyDisc);
        l.setMonthlyDiscountPercent(monthlyDisc);
        l.setMinNights(minNights);
        l.setMaxNights(maxNights);
        l.setCancellationPolicy(policy);
        l.setInstantBook(instant);
        l.setAmenities(new HashSet<>(amenities));
        l = listingRepository.save(l);
// Add 5 realistic sample photos per listing. The storage key must be a UUID because
        // MediaController only serves ^[0-9a-fA-F-]{36}\.(jpg|png|webp)$, and the bytes must
        // actually exist on disk or every cover photo URL 404s.
        for (int i = 1; i <= 5; i++) {
            boolean isCover = (i == 1);
            String filename = seedPhoto(l.getId(), i);
            long sizeBytes = storageService.load(filename).length;

            ListingPhoto photo = new ListingPhoto(l, filename, "image/jpeg", sizeBytes, SEED_PHOTO_WIDTH, SEED_PHOTO_HEIGHT, i - 1, isCover);
            listingPhotoRepository.save(photo);
        }

        // Add standard house rules
        houseRuleRepository.save(new HouseRule(l, "No smoking allowed inside the property", 1));
        houseRuleRepository.save(new HouseRule(l, "Quiet hours observed between 10:00 PM and 8:00 AM", 2));

        return l;
    }

    private Booking createBooking(
            Listing listing, User guest, LocalDate in, LocalDate out, int guests,
            BigDecimal baseTotal, BigDecimal cleaning, BigDecimal service, BigDecimal tax, BigDecimal total,
            BookingStatus status, String reference, Instant createdAt
    ) {
        Booking b = new Booking();
        b.setReference(reference);
        b.setListing(listing);
        b.setGuest(guest);
        b.setHost(listing.getHost());
        b.setCheckIn(in);
        b.setCheckOut(out);
        b.setNights((int) java.time.temporal.ChronoUnit.DAYS.between(in, out));
        b.setGuestsCount(guests);
        b.setNightlySubtotal(baseTotal);
        b.setDiscountTotal(BigDecimal.ZERO);
        b.setCleaningFee(cleaning);
        b.setServiceFee(service);
        b.setTaxTotal(tax);
        b.setTotalAmount(total);
        b.setHostCommission(MoneyUtils.percentage(baseTotal, new BigDecimal("15.00")));
        b.setHostPayoutAmount(MoneyUtils.round(baseTotal.add(cleaning).subtract(b.getHostCommission())));
        b.setPriceBreakdown(Map.of(
                "nightlySubtotal", baseTotal,
                "discountTotal", BigDecimal.ZERO,
                "cleaningFee", cleaning,
                "serviceFee", service,
                "taxTotal", tax,
                "totalAmount", total));
        b.setCancellationPolicy(listing.getCancellationPolicy());
        b.setListingTimezone(listing.getTimezone());
        b.setCheckInTime(listing.getCheckInTime());
        b.setCheckOutTime(listing.getCheckOutTime());
        b.setStatus(status);
        b.setInstantBook(listing.isInstantBook());
        b.setCreatedAt(createdAt);
        b.setUpdatedAt(createdAt);
        return b;
    }

    private void recordHistory(Booking b, BookingStatus from, BookingStatus to, String actor, Instant at) {
        BookingStatusHistory h = new BookingStatusHistory(
                b, from.name(), to.name(), null, actor, "Initial seed state");
        h.setCreatedAt(at);
        bookingStatusHistoryRepository.save(h);
    }

    private void createPaymentAndPayout(Booking b, PaymentStatus payStatus, PayoutStatus payoutStatus, Instant at) {
        Payment payment = new Payment(
                b,
                b.getTotalAmount(),
                payStatus,
                "seed-" + UUID.randomUUID()
        );
        payment.setProviderReference("fake_ch_" + UUID.randomUUID());
        payment.setCreatedAt(at);
        if (payStatus == PaymentStatus.PARTIALLY_REFUNDED && b.getRefundAmount() != null) {
            payment.setRefundedTotal(b.getRefundAmount());
        }
        paymentRepository.save(payment);

        Payout payout = new Payout(
                b.getHost(),
                b,
                b.getHostPayoutAmount(),
                at.plus(24, java.time.temporal.ChronoUnit.HOURS)
        );
        payout.setStatus(payoutStatus);
        payout.setCreatedAt(at);
        if (payoutStatus == PayoutStatus.PAID) {
            payout.setPaidAt(at.plus(24, java.time.temporal.ChronoUnit.HOURS));
        }
        payoutRepository.save(payout);
    }
}
