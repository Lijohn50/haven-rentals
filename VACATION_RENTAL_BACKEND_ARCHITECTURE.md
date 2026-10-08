# Vacation Rental Marketplace: Backend Architecture (REST API)

> **How to use this document.** This file is a complete, self-contained specification for a **pure REST API backend** built with Spring Boot. A developer or AI that reads only this file must be able to build the whole backend. Every module and every class listed here has a stated purpose. **Do not create classes, interfaces, or layers that are not listed here.** If something is not in this document, it is not needed.

---

## 0. Rules for whoever implements this

1. **Only build what is listed.** No extra abstraction layers, no "Manager"/"Helper"/"Factory" classes, no interfaces with a single implementation unless this document says why (Section 4.3 lists the only allowed interfaces).
2. Every class listed has a one-line purpose. If you cannot explain a class in one line, it should not exist.
3. The backend is a **REST API only**: no Thymeleaf, no server-rendered pages, no sessions. It returns JSON. A separate frontend consumes it (the frontend architecture is a second document that will be built on the contract in **Section 12**).
4. Controllers contain **no business logic**. Services contain all rules. Repositories only query.
5. Never expose JPA entities in API responses. Always return DTOs.
6. Never use `double`/`float` for money. Never use `ddl-auto=create` or `update`. Never hardcode secrets.
7. Every validation rule and edge case in this document must be implemented and covered by at least one automated test.
8. Inject `java.time.Clock` wherever "the current time" is needed. Never call `Instant.now()` or `LocalDate.now()` directly, so time-based rules can be tested.
9. Generate: source code, Flyway migrations, `application.yml` profiles, `Dockerfile`, `docker-compose.yml`, seed data, tests, and a `README.md`.

---

## 1. Project summary

An Airbnb-style marketplace. **Hosts** publish properties. **Guests** search, book, pay (simulated), message hosts, and leave reviews. **Support agents** resolve disputes. **Admins** moderate listings, manage users, and configure fees.

### 1.1 Roles
| Role | Meaning |
|---|---|
| `GUEST` | Every registered user has it. Can search, book, message, review. |
| `HOST` | Granted when a user completes host onboarding. A host is also a guest. |
| `SUPPORT_AGENT` | Assigned by an admin. Handles disputes. |
| `ADMIN` | Seeded or assigned by another admin. Full platform control. |

A user holds a **set** of roles (table `user_roles`).

### 1.2 Out of scope (do not build)
Real payment providers, multiple currencies (everything is **USD**), changing the dates of an existing booking (guest cancels and rebooks), wishlists, WebSockets, microservices, server-side HTML.

---

## 2. Course topics mapped to the project

This table is the answer to "why does this exist?". Every topic from the course is used in a real, necessary place.

| Course topic | Where it is used in this project |
|---|---|
| **MVC / REST controllers / REST API** | One controller per module under `/api/v1`; JSON in and out |
| **DTO** | Request records (what clients send) and response records (what clients receive); entities never leave the service layer |
| **JPA** | Entities and relationships (Listing, Booking, Review, ...), derived queries, `@Query`, JPA `Specification` for search, pessimistic and optimistic locking |
| **Validation** | Bean Validation on every request DTO plus business validation in services |
| **SOLID** | Strategy pattern for pricing rules and cancellation policies (Open/Closed); a `PaymentGateway` interface (Dependency Inversion); one responsibility per service |
| **Lombok + Builder Pattern** | `@Builder` on `PriceBreakdown` and `Booking` creation; `@RequiredArgsConstructor`, `@Getter`, `@Slf4j` |
| **Spring Security + custom sign-in** | Custom `AuthController` login (not the default form), custom `UserDetailsService`, custom 401/403 JSON handlers |
| **BCrypt** | Password hashing (strength 12) |
| **JWT** | Stateless access tokens plus rotating refresh tokens |
| **Role-based authorization** | URL rules per role, `@PreAuthorize`, and ownership checks in services |
| **Caching** | Spring Cache (Caffeine) for amenities, commission settings, listing details, search results |
| **Transactions** | `@Transactional` booking creation under a row lock, refunds, cancellations, and state transitions |
| **SQL vs NoSQL / NoSQL use cases** | PostgreSQL for money and relationships; **MongoDB for chat messages** (high volume, append-only, flexible, no joins needed) |
| **JUnit testing** | Unit tests (pricing, refunds, state machine), integration tests, and a concurrency test |
| **Deployment** | Dockerfile, docker-compose (app + PostgreSQL + MongoDB), environment-based profiles |
| **Spring AI** | Listing description generator, review summarizer, trip-plan helper |

---

## 3. Technology stack

| Concern | Choice |
|---|---|
| Language / build | Java 21, Maven |
| Framework | Spring Boot 3.x: Web, Data JPA, Security, Validation, Cache, Mail, Actuator, Data MongoDB |
| Databases | **PostgreSQL 16** (system of record), **MongoDB 7** (messages) |
| Migrations | Flyway |
| Cache | Caffeine via Spring Cache |
| Security | Spring Security 6, BCrypt, JJWT 0.12.x (HS256) |
| Boilerplate | Lombok |
| Mapping | Plain static `from(...)` methods on response records (no MapStruct; fewer moving parts and easier to read) |
| API docs | springdoc-openapi (`/swagger-ui.html`) |
| AI | Spring AI `ChatClient` |
| Testing | JUnit 5, Mockito, AssertJ, Spring Boot Test, Testcontainers (PostgreSQL, MongoDB) |
| Containers | Docker, docker-compose |

**Why PostgreSQL and not MySQL or H2:** PostgreSQL has *exclusion constraints*, which let the database itself refuse two overlapping bookings for the same listing. This is the strongest protection against double booking. H2 behaves differently and must not be used, not even in tests.

The JVM runs in UTC (`-Duser.timezone=UTC`).

---

## 4. Architecture

### 4.1 Request flow
```
Frontend (browser)
   │  HTTPS + JSON + Authorization: Bearer <JWT>
   ▼
Security filter chain  ──►  JwtAuthenticationFilter (who is calling?)
   ▼
Controller      validates the request DTO, calls ONE service method, returns a response DTO
   ▼
Service         business rules, transactions, ownership checks
   ▼
Repository      database queries only
   ▼
PostgreSQL (entities)           MongoDB (messages)
```

### 4.2 Layer responsibilities (what each kind of class is for)
| Kind | One-line purpose | Must never |
|---|---|---|
| **Controller** | Translate HTTP to a service call and back | Contain business rules or call repositories |
| **Service** | Hold the business rules and open transactions | Know about HTTP (`HttpServletRequest`, `ResponseEntity`) |
| **Repository** | Run database queries | Make business decisions |
| **Entity** | Represent a table and protect its own invariants (e.g., `booking.transitionTo(...)`) | Be returned from a controller |
| **DTO (record)** | Define exactly what crosses the API boundary | Contain JPA annotations |
| **Strategy classes** | Replace long `if/else` chains with swappable rules (pricing, cancellation) | Hold state |

### 4.3 The only interfaces allowed
| Interface | Reason it exists |
|---|---|
| `PricingRule` | Strategy pattern: each price component (weekend, season, discount, fees, tax) is one small class; adding a rule changes no existing code |
| `CancellationPolicy` | Strategy pattern: flexible, moderate, strict are three implementations |
| `PaymentGateway` | Dependency inversion: the app talks to an interface; `FakePaymentGateway` is today's implementation and a real provider could replace it |
| `StorageService` | Photos are stored through an interface; `LocalStorageService` is today's implementation, cloud storage could replace it |

### 4.4 Package structure (feature-based)
```
com.example.rentals
├── RentalsApplication
├── common        shared building blocks used by every module
├── auth          register, login, JWT, refresh tokens, email verification, password reset
├── user          profiles, host onboarding
├── listing       properties, photos, amenities, house rules, listing lifecycle
├── availability  blocked dates and the calendar
├── pricing       price calculation, seasonal rates, commission settings
├── search        listing search
├── booking       booking lifecycle and cancellation policies
├── payment       simulated payments, refunds, host payouts
├── review        two-way blind reviews
├── messaging     conversations (PostgreSQL) and messages (MongoDB)
├── notification  in-app notifications
├── dispute       disputes and resolution
├── admin         moderation, user management, reports, audit log
├── dashboard     host statistics
├── ai            Spring AI features
└── scheduler     background jobs
```
Each feature package contains: `XController`, `XService`, `XRepository`, entities, and a `dto` sub-package. Modules call each other **only through services**, never through another module's repository.

### 4.5 Global conventions

**Time.** Timestamps are `Instant` (UTC, ISO-8601 in JSON). Calendar dates are `LocalDate` (`yyyy-MM-dd`). Each listing has an IANA `timezone`; "today", check-in time, and check-out are evaluated **in the listing's timezone**. `checkInDateTime = checkInDate + listing.checkInTime in listing.timezone`.

**Check-out is exclusive.** A stay from Jan 10 to Jan 12 occupies the nights of Jan 10 and Jan 11. Another guest may check in on Jan 12. Use this rule everywhere.

**Money.** `NUMERIC(12,2)` in the database, `BigDecimal` with scale 2 in Java, `RoundingMode.HALF_UP`. Currency is always USD. Inputs with more than 2 decimals are **rejected**, not rounded. Negative values are always rejected.

**IDs.** `BIGINT` identity. Bookings also have a public `reference` such as `BK-7K2M9QXA`.

**Optimistic locking.** Mutable entities have a `@Version` column. A conflict returns `409 CONCURRENT_MODIFICATION`.

**Lock order (prevents deadlocks).** Always lock `listing` → `booking` → `payment` → `payout`, never in another order.

**Text input.** Trim every string. Required strings that are blank are errors. Strip or reject HTML in free text (`@NoHtml`).

**404 vs 403.** Wrong role → `403`. Right role but not your resource → `404` (do not reveal that it exists).

**Pagination.** `page` (0-based, default 0) and `size` (default 20, min 1, max 50). Invalid values return `400`. Page responses look like:
```json
{ "content": [], "page": 0, "size": 20, "totalElements": 0, "totalPages": 0, "hasNext": false }
```

**Errors.** Every error is an RFC 7807 `ProblemDetail` with extra fields:
```json
{ "status": 409, "title": "Conflict", "detail": "The requested dates are not available",
  "code": "BOOKING_CONFLICT", "traceId": "a1b2c3", "timestamp": "2026-01-01T10:00:00Z",
  "path": "/api/v1/bookings", "fieldErrors": [{"field":"checkOut","message":"must be after checkIn"}] }
```
Stack traces and SQL text are never returned. The frontend switches on `code`, never on `detail`.

**Successful responses** return the DTO directly (no envelope). Creating returns `201` with a `Location` header. Actions with no result return `204`.

---

## 5. Configuration

Profiles: `dev` (default), `test`, `prod`. In `prod`, startup **fails** if `JWT_SECRET` is shorter than 32 bytes or `DB_PASSWORD` is empty.

| Env variable | Purpose | Dev default |
|---|---|---|
| `DB_URL`, `DB_USER`, `DB_PASSWORD` | PostgreSQL | docker-compose values |
| `MONGO_URI` | MongoDB | `mongodb://localhost:27017/rentals` |
| `JWT_SECRET` | Token signing key (≥ 32 bytes) | dev-only value |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD` | SMTP | MailHog `localhost:1025` |
| `APP_FRONTEND_URL` | Used in email links and CORS | `http://localhost:3000` |
| `APP_CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:3000` |
| `APP_STORAGE_PATH` | Photo folder | `./uploads` |
| `APP_AI_ENABLED` | Spring AI feature flag | `false` |
| `SPRING_AI_API_KEY` | AI provider key | none |

Business settings (bound to a `@ConfigurationProperties("app")` class, validated at startup):
```yaml
app:
  booking:
    payment-hold-minutes: 15        # a PENDING_PAYMENT booking holds the dates this long
    host-response-hours: 24         # a host has this long to approve a request
  payout:
    release-delay-hours: 24         # after check-in time
  review:
    window-days: 14
  dispute:
    window-days: 14
  security:
    max-failed-logins: 5
    lockout-minutes: 15
    access-token-minutes: 15
    refresh-token-days: 7
  upload:
    max-photo-bytes: 5242880
    max-photos-per-listing: 20
    min-photos-to-submit: 3
```
Also set: `spring.jpa.open-in-view=false`, `spring.jpa.hibernate.ddl-auto=validate`, multipart max file 5 MB / request 25 MB, `server.error.include-stacktrace=never`, graceful shutdown.

---

## 6. Data model

### 6.1 Why two databases (SQL vs NoSQL)
| | PostgreSQL | MongoDB |
|---|---|---|
| Stores | Users, listings, bookings, payments, reviews, disputes | Chat messages only |
| Why | Money and bookings need transactions, foreign keys, and constraints (exclusion constraint) | Messages are append-only, very numerous, read newest-first by conversation, never joined or updated in transactions |
| Consequence | Strict schema | Flexible documents, fast writes |

### 6.2 PostgreSQL tables (Flyway migrations V1..V6)
Conventions: `snake_case`; enums are `VARCHAR` with a `CHECK`; every foreign key is indexed; `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`; `version BIGINT` on mutable tables.

