# Vacation Rental Marketplace Backend (REST API)

A production-grade, Airbnb-inspired vacation rental marketplace REST API built with **Spring Boot 3.3.4** and **Java 21**, following clean MVC architecture, SOLID principles, and strict separation of concerns.

---

## 1. Architectural Highlights

- **Dual-Database Strategy:**
  - **PostgreSQL 16**: System of record for users, listings, availability, bookings, pricing, payments, refunds, payouts, disputes, notifications, and immutable audit logs. Employs `btree_gist` exclusion constraints to mathematically prevent double-booking.
  - **MongoDB 7**: High-volume, append-only document storage for guest-host chat messaging and cursor-paginated threads.
- **RESTful Domain Design (No Server-Side HTML / No Thymeleaf):** Pure JSON request/response models. Entities are never exposed beyond the service layer.
- **Financial Accuracy:** Strict `BigDecimal` arithmetic with scale 2 and `RoundingMode.HALF_UP` for all prices, taxes, commissions, discounts, and refunds. No `double` or `float` for monetary values.
- **State Machine Integrity:** Robust booking lifecycle (`PENDING_PAYMENT` -> `CONFIRMED` / `PENDING_APPROVAL` -> `COMPLETED`, `CANCELLED`, `EXPIRED`, `DECLINED`) with pessimistic row locking and immutable status history logs.
- **Security & Authorization:** Spring Security 6 with stateless JJWT access tokens (15-min TTL) and rotating database-backed refresh tokens (7-day TTL) with automated replay attack detection.
- **Two-Way Blind Reviews:** Reviews remain hidden until both guest and host complete their feedback or the 14-day window expires.
- **Caffeine In-Memory Caching:** High-speed caching for amenities, commission settings, listing details, search results, and host dashboards with automated transactional eviction.

---

## 2. Technology Stack

| Layer | Component |
|---|---|
| **Runtime & Language** | Java 21 LTS, Maven 3.9+ |
| **Framework** | Spring Boot 3.3.4 (Data JPA, Security, Cache, Validation, Mail, Actuator, Data MongoDB) |
| **Relational Database** | PostgreSQL 16 with `btree_gist` extension |
| **NoSQL Database** | MongoDB 7 |
| **Database Migrations** | Flyway (V1 through V6) |
| **Cache Provider** | Caffeine (`com.github.ben-manes.caffeine:caffeine`) |
| **Authentication & Tokens**| Spring Security 6, BCrypt (strength 12), JJWT 0.12.6 |
| **API Documentation** | SpringDoc OpenAPI 2.6.0 (`/swagger-ui.html`) |
| **Testing** | JUnit 5, Mockito, AssertJ, Spring Boot Test |

---

## 3. Getting Started

### Prerequisites
- Docker & Docker Compose **OR**
- Java 21 JDK, Maven 3.9+, PostgreSQL 16, and MongoDB 7.

### Running via Docker Compose
To boot the full application stack (Spring Boot app, PostgreSQL 16, MongoDB 7, and MailHog SMTP server) with automatic schema migration and dev seed data:

```bash
docker compose up --build
```

The services will be available at:
- **API Base URL**: `http://localhost:8080/api/v1`
- **Swagger OpenAPI Documentation**: `http://localhost:8080/swagger-ui.html`
- **Actuator Health Endpoint**: `http://localhost:8080/actuator/health`
- **MailHog Web UI**: `http://localhost:8025`
- **PostgreSQL**: `localhost:5432` (`db: rentals, user: rentals_user, pass: rentals_secret`)
- **MongoDB**: `localhost:27017/rentals`

### Running Locally with Maven
1. Ensure PostgreSQL is running on `localhost:5432` with database `rentals` and MongoDB on `localhost:27017`.
2. Configure `.env` or set environment variables:
   ```bash
   cp .env.example .env
   ```
3. Run the Spring Boot application:
   ```bash
   mvn spring-boot:run -Dspring-boot.run.profiles=dev
   ```

---

## 4. Default Seed Accounts (`dev` profile)

All seeded test accounts use the password: `Password123!`

| Email | Roles | Description |
|---|---|---|
| `admin@rentals.test` | `GUEST`, `ADMIN` | Platform administrator with moderation and user management privileges |
| `support@rentals.test` | `GUEST`, `SUPPORT_AGENT` | Dispute resolution and mediation agent |
| `host1@rentals.test` | `GUEST`, `HOST` | Superhost managing properties in New York & San Francisco |
| `host2@rentals.test` | `GUEST`, `HOST` | Host managing properties in Miami & Austin |
| `guest1@rentals.test` | `GUEST` | Primary traveler account with past completed stays and pending trips |
| `guest2@rentals.test` | `GUEST` | Traveler account with pending approval requests |

---

## 5. API Reference & Contract Overview