**V1: users and auth**
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  first_name VARCHAR(60) NOT NULL,
  last_name VARCHAR(60) NOT NULL,
  phone VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','DELETED')),
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  token_version INT NOT NULL DEFAULT 0,     -- increment to invalidate all of the user's JWTs
  suspension_reason VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version BIGINT NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX uq_users_email ON users (lower(email));

CREATE TABLE user_roles (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('GUEST','HOST','SUPPORT_AGENT','ADMIN')),
  PRIMARY KEY (user_id, role)
);

CREATE TABLE host_profiles (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name VARCHAR(80) NOT NULL,
  bio VARCHAR(1000),
  host_cancellation_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,      -- SHA-256 of the opaque token
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);

CREATE TABLE one_time_tokens (               -- email verification and password reset links
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('EMAIL_VERIFY','PASSWORD_RESET')),
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ott_user_type ON one_time_tokens(user_id, type);
```

**V2: listings**
```sql
CREATE TABLE amenities (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE,
  category VARCHAR(40) NOT NULL,
  icon VARCHAR(40),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE listings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  host_id BIGINT NOT NULL REFERENCES users(id),
  title VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  property_type VARCHAR(20) NOT NULL CHECK (property_type IN ('APARTMENT','HOUSE','VILLA','CABIN','CONDO','STUDIO','OTHER')),
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING_REVIEW','ACTIVE','PAUSED','SUSPENDED','REJECTED','DELETED')),
  rejection_reason VARCHAR(500),
  address_line VARCHAR(200) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state_region VARCHAR(100),
  country CHAR(2) NOT NULL,
  postal_code VARCHAR(20),
  latitude NUMERIC(9,6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  timezone VARCHAR(50) NOT NULL,
  max_guests INT NOT NULL CHECK (max_guests BETWEEN 1 AND 50),
  bedrooms INT NOT NULL CHECK (bedrooms BETWEEN 0 AND 50),
  beds INT NOT NULL CHECK (beds BETWEEN 1 AND 100),
  bathrooms NUMERIC(3,1) NOT NULL CHECK (bathrooms BETWEEN 0 AND 50),
  base_nightly_price NUMERIC(12,2) NOT NULL CHECK (base_nightly_price BETWEEN 1.00 AND 100000.00),
  weekend_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.00 CHECK (weekend_multiplier BETWEEN 1.00 AND 3.00),
  cleaning_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cleaning_fee BETWEEN 0 AND 10000.00),
  weekly_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (weekly_discount_percent BETWEEN 0 AND 90),
  monthly_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (monthly_discount_percent BETWEEN 0 AND 90),
  min_nights INT NOT NULL DEFAULT 1 CHECK (min_nights >= 1),
  max_nights INT NOT NULL DEFAULT 365 CHECK (max_nights <= 365),
  advance_notice_days INT NOT NULL DEFAULT 0 CHECK (advance_notice_days BETWEEN 0 AND 60),
  booking_window_days INT NOT NULL DEFAULT 365 CHECK (booking_window_days BETWEEN 30 AND 730),
  check_in_time TIME NOT NULL DEFAULT '15:00',
  check_out_time TIME NOT NULL DEFAULT '11:00',
  cancellation_policy VARCHAR(10) NOT NULL DEFAULT 'MODERATE' CHECK (cancellation_policy IN ('FLEXIBLE','MODERATE','STRICT')),
  instant_book BOOLEAN NOT NULL DEFAULT FALSE,
  average_rating NUMERIC(3,2) NOT NULL DEFAULT 0 CHECK (average_rating BETWEEN 0 AND 5),
  review_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT ck_nights_order CHECK (max_nights >= min_nights),
  CONSTRAINT ck_discount_order CHECK (monthly_discount_percent >= weekly_discount_percent)
);
CREATE INDEX idx_listings_host ON listings(host_id);
CREATE INDEX idx_listings_search ON listings(status, lower(city), base_nightly_price);
CREATE INDEX idx_listings_rating ON listings(average_rating DESC, id);

CREATE TABLE listing_amenities (
  listing_id BIGINT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  amenity_id BIGINT NOT NULL REFERENCES amenities(id),
  PRIMARY KEY (listing_id, amenity_id)
);

CREATE TABLE listing_photos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_id BIGINT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  storage_key VARCHAR(120) NOT NULL UNIQUE,   -- uuid.ext, never the client's filename
  content_type VARCHAR(30) NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp')),
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  width INT NOT NULL, height INT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_cover BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_photos_listing ON listing_photos(listing_id, sort_order);
CREATE UNIQUE INDEX uq_one_cover ON listing_photos(listing_id) WHERE is_cover;

CREATE TABLE house_rules (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_id BIGINT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  rule_text VARCHAR(200) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);
```

**V3: availability and pricing**
```sql
CREATE TABLE availability_blocks (            -- dates the host blocked; end_date is EXCLUSIVE
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_id BIGINT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason VARCHAR(200),
  CONSTRAINT ck_block_range CHECK (end_date > start_date),
  CONSTRAINT no_overlapping_blocks EXCLUDE USING gist (
    listing_id WITH =, daterange(start_date, end_date, '[)') WITH &&)
);

CREATE TABLE seasonal_rates (                 -- a special nightly price for a date range; both ends INCLUSIVE
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_id BIGINT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  name VARCHAR(60) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  nightly_price NUMERIC(12,2) NOT NULL CHECK (nightly_price BETWEEN 1.00 AND 100000.00),
  CONSTRAINT ck_season_range CHECK (end_date >= start_date),
  CONSTRAINT no_overlapping_seasons EXCLUDE USING gist (
    listing_id WITH =, daterange(start_date, end_date, '[]') WITH &&)
);

CREATE TABLE commission_settings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guest_service_fee_percent NUMERIC(5,2) NOT NULL CHECK (guest_service_fee_percent BETWEEN 0 AND 30),
  host_commission_percent NUMERIC(5,2) NOT NULL CHECK (host_commission_percent BETWEEN 0 AND 30),
  tax_percent NUMERIC(5,2) NOT NULL CHECK (tax_percent BETWEEN 0 AND 30),
  effective_from TIMESTAMPTZ NOT NULL UNIQUE,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**V4: bookings**
```sql
CREATE TABLE bookings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reference VARCHAR(12) NOT NULL UNIQUE,
  listing_id BIGINT NOT NULL REFERENCES listings(id),
  guest_id BIGINT NOT NULL REFERENCES users(id),
  host_id BIGINT NOT NULL REFERENCES users(id),
  idempotency_key VARCHAR(64),                  -- prevents a double click creating two bookings
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,                      -- exclusive
  nights INT NOT NULL CHECK (nights BETWEEN 1 AND 365),
  guests_count INT NOT NULL CHECK (guests_count BETWEEN 1 AND 50),
  status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING_PAYMENT','PENDING_APPROVAL','CONFIRMED','COMPLETED',
     'DECLINED','EXPIRED','PAYMENT_FAILED','CANCELLED_BY_GUEST','CANCELLED_BY_HOST')),
  instant_book BOOLEAN NOT NULL,
  guest_message VARCHAR(1000),
  -- Price snapshot: copied at booking time and never changed afterwards
  nightly_subtotal NUMERIC(12,2) NOT NULL CHECK (nightly_subtotal >= 0),
  discount_total NUMERIC(12,2) NOT NULL CHECK (discount_total >= 0),
  cleaning_fee NUMERIC(12,2) NOT NULL CHECK (cleaning_fee >= 0),
  service_fee NUMERIC(12,2) NOT NULL CHECK (service_fee >= 0),
  tax_total NUMERIC(12,2) NOT NULL CHECK (tax_total >= 0),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  host_commission NUMERIC(12,2) NOT NULL CHECK (host_commission >= 0),
  host_payout_amount NUMERIC(12,2) NOT NULL CHECK (host_payout_amount >= 0),
  price_breakdown JSONB NOT NULL,               -- per-night lines for display
  cancellation_policy VARCHAR(10) NOT NULL,     -- snapshot
  listing_timezone VARCHAR(50) NOT NULL,        -- snapshot
  check_in_time TIME NOT NULL,                  -- snapshot
  check_out_time TIME NOT NULL,                 -- snapshot
  expires_at TIMESTAMPTZ,                       -- hold expiry or host-response deadline
  confirmed_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, cancelled_at TIMESTAMPTZ,
  cancelled_by BIGINT REFERENCES users(id),
  cancellation_reason VARCHAR(500),
  decline_reason VARCHAR(500),
  refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT ck_booking_dates CHECK (check_out > check_in),
  CONSTRAINT ck_booking_nights CHECK (nights = check_out - check_in),
  CONSTRAINT ck_not_self CHECK (guest_id <> host_id),
  CONSTRAINT ck_refund_le_total CHECK (refund_amount <= total_amount),
  CONSTRAINT ck_total_math CHECK (total_amount = nightly_subtotal - discount_total + cleaning_fee + service_fee + tax_total),
  CONSTRAINT no_overlapping_bookings EXCLUDE USING gist (
    listing_id WITH =, daterange(check_in, check_out, '[)') WITH &&)
    WHERE (status IN ('PENDING_PAYMENT','PENDING_APPROVAL','CONFIRMED'))
);
CREATE UNIQUE INDEX uq_booking_idem ON bookings(guest_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_bookings_guest ON bookings(guest_id, created_at DESC);
CREATE INDEX idx_bookings_host ON bookings(host_id, created_at DESC);
CREATE INDEX idx_bookings_listing_dates ON bookings(listing_id, check_in, check_out);
CREATE INDEX idx_bookings_status_expiry ON bookings(status, expires_at);

CREATE TABLE booking_status_history (         -- who changed the status, when, and why
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  from_status VARCHAR(20),
  to_status VARCHAR(20) NOT NULL,
  actor_id BIGINT REFERENCES users(id),       -- null means the system
  actor_type VARCHAR(10) NOT NULL CHECK (actor_type IN ('GUEST','HOST','SUPPORT','ADMIN','SYSTEM')),
  reason VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**V5: payments, reviews, messaging metadata, disputes**
```sql
CREATE TABLE payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES bookings(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING','SUCCEEDED','FAILED','PARTIALLY_REFUNDED','REFUNDED')),
  idempotency_key VARCHAR(80) NOT NULL UNIQUE,       -- "pay-{bookingId}"
  provider_reference VARCHAR(80),
  failure_code VARCHAR(40),
  refunded_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT ck_refunded_le_amount CHECK (refunded_total <= amount)
);
CREATE UNIQUE INDEX uq_one_paid_per_booking ON payments(booking_id)
  WHERE status IN ('SUCCEEDED','PARTIALLY_REFUNDED','REFUNDED');