All endpoints accept and return `application/json`. Timestamps are ISO-8601 UTC.

### Core Endpoints

#### Authentication (`/api/v1/auth`)
- `POST /register`: Register guest account (initiates email verification)
- `POST /login`: Authenticate and receive access + refresh token
- `POST /refresh`: Rotate refresh token
- `POST /logout`: Invalidate refresh token session
- `POST /verify-email`: Verify registration token
- `POST /resend-verification`: Resend verification email
- `POST /forgot-password`: Request password reset token
- `POST /reset-password`: Complete password reset
- `POST /change-password`: Update password while authenticated

#### User & Host Management (`/api/v1/users`, `/api/v1/hosts`)
- `GET /users/me`: Current user profile
- `PATCH /users/me`: Update profile
- `POST /users/me/become-host`: Host onboarding (grants `HOST` role)
- `GET /hosts/{id}`: Public host profile and listings

#### Public Browse & Search (`/api/v1`)
- `GET /search`: Filter listings by city, country, dates, guests, price, amenities, rating, instant book
- `GET /search/suggestions/cities`: Autocomplete city suggestions
- `GET /listings/{id}`: Listing details
- `GET /listings/{id}/calendar`: Dynamic availability calendar
- `GET /listings/{id}/quote`: Pricing breakdown quote for specific dates
- `GET /listings/{id}/reviews`: Published reviews for listing
- `GET /amenities`: Reference amenity catalog

#### Booking Lifecycle (`/api/v1/bookings`, `/api/v1/host/bookings`)
- `POST /bookings`: Step 1 - Hold dates (`PENDING_PAYMENT`, 15-minute hold)
- `POST /bookings/{id}/pay`: Step 2 - Simulate charge via token (`CONFIRMED` or `PENDING_APPROVAL`)
- `GET /bookings/mine`: Guest's reservation history
- `GET /bookings/{id}`: Booking details with dynamic `allowedActions`
- `GET /bookings/{id}/cancellation-preview`: Cancellation refund calculation preview
- `POST /bookings/{id}/cancel`: Guest cancellation with policy-governed refund
- `GET /host/bookings`: Host reservation pipeline
- `POST /host/bookings/{id}/approve`: Host approves booking request
- `POST /host/bookings/{id}/decline`: Host declines request (100% refund)
- `POST /host/bookings/{id}/cancel`: Host cancellation (100% refund, audited)

#### Messaging (`/api/v1/conversations`)
- `POST /conversations`: Start conversation or reuse existing thread
- `GET /conversations`: Inbox list with unread counters
- `GET /conversations/{id}`: Conversation details
- `GET /conversations/{id}/messages`: Cursor-paginated messages
- `POST /conversations/{id}/messages`: Send message (with idempotency)
- `POST /conversations/{id}/read`: Mark messages as read
- `GET /conversations/unread-count`: Unread counter for navigation badges

#### Notifications (`/api/v1/notifications`)
- `GET /notifications`: User notification feed
- `GET /notifications/unread-count`: Total unread count
- `PATCH /notifications/{id}/read`: Mark notification read
- `PATCH /notifications/read-all`: Mark all read

#### Disputes (`/api/v1/disputes`, `/api/v1/support/disputes`)
- `POST /bookings/{id}/disputes`: Raise dispute during or after stay
- `GET /disputes/mine`: User's disputes
- `GET /support/disputes`: Support agent queue
- `GET /support/disputes/{id}`: Full dispute audit dossier (booking, payment, chat logs)
- `PATCH /support/disputes/{id}/assign`: Claim dispute (`UNDER_REVIEW`)
- `POST /support/disputes/{id}/resolve`: Resolve dispute with full/partial/no refund
- `POST /support/disputes/{id}/reject`: Reject dispute claim

#### Admin Control Panel (`/api/v1/admin`)
- `GET /admin/summary`: Platform GMV, revenue, and metrics
- `GET /admin/listings/pending`: Listing approval moderation queue
- `POST /admin/listings/{id}/approve|reject|suspend|reinstate`: Listing lifecycle control
- `GET /admin/users`: User search with wildcard escaping
- `POST /admin/users/{id}/suspend|unsuspend`: User suspension
- `PATCH /admin/users/{id}/roles`: Role management (`SUPPORT_AGENT`, `ADMIN`)
- `GET /admin/audit`: Immutable append-only audit log query

---

## 6. Testing

Run the automated test suite:
```bash
mvn test
```

Includes unit tests for:
- Price breakdown calculations and pricing rules (`SeasonalRateRule`, `WeekendRule`, `LengthOfStayDiscountRule`, `CleaningFeeRule`, `ServiceFeeRule`, `TaxRule`).
- Cancellation refund strategies (`FlexiblePolicy`, `ModeratePolicy`, `StrictPolicy`).
- Availability checking and calendar blocking.
- Monetary utility invariants and validation rules.