CREATE TABLE refunds (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payment_id BIGINT NOT NULL REFERENCES payments(id),
  booking_id BIGINT NOT NULL REFERENCES bookings(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reason VARCHAR(30) NOT NULL CHECK (reason IN ('GUEST_CANCELLATION','HOST_CANCELLATION','HOST_DECLINED',
     'REQUEST_EXPIRED','DISPUTE_RESOLUTION','LATE_PAYMENT')),
  status VARCHAR(10) NOT NULL CHECK (status IN ('PENDING','SUCCEEDED','FAILED')),
  idempotency_key VARCHAR(80) NOT NULL UNIQUE,       -- "refund-{bookingId}-{reason}[-{disputeId}]"
  attempt_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payouts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  host_id BIGINT NOT NULL REFERENCES users(id),
  booking_id BIGINT NOT NULL UNIQUE REFERENCES bookings(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  status VARCHAR(12) NOT NULL CHECK (status IN ('SCHEDULED','HELD','PAID','CANCELLED')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_payouts_due ON payouts(status, scheduled_for);

CREATE TABLE reviews (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES bookings(id),
  listing_id BIGINT NOT NULL REFERENCES listings(id),
  reviewer_id BIGINT NOT NULL REFERENCES users(id),
  reviewee_id BIGINT NOT NULL REFERENCES users(id),
  direction VARCHAR(15) NOT NULL CHECK (direction IN ('GUEST_TO_HOST','HOST_TO_GUEST')),
  overall_rating SMALLINT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  cleanliness_rating SMALLINT CHECK (cleanliness_rating BETWEEN 1 AND 5),
  communication_rating SMALLINT CHECK (communication_rating BETWEEN 1 AND 5),
  accuracy_rating SMALLINT CHECK (accuracy_rating BETWEEN 1 AND 5),
  comment VARCHAR(2000),
  status VARCHAR(10) NOT NULL DEFAULT 'HIDDEN' CHECK (status IN ('HIDDEN','PUBLISHED','REMOVED')),
  publish_deadline TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_review_per_direction UNIQUE (booking_id, direction),
  CONSTRAINT ck_review_not_self CHECK (reviewer_id <> reviewee_id)
);
CREATE INDEX idx_reviews_listing ON reviews(listing_id, status, published_at DESC);

CREATE TABLE conversations (                  -- who is talking about which listing; text lives in MongoDB
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_id BIGINT NOT NULL REFERENCES listings(id),
  guest_id BIGINT NOT NULL REFERENCES users(id),
  host_id BIGINT NOT NULL REFERENCES users(id),
  last_message_at TIMESTAMPTZ,
  last_message_preview VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_conversation UNIQUE (listing_id, guest_id),
  CONSTRAINT ck_conv_not_self CHECK (guest_id <> host_id)
);

CREATE TABLE disputes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES bookings(id),
  raised_by BIGINT NOT NULL REFERENCES users(id),
  category VARCHAR(30) NOT NULL CHECK (category IN ('PROPERTY_NOT_AS_DESCRIBED','CLEANLINESS','HOST_NO_SHOW','GUEST_DAMAGE','SAFETY','BILLING','OTHER')),
  description VARCHAR(2000) NOT NULL,
  status VARCHAR(15) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','UNDER_REVIEW','RESOLVED','REJECTED')),
  assigned_agent_id BIGINT REFERENCES users(id),
  resolution_type VARCHAR(15) CHECK (resolution_type IN ('FULL_REFUND','PARTIAL_REFUND','NO_REFUND')),
  refund_amount NUMERIC(12,2) CHECK (refund_amount >= 0),
  resolution_note VARCHAR(2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX uq_one_active_dispute ON disputes(booking_id) WHERE status IN ('OPEN','UNDER_REVIEW');
```

**V6: notifications, audit, AI cache, reference data**
```sql
CREATE TABLE notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(120) NOT NULL,
  body VARCHAR(500) NOT NULL,
  link VARCHAR(200),                          -- frontend route such as /trips/BK-XXXX
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON notifications(user_id, read_at, created_at DESC);

CREATE TABLE audit_logs (                     -- append-only record of sensitive admin actions
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id BIGINT REFERENCES users(id),
  action VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id BIGINT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE FUNCTION audit_logs_immutable() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'audit_logs is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_audit_immutable BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();

CREATE TABLE listing_ai_summaries (           -- caches the AI review summary so it is not regenerated every request
  listing_id BIGINT PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  review_count INT NOT NULL,
  summary VARCHAR(1500) NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
Reference data (in `V6` or `V7`): insert ~25 amenities (WiFi, Kitchen, Air conditioning, Heating, Washer, Dryer, Free parking, Pool, Hot tub, TV, Workspace, Smoke alarm, First aid kit, Fire extinguisher, Pets allowed, Gym, BBQ grill, Balcony, Beach access, Elevator, Crib, Hair dryer, Iron, Self check-in, Carbon monoxide alarm) and the first commission row: service fee 10.00, host commission 3.00, tax 8.00, `effective_from = 1970-01-01T00:00:00Z`.

### 6.3 MongoDB collection `messages`
```json
{ "_id": "ObjectId", "conversationId": 42, "senderId": 7, "body": "Is the place free in June?",
  "clientKey": "optional-uuid", "sentAt": "ISODate", "readAt": null }
```
Indexes: `{conversationId:1, sentAt:-1}` (load a chat newest-first), `{conversationId:1, senderId:1, readAt:1}` (count unread), unique partial `{conversationId:1, senderId:1, clientKey:1}` where `clientKey` exists (prevents duplicate sends).

---

## 7. Security

### 7.1 One stateless filter chain
- All `/api/**` requests: CSRF disabled (no cookies are used), sessions `STATELESS`, `JwtAuthenticationFilter` runs before the standard authentication filter.
- **CORS:** allowed origins from `APP_CORS_ORIGINS`; methods `GET, POST, PUT, PATCH, DELETE, OPTIONS`; headers `Authorization, Content-Type, Idempotency-Key`; exposed header `Location`; no credentials.
- Security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, HSTS in `prod`.
- Custom JSON handlers: unauthenticated → `401 UNAUTHENTICATED`; wrong role → `403 FORBIDDEN` (both in the standard error format).

### 7.2 Public vs protected routes
| Access | Routes |
|---|---|
| Public | `POST /auth/register, login, refresh, verify-email, resend-verification, forgot-password, reset-password`; `GET /listings/**`, `GET /search/**`, `GET /amenities`, `GET /hosts/{id}`, `GET /media/**`, `GET /health` |
| Any logged-in user | everything else not listed below |
| `HOST` | `/host/**` |
| `SUPPORT_AGENT` or `ADMIN` | `/support/**` |
| `ADMIN` | `/admin/**` |

### 7.3 JWT
- Access token: HS256, **15 min**. Claims: `sub` (user id), `roles`, `tv` (token_version), `jti`, `iat`, `exp`, `iss=rentals-api`.
- On every request the filter loads the user (cached 30 s) and rejects the token if the user is not `ACTIVE` or `tv` differs from the stored `token_version`. Roles are read from the stored user, not trusted from the token.
- Refresh token: opaque 256-bit random value, stored only as a SHA-256 hash, valid **7 days**. **Rotation:** every `/auth/refresh` revokes the presented token and issues a new one. Presenting a **revoked** token again means theft: revoke all the user's refresh tokens, increment `token_version`, return `401 REFRESH_TOKEN_REUSED`.
- Logout revokes the presented refresh token. Password change or reset revokes all refresh tokens and increments `token_version`.

### 7.4 Passwords and accounts
- Password rules: 8 to 72 **bytes** (BCrypt limit), at least one letter and one digit, no leading/trailing space, must not contain the email's local part. BCrypt strength 12.
- Login failure message is always `Invalid email or password` (same for unknown email, wrong password, deleted account). An unknown email still triggers a dummy BCrypt check so timing does not leak existence.
- After 5 consecutive failures: `locked_until = now + 15 min`; while locked, return the same generic 401. Success resets the counter.
- Suspended account with a **correct** password: `403 ACCOUNT_SUSPENDED`.
- Unverified email: login allowed, but booking, submitting a listing, and sending messages return `403 EMAIL_NOT_VERIFIED`.
- `forgot-password` and `resend-verification` always return `202` with the same body whether or not the email exists.
- One-time tokens: 256-bit random, hashed at rest, single use. Verification link valid 24 h; reset link valid 60 min. A new token invalidates older unused tokens of the same type. Bad/expired/used → `400 INVALID_OR_EXPIRED_TOKEN`.
- Registration: email trimmed, lowercased, max 254 chars, valid format; names 1–60 chars (letters, spaces, hyphens, apostrophes); phone optional E.164 (`^\+[1-9]\d{6,14}$`); duplicate email → `409 EMAIL_ALREADY_REGISTERED`.
- Login/register/forgot-password are rate limited to **10 requests per minute per IP** (`429 RATE_LIMITED`, `Retry-After` header).

### 7.5 Authorization in three layers (all required)
1. **URL rules** by role (Section 7.2).
2. **`@PreAuthorize`** on controller methods for readability (`hasRole('HOST')`).
3. **Ownership checks inside services.** A host with the `HOST` role can still only touch their own listings. Every "mine" query filters by the authenticated user id in SQL. If the resource is not the caller's, throw `ResourceNotFoundException` (404).

---

## 8. Modules

Each module states **Purpose**, **Why it exists**, **Classes** (every class has a purpose), **Endpoints**, and **Rules and edge cases**. All paths are under `/api/v1`.

---

### 8.1 `common`: shared building blocks

**Purpose:** things every module needs, kept in one place so no module duplicates them.

| Class | Purpose |
|---|---|
| `ErrorCode` (enum) | The stable list of error codes the frontend can rely on (Section 11) |
| `ApiException` + subclasses `ResourceNotFoundException`, `BusinessRuleException`, `ConflictException` | Let services signal failures without knowing about HTTP; each carries an `ErrorCode` |
| `GlobalExceptionHandler` (`@RestControllerAdvice`) | The only place exceptions become JSON error responses; also translates validation errors, JSON parse errors, constraint violations, optimistic-lock failures |
| `PageResponse<T>` (record) | One consistent shape for every paginated response |
| `CurrentUser` | Reads the authenticated user's id and roles from the security context so services receive a plain `userId` instead of touching security code |
| `MoneyUtils` | The single place for rounding (`HALF_UP`, 2 decimals) and percentage math, so no service does its own money arithmetic |
| `AppProperties` | Typed, validated business settings (Section 5) |
| `ClockConfig` | Provides the `Clock` bean (UTC); tests replace it with a fixed clock |
| `CacheConfig` | Declares Caffeine caches and their TTLs (Section 9) |
| `AsyncConfig` | Thread pool for sending emails without blocking requests |
| `OpenApiConfig` | Swagger documentation with the JWT bearer scheme |
| `RateLimitFilter` | Brute-force protection for `/auth/**` (10/min/IP, in-memory) |
| `RequestIdFilter` | Adds `X-Request-Id` / `traceId` to logs and error responses so a failure can be traced |
| Custom validators `@NoHtml`, `@StrongPassword`, `@CountryCode`, `@TimezoneId`, `@Phone` | Reusable validation rules used by many DTOs |
| `AuditService` + `AuditLog` entity + `AuditLogRepository` | Writes the append-only audit trail (Section 8.14) in the caller's transaction |

---

### 8.2 `auth`: registration, login, tokens

**Purpose:** prove who a caller is and issue/verify their tokens.
**Why it exists:** every other module needs an authenticated user. This is the course's custom sign-in, BCrypt, and JWT topic.

| Class | Purpose |
|---|---|
| `AuthController` | Exposes the auth endpoints below |
| `AuthService` | Registration, login (with lockout), refresh rotation, logout, password flows |
| `JwtService` | Creates and validates access tokens (one job: JWT) |
| `JwtAuthenticationFilter` | Reads the Bearer token on each request and sets the security context |
| `SecurityConfig` | Defines the filter chain, public routes, role rules, CORS, password encoder |
| `ApiAuthenticationHandlers` | Returns the 401 and 403 responses as JSON |
| `CustomUserDetailsService` | Loads the user for Spring Security |
| `RefreshToken`, `OneTimeToken` entities + repositories | Persist hashed refresh tokens and email/reset tokens |
| `TokenHasher` | SHA-256 hashing and secure random token generation (one place for token hygiene) |
| `EmailService` | Sends the verification and password-reset emails (async, failures are logged and never break the request) |

**Endpoints**
| Method | Path | Auth | Body → Response |
|---|---|---|---|
| POST | `/auth/register` | public | `{email,password,firstName,lastName,phone?}` → `201 UserResponse` |
| POST | `/auth/verify-email` | public | `{token}` → `204` |
| POST | `/auth/resend-verification` | public | `{email}` → `202` |
| POST | `/auth/login` | public | `{email,password}` → `{accessToken, refreshToken, tokenType:"Bearer", expiresIn, user}` |
| POST | `/auth/refresh` | public | `{refreshToken}` → same shape as login |
| POST | `/auth/logout` | user | `{refreshToken}` → `204` |
| POST | `/auth/forgot-password` | public | `{email}` → `202` |
| POST | `/auth/reset-password` | public | `{token,newPassword}` → `204` |
| POST | `/auth/change-password` | user | `{currentPassword,newPassword}` → `204` |

**Rules:** see Section 7.4. Additionally: `change-password` requires the correct current password and a new password different from it; it revokes all refresh tokens. Registration creates the user with role `GUEST` and sends the verification email.

---

### 8.3 `user`: profiles and host onboarding

**Purpose:** let users see and edit their own profile, become hosts, and let anyone see a host's public profile.
**Why it exists:** the `HOST` role is how the platform separates people who publish listings from those who only book.

| Class | Purpose |
|---|---|
| `UserController` | Profile and host endpoints |
| `UserService` | Profile updates, host onboarding, account deletion rules |
| `User`, `Role` (enum), `UserStatus` (enum), `UserRepository` | The user table and its roles |
| `HostProfile` + `HostProfileRepository` | Host-only data (display name, bio, cancellation count) |
| DTOs: `UserResponse`, `UpdateProfileRequest`, `BecomeHostRequest`, `PublicHostResponse` | What clients send and receive |

**Endpoints**
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/users/me` | user | `UserResponse` (id, email, names, phone, roles, `host`, `emailVerified`, `hostDisplayName`) |
| PATCH | `/users/me` | user | `{firstName?,lastName?,phone?}`; only supplied fields change; email cannot change |
| POST | `/users/me/become-host` | user | `{displayName, bio?, acceptTerms}` → `UserResponse` |
| DELETE | `/users/me` | user | `{password}` → `204` |
| GET | `/hosts/{userId}` | public | `{displayName, bio, memberSince, activeListings, averageRating, reviewCount}` |

**Rules and edge cases**
- `become-host`: email must be verified; `acceptTerms` must be `true`; `displayName` 2–80 chars; already a host → `409 DUPLICATE_RESOURCE`. Adds role `HOST`, creates the profile, writes an audit entry, evicts the user cache.
- `DELETE /users/me`: password required. **Blocked** (`422 BUSINESS_RULE_VIOLATION`) while the user has bookings in `PENDING_PAYMENT`, `PENDING_APPROVAL` or `CONFIRMED` (as guest or host), unpaid payouts, or an open dispute. Otherwise soft delete: status `DELETED`, email replaced with `deleted-{id}@deleted.invalid`, names `Deleted User`, phone cleared, own listings set `DELETED`, refresh tokens revoked. Past bookings and reviews remain for integrity.
- The public host profile never exposes email, phone, or address.

---

### 8.4 `listing`: properties, photos, amenities

**Purpose:** create and manage the properties that guests book, including their lifecycle and photos.
**Why it exists:** listings are the product. The lifecycle (draft → reviewed → active) gives admins control over what becomes public.

| Class | Purpose |
|---|---|
| `ListingController` | Public read endpoints and host management endpoints |
| `ListingService` | Create/update/submit/pause/resume/delete, lifecycle rules, ownership checks |
| `Listing`, `ListingStatus`, `PropertyType`, `CancellationPolicyType` enums | The listing table and its states; `Listing` enforces legal status changes in its own methods |
| `ListingRepository` | Queries including "lock this listing row" for bookings |
| `Amenity` + `AmenityRepository` | The catalog of amenities (WiFi, pool, …) |
| `AmenityController` | Public amenity list (cached) |
| `ListingPhoto` + `ListingPhotoRepository` | Photo metadata |
| `PhotoService` | Validates and stores uploaded images, orders photos, sets the cover |
| `StorageService` (interface) + `LocalStorageService` | Saves and deletes image files behind an interface |
| `MediaController` | Serves image files to the public safely |
| `HouseRule` + repository | Rules a host sets ("no smoking") |
| DTOs: `ListingRequest`, `ListingResponse`, `ListingSummaryResponse`, `PhotoResponse`, `AmenityResponse`, `HouseRulesRequest`, … | API shapes |

**Listing lifecycle**
```
DRAFT ──submit──► PENDING_REVIEW ──admin approve──► ACTIVE ◄──resume── PAUSED
  ▲                    │                              │ └──pause──────►┘
  │                    └─admin reject─► REJECTED ─edit+submit─► PENDING_REVIEW
ACTIVE ──admin suspend──► SUSPENDED ──admin reinstate──► ACTIVE
Any status except DELETED ──host delete (no active future bookings)──► DELETED
```
Anything not shown → `409 INVALID_STATE_TRANSITION`.

**Endpoints**
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/listings/{id}` | public | Full detail. `ACTIVE` only for the public; owner and admin can see any status; others get 404 |
| GET | `/amenities` | public | Active amenities grouped by category (cached) |
| POST | `/host/listings` | HOST | Create `DRAFT` → `201` |
| GET | `/host/listings` | HOST | Own listings, paged, filter `status` |
| GET | `/host/listings/{id}` | HOST | Own listing detail |
| PUT | `/host/listings/{id}` | HOST | Full update |
| DELETE | `/host/listings/{id}` | HOST | Soft delete |
| POST | `/host/listings/{id}/submit`, `/pause`, `/resume` | HOST | Lifecycle actions |
| PUT | `/host/listings/{id}/amenities` | HOST | `{amenityIds:[…]}` replaces the set (max 50) |
| PUT | `/host/listings/{id}/house-rules` | HOST | `{rules:[{text,sortOrder}]}` max 15 |
| POST | `/host/listings/{id}/photos` | HOST | multipart field `file` |
| PUT | `/host/listings/{id}/photos/order` | HOST | `{photoIds:[…]}` must be exactly the listing's photos |
| PATCH | `/host/listings/{id}/photos/{photoId}/cover` | HOST | Set cover |
| DELETE | `/host/listings/{id}/photos/{photoId}` | HOST | Delete photo |
| GET | `/media/listings/{listingId}/{filename}` | public | Image bytes |

**`ListingRequest` validation**
| Field | Rule |
|---|---|
| `title` | required, 10–120 chars, no HTML |
| `description` | required, 50–5000 chars, no HTML |
| `propertyType` | required enum |
| `addressLine` | required, 5–200 |
| `city` | required, 1–100 · `stateRegion` ≤ 100 · `postalCode` ≤ 20 |
| `country` | required ISO-3166 alpha-2 uppercase |
| `latitude` / `longitude` | required, within ±90 / ±180 |
| `timezone` | required valid IANA id (e.g., `America/New_York`) |
| `maxGuests` 1–50 · `bedrooms` 0–50 · `beds` 1–100 · `bathrooms` 0–50 in 0.5 steps | |
| `baseNightlyPrice` | required, **1.00 to 100000.00**, ≤ 2 decimals; negative or zero rejected |
| `weekendMultiplier` | 1.00–3.00 (applied to Friday and Saturday nights) |
| `cleaningFee` | 0–10000.00 |
| `weeklyDiscountPercent`, `monthlyDiscountPercent` | 0–90; monthly ≥ weekly |
| `minNights` ≥ 1; `maxNights` ≤ 365 and ≥ `minNights` | |
| `advanceNoticeDays` | 0–60 · `bookingWindowDays` 30–730 |
| `checkInTime`, `checkOutTime` | `HH:mm` |
| `cancellationPolicy` | enum `FLEXIBLE|MODERATE|STRICT` |
| `instantBook` | boolean |

**Rules and edge cases**
- `submit` needs all required fields, **≥ 3 photos**, a cover photo (the first photo becomes the cover if none), and a verified email. Missing items are returned in the error message (`422`).
- Editing an `ACTIVE` listing is allowed for price, text, amenities, rules, photos, and stay rules; it affects **future bookings only** (bookings carry a price snapshot). Changing `country`, `city`, coordinates, `addressLine`, or `propertyType` of an ACTIVE listing sends it back to `PENDING_REVIEW`. Editing a `PENDING_REVIEW` listing → `409`.
- **Delete** is blocked with `409 LISTING_HAS_ACTIVE_BOOKINGS` if any booking in `PENDING_PAYMENT`, `PENDING_APPROVAL`, or `CONFIRMED` has `check_out >= today` (listing tz). Otherwise soft delete (`status=DELETED`, photo files removed after commit).
- Pausing with future bookings is allowed (existing bookings stay valid); paused listings leave search and cannot be newly booked.
- Amenity ids must exist and be active; duplicates are ignored.
- A host may have at most 50 non-deleted listings.
- **Photo upload:** reject an empty file (400), > 5 MB (413), or a 21st photo (422). Verify the real file type by **magic bytes** (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF…WEBP`); otherwise `415`. Decode with `ImageIO` to confirm it is a real image; reject if either side is < 400 px or > 8000 px; **re-encode** to strip EXIF/GPS data. Store as `{uuid}.{jpg|png|webp}` and verify the resolved path stays inside the storage root (stops path traversal). Deleting the cover promotes the next photo; deleting a photo that would leave < 3 photos on an ACTIVE or PENDING_REVIEW listing → `422`. Delete the DB row first and the file after commit. `MediaController` validates the filename against `^[0-9a-f-]{36}\.(jpg|png|webp)$` and sends `Cache-Control: public, max-age=86400` and `X-Content-Type-Options: nosniff`.

---

### 8.5 `availability`: blocked dates and the calendar

**Purpose:** answer "can this listing be booked on these dates?" and let hosts block dates.
**Why it exists:** both search, quoting, and booking need one shared definition of "available", so the rule is written once.

| Class | Purpose |
|---|---|
| `AvailabilityController` | Calendar and block endpoints |
| `AvailabilityService` | The single `checkAvailability(...)` method plus calendar building and block management |
| `AvailabilityBlock` + `AvailabilityBlockRepository` | Host-blocked date ranges |
| DTOs: `BlockRequest`, `BlockResponse`, `CalendarResponse`, `CalendarDayResponse` | API shapes |

**Endpoints**
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/listings/{id}/calendar?from=&to=` | public | Per day: `{date, available, reason (BOOKED|BLOCKED|PAST|OUTSIDE_WINDOW|null), nightlyPrice}` |
| GET | `/host/listings/{id}/blocks` | HOST | List blocks |
| POST | `/host/listings/{id}/blocks` | HOST | `{startDate,endDate,reason?}` (end exclusive) → `201` |
| DELETE | `/host/listings/{id}/blocks/{blockId}` | HOST | `204` |

**`checkAvailability(listingId, checkIn, checkOut, guests)`** returns success or the *first* violated rule, in this order:
1. `checkIn < checkOut` and `nights ≤ 365` → else `400 INVALID_DATE_RANGE`
2. Advance notice: `checkIn ≥ today(tz) + advanceNoticeDays`. If `advanceNoticeDays = 0`, same-day check-in is allowed only while now is before the check-in time → else `422 BUSINESS_RULE_VIOLATION`
3. Booking window: `checkOut ≤ today(tz) + bookingWindowDays` → else `422`
4. `1 ≤ guests ≤ maxGuests` → else `422`
5. `minNights ≤ nights ≤ maxNights` → else `422`
6. No overlap with a block → else `409 BOOKING_CONFLICT`
7. No overlap with an active booking (`PENDING_PAYMENT`, `PENDING_APPROVAL`, `CONFIRMED`). Overlap test: `existing.checkIn < new.checkOut AND existing.checkOut > new.checkIn` → else `409 BOOKING_CONFLICT`

**Edge cases:** back-to-back stays (10→12 and 12→14) must both succeed; 10→12 vs 11→13 must conflict. Calendar range: `from ≤ to`, ≤ 366 days, `from` not more than 1 year in the past (else `400 INVALID_DATE_RANGE`). The calendar shows booking reasons only as the generic `BOOKED`, never guest details. A block cannot start in the past, cannot exceed 730 days, cannot overlap an active booking (`409 BOOKING_CONFLICT`) or another block (`409 DUPLICATE_RESOURCE`). Block creation takes the **same listing row lock** as booking creation, so a block and a booking cannot race.

---

### 8.6 `pricing`: price calculation, seasonal rates, commission

**Purpose:** compute the exact price of a stay, the same way every time, and let hosts and admins configure what affects it.
**Why it exists:** search, quote, and checkout must show identical numbers. This is the course's Strategy pattern, SOLID, and Builder pattern topic.

| Class | Purpose |
|---|---|
| `PricingService` | Loads listing, seasons, and commission; runs the rules in order; returns a `PriceBreakdown` |
| `PricingRule` (interface) | One method `apply(PricingContext, PriceBreakdown.Builder)`; each implementation is one price component |
| `SeasonalRateRule` | Replaces the base nightly price for nights that fall inside a seasonal rate |
| `WeekendRule` | Multiplies the nightly price on Friday and Saturday nights |
| `LengthOfStayDiscountRule` | Applies the weekly (≥ 7 nights) or monthly (≥ 28 nights) discount |
| `CleaningFeeRule` | Adds the flat cleaning fee once |
| `ServiceFeeRule` | Adds the guest service fee |
| `TaxRule` | Adds tax |
| `PricingContext` | Immutable bundle of inputs the rules need (listing values, seasons, dates, percentages) |
| `PriceBreakdown` (Lombok `@Builder`) | The immutable result: night lines, subtotal, discount, fees, tax, total, host commission, host payout |
| `SeasonalRate` + repository, `SeasonalRateController` | Hosts define special-price date ranges |
| `CommissionSetting` + repository, `CommissionService`, `CommissionController` | Admin-controlled fee percentages with effective dates |
| DTOs: `QuoteResponse`, `PriceBreakdownResponse`, `NightLineResponse`, `SeasonalRateRequest/Response`, `CommissionSettingRequest/Response` | API shapes |

**Calculation (rules run in this order; `PricingService` sorts them by an `order()` value)**
| Step | Rule | Formula |
|---|---|---|
| 1 | Start | For each night `d` in `[checkIn, checkOut)`: rate = `baseNightlyPrice` |
| 2 | `SeasonalRateRule` | If a seasonal rate covers `d` (inclusive range), rate = that season's `nightlyPrice` |
| 3 | `WeekendRule` | If `d` is a **Friday or Saturday**, rate = `round(rate × weekendMultiplier)` |
| 4 | `LengthOfStayDiscountRule` | `nights ≥ 28` → monthly %; else `nights ≥ 7` → weekly %; the larger applicable one only (never stacked). `discountTotal = round(nightlySubtotal × pct / 100)` |
| 5 | `CleaningFeeRule` | `cleaningFee` once, not discounted |
| 6 | `ServiceFeeRule` | `serviceFee = round((nightlySubtotal − discountTotal) × serviceFeePercent / 100)` |
| 7 | `TaxRule` | `taxTotal = round((nightlySubtotal − discountTotal + cleaningFee) × taxPercent / 100)` |
| 8 | Totals | `total = nightlySubtotal − discountTotal + cleaningFee + serviceFee + taxTotal`; `hostCommission = round((nightlySubtotal − discountTotal) × hostCommissionPercent / 100)`; `hostPayout = nightlySubtotal − discountTotal + cleaningFee − hostCommission`; `accommodationTotal = total − serviceFee` |

Every line is rounded HALF_UP to 2 decimals **before** summing, so the database check `total = subtotal − discount + cleaning + service + tax` always holds.

**Commission selection:** the row with the greatest `effective_from ≤ now`.

**Endpoints**
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/listings/{id}/quote?checkIn=&checkOut=&guests=` | public | Runs `checkAvailability` then returns `{listingId, checkIn, checkOut, nights, guests, instantBook, priceBreakdown}`; unavailable dates return the same error as booking |
| GET/POST | `/host/listings/{id}/seasonal-rates` | HOST | `{name,startDate,endDate,nightlyPrice}` |
| PUT/DELETE | `/host/listings/{id}/seasonal-rates/{rateId}` | HOST | |
| GET | `/admin/commission-settings` | ADMIN | History, paged |
| POST | `/admin/commission-settings` | ADMIN | `{guestServiceFeePercent, hostCommissionPercent, taxPercent, effectiveFrom}` |

**Rules and edge cases**
- Seasonal rate: name 2–60 chars; `endDate ≥ startDate`; length ≤ 366 days; `nightlyPrice` 1.00–100000.00; may not overlap another season (`409 DUPLICATE_RESOURCE`); `endDate` cannot be in the past. Changing seasons never affects existing bookings (price snapshot).
- Commission: each percent 0–30 with ≤ 2 decimals; **`effectiveFrom` must be at least 1 minute in the future** (no backdating, it would silently rewrite history); must be unique. Audited with old and new values. Evicts the `commission` cache.
- Sanity checks after calculating: `total > 0`, `hostPayout ≥ 0`, every night rate ≥ 0.01; otherwise throw an internal error and **never persist**.
- Nights > 365 are rejected before pricing. Leap-day stays must price correctly.
- Worked example for a unit test: base 100.00, weekend multiplier 1.20, a season 150.00 for Dec 24–31 inclusive, a stay that crosses a weekend and the season boundary; assert each night line, discount, fees, tax, and total.

---

### 8.7 `search`: finding listings

**Purpose:** return a filtered, sorted, paginated list of bookable listings.
**Why it exists:** it is the landing experience of the site and the main use of JPA Specifications and caching.

| Class | Purpose |
|---|---|
| `SearchController` | `GET /search` and the city suggestion endpoint |
| `SearchService` | Validates parameters, builds the query, enriches results with prices |
| `ListingSpecifications` | Small composable filters (city, guests, price range, amenities, availability, …) combined with `Specification.and(...)` |
| `SearchCriteria` (record) | The validated filter values passed around inside the module |
| DTOs: `SearchResultResponse`, `CitySuggestionResponse` | API shapes |

**Endpoints**
| Method | Path | Auth |
|---|---|---|
| GET | `/search` | public |
| GET | `/search/suggestions/cities?prefix=&limit=` | public |

**Parameters**
| Param | Rule |
|---|---|
| `city` | optional, 2–100 chars, case-insensitive contains (`%`, `_`, `\` escaped) |
| `country` | optional ISO-2 |
| `checkIn`, `checkOut` | both or neither; `checkIn ≥ today`; `checkIn < checkOut`; ≤ 365 nights → else `400 INVALID_DATE_RANGE` |
| `guests` | 1–50, default 1 |
| `minPrice`, `maxPrice` | ≥ 0, ≤ 2 decimals; **`minPrice ≤ maxPrice`**; compared with `baseNightlyPrice` |
| `amenityIds` | repeated or comma list, max 15; listing must have **all** |
| `propertyType`, `minBedrooms`, `minRating`, `instantBook` | optional |
| `sort` | `PRICE_ASC`, `PRICE_DESC`, `RATING_DESC` (default), `NEWEST`; unknown → `400 INVALID_SORT` |
| `page`, `size` | Section 4.5 |

**Result item:** `{id, title, city, country, propertyType, coverPhotoUrl, maxGuests, bedrooms, baseNightlyPrice, averageRating, reviewCount, instantBook, amenitiesPreview[≤4], totalPrice?, nights?}`. `totalPrice` is included only when dates are supplied (computed by `PricingService` for the current page only; if pricing fails for one item, leave that price out and continue).

**Rules**
- Only `ACTIVE`, non-deleted listings whose host is `ACTIVE` appear.
- When dates are given, exclude listings that violate min/max nights, advance notice, or booking window, and listings with an overlapping block or active booking (`NOT EXISTS` subqueries).
- Always add `id` as a sort tiebreaker so pages are stable. Empty results return `200` with an empty page.
- **No N+1:** load cover photos with a join/`@EntityGraph` or one batched query. A test asserts a page of 20 triggers ≤ 5 SQL statements.
- Cached 30 s keyed by normalized criteria (Section 9). Search results are **never** used to decide booking availability; booking always reads the database.

---

### 8.8 `booking`: the core module

**Purpose:** take a guest from "I want these dates" to a confirmed, paid, completed (or cancelled) stay, without ever double booking.
**Why it exists:** it is the heart of the product and the main demonstration of transactions, locking, and state machines.

| Class | Purpose |
|---|---|
| `BookingController` | Guest and host booking endpoints |
| `BookingService` | Create (hold), pay, approve, decline, cancel, complete; all transaction boundaries live here |
| `Booking` entity | Holds the data and `transitionTo(newStatus, actor)`, the **only** place that allows or rejects a status change |
| `BookingStatus` (enum) | The list of states |
| `BookingStatusHistory` + repository | Audit trail of each status change |
| `BookingRepository` | Queries including "lock this booking row" and overlap checks |
| `CancellationPolicy` (interface) | Strategy: `calculateRefund(booking, now)` |
| `FlexiblePolicy`, `ModeratePolicy`, `StrictPolicy` | The three refund rules |
| `CancellationPolicyResolver` | Picks the right policy implementation from the booking's snapshotted policy name |
| `BookingReferenceGenerator` | Creates unique public references like `BK-7K2M9QXA` |
| DTOs: `CreateBookingRequest`, `PayBookingRequest`, `BookingResponse`, `CancellationPreviewResponse`, `DeclineRequest`, `CancelRequest` | API shapes |

**Status machine (enforced only in `Booking.transitionTo`)**
| From | To | Who / trigger |
|---|---|---|
| `PENDING_PAYMENT` | `CONFIRMED` | system: payment succeeded and listing is instant book |
| `PENDING_PAYMENT` | `PENDING_APPROVAL` | system: payment succeeded and listing needs approval |
| `PENDING_PAYMENT` | `PAYMENT_FAILED` | system: payment declined or timed out |
| `PENDING_PAYMENT` | `EXPIRED` | scheduler: hold time ran out |
| `PENDING_APPROVAL` | `CONFIRMED` | host approves |
| `PENDING_APPROVAL` | `DECLINED` | host declines |
| `PENDING_APPROVAL` | `EXPIRED` | scheduler: host did not respond in 24 h |
| `PENDING_APPROVAL` | `CANCELLED_BY_GUEST` | guest cancels (full refund) |
| `CONFIRMED` | `CANCELLED_BY_GUEST` | guest cancels (policy refund) |
| `CONFIRMED` | `CANCELLED_BY_HOST` | host cancels (full refund) |
| `CONFIRMED` | `COMPLETED` | scheduler: check-out date reached |

Every other combination throws `409 INVALID_STATE_TRANSITION`. Each transition writes a `booking_status_history` row in the same transaction and a notification.

**Endpoints**
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/bookings` | user | Step 1 of checkout: holds the dates. Optional header `Idempotency-Key`. → `201 BookingResponse` (`PENDING_PAYMENT`) |
| POST | `/bookings/{id}/pay` | guest of booking | Step 2: `{paymentToken}` → `BookingResponse` (`CONFIRMED` or `PENDING_APPROVAL`) |
| GET | `/bookings/mine?status=&page=&size=` | user | Guest's bookings, newest first |
| GET | `/bookings/{id}` | guest, host, or staff | Includes `allowedActions` and `history` |
| GET | `/bookings/reference/{reference}` | guest, host, or staff | Same, by public reference |
| GET | `/bookings/{id}/cancellation-preview` | guest or host of booking | Shows the refund **before** cancelling |
| POST | `/bookings/{id}/cancel` | guest of booking | `{reason?}` ≤ 500 chars |
| GET | `/host/bookings?status=&listingId=&page=&size=` | HOST | Bookings for the host's listings |
| POST | `/host/bookings/{id}/approve` | HOST of booking | |
| POST | `/host/bookings/{id}/decline` | HOST of booking | `{reason}` 5–500 chars |
| POST | `/host/bookings/{id}/cancel` | HOST of booking | `{reason}` 10–500 chars |

**`CreateBookingRequest`**
| Field | Validation |
|---|---|
| `listingId` | required, positive |
| `checkIn`, `checkOut` | required ISO dates, `checkIn < checkOut`, `checkIn` not before today (listing tz) |
| `guests` | required, 1 to listing maximum |
| `expectedTotal` | required, 0.01–100000.00, ≤ 2 decimals; must equal the server total, else `409 PRICE_CHANGED` with the new quote in the body |
| `message` | optional, ≤ 1000 chars, no HTML |

`PayBookingRequest`: `paymentToken` required, 1–100 chars, pattern `[A-Za-z0-9_-]+`, and **must not look like a card number** (13–19 digits → `400`). The API never accepts raw card data.

**Step 1: create a hold (one transaction)**
1. If `Idempotency-Key` was already used by this guest, return that booking (no new one).
2. Validate the DTO. The guest must be `ACTIVE` with a verified email (`403 EMAIL_NOT_VERIFIED`).
3. A guest may have at most **3** bookings in `PENDING_PAYMENT` (else `422`), to stop hold abuse.
4. **Lock the listing row** (`SELECT … FOR UPDATE`, lock timeout 5 s; timeout → `409 CONCURRENT_MODIFICATION`).
5. The listing must be `ACTIVE` and its host `ACTIVE` (`409 LISTING_NOT_BOOKABLE`). The guest must not be the host (`422`).
6. `AvailabilityService.checkAvailability(...)`.
7. `PricingService.calculate(...)`; compare with `expectedTotal`.
8. Insert the booking: status `PENDING_PAYMENT`, `expires_at = now + 15 min`, full price snapshot, policy/timezone/time snapshots, generated `reference`. A `DataIntegrityViolationException` from the exclusion constraint becomes `409 BOOKING_CONFLICT`.
9. Commit. The dates are now held.

**Step 2: pay (no database lock is held during the payment call)**
1. Short transaction: validate the booking is `PENDING_PAYMENT` and not expired (`409 BOOKING_EXPIRED`); create a `PENDING` payment.
2. Call `PaymentGateway.charge(...)` (outside any transaction).
3. Second transaction: lock the booking row, then:
   - **Succeeded** and still `PENDING_PAYMENT` → instant book: `CONFIRMED` (create the payout); otherwise `PENDING_APPROVAL` with `expires_at = now + 24 h`.
   - **Succeeded** but the booking expired in the meantime → refund automatically (reason `LATE_PAYMENT`) and return `409 BOOKING_EXPIRED`.
   - **Declined or timed out** → payment `FAILED`, booking `PAYMENT_FAILED` (dates are freed), return `402 PAYMENT_FAILED` with `failureCode`.

**Cancellation by guest (one transaction, locks booking → payment → payout)**
1. Booking must be `PENDING_APPROVAL` or `CONFIRMED`; caller is the booking's guest (else 404).
2. If `now ≥ checkInDateTime` → `409 CANCELLATION_NOT_ALLOWED` ("stay has started, open a dispute").
3. `PENDING_APPROVAL` → refund 100% of the total. `CONFIRMED` → refund from the booking's policy.
4. Save status, `cancelled_at`, reason, `refund_amount`; create the refund through `RefundService`; adjust the payout; notify.

**Cancellation policies.** Let `A = total_amount − service_fee`. `hoursBefore = hours between now and checkInDateTime`; thresholds are inclusive (`>=`). **The service fee is non-refundable except in a 100% refund.**
| Policy | Condition | Refund |
|---|---|---|
| FLEXIBLE | ≥ 24 h before check-in | 100% of `total_amount` |
| | < 24 h | `A − round(A / nights)` (first night charged) |
| MODERATE | ≥ 120 h (5 days) | 100% of `total_amount` |
| | ≥ 24 h and < 120 h | `round(A × 0.50)` |
| | < 24 h | 0 |
| STRICT | ≥ 168 h (7 days) | `round(A × 0.50)` |
| | < 168 h | 0 |

**Host cancellation:** always refunds 100% of `total_amount`; increments the host's `host_cancellation_count`; audited; allowed only before the check-in time (else `409 CANCELLATION_NOT_ALLOWED`). A host handles a `PENDING_APPROVAL` booking with **decline**, not cancel.

**Payout adjustment on cancellation:** refund 100% of total → payout `CANCELLED`. Otherwise `newPayout = round(originalHostPayout × (A − refund) / A)` (never negative), payout stays `SCHEDULED`.

**Approve / decline**
- Approve: caller is the booking's host (else 404); booking must be `PENDING_APPROVAL` and `expires_at > now` (else `409 BOOKING_EXPIRED`). Sets `CONFIRMED` and creates the payout (`scheduled_for = checkInDateTime + 24 h`; if that is in the past, use now).
- Decline: reason required; status `DECLINED`; 100% refund.

**`BookingResponse`:** `reference, id, status, listing{id,title,city,country,coverPhotoUrl}, guest{id,firstName,…}, host{id,displayName,…}, checkIn, checkOut, nights, guests, priceBreakdown, refundAmount, cancellationPolicy, cancellationPolicyDescription, checkInDateTime, checkOutDateTime, expiresAt, confirmedAt, completedAt, cancelledAt, hostPayoutAmount, instantBook, allowedActions[], history[]`.
`allowedActions` is computed on the server for the caller from `{PAY, CANCEL, APPROVE, DECLINE, REVIEW, MESSAGE, OPEN_DISPUTE}` so the frontend only shows buttons that will work. The host sees the guest's first name before confirmation; the guest's last name and phone only after `CONFIRMED`. Guest email is never shown to a host.

**Concurrency design (three layers)**
1. **Listing row lock** during hold creation and block creation, so availability checks and inserts happen one at a time per listing.
2. **PostgreSQL exclusion constraint** `no_overlapping_bookings` as the final safety net.
3. **Booking row lock** for every status change, re-reading the status inside the lock (approve vs expire vs cancel races).

---

### 8.9 `payment`: simulated payments, refunds, payouts

**Purpose:** model the flow of money without a real provider.
**Why it exists:** guests pay, cancellations refund, hosts get paid. This is a clean demonstration of an interface (`PaymentGateway`) and of safe, repeatable money operations.

| Class | Purpose |
|---|---|
| `PaymentGateway` (interface) | `charge`, `refund`, `voidCharge`: the app depends on this, not on any provider |
| `FakePaymentGateway` | The only implementation; behavior depends on the token (table below) |
| `PaymentService` | Creates payments and records charge results |
| `Payment` + `PaymentRepository` | Payment table (one successful payment per booking) |
| `RefundService` | Issues refunds safely (locks the payment, caps the amount, idempotent) |
| `Refund` + `RefundRepository` | Refund table |
| `PayoutService` | Creates, adjusts, holds, and releases host payouts |
| `Payout` + `PayoutRepository` | Payout table |
| `PaymentController` | Read-only endpoints for the guest and host |
| DTOs: `PaymentResponse`, `RefundResponse`, `PayoutResponse`, `PayoutSummaryResponse` | API shapes |

**Fake gateway tokens**
| Token | Result |
|---|---|
| `tok_success` | Succeeds, reference `fake_ch_<uuid>` |
| `tok_decline` | `CARD_DECLINED` |
| `tok_insufficient` | `INSUFFICIENT_FUNDS` |
| `tok_timeout` | Throws a timeout after 2 s |
| `tok_flaky` | Fails first, succeeds when retried with the same idempotency key |
| anything else | `CARD_DECLINED` |
The fake remembers results by idempotency key, so repeating a call returns the same result, exactly like a real gateway.

**Endpoints**
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/bookings/{id}/payment` | guest of booking | Status, amount, refunded total, refundable amount, refunds list |
| GET | `/host/payouts?status=&page=&size=` | HOST | Own payouts |
| GET | `/host/payouts/summary` | HOST | `{pendingAmount, paidAmount, heldAmount, scheduledCount}` |

**Rules and edge cases**
- The amount charged is always `booking.total_amount`. The client never sends an amount.
- **Refund:** lock the payment row; `amount > 0`; `amount ≤ payment.amount − refunded_total` else `422`; idempotency key `refund-{bookingId}-{reason}[-{disputeId}]` so a retry never double-refunds. The refund row is saved first, the gateway is called after commit, then the result and `refunded_total` are updated. A gateway failure leaves the refund `FAILED`; the scheduler retries up to 5 times. **A refund failure never undoes the cancellation.**
- **Payouts:** created `SCHEDULED` when a booking becomes `CONFIRMED` (`scheduled_for = checkInDateTime + 24 h`). A payout is released only if its booking is `CONFIRMED` or `COMPLETED`, it is due, and there is **no open dispute** (an open dispute sets it `HELD`). Released with `FOR UPDATE SKIP LOCKED`, marked `PAID`. Failure leaves it `SCHEDULED` for the next run.
- Money-flow example: nights 300.00, 10% service fee, 3% commission, 8% tax → service fee 30.00, tax 24.00, guest pays 354.00, commission 9.00, host payout 291.00, platform keeps 39.00.

---

### 8.10 `review`: two-way blind reviews

**Purpose:** collect honest reviews from both guest and host, revealed only when both have written or the deadline passes.
**Why it exists:** reviews drive trust and search ranking; the "blind" rule prevents revenge reviews.

| Class | Purpose |
|---|---|
| `ReviewController` | Review endpoints |
| `ReviewService` | Submission rules, publishing logic, listing rating recalculation |
| `Review` + `ReviewRepository` | Review table including the aggregate rating query |
| DTOs: `CreateReviewRequest`, `ReviewResponse`, `PendingReviewResponse` | API shapes |

**Endpoints**
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/bookings/{id}/reviews` | guest or host of booking | Direction is derived from who calls |
| GET | `/bookings/{id}/reviews` | guest or host of booking | Published reviews plus the caller's own |
| GET | `/listings/{id}/reviews?sort=&page=&size=` | public | Published `GUEST_TO_HOST` only; sort `NEWEST|HIGHEST|LOWEST` |
| GET | `/reviews/pending` | user | Completed bookings the caller can still review |
| DELETE | `/admin/reviews/{id}` | ADMIN | `{reason}` 5–500 chars, sets `REMOVED`, recalculates rating |

**`CreateReviewRequest`:** `overallRating` required integer 1–5; `cleanlinessRating`, `communicationRating`, `accuracyRating` optional 1–5 (guest reviews only; for a host review they are rejected with `400`); `comment` optional ≤ 2000 chars.

**Rules**
- Booking must be `COMPLETED` (else `422`); the caller must be its guest or host (else 404).
- Deadline: `publish_deadline = end of check-out day in listing tz + 14 days`; after it → `422` ("review window closed").
- One review per booking per direction (`409 DUPLICATE_RESOURCE`, backed by a unique constraint). Reviews cannot be edited.
- A new review starts `HIDDEN`. **When the counterpart review already exists, both become `PUBLISHED` in the same transaction.** Otherwise the scheduler publishes it when the deadline passes.
- Publishing a `GUEST_TO_HOST` review recalculates `listing.average_rating` (average of published `overall_rating`, 2 decimals) and `review_count` in the same transaction, and evicts caches.
- A hidden review, or even the existence of the counterpart's review, is never visible before publishing.

---

### 8.11 `messaging`: guest-host chat (PostgreSQL + MongoDB)

**Purpose:** let guests ask hosts questions before and after booking.
**Why it exists:** it is the project's genuine **NoSQL use case**: many small append-only documents, read newest-first per conversation, no joins and no transactions with money.

| Class | Purpose |
|---|---|
| `MessagingController` | Conversation and message endpoints |
| `MessagingService` | Access checks, sending, reading, unread counts |
| `Conversation` + `ConversationRepository` (JPA) | Who is talking about which listing (relational, small) |
| `MessageDocument` + `MessageRepository` (Spring Data MongoDB) | The message texts |
| DTOs: `StartConversationRequest`, `SendMessageRequest`, `ConversationResponse`, `MessageResponse`, `MessagePageResponse` | API shapes |

**Endpoints**
| Method | Path | Notes |
|---|---|---|
| POST | `/conversations` | `{listingId, message}` → creates or reuses the conversation (unique per listing + guest) and posts the first message |
| GET | `/conversations` | Inbox: `{id, listing, counterpartDisplayName, lastMessageAt, lastMessagePreview, unreadCount}` newest first |
| GET | `/conversations/{id}` | One conversation (participants only) |
| GET | `/conversations/{id}/messages?before=<ISO instant>&limit=1..50` | Newest-first, cursor paginated: `{content, hasMore, nextCursor}` |
| POST | `/conversations/{id}/messages` | `{body}`, optional `Idempotency-Key`. Sending does not mark anything as read; reading is the separate `/read` call |
| POST | `/conversations/{id}/read` | Marks the other party's messages read |
| GET | `/conversations/unread-count` | `{total}` for the navbar badge |

**Rules**
- `body`: required, trimmed, 1–2000 chars, no HTML, not only whitespace.
- A guest cannot message their own listing (`422`). A new conversation needs an `ACTIVE` listing; an existing conversation continues even if the listing is later paused. Suspended users cannot send (`403`). Sending requires a verified email.
- Only the two participants can read or write. Staff can read messages **only** through a dispute view (Section 8.13).
- Anti-spam: the same message sent 5 times in a minute is rejected (`429`).
- Duplicate sends with the same `Idempotency-Key` return the original message.
- Write order: save the message in MongoDB first, then update `last_message_at` and the preview in PostgreSQL. If the second step fails, log it; the next message heals it.
- If MongoDB is down, messaging endpoints return `503 SERVICE_UNAVAILABLE`; the rest of the API keeps working.
- Messages are never edited or deleted in v1. A deleted user's messages show the sender as `Deleted User`.

---

### 8.12 `notification`: in-app notifications

**Purpose:** tell users something happened (booking confirmed, new message, review published…).
**Why it exists:** the frontend's notification bell and the "what needs my attention" experience are built on it. It also decouples modules: the booking code announces an event and does not know who listens.

| Class | Purpose |
|---|---|
| `NotificationController` | List and mark-read endpoints |
| `NotificationService` | Creates and queries notifications |
| `Notification` + `NotificationRepository` | The table |
| `NotificationType` (enum) | Event types: `BOOKING_REQUESTED`, `BOOKING_CONFIRMED`, `BOOKING_DECLINED`, `BOOKING_CANCELLED`, `BOOKING_EXPIRED`, `BOOKING_COMPLETED`, `PAYOUT_PAID`, `REFUND_ISSUED`, `REVIEW_REMINDER`, `REVIEW_PUBLISHED`, `LISTING_APPROVED`, `LISTING_REJECTED`, `LISTING_SUSPENDED`, `DISPUTE_OPENED`, `DISPUTE_RESOLVED`, `NEW_MESSAGE`, `CHECK_IN_REMINDER` |
| `NotificationListener` | Listens to Spring `ApplicationEvent`s published by services and creates the notification |
| Event records `BookingEvent`, `ReviewEvent`, `ListingEvent`, `DisputeEvent`, `MessageEvent` | Small immutable events carrying ids only |

**Endpoints**
| Method | Path | Notes |
|---|---|---|
| GET | `/notifications?unreadOnly=&page=&size=` | Own notifications |
| GET | `/notifications/unread-count` | `{total}` |
| PATCH | `/notifications/{id}/read` | Own only |
| PATCH | `/notifications/read-all` | |

**Rules:** each notification has a `link` that is a frontend route (e.g., `/trips/BK-7K2M9QXA`), never a backend URL. The in-app notification is created in the **same transaction** as the business change. Notification creation failure must not break the business flow for non-critical events (log and continue). Message notifications are throttled: only create one if the previous `NEW_MESSAGE` notification for that conversation is already read. Read notifications older than 90 days are deleted weekly.

---

### 8.13 `dispute`: problems after check-in

**Purpose:** give guests and hosts a formal way to raise a problem and give support staff a way to resolve it with a refund decision.
**Why it exists:** completes the money lifecycle (what if the property was not as described?) and justifies the `SUPPORT_AGENT` role.

| Class | Purpose |
|---|---|
| `DisputeController` | Endpoints for participants and for staff |
| `DisputeService` | Opening, assigning, resolving, rejecting; refund and payout consequences |
| `Dispute` + `DisputeRepository` | The table |
| `DisputeCategory`, `DisputeStatus`, `ResolutionType` (enums) | Allowed values |
| DTOs: `CreateDisputeRequest`, `DisputeResponse`, `SupportDisputeDetailResponse`, `ResolveDisputeRequest`, `RejectDisputeRequest` | API shapes |

**Endpoints**
| Method | Path | Auth |
|---|---|---|
| POST | `/bookings/{id}/disputes` | guest or host of booking |
| GET | `/disputes/mine?page=&size=` | user |
| GET | `/support/disputes?status=&page=&size=` | SUPPORT_AGENT, ADMIN |
| GET | `/support/disputes/{id}` | SUPPORT_AGENT, ADMIN: dispute + booking + payment + status history + the two parties' chat messages (view is audited as `DISPUTE_CONVERSATION_VIEWED`) |
| PATCH | `/support/disputes/{id}/assign` | takes the dispute → `UNDER_REVIEW`; an admin may reassign |
| POST | `/support/disputes/{id}/resolve` | `{resolutionType, refundAmount?, note}` |
| POST | `/support/disputes/{id}/reject` | `{note}` 10–2000 chars |

**Rules**
- Open: the booking must be `CONFIRMED` with check-in time already passed, **or** `COMPLETED` within 14 days after check-out, **or** cancelled within 14 days of cancelling (else `422`). `category` required; `description` 20–2000 chars. Only one `OPEN`/`UNDER_REVIEW` dispute per booking (`409 DUPLICATE_RESOURCE`).
- Opening sets the payout `HELD` (if `SCHEDULED`) and notifies the other party and staff.
- Resolve: only the assigned agent or an admin; the dispute must be `UNDER_REVIEW`; an agent cannot resolve a dispute they are party to. `FULL_REFUND` refunds everything still refundable (`payment.amount − refunded_total`); `PARTIAL_REFUND` needs `0 < refundAmount ≤ remaining refundable` (else `422`); `NO_REFUND` needs `refundAmount` null or 0. `note` 10–2000 chars required.
- The refund goes through `RefundService` (reason `DISPUTE_RESOLUTION`, key includes the dispute id). If the payout is not yet `PAID`, recalculate `newPayout = max(0, round(originalPayout × (A − refunded) / A))`, set it back to `SCHEDULED` (or `CANCELLED` if 0). `NO_REFUND` restores the original `SCHEDULED` payout. If already `PAID`, the platform absorbs the refund and an audit entry records it.
- Resolution is final in v1. Both parties are notified.

---

### 8.14 `admin`: moderation, users, reports, audit

**Purpose:** give admins the controls to keep the marketplace safe and correctly configured.
**Why it exists:** the admin panel of the frontend is entirely powered by these endpoints; it also demonstrates role-based authorization at its strictest.

| Class | Purpose |
|---|---|
| `AdminController` | All `/admin/**` endpoints except commission and amenities (which live with their modules) |
| `AdminListingService` | Approve, reject, suspend, reinstate listings |
| `AdminUserService` | Search users, suspend/unsuspend, change roles |
| `AdminReportService` | Platform-wide statistics |
| `AdminController` (audit endpoint) | The `GET /admin/audit` endpoint reads the audit log through `AuditService` (Section 8.1); no separate controller is needed |
| `AmenityAdminController` | Admin CRUD for amenities (uses `AmenityRepository`) |
| DTOs: `ReasonRequest`, `RolesRequest`, `AdminUserResponse`, `AdminSummaryResponse`, `AuditLogResponse` | API shapes |

**Endpoints**
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/summary?from=&to=` | `{grossMerchandiseValue, platformRevenue, bookingsByStatus, newUsers, newListings, topCities[], averageHostResponseHours, disputesByStatus}`; range ≤ 366 days |
| GET | `/admin/listings/pending` | `PENDING_REVIEW` queue, oldest first |
| GET | `/admin/listings/{id}` | Any status |
| POST | `/admin/listings/{id}/approve` | → `ACTIVE` |
| POST | `/admin/listings/{id}/reject` | `{reason}` 10–500 → `REJECTED` |
| POST | `/admin/listings/{id}/suspend` | `{reason}`; `ACTIVE`/`PAUSED` → `SUSPENDED` |
| POST | `/admin/listings/{id}/reinstate` | `SUSPENDED` → `ACTIVE` |
| GET | `/admin/users?query=&role=&status=&page=&size=` | Name/email search (wildcards escaped) |
| GET | `/admin/users/{id}` | Details |
| POST | `/admin/users/{id}/suspend` | `{reason}` 10–500 |
| POST | `/admin/users/{id}/unsuspend` | |
| PATCH | `/admin/users/{id}/roles` | `{roles:[…]}`; only `SUPPORT_AGENT` and `ADMIN` can be granted; `GUEST` always stays; `HOST` only through onboarding |
| GET | `/admin/bookings/{id}` | Any booking |
| GET | `/admin/audit?actor=&entityType=&action=&from=&to=&page=&size=` | Read-only audit log |
| POST/PUT/DELETE | `/admin/amenities`, `/admin/amenities/{id}` | Name unique case-insensitively, 2–60 chars; deleting an amenity in use **deactivates** it instead |

**Rules and edge cases**
- Approve only from `PENDING_REVIEW`, re-checking the submit checklist (photos etc.); a listing whose host is suspended cannot be approved (`422`).
- An admin cannot suspend or demote **themselves**, cannot suspend another admin, and cannot remove the **last** admin (`422`).
- **Suspending a user:** status `SUSPENDED`, `token_version++`, refresh tokens revoked, cache evicted; their `ACTIVE` listings become `SUSPENDED`; their `PENDING_APPROVAL` bookings as host are auto-declined with a full refund; their `PENDING_PAYMENT` bookings as guest expire; `CONFIRMED` bookings are left alone but a notification alerts support. Unsuspending restores the user but **not** their listings (an admin must reinstate them deliberately).
- Every admin action writes an audit entry (actor, action, entity, before/after) in the same transaction. Audit actions: `USER_SUSPENDED`, `USER_UNSUSPENDED`, `ROLE_CHANGED`, `HOST_ONBOARDED`, `LISTING_SUBMITTED`, `LISTING_APPROVED`, `LISTING_REJECTED`, `LISTING_SUSPENDED`, `LISTING_REINSTATED`, `LISTING_DELETED`, `COMMISSION_CHANGED`, `BOOKING_CANCELLED_BY_HOST`, `REFUND_ISSUED`, `PAYOUT_PAID`, `DISPUTE_OPENED`, `DISPUTE_ASSIGNED`, `DISPUTE_RESOLVED`, `DISPUTE_CONVERSATION_VIEWED`, `REVIEW_REMOVED`, `PLATFORM_ABSORBED_REFUND`.

---

### 8.15 `dashboard`: host statistics and guest trip groups

**Purpose:** summarize numbers and groupings so the frontend does not have to compute them.
**Why it exists:** the host dashboard and "My trips" page are first-class screens; aggregating in SQL is faster and more correct than in the browser.

| Class | Purpose |
|---|---|
| `DashboardController` | Dashboard endpoints |
| `DashboardService` | Runs aggregate queries and assembles results |
| `DashboardRepository` | Aggregate SQL (`SUM`, `COUNT`, `GROUP BY`) returning DTO projections |
| DTOs: `HostDashboardResponse`, `EarningsResponse`, `ListingMetricsResponse`, `MyTripsResponse` | API shapes |

**Endpoints**
| Method | Path | Notes |
|---|---|---|
| GET | `/host/dashboard?from=&to=` | Default: current month (UTC). `from ≤ to`, ≤ 366 days, not more than 5 years back |
| GET | `/host/dashboard/listings?from=&to=` | Per-listing metrics |
| GET | `/dashboard/trips` | Guest's bookings grouped as `{upcoming, past, cancelled}` |

**`HostDashboardResponse`:** `{from, to, earnings{paidTotal, pendingTotal, heldTotal, thisMonthPaid}, overallOccupancyRate, upcomingCheckIns (next 7 days), pendingRequests, oldestPendingRequestExpiry, recentBookings[], averageRating, listings[{listingId, title, coverPhotoUrl, bookings, bookedNights, blockedNights, occupancyRate, revenue, averageRating}]}`.

**Rules:** `occupancyRate = bookedNights / (rangeDays − blockedNights) × 100`, counting only nights of `CONFIRMED` and `COMPLETED` bookings clipped to the range; **if the denominator is ≤ 0, return 0** (never divide by zero), rounded to 1 decimal. Trips grouping: `upcoming` = `CONFIRMED`/`PENDING_*` with check-out ≥ today; `past` = `COMPLETED`; `cancelled` = `CANCELLED_*`, `DECLINED`, `EXPIRED`. Cached 60 s per (user, range).

---

### 8.16 `ai`: Spring AI helpers

**Purpose:** use a language model for three genuinely useful tasks.
**Why it exists:** it covers the Spring AI topic with features that save real user effort, while being isolated so the rest of the app never depends on it.

| Class | Purpose |
|---|---|
| `AiController` | The three endpoints |
| `AiService` | Builds prompts, calls `ChatClient`, enforces limits, caches summaries, falls back on failure |
| `ListingAiSummary` + repository | Caches the review summary in `listing_ai_summaries` |
| DTOs: `ListingDescriptionRequest`, `TripPlanRequest`, `AiTextResponse`, `ReviewSummaryResponse` | API shapes |

**Endpoints**
| Method | Path | Auth | Input | Rules |
|---|---|---|---|---|
| POST | `/ai/listing-description` | HOST | `{propertyType, city, bullets:[…]}` | 1–15 bullets, each 3–200 chars; output ≤ 1500 chars; returned as a **draft**, never saved automatically |
| GET | `/ai/listings/{id}/review-summary` | public | | Needs ≥ 3 published reviews (else `422`); cached and regenerated only when `review_count` changed |
| POST | `/ai/trip-plan` | user | `{city, days 1–14, interests?[≤5]}` | Output ≤ 2000 chars |

**Rules:** feature flag `app.ai.enabled` (default `false`). When disabled, or when the provider errors or exceeds 10 s, respond `503 AI_UNAVAILABLE` with a friendly message; nothing else is affected. The system prompt fixes the task and forbids following instructions found in user text; user text is wrapped in delimiters and length-limited; output has HTML stripped. Prompts **never** include emails, phones, or booking data; the review summary uses only the text and ratings of published reviews. Limit: 10 requests/min/user and 50/day/user. Log token counts, not content. API keys come from environment variables only.

---

### 8.17 `scheduler`: background jobs

**Purpose:** perform time-based state changes that no user triggers.
**Why it exists:** holds expire, stays complete, payouts release, and reviews publish whether or not anyone is online. Each job is a separate small class so it can be tested alone.

All jobs use `@Scheduled`, the injected `Clock`, process in batches of 100, handle **each item in its own transaction** (one bad row never blocks the others), and are **idempotent**. Each job re-checks the item's state **inside the row lock** before acting, so it is safe against simultaneous user actions. The app runs as a single instance; if it is ever scaled out, add a distributed lock.

| Job class | Schedule | Action |
|---|---|---|
| `ExpirePendingPaymentJob` | every minute | `PENDING_PAYMENT` with `expires_at ≤ now` → `EXPIRED` (dates freed); if a successful payment exists, refund it |
| `ExpirePendingApprovalJob` | every 5 min | `PENDING_APPROVAL` with `expires_at ≤ now` → `EXPIRED` + full refund + notifications |
| `CompleteStayJob` | every 15 min | `CONFIRMED` where today in the listing's timezone ≥ `check_out` → `COMPLETED`; notify both sides to review |
| `PayoutJob` | every 15 min | Release due payouts (Section 8.9) |
| `RetryRefundsJob` | every 10 min | Retry `FAILED` refunds up to 5 attempts |
| `ReviewPublishJob` | every 30 min | Publish `HIDDEN` reviews past their deadline and recalculate ratings |
| `ReminderJob` | daily 08:00 UTC | Check-in reminder (day before) and review reminder (3 days before deadline), once per booking |
| `CleanupJob` | daily 03:00 UTC | Delete expired/used one-time tokens, old revoked refresh tokens, read notifications older than 90 days |

---

## 9. Caching and transactions

### 9.1 Caching (Caffeine)
| Cache | TTL | Evicted when |
|---|---|---|
| `amenities` | 1 h | an admin changes an amenity |
| `commission` | 10 min | a new commission row is created |
| `listingDetail` | 60 s | the listing, its photos, amenities, price, rating, or status changes |
| `searchResults` | 30 s | any listing, booking, or block change (clear all) |
| `userAuth` (JWT user lookup) | 30 s | the user is suspended, roles change, password changes, logout |
| `hostDashboard` | 60 s | time only |

Never cache another user's private data under a shared key. **Booking creation and quotes never use a cache to decide availability or price.**

### 9.2 Transaction rules
- `@Transactional` goes on **service** methods only; read-only methods use `readOnly = true`.
- External calls (payment gateway, email, AI) **never** happen inside a transaction that holds a row lock.
- Lock order: listing → booking → payment → payout.
- `spring.jpa.open-in-view=false`; entities are mapped to DTOs inside the service so lazy loading never leaks into controllers.
- All associations are `FetchType.LAZY`; use `@EntityGraph` or join fetch where data is needed; enums use `@Enumerated(STRING)`; no Lombok `@Data` on entities.

---

## 10. Testing (JUnit)

**Targets:** ≥ 80% line coverage on `pricing`, `booking`, `payment`, `availability` services; every legal and illegal state transition covered.

**Unit tests (JUnit 5, Mockito, AssertJ)**
- Pricing: one test per rule; weekend and season boundary combinations; weekly/monthly thresholds (6, 7, 27, 28 nights); rounding at `.005` (HALF_UP); zero cleaning fee; zero discounts; leap day; the sum always equals the DB check formula.
- Cancellation policies: all boundaries (exactly 120 h, 119 h 59 min, exactly 24 h, 23 h 59 min, STRICT at 168 h), service-fee rule, host cancellation, pending-approval cancellation, a New York DST-change day, cancellation at the check-in instant (blocked).
- Booking state machine: table-driven test of every (from, to) pair.
- Availability: each rule's failure, error order, back-to-back stays, same-day edge, advance notice 0/1/2.
- Reviews: both submitted, only one after the deadline, closed window, duplicate.
- Validation: password, money (3 decimals, negative, zero), dates (`checkIn ≥ checkOut`, past), `minPrice > maxPrice`.
- Token hashing, refresh rotation and reuse detection; dispute refund and payout math.

**Integration tests (`@SpringBootTest` + Testcontainers PostgreSQL and MongoDB)**
- Flyway migrates from scratch and Hibernate `validate` passes.
- The exclusion constraint rejects overlapping inserts even when bypassing services; allows back-to-back; ignores cancelled bookings.
- Full flows over HTTP: instant booking, request → approve, request → decline, request → expire (fixed `Clock`), payment decline/timeout/flaky, each cancellation policy, host cancellation, completion, payout release, blind review → published, dispute open → resolve.
- Security: each endpoint as anonymous / wrong role / **another user** (must be 404) / suspended user; expired, tampered, wrong-issuer JWT; token after password change; refresh rotation and reuse; rate limit → 429.
- Search: each filter, combinations, stable pagination, sorts, escaped wildcards, query-count guard.
- Photo upload: valid, oversized, wrong magic bytes, corrupt image, path-traversal filename, 21st photo, deleting the cover.
- Messaging: participants only, cursor paging, read receipts, idempotent send.
- Commission: a booking made before a change keeps the old rates.

**Concurrency tests (mandatory proof the system works)**
- 20 threads book the same dates on one listing → exactly **1** booking is created; 19 get `BOOKING_CONFLICT`.
- 20 threads book different non-overlapping dates → all succeed.
- Approve, expire, and cancel fired together on one `PENDING_APPROVAL` booking → exactly one wins; the refund is issued once.
- Two simultaneous refunds never exceed the payment amount.
- Same `Idempotency-Key` sent 10 times in parallel → exactly one booking.

**Infrastructure:** fixed `Clock` bean overridable in tests; test data builders for listings and bookings; one shared container per test run for speed.

---

## 11. Error codes (the contract the frontend relies on)

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Field errors in `fieldErrors` |
| `MALFORMED_REQUEST` | 400 | Bad JSON, bad enum/date/number format |
| `INVALID_DATE_RANGE`, `INVALID_PAGE_SIZE`, `INVALID_SORT` | 400 | Bad parameters |
| `INVALID_OR_EXPIRED_TOKEN` | 400 | Email/reset token invalid |
| `UNAUTHENTICATED`, `INVALID_CREDENTIALS` | 401 | Missing/expired token or wrong login |
| `REFRESH_TOKEN_REUSED` | 401 | Refresh token replay; user must log in again |
| `PAYMENT_FAILED` | 402 | Gateway declined; `failureCode` is `CARD_DECLINED`, `INSUFFICIENT_FUNDS`, or `GATEWAY_TIMEOUT` |
| `FORBIDDEN`, `ACCOUNT_SUSPENDED`, `EMAIL_NOT_VERIFIED` | 403 | Not allowed |
| `RESOURCE_NOT_FOUND` | 404 | Missing, deleted, or not yours |
| `EMAIL_ALREADY_REGISTERED`, `DUPLICATE_RESOURCE` | 409 | Duplicate |
| `BOOKING_CONFLICT` | 409 | Dates unavailable |
| `PRICE_CHANGED` | 409 | Body contains the new quote |
| `INVALID_STATE_TRANSITION`, `BOOKING_EXPIRED`, `CANCELLATION_NOT_ALLOWED` | 409 | Action not allowed now |
| `LISTING_NOT_BOOKABLE`, `LISTING_HAS_ACTIVE_BOOKINGS` | 409 | Listing rule |
| `CONCURRENT_MODIFICATION` | 409 | Try again |
| `BUSINESS_RULE_VIOLATION` | 422 | Any other named rule (readable message) |
| `IDEMPOTENCY_KEY_REUSED` | 422 | Same key, different request |
| `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE` | 413, 415 | Upload problems |
| `RATE_LIMITED` | 429 | `Retry-After` header present |
| `AI_UNAVAILABLE`, `SERVICE_UNAVAILABLE` | 503 | Optional feature or dependency down |
| `INTERNAL_ERROR` | 500 | Unexpected; includes `traceId` |

Also translate: unique-constraint violations → `409 DUPLICATE_RESOURCE`; the booking exclusion constraint → `409 BOOKING_CONFLICT`; wrong HTTP method → 405; oversized upload → 413; wrong parameter type → `400 MALFORMED_REQUEST`.

---

## 12. API contract summary (the bridge to the frontend)

This section is the single index the frontend document will be built on.

**Base URL:** `/api/v1`. **Format:** JSON, UTF-8. **Auth:** `Authorization: Bearer <accessToken>`. **Dates:** `yyyy-MM-dd`; timestamps ISO-8601 UTC. **Money:** JSON numbers with 2 decimals, USD.

**Token handling the frontend must follow:** access token lives 15 min; when a call returns `401 UNAUTHENTICATED`, call `/auth/refresh` **once**, replace both tokens, and retry; if refresh fails (including `REFRESH_TOKEN_REUSED`), clear tokens and go to login. Never send two refreshes in parallel (rotation would trigger reuse detection).

**Checkout flow the frontend must follow:** `GET /listings/{id}/quote` → show price → `POST /bookings` (hold, show a countdown from `expiresAt`) → `POST /bookings/{id}/pay` with `paymentToken` → show confirmation. Handle `PRICE_CHANGED` (show the new quote), `BOOKING_CONFLICT`, `BOOKING_EXPIRED`, `PAYMENT_FAILED`.

**Show only what `allowedActions` allows** on booking screens.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register, login, refresh, logout, verify-email, resend-verification, forgot-password, reset-password, change-password` |
| Me | `GET/PATCH/DELETE /users/me`, `POST /users/me/become-host`, `GET /hosts/{id}` |
| Browse (public) | `GET /search`, `GET /search/suggestions/cities`, `GET /listings/{id}`, `GET /listings/{id}/calendar`, `GET /listings/{id}/quote`, `GET /listings/{id}/reviews`, `GET /amenities`, `GET /ai/listings/{id}/review-summary` |
| Guest | `POST /bookings`, `POST /bookings/{id}/pay`, `GET /bookings/mine`, `GET /bookings/{id}`, `GET /bookings/reference/{ref}`, `GET /bookings/{id}/cancellation-preview`, `POST /bookings/{id}/cancel`, `GET /bookings/{id}/payment`, `GET /dashboard/trips`, `POST/GET /bookings/{id}/reviews`, `GET /reviews/pending`, `POST /bookings/{id}/disputes`, `GET /disputes/mine` |
| Messaging | `POST/GET /conversations`, `GET /conversations/{id}`, `GET/POST /conversations/{id}/messages`, `POST /conversations/{id}/read`, `GET /conversations/unread-count` |
| Notifications | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/{id}/read`, `PATCH /notifications/read-all` |
| Host | `/host/listings` (CRUD, `submit`, `pause`, `resume`, `amenities`, `house-rules`, `photos`, `blocks`, `seasonal-rates`), `GET /host/bookings`, `POST /host/bookings/{id}/approve|decline|cancel`, `GET /host/payouts`, `GET /host/payouts/summary`, `GET /host/dashboard`, `GET /host/dashboard/listings`, `POST /ai/listing-description` |
| Support | `GET /support/disputes`, `GET /support/disputes/{id}`, `PATCH …/assign`, `POST …/resolve`, `POST …/reject` |
| Admin | `GET /admin/summary`, `/admin/listings/**`, `/admin/users/**`, `GET /admin/audit`, `/admin/commission-settings`, `/admin/amenities`, `DELETE /admin/reviews/{id}`, `GET /admin/bookings/{id}` |
| Misc | `GET /media/listings/{listingId}/{filename}`, `GET /health`, `POST /ai/trip-plan`, Swagger at `/swagger-ui.html` and `/v3/api-docs` |

Every enum value used in responses (statuses, policies, types) is part of this contract; the frontend maps each to a label and a color.

---

## 13. Deployment

- **Dockerfile:** multi-stage build (Maven → `eclipse-temurin:21-jre`), non-root user, `JAVA_OPTS="-Duser.timezone=UTC -XX:MaxRAMPercentage=75"`, health check on `/api/v1/health` (or Actuator).
- **docker-compose.yml:** services `app`, `postgres:16` (volume + `pg_isready` health check), `mongo:7` (volume + health check), `mailhog` (SMTP 1025, UI 8025). The app waits for healthy databases (`depends_on: condition: service_healthy`). A volume holds uploaded photos. `docker compose up --build` starts everything.
- **Production checklist:** `SPRING_PROFILES_ACTIVE=prod`; all env vars set; HTTPS terminated by a reverse proxy (`server.forward-headers-strategy=framework`); Swagger disabled unless explicitly enabled; the database user is not a superuser (except for the one-time `btree_gist` extension creation); backups for volumes; uploads on persistent storage.
- Flyway runs at startup. **Never edit an applied migration; add a new version.**
- Observability: SLF4J logging, JSON logs in `prod`, `traceId` on every line, Actuator `health` public and everything else admin-only, never log passwords, tokens, or full emails.

---

## 14. Seed data (`dev` profile only, idempotent)

- Users (password for all: `Password123!`, all emails verified): `admin@rentals.test` (ADMIN), `support@rentals.test` (SUPPORT_AGENT), `host1@rentals.test`, `host2@rentals.test` (HOST), `guest1@rentals.test`, `guest2@rentals.test` (GUEST).
- 12 listings across 4 cities with a mix of policies, instant/request modes, seasonal rates, weekend multipliers, and blocks. Statuses: 8 `ACTIVE`, 2 `PENDING_REVIEW`, 1 `DRAFT`, 1 `PAUSED`. Photos generated programmatically as valid JPEGs (no external files).
- Bookings in **every** status, including past `COMPLETED` ones with published reviews and a hidden review, an open dispute, and a pending request close to expiry, with matching payments and payouts.
- Conversations with sample messages; the first commission row from the migration.
- Print the demo credentials in the log at startup (dev only).

---

## 15. Master edge-case checklist

**Numbers and money**
1. Prices, fees, and refunds are never negative; zero is rejected where `> 0` is required; more than 2 decimals is rejected (not rounded); maximums enforced.
2. `minPrice > maxPrice` rejected. Discounts 0–90, commission 0–30, weekend multiplier 1.0–3.0.
3. A refund can never exceed what remains refundable; a payout can never be negative.
4. Client-supplied totals are only compared with the server total, never trusted.

**Dates and times**
5. `checkIn ≥ checkOut`, zero nights, and > 365 nights are rejected.
6. Past check-in (listing tz), beyond the booking window, and inside the advance notice are rejected.
7. End-before-start is rejected for blocks and seasons; blocks cannot start in the past; overlaps are rejected.
8. Commission `effectiveFrom` cannot be in the past.
9. **Expiry and deadline times are always system-computed and always after creation**; no client can set an expiry, review deadline, or payout date.
10. Cancellation is not allowed at or after the check-in instant; reviews are not allowed before completion or after the window; disputes only within their windows.
11. DST changes are handled with `ZonedDateTime`; leap-day stays validate and price correctly.
12. Calendar and dashboard ranges are capped at 366 days; `from > to` rejected.

**State and ownership**
13. Illegal state transitions are rejected; simultaneous transitions are serialized by row locks.
14. A guest cannot book their own listing, review themselves, or message themselves.
15. Every id-based endpoint is checked for ownership; another user gets 404.
16. Roles cannot be escalated through any API other than host onboarding and the admin roles endpoint.
17. Suspended or deleted users cannot log in, and their existing tokens stop working immediately (`token_version`).
18. Double submissions never create two bookings, payments, refunds, or reviews.

**Input and files**
19. Strings are trimmed, length-checked, and HTML-free; control characters are rejected; emoji are allowed.
20. Bad enum/date/number formats return `400 MALFORMED_REQUEST`, never `500`.
21. Uploads are verified by content; oversized, empty, corrupt, and disguised files are rejected; path traversal is impossible; EXIF is stripped.
22. SQL `LIKE` wildcards in search terms are escaped; page size > 50 and negative pages are rejected.
23. Latitude/longitude ranges, ISO country codes, and timezones are validated.

**Failure modes**
24. A payment timeout or decline never leaves a booking holding dates forever (explicit failure handling plus the expiry job).
25. Payment succeeded but the hold expired → automatic refund.
26. A refund gateway failure is retried and surfaced; the cancellation still stands.
27. Email, AI, or MongoDB outages never break bookings and payments.
28. Database constraint violations always become a proper 4xx, never a 500.
29. Re-running any scheduled job is harmless.

---

## 16. Build order

| Phase | Build | Done when |
|---|---|---|
| 1 | Project, profiles, Flyway V1, `common`, `auth`, `user`, security chain, Docker compose | Register, verify, login, refresh, logout work; security tests pass |
| 2 | Amenities, `listing` (CRUD, lifecycle, photos), `admin` listing moderation, audit | A listing goes DRAFT → ACTIVE via admin approval; photo tests pass |
| 3 | `availability`, `pricing` (rules, seasonal rates, commission), quote endpoint | Pricing and availability unit tests green |
| 4 | `search`, caching | Filters, pagination, and the query-count test pass |
| 5 | `booking`, `payment`, refunds, payouts, schedulers for holds | Concurrency tests green; every cancellation boundary test passes |
| 6 | `review`, `messaging` (MongoDB), `notification` | Blind review and messaging tests pass |
| 7 | `dispute`, `dashboard`, `admin` users/reports, remaining jobs | Dispute refund math tests pass |
| 8 | `ai`, seed data, OpenAPI polish, README | Everything runs from a clean `docker compose up` |

**If time runs short, cut from the bottom:** `ai`, then `dashboard`, then `dispute`. Phases 1–5 alone are a complete, impressive product.

---

## 17. Definition of done
- [ ] `docker compose up --build` from a clean checkout starts a working system with seed data.
- [ ] All Flyway migrations apply to an empty database and `ddl-auto=validate` passes.
- [ ] Every endpoint in this document exists, is documented in Swagger, and is authorized by role **and** ownership.
- [ ] Every rule and edge case in Sections 7, 8, and 15 has an automated test.
- [ ] The concurrency tests pass 20 consecutive runs.
- [ ] No entity is returned from a controller, no `double` is used for money, no secret is in the code, and no class exists that is not listed here.
- [ ] Every error follows the `ProblemDetail` format with a stable `code`.
- [ ] `mvn verify` is green.
