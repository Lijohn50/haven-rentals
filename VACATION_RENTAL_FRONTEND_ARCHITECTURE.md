# Vacation Rental Marketplace: Frontend Architecture (Web App)

> **Companion to `VACATION_RENTAL_BACKEND_ARCHITECTURE.md`.** That document ends by saying the frontend "will be built on the contract in Section 12". This is that frontend document.
> **Design reference:** primarily **Vrbo** (whole-home vacation rentals: search-first landing page, all-in pricing, instant-book vs. request-to-book, clear policies, trip and inbox areas). Secondary inspiration from **Airbnb** (category strip, compact search pill, host listing wizard, calendar UX). Admin and support consoles are **improvised**: neither company exposes them publicly.
> **Brand:** layout and interaction patterns follow Vrbo; colours stay on the **Coastal Teal** palette chosen earlier so the product has its own identity. Logos, badge names and copy are original.

---

## 0. How to read and use this document

1. **Source of truth.** Every network call in this document is taken from the backend architecture document (Sections 7, 8, 11, 12). If a path, field or rule here ever disagrees with the running backend, the backend's OpenAPI (`/v3/api-docs`) wins, and the mismatch is fixed in **one file** (`src/api/endpoints.ts`, Section 4.3).
2. **Nothing invented.** Where Vrbo or Airbnb has a feature the backend does **not** support (wishlists, children/pets counts, map search, guest photos, rewards, Q&A), it is listed in Section 2.4 as intentionally *not built* rather than faked.
3. **Server decides, UI reflects.** The UI never re-implements pricing, refund, availability, permission or state-machine rules. It renders what the API returns (`priceBreakdown`, `allowedActions`, `cancellation-preview`, status enums) and handles the documented error codes.
4. **Items marked ⚠ in Section 2.5** need a one-line confirmation from whoever owns the backend before the related screen is finished.
5. Earlier file `FRONTEND_ARCHITECTURE.md` (Thymeleaf-based, partial) was written against the first code drop and is **superseded** by this document, because the backend is now specified as a pure REST API with no server-rendered HTML.

### Table of contents

1. [Executive summary and decisions](#1-executive-summary-and-decisions)
2. [Backend contract digest](#2-backend-contract-digest)
3. [Technology stack](#3-technology-stack)
4. [Application architecture](#4-application-architecture)
5. [Project structure and backend mapping](#5-project-structure-and-backend-mapping)
6. [Design system](#6-design-system)
7. [Layouts, navigation and role-based access](#7-layouts-navigation-and-role-based-access)
8. [Route inventory](#8-route-inventory)
9. [Landing page (full specification)](#9-landing-page-full-specification)
10. [Public pages: search, listing, host profile, auth](#10-public-pages)
11. [Guest area](#11-guest-area)
12. [Host area](#12-host-area)
13. [Support console and Admin panel](#13-support-console-and-admin-panel)
14. [Cross-cutting behaviour](#14-cross-cutting-behaviour)
15. [Quality: accessibility, performance, SEO, security, testing](#15-quality)
16. [Deployment and CI](#16-deployment-and-ci)
17. [Delivery roadmap](#17-delivery-roadmap)
18. [Endpoint coverage matrix](#18-endpoint-coverage-matrix)
19. [Definition of done](#19-definition-of-done)
20. [Appendices (code)](#20-appendices)

---

## 1. Executive summary and decisions

### 1.1 What is being built

One web application, three audiences, one design system:

| Audience | Roles (backend) | Experience |
|---|---|---|
| Visitors and travellers | anonymous, `GUEST` | Landing page, search, listing pages, checkout, trips, inbox, reviews, disputes |
| Property owners | `HOST` (always also a guest) | Dashboard, listing wizard, calendar and pricing, booking requests, payouts |
| Staff | `SUPPORT_AGENT`, `ADMIN` | Dispute queue; listing moderation, users, commission, amenities, audit, platform summary |

### 1.2 Reference matrix: what is borrowed from where

| Pattern | Source | How it is applied here |
|---|---|---|
| Search-first hero: **Where to? / Dates / Guests**, "search without dates" | Vrbo | Landing hero and the persistent search bar (Section 9, 10.1) |
| Whole-home emphasis: *Sleeps N · bedrooms · bathrooms* | Vrbo | Card and listing summary rows |
| All-in price shown before checkout (nightly, cleaning, service fee, tax) | Vrbo | `priceBreakdown` rendered line by line everywhere a total is shown |
| **Instant Book** vs. **request to book, host answers within 24 h** | Vrbo | Button label and helper text driven by `instantBook` |
| Checkout: trip and contact details, message to host, review rules and policies, then payment | Vrbo | Two-step checkout (Section 11.1) |
| Trips, Inbox, Account as the signed-in core | Vrbo app menu | Header and mobile bottom navigation |
| Filter chips with popovers, "All filters" sheet | Vrbo / Airbnb | Search page (10.1) |
| Property-type icon strip | Airbnb | Landing page and search page |
| Compact search pill that expands when the header is scrolled | Airbnb | Sticky header on search and listing pages |
| 1 large + 4 small photo grid with "Show all photos" | Vrbo / Airbnb | Listing gallery |
| Step-by-step host wizard with progress bar and autosave | Airbnb | Host listing wizard (12.2) |
| Host calendar with drag selection | Airbnb | Host calendar (12.4) |
| Review summary sentence generated by AI | Vrbo (AI review summaries) | `GET /ai/listings/{id}/review-summary`, hidden when unavailable |

### 1.3 Architecture decisions (ADR summary)

| # | Decision | Reason | Rejected |
|---|---|---|---|
| D1 | **Next.js (App Router) + React + TypeScript** as a separate app on port 3000 | The backend is a pure JSON API whose default CORS origin and `APP_FRONTEND_URL` are `http://localhost:3000`. Public pages (landing, search, listing) benefit from server rendering for SEO and first paint, like Vrbo's | Plain Vite SPA: no SEO for listing pages. Thymeleaf: backend no longer serves HTML |
| D2 | **Hybrid rendering:** public pages are server components fetching public endpoints; every authenticated area is client-rendered | Tokens live in the browser, so the server cannot call private endpoints. Public endpoints need no token | SSR for everything (would require cookies, which the API deliberately does not use) |
| D3 | **Browser calls the API directly (CORS)**, server rendering calls it over the internal network | The backend rate-limits per IP and honours forwarded headers; proxying all browsers through Next would make every user share one IP and one rate-limit bucket | Next rewrite proxy |
| D4 | **Access token in memory, refresh token in `localStorage`**, one refresh at a time across all tabs (Web Locks) | The API issues tokens in JSON bodies, not cookies. Rotation with reuse detection means two tabs refreshing at once would log the user out everywhere | Both in `localStorage`; naive per-tab refresh |
| D5 | **TanStack Query for all server state**, URL for filter state, React context only for auth | One cache, predictable invalidation, stale times aligned with backend caches (Section 14.6) | Redux for server data |
| D6 | **One endpoint table and generated types** (`endpoints.ts` + `openapi-typescript`) | The request was "no room for error". A single file maps every URL; generated types catch field drift at compile time | Paths scattered through components |
| D7 | **Accent colour `#C2410C` only on money-moving buttons** (Book now, Request to book, Pay) | Palette rule. Users learn orange = spend money | Accent as decoration |
| D8 | **UI gating is a convenience, not security.** Role guards hide routes; the API enforces roles and ownership | Backend Section 7.5 | Trusting the client |
| D9 | **Light theme only in v1** | Palette is contrast-checked on light surfaces | Dark mode (later: swap tokens) |
| D10 | **English, USD only** | Backend is single-currency | i18n framework |

---

## 2. Backend contract digest

### 2.1 Roles and what each can reach

| Capability | Anonymous | GUEST | HOST | SUPPORT_AGENT | ADMIN |
|---|:-:|:-:|:-:|:-:|:-:|
| Landing, search, listing, host profile, reviews, calendar, quote, amenities | ✔ | ✔ | ✔ | ✔ | ✔ |
| Register, login, reset password | ✔ | | | | |
| Book, pay, trips, cancel, review, dispute, inbox, notifications, account | | ✔ | ✔ | ✔ | ✔ |
| Become host (needs verified email) | | ✔ | | | |
| `/host/**` screens | | | ✔ | | |
| `/support/**` screens | | | | ✔ | ✔ |
| `/admin/**` screens | | | | | ✔ |
| View non-`ACTIVE` listing | | | own only | | ✔ |

A user holds a **set** of roles. Every signed-in user is a `GUEST`. The UI shows the union of what the roles allow. A support agent who is also a host sees both menus.

### 2.2 Global conventions the frontend must honour

| Topic | Backend rule | Frontend consequence |
|---|---|---|
| Base | `/api/v1`, JSON UTF-8, `Authorization: Bearer` | One `api()` client (Appendix B) |
| Access token | 15 min, JWT | Kept in memory; proactive refresh 30 s before expiry; reactive refresh on `401 UNAUTHENTICATED` |
| Refresh | 7 days, **rotating**; replay of an old token = `401 REFRESH_TOKEN_REUSED` and all sessions die | Single-flight refresh across tabs (Appendix C). Never two refreshes in parallel |
| Dates | `LocalDate` `yyyy-MM-dd`; timestamps ISO-8601 UTC | Never `new Date('2026-01-10')` for a calendar date (it is UTC midnight and shifts a day in the Americas). Use a `LocalDate` helper; format times with the **listing's IANA timezone** |
| Check-out | **Exclusive** (nights = `[checkIn, checkOut)`) | Date picker semantics in 10.2.2 |
| Money | JSON number, 2 decimals, USD | Never do arithmetic on money in the browser. Pass `totalAmount` through unchanged as `expectedTotal`. Display with `Intl.NumberFormat` |
| Pagination | `page` 0-based, `size` 1–50 (default 20); `{content,page,size,totalElements,totalPages,hasNext}` | Shared `usePagedQuery`; URL `?page=` is **1-based for humans**, converted at the edge |
| Errors | RFC 7807 with stable `code`, `fieldErrors[]`, `traceId` | Switch on `code`, never on `detail`. Show `traceId` on unexpected errors |
| 404 vs 403 | Wrong role → 403. Not your resource → **404** | Both render a friendly "not found / no access" page; never hint that the resource exists |
| Idempotency | `Idempotency-Key` on `POST /bookings` and `POST /conversations/{id}/messages` | One UUID per attempt, persisted in `sessionStorage` (Appendix D) |
| Rate limits | auth endpoints 10/min/IP, message spam guard, AI limits → `429 RATE_LIMITED` + `Retry-After` | Disable the action and show a countdown. The browser can read `Retry-After` **only if** the backend lists it in `Access-Control-Expose-Headers` (C4); otherwise the UI uses a 60-second default cooldown |
| Unverified email | Login works; booking, listing submit, messaging, become-host → `403 EMAIL_NOT_VERIFIED` | Pre-check `user.emailVerified` and show a verification prompt **before** calling; still handle the 403 |
| Suspended | `403 ACCOUNT_SUSPENDED` on login; live tokens die via `token_version` | On any 401 after refresh failure, send to login; show suspension message when returned |

### 2.3 Response shapes used by the UI

The backend document names the DTOs and lists key fields. The **generated OpenAPI types are authoritative**; the shapes below are what the screens depend on (field names verified against the implemented DTO records in the code drop).

```ts
// Listing card (search results)
SearchResult { id; title; city; country; propertyType; coverPhotoUrl; maxGuests; bedrooms;
  baseNightlyPrice; averageRating; reviewCount; instantBook; amenitiesPreview: AmenityRef[]; // ≤ 4
  totalPrice?: number; nights?: number }                 // only when dates were sent

// Listing page
Listing { id; title; description; propertyType; status; addressLine; city; stateRegion; country; postalCode;
  latitude; longitude; timezone; maxGuests; bedrooms; beds; bathrooms; baseNightlyPrice; weekendMultiplier;
  cleaningFee; weeklyDiscountPercent; monthlyDiscountPercent; minNights; maxNights; advanceNoticeDays;
  bookingWindowDays; checkInTime; checkOutTime; cancellationPolicy; cancellationPolicyDescription;
  instantBook; averageRating; reviewCount; photos: Photo[]; coverPhotoUrl; amenities: AmenityRef[];
  houseRules: {id;text;sortOrder}[]; host: {id;displayName;bio;averageRating;reviewCount}; rejectionReason? }

Quote { listingId; checkIn; checkOut; nights; guests; instantBook; priceBreakdown: PriceBreakdown }
PriceBreakdown { nights: NightLine[]; nightCount; nightlySubtotal; discountLabel?; discountPercent?; discountTotal;
  cleaningFee; serviceFee; taxTotal; totalAmount; accommodationTotal; currency; /* host-only: */ hostCommission; hostPayoutAmount }

Booking { reference; id; status; listing; guest; host; checkIn; checkOut; nights; guests; priceBreakdown; refundAmount;
  cancellationPolicy; cancellationPolicyDescription; checkInDateTime; checkOutDateTime; expiresAt; confirmedAt;
  completedAt; cancelledAt; hostPayoutAmount; instantBook; allowedActions: AllowedAction[]; history: StatusChange[] }
AllowedAction = 'PAY'|'CANCEL'|'APPROVE'|'DECLINE'|'REVIEW'|'MESSAGE'|'OPEN_DISPUTE'
```

> **UI rule:** `hostCommission` and `hostPayoutAmount` exist in the same payload but are **never rendered in guest views**.

### 2.4 Intentionally not built (not in the backend contract)

| Vrbo / Airbnb feature | Why it is absent | Honest fallback |
|---|---|---|
| Saved properties / Trip boards / wishlist hearts | Backend §1.2 lists wishlists as out of scope | None. No heart icons anywhere |
| Children, infants, pets counts | API has one `guests` number | Single "Guests" stepper; pets only via the "Pets allowed" amenity filter |
| Search on a map | Search results carry no coordinates | List view only; a map appears on the listing page |
| Card image carousels in results | Results carry only `coverPhotoUrl` | Single cover image |
| Rewards, member prices, coupons | No such module | Not shown |
| Guest photos, host Q&A, "Loved by Guests" badge | No data | A derived "Top rated" label (config thresholds) |
| Category rating bars (cleanliness etc.) on a listing | Only per-review ratings are returned, not aggregates | Overall rating plus review list |
| Change dates of an existing booking | Out of scope (§1.2) | "Cancel and rebook" guidance |
| Real-time chat | WebSockets out of scope | Polling (14.5) |
| Multi-currency, languages | Out of scope | USD, English |
| Card entry form | API accepts a **token only** and rejects card-like numbers | Provider-hosted field in production; test-token picker in dev (11.1.3) |

### 2.5 ⚠ Confirmations needed from the backend (one line each)

| # | Question | Frontend assumption until answered | Affects |
|---|---|---|---|
| C1 | What are the link formats in the verification and reset-password emails? | `{APP_FRONTEND_URL}/verify-email?token=…` and `/reset-password?token=…` | Auth pages |
| C2 | What `link` does each `NotificationType` carry? (Only `/trips/BK-…` is documented) | Resolver table in 11.6 with fallback to `/notifications` | Bell, notifications |
| C3 | How does a **host** open the conversation for a booking? (`POST /conversations` is guest-initiated; `BookingResponse` has no `conversationId`) | Host sees conversations the guest started; "Message guest" opens the inbox filtered by listing. **Recommend** adding `conversationId` to `BookingResponse` | Host booking detail |
| C4 | The documented CORS config exposes only `Location`. Can `Retry-After` and `Date` be added to `Access-Control-Expose-Headers`? | Without them: rate-limit cooldowns default to 60 s, and the hold countdown uses the browser clock (a `BOOKING_EXPIRED` response is always handled) | Rate-limit UX, checkout timer |
| C5 | Does the public `GET /listings/{id}` return **exact** coordinates and street address? | Map shows an approximate circle; street address hidden until booking confirmed. Backend should round coordinates for public callers | Listing map |
| C6 | Admin gaps: no listing search for admins (only the pending queue and by-id), and `GET /amenities` returns only active amenities | Admin finds listings via the queue, an "open by ID" box, and an admin action bar on the public page. Recommend `GET /admin/listings?status=&query=` and `GET /admin/amenities` | Admin |
| C7 | Is `SearchResult.totalPrice` equal to `priceBreakdown.totalAmount` (taxes and fees included)? | Yes; label "total" and "includes taxes and fees" | Result cards |
| C8 | Minimum `prefix` length for city suggestions | 2 characters (city search minimum) | Autocomplete |
| C9 | Production payment: which provider produces `paymentToken`? | `PaymentMethodField` abstraction with a fake implementation (11.1.3) | Checkout |
| C10 | Refresh token in `localStorage` is an XSS-sensitive choice | Accepted with strict CSP (15.4). Safer option needs backend `httpOnly` cookie support | Security |
| C11 | `BookingResponse.listing` has no `timezone` (the listing's `checkInTime` is also absent). Times must be shown in the listing's zone | Try the public listing endpoint; if it returns 404 (paused or suspended listing) show dates only. **Recommend** adding `timezone` and `checkInTime` to the booking's listing reference | Trip and booking detail |
| C12 | How does an admin reassign a dispute? (`PATCH /support/disputes/{id}/assign` is documented as "takes the dispute"; no body is specified) | Agents and admins can only assign to themselves | Support console |
| C13 | Semantics of `PATCH /admin/users/{id}/roles`: does `roles` replace the whole set or only the grantable roles (`SUPPORT_AGENT`, `ADMIN`)? | UI sends only the grantable roles and never `GUEST` or `HOST` | Admin users |

### 2.6 Where the earlier code drop differs from the backend document

The architecture document is the target. These differences were found in the earlier code archive (`finalProjectDemo.zip`). The frontend follows the **document**; all of them are absorbed by `endpoints.ts`, but the backend should be brought in line.

| Capability | Document (frontend uses) | Code archive had |
|---|---|---|
| Current user | `GET /users/me` | `GET /auth/me` |
| Become host | `POST /users/me/become-host` | service method existed, **no endpoint** |
| Host listings | `/host/listings`, `/host/listings/{id}` … | `/listings`, `/listings/mine`, `/listings/{id}/…` |
| Quote | `GET /listings/{id}/quote` | `GET /listings/{id}/price/quote` |
| Calendar | `GET /listings/{id}/calendar` | `GET /listings/{id}/availability/calendar` |
| Blocks | `/host/listings/{id}/blocks` | `/listings/{id}/availability/blocks` |
| Host bookings | `/host/bookings`, `/host/bookings/{id}/approve…` | `/bookings/host`, `/bookings/{id}/approve…` |
| Review removal | `DELETE /admin/reviews/{id}` | `DELETE /reviews/{id}` |
| Photo URLs | `/media/listings/{listingId}/{filename}` | `/media/{storageKey}` |
| Amenities | `GET /amenities` (public) | whitelisted but **no controller** |
| Seasonal rates, commission, amenity admin | endpoints specified | not implemented |
| Conversation read | `POST /conversations/{id}/read` | not present |
| Anonymous access | `/search`, quote, calendar, review summary are public | public-path patterns did not match several of these paths, so anonymous calls would return 401 |
| Database | PostgreSQL 16 | MySQL |

---

## 3. Technology stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js** (App Router, current stable major), **React 19**, **TypeScript** (strict) | Hybrid rendering (D1, D2) |
| Styling | **Tailwind CSS v4** with design tokens as CSS variables | Tokens map straight from the palette; no runtime CSS-in-JS |
| Components | **Radix UI** primitives wrapped in an in-repo `ui/` kit (shadcn-style, owned code) | Accessible dialog, popover, tabs, dropdown, toast, accordion |
| Server state | **TanStack Query v5** | Cache, retries, invalidation, polling |
| Forms | **react-hook-form** + **zod** | Schemas mirror backend validation (11.x tables) |
| Date range picker | **react-day-picker v9** (range mode, custom disabled matchers) | Needed for check-out-exclusive logic |
| Date maths | **date-fns** + in-repo `LocalDate` helpers | No timezone drift |
| Charts | **Recharts** (lazy-loaded) | Host and admin dashboards |
| Map | **Leaflet** + OpenStreetMap tiles (listing page, host location picker) | No API key; coordinates exist on the listing |
| Icons | **lucide-react** | Amenity icon mapping in 6.7 |
| Drag and drop | **@dnd-kit** | Photo reordering |
| Fonts | **Inter** (body), **Poppins 600** (headings) via `next/font` (self-hosted) | Palette document |
| API types | **openapi-typescript** from `/v3/api-docs` | Compile-time contract |
| Tests | **Vitest**, **Testing Library**, **MSW**, **Playwright**, **axe-core**, **Lighthouse CI** | Section 15.6 |
| Lint/format | ESLint (+ jsx-a11y), Prettier, TypeScript strict, `eslint-plugin-no-secrets` | CI gate |
| Package manager | pnpm | Reproducible installs |

**Browser support:** last two versions of Chrome, Edge, Firefox, Safari; iOS Safari 15.4+ (Web Locks API). Minimum viewport 360 px.


---

## 4. Application architecture

### 4.1 Layers

```
Browser
  │
  ├─ Server-rendered public pages (Next server components)       ← anonymous, SEO, no token
  │     fetch(API_INTERNAL_URL + public endpoint, { next:{ revalidate } })
  │
  └─ Client islands and all authenticated areas (client components)
        Route guard ─► Feature screen ─► Feature hook (TanStack Query) ─► api() client ─► REST API
                                                         │                     │
                                                         │                     ├─ token manager (memory + localStorage + Web Locks)
                                                         │                     └─ ApiError (ProblemDetail)
                                                         └─ cache, invalidation, polling
```

| Layer | Responsibility | Must never |
|---|---|---|
| `app/` route files | Thin: pick layout, guard, render one feature screen, set metadata | Contain logic or fetch directly |
| `features/*/components` | Screens and widgets for one backend module | Import another feature's internals (use its public `index.ts`) |
| `features/*/api.ts` | Query/mutation hooks, query keys, cache invalidation | Contain JSX |
| `api/` | HTTP client, endpoints table, error type, token manager, generated types | Know about React |
| `components/ui` | Design-system primitives | Know about the backend |
| `lib/` | Pure helpers: money, dates, status maps, amenity icons | Perform I/O |

### 4.2 Rendering strategy per page type

| Page | Rendering | Data | Revalidate |
|---|---|---|---|
| Landing `/` | Server component, static with ISR | `GET /search` (several curated calls), `GET /amenities` | 60 s |
| Search `/search` | Server renders the first page; client hydrates and takes over (HydrationBoundary) | `GET /search` | 30 s (backend cache is 30 s) |
| Listing `/listings/[id]` | Server component with metadata + JSON-LD; client islands for booking card, calendar, messaging, admin bar | `GET /listings/{id}`, reviews, review summary | 60 s (backend cache is 60 s) |
| Host profile `/hosts/[id]` | Server component | `GET /hosts/{id}` | 300 s |
| Auth pages, static pages | Server components with small client forms | none | static |
| Everything under `/trips`, `/inbox`, `/account`, `/host`, `/support`, `/admin`, `/checkout` | **Client only** behind a guard | private endpoints | none (`noindex`) |

**Owner/admin preview problem.** `GET /listings/{id}` returns 404 to anonymous callers for any listing that is not `ACTIVE`, but owners and admins may see it. The server render (anonymous) will therefore 404 for a draft. The listing route handles this: when the server fetch is a 404 it renders a small **client fallback** that retries the same endpoint **with the user's token**; only if that also fails does it show Not Found. This is what makes "Preview" in the host area and the admin review link work.

### 4.3 The API layer: one table, one client

`src/api/endpoints.ts` is the **only** place that contains URL strings. Components import functions, never paths.

```ts
// src/api/endpoints.ts  (excerpt; the full table is in Section 18)
export const ep = {
  auth:   { register: '/auth/register', login: '/auth/login', refresh: '/auth/refresh', logout: '/auth/logout',
            verifyEmail: '/auth/verify-email', resendVerification: '/auth/resend-verification',
            forgotPassword: '/auth/forgot-password', resetPassword: '/auth/reset-password',
            changePassword: '/auth/change-password' },
  me:     { get: '/users/me', patch: '/users/me', remove: '/users/me', becomeHost: '/users/me/become-host' },
  host:   (id: number) => `/hosts/${id}`,
  search: { list: '/search', cities: '/search/suggestions/cities' },
  listing:{ get: (id: number) => `/listings/${id}`, calendar: (id: number) => `/listings/${id}/calendar`,
            quote: (id: number) => `/listings/${id}/quote`, reviews: (id: number) => `/listings/${id}/reviews`,
            aiSummary: (id: number) => `/ai/listings/${id}/review-summary` },
  amenities: '/amenities',
  bookings: { create: '/bookings', mine: '/bookings/mine', get: (id: number) => `/bookings/${id}`,
              byRef: (ref: string) => `/bookings/reference/${encodeURIComponent(ref)}`,
              pay: (id: number) => `/bookings/${id}/pay`, cancelPreview: (id: number) => `/bookings/${id}/cancellation-preview`,
              cancel: (id: number) => `/bookings/${id}/cancel`, payment: (id: number) => `/bookings/${id}/payment` },
  // … host, support, admin, messaging, notifications, reviews, disputes, dashboard, ai
} as const;
```

**Contract safety net (five independent checks):**

1. **Generated types** (`pnpm api:types`) fail the TypeScript build when a field is renamed or removed.
2. **Contract snapshot test:** CI downloads `/v3/api-docs` from the docker-compose backend and diffs it with the committed snapshot; any removed path or required field fails the build.
3. **Runtime guards** (zod) on the five most dangerous responses (login, quote, booking, payment, dashboard) in development and test; in production a failed parse logs to the error reporter and continues.
4. **MSW handlers** generated from the same schema keep unit tests honest.
5. **Playwright e2e** runs the real flows against `docker compose up` with the seed data (Section 15.6).

### 4.4 Authentication and token management

State machine:

```
anonymous ──login/register──► authenticated(user, roles)
authenticated ──401 UNAUTHENTICATED──► refresh (single-flight, cross-tab lock)
   refresh ok ──► retry the original request once
   refresh 401 / REFRESH_TOKEN_REUSED ──► clear tokens ─► toast "Please sign in again" ─► /login?next=…
logout ──► POST /auth/logout ─► clear storage ─► clear query cache ─► BroadcastChannel('auth') tells other tabs
```

| Rule | Detail |
|---|---|
| Storage | Access token: module variable only. Refresh token: `localStorage['rt.v1']` |
| Bootstrap | On app start, if a refresh token exists: refresh, then `GET /users/me`. Guards show a skeleton, never a flash of the login page |
| Proactive refresh | If the access token expires in less than 30 s, refresh **before** the call |
| Cross-tab | `navigator.locks.request('auth-refresh', …)`; the refresh token is read **inside** the lock because another tab may have rotated it while this one waited (Appendix C) |
| Failure handling | Only a `401` from `/auth/refresh` clears tokens. A network error or `5xx` keeps them and retries later |
| Logout everywhere | Password change or reset invalidates all sessions server-side; the next refresh fails and the user is sent to login with an explanation |
| Role refresh | After `become-host` or an admin role change, refetch `/users/me`. Roles come from the stored user, not the token, so no re-login is needed |

### 4.5 Error handling

`ApiError { status, code, detail, fieldErrors, traceId, retryAfter?, body }` is thrown for every non-2xx response. Handling is layered:

1. **Field errors** (`VALIDATION_ERROR`): mapped to the matching form field with `setError`; unmatched ones go in a form-level alert.
2. **Known business codes**: handled by the screen that triggers them (matrix in 14.1).
3. **Global fallbacks** (toast or full-page): `UNAUTHENTICATED` (refresh flow), `RATE_LIMITED` (countdown), `SERVICE_UNAVAILABLE` / `AI_UNAVAILABLE` (degrade the one widget), `INTERNAL_ERROR` (generic message with `traceId`).
4. **Error boundaries** per route group, so a crash in the admin audit table never takes down the header.

### 4.6 Data fetching rules

* Every query key starts with the backend module: `['search', params]`, `['listing', id]`, `['booking', ref]`, `['trips']`, `['conversations']`, …
* **Prices and availability are never trusted from cache.** `quote` and `calendar` use `staleTime: 0` on checkout and booking-card interactions; the backend explicitly excludes them from caching.
* Mutations invalidate by module (table in 14.6) and never patch cached money values by hand.
* Retries: queries retry twice with backoff on network errors and 5xx only; **never** on 4xx. Mutations never auto-retry.
* Lists keep previous data while the next page loads (`placeholderData: keepPreviousData`).

### 4.7 Forms and validation

Each form has a zod schema in `features/<module>/schemas.ts` that **mirrors the backend rule** (tables in later sections). Client validation exists to give instant feedback; the server remains the authority, so every form also renders `fieldErrors` returned by the API. All strings are trimmed before submit. Money inputs accept at most 2 decimals and reject, never round (same as the backend).

### 4.8 URL as state

Search filters, page, sort and tab selections live in the URL so links are shareable and the back button works, as on Vrbo (`/search?destination=…&startDate=…`). **Parameter names equal the backend's** (`city, country, checkIn, checkOut, guests, minPrice, maxPrice, amenityIds, propertyType, minBedrooms, minRating, instantBook, sort, page, size`), so the URL passes straight through with no translation layer.

### 4.9 Environment configuration

| Variable | Used by | Example |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Browser | `http://localhost:8080/api/v1` |
| `API_INTERNAL_URL` | Server rendering (Docker network) | `http://app:8080/api/v1` |
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs, sitemap, Open Graph | `http://localhost:3000` |
| `NEXT_PUBLIC_PAYMENT_MODE` | Checkout | `fake` (dev/demo) or `provider` |
| `NEXT_PUBLIC_MAP_TILE_URL` | Leaflet | OSM tile template |

Backend side: `APP_CORS_ORIGINS` and `APP_FRONTEND_URL` must equal the frontend origin. Allowed request headers on the backend are `Authorization`, `Content-Type`, `Idempotency-Key`; the client sends nothing else.

---

## 5. Project structure and backend mapping

```
frontend/
├─ app/                              Next.js routes (thin)
│  ├─ (public)/                      /, /search, /listings/[id], /hosts/[id], static pages
│  ├─ (auth)/                        /login, /register, /verify-email, /forgot-password, /reset-password
│  ├─ (account)/                     guard: signed in      → /trips, /inbox, /account, /checkout, /reviews …
│  ├─ (host)/host/                   guard: role HOST      → dashboard, listings, bookings, payouts
│  ├─ (support)/support/             guard: SUPPORT_AGENT or ADMIN
│  ├─ (admin)/admin/                 guard: ADMIN
│  ├─ layout.tsx, not-found.tsx, error.tsx, forbidden/page.tsx
│  └─ sitemap.ts, robots.ts
├─ src/
│  ├─ api/            client.ts · endpoints.ts · errors.ts · tokens.ts · server.ts · schema.d.ts (generated)
│  ├─ features/       auth · account · listings · search · availability · pricing · booking · payments
│  │                  reviews · messaging · notifications · disputes · host · support · admin · ai
│  ├─ components/
│  │  ├─ ui/          Button, Input, Select, Dialog, Popover, Tabs, Badge, Toast, Skeleton, Tooltip …
│  │  ├─ layout/      SiteHeader, HostShell, StaffShell, MobileTabBar, Footer, Banner
│  │  └─ patterns/    ListingCard, PriceBreakdown, StatusBadge, RatingStars, PhotoGallery, DateRangePicker,
│  │                  GuestStepper, AmenityIcon, EmptyState, ErrorState, DataTable, Pagination, Countdown
│  ├─ lib/            money.ts · local-date.ts · status.ts · amenity-icons.ts · cancellation.ts · seo.ts · idempotency.ts
│  ├─ styles/         tokens.css · globals.css
│  └─ test/           msw handlers, fixtures, a11y helpers
├─ public/            images (hero, destinations), favicon, robots
├─ e2e/               Playwright specs
├─ Dockerfile · next.config.ts · .env.example
```

### 5.1 Backend module → frontend feature

| Backend module | Frontend feature | Screens |
|---|---|---|
| `auth` | `features/auth` | login, register, verify, forgot/reset password, session bootstrap |
| `user` | `features/account` | profile, security, become host, delete account, public host profile |
| `listing` | `features/listings` (+ `host/listing-wizard`) | listing page, host listings, wizard, photos, amenities, house rules |
| `availability` | `features/availability` | date picker data, host calendar and blocks |
| `pricing` | `features/pricing` | quote widget, price breakdown, seasonal rates, commission (admin) |
| `search` | `features/search` | search page, autocomplete, filters |
| `booking` | `features/booking` | checkout, trips, trip detail, host bookings |
| `payment` | `features/payments` | payment receipt, refunds list, host payouts |
| `review` | `features/reviews` | review list, review form, pending reviews, admin removal |
| `messaging` | `features/messaging` | inbox, thread, "contact host" |
| `notification` | `features/notifications` | bell, page, link resolver |
| `dispute` | `features/disputes` | open dispute, my disputes, support queue and detail |
| `admin` | `features/admin` | summary, moderation, users, audit, amenities, commission |
| `dashboard` | `features/host` | host dashboard, trips grouping |
| `ai` | `features/ai` | listing description draft, review summary, trip plan |
| `scheduler` | none | effects are visible only as status changes (EXPIRED, COMPLETED, PAID) |

---

## 6. Design system

### 6.1 Principles (Vrbo-like, calm, photo-led)

1. **Photography leads.** Large images, generous white space, minimal chrome.
2. **Price clarity.** Total first, breakdown one click away, never a surprise at checkout.
3. **One primary action per view.** Teal for navigation and primary buttons; orange only where money moves.
4. **Flat and bordered.** 1 px borders, at most a very light shadow, matching the palette guidance.
5. **State is colour plus text.** A status is never conveyed by colour alone.

### 6.2 Colour tokens (Palette 1: Coastal Teal)

All values pass WCAG AA (4.5:1) for normal text where used as stated. 60/30/10: ~60% neutrals, ~30% primary, ~10% accent.

| Token | Hex | Use |
|---|---|---|
| `--color-primary` | `#0F766E` | Header accents, links, primary buttons, selected states |
| `--color-primary-dark` | `#115E59` | Hover, footer |
| `--color-accent` | `#C2410C` | **Book now, Request to book, Pay** only |
| `--color-accent-dark` | `#9A3412` | Accent hover |
| `--color-bg` | `#F8FAFC` | Page background |
| `--color-surface` | `#FFFFFF` | Cards, forms, modals |
| `--color-text` | `#0F172A` | Headings and body |
| `--color-muted` | `#475569` | Captions, labels |
| `--color-border` | `#E2E8F0` | Dividers, input borders |
| `--color-highlight` | `#CCFBF1` | Selected dates (range middle), soft badges. **Dark text only** |

Status pairs (dark text on soft background for badges; solid colours for strong buttons and alerts):

| Meaning | Text | Soft bg | Solid |
|---|---|---|---|
| Success | `#166534` | `#DCFCE7` | `#15803D` |
| Warning | `#92400E` | `#FEF3C7` | `#B45309` |
| Danger | `#991B1B` | `#FEE2E2` | `#B91C1C` |
| Info | `#1E40AF` | `#DBEAFE` | `#1D4ED8` |
| Neutral | `#334155` | `#E2E8F0` | `#475569` |

Rules: white text on primary and accent buttons only; **never** white text on highlight or soft backgrounds; red only for errors and destructive actions (cancel, delete, suspend, decline); selected calendar dates use solid primary with white text, the range between them uses highlight with dark text.

### 6.3 Typography, spacing, shape

| Item | Value |
|---|---|
| Headings | Poppins 600; H1 `clamp(2rem, 4vw, 3rem)`, H2 `1.75rem`, H3 `1.25rem` |
| Body | Inter 400/500, 16 px base, line-height 1.55 |
| Numbers (prices) | Inter 600 with `tabular-nums` |
| Spacing scale | 4 px base: 4, 8, 12, 16, 24, 32, 48, 64, 96 |
| Radius | inputs and buttons 8 px, cards 12 px, hero search bar 16 px, avatars/pills full |
| Breakpoints | `sm 640`, `md 768`, `lg 1024`, `xl 1280`; content max-width 1200 px (search/listing), 1040 px (account), full-width tables in host/staff |
| Touch targets | ≥ 44 × 44 px |

### 6.4 Component inventory

| Group | Components |
|---|---|
| Primitives | Button (primary, secondary, accent, destructive, ghost, link), IconButton, Input, Textarea, Select, Checkbox, Radio, Switch, Stepper, Slider (price range), Badge, Avatar, Tooltip, Skeleton, Spinner, Toast, Banner (info/warn/error), Alert |
| Overlays | Dialog, Drawer/Sheet (mobile filters, mobile booking), Popover, DropdownMenu, Lightbox |
| Navigation | Tabs, Breadcrumbs, Pagination, Sidebar, MobileTabBar, Stepper (wizard), AnchorNav |
| Data | DataTable (sort, filter, sticky header, row actions, empty/error/loading), StatCard, Chart wrappers, Timeline (status history), DescriptionList |
| Domain patterns | ListingCard, ListingCardSkeleton, PhotoGallery, DateRangePicker, GuestStepper, PriceBreakdown, StatusBadge, RatingSummary, ReviewCard, AmenityIcon, HostCard, Countdown, ConversationList, MessageBubble, NotificationItem, PolicyCard, PhotoUploader |

### 6.5 Status badges (single source: `lib/status.ts`)

Every enum value is mapped to a label, tone and optional explanatory tooltip. Unknown values (forward compatibility) fall back to Neutral with the raw value.

| Enum | Value → tone |
|---|---|
| Booking | `CONFIRMED` success · `PENDING_PAYMENT` warning · `PENDING_APPROVAL` warning · `COMPLETED` neutral · `DECLINED` danger · `EXPIRED` neutral · `PAYMENT_FAILED` danger · `CANCELLED_BY_GUEST` danger · `CANCELLED_BY_HOST` danger |
| Listing | `ACTIVE` success · `PENDING_REVIEW` warning · `DRAFT` neutral · `PAUSED` neutral · `REJECTED` danger · `SUSPENDED` danger · `DELETED` neutral |
| Payment | `SUCCEEDED` success · `PENDING` warning · `FAILED` danger · `PARTIALLY_REFUNDED` info · `REFUNDED` neutral |
| Refund | `SUCCEEDED` success · `PENDING` warning · `FAILED` danger |
| Payout | `PAID` success · `SCHEDULED` info · `HELD` warning · `CANCELLED` neutral |
| Dispute | `OPEN` warning · `UNDER_REVIEW` info · `RESOLVED` success · `REJECTED` neutral |
| Review | `PUBLISHED` success · `HIDDEN` neutral · `REMOVED` danger |
| User | `ACTIVE` success · `SUSPENDED` danger · `DELETED` neutral |

Copy differs by viewer where it matters: `PENDING_APPROVAL` reads "Waiting for host" to the guest and "Needs your response" to the host.

### 6.6 Imagery

* Listing photos come from the API with **no size variants** (originals up to 8000 px). All listing images render through `next/image`, which resizes and converts to WebP/AVIF on the server and caches the result; `sizes` is set per layout. `remotePatterns` allows the API origin.
* Image URLs from the API may be relative; `mediaUrl()` prefixes the API origin when needed.
* Marketing images (hero, destination tiles, property types) are self-hosted in `/public/images`, exported at 3 widths in AVIF and WebP, with a blur placeholder. Use images with a licence that permits commercial use.
* Every `<img>` has meaningful `alt` (listing title plus "photo N"); decorative images use `alt=""`.

### 6.7 Amenity icons

The backend stores a free-text `icon` key per amenity (nullable). `lib/amenity-icons.ts` maps keys to lucide icons and **always has a fallback** (generic check icon), so a new amenity added by an admin never breaks the UI.

| Key examples | Icon intent |
|---|---|
| `wifi`, `kitchen`, `snowflake` (A/C), `thermometer` (heating) | Wi-Fi, utensils, snowflake, thermometer |
| `washing-machine`, `dryer`, `tv`, `desk` | washer, dryer, TV, workspace |
| `parking`, `pool`, `hot-tub`, `bbq`, `balcony`, `beach` | car, waves, hot tub, flame, balcony, umbrella |
| `smoke-alarm`, `co-alarm`, `first-aid`, `fire-extinguisher` | shield / alarm / plus-cross / extinguisher |
| `paw`, `crib`, `dumbbell`, `elevator`, `hair-dryer`, `iron`, `key` | paw, baby, dumbbell, elevator, wind, shirt, key |

(Exact lucide names are verified when implementing; the mapping is data, not logic.)

### 6.8 Motion and accessibility defaults

Transitions 150–200 ms, only on opacity/transform; `prefers-reduced-motion` disables them. Visible 2 px focus ring (`primary`, offset 2 px) on every interactive element. Skip link as the first focusable element. All interactive overlays trap focus and restore it on close.


---

## 7. Layouts, navigation and role-based access

### 7.1 Three shells

| Shell | Used by | Structure |
|---|---|---|
| **Public/Guest shell** | `/`, `/search`, `/listings/*`, `/hosts/*`, auth pages, `/trips`, `/inbox`, `/account`, `/checkout` | Top header, content, footer. Mobile: header plus bottom tab bar for signed-in users |
| **Host shell** | `/host/**` | Left sidebar (collapses to a drawer on mobile), top bar with listing switcher and notifications |
| **Staff shell** | `/support/**`, `/admin/**` | Left sidebar with role-filtered sections, dense tables, top bar with global booking/listing lookup |

### 7.2 Header (Vrbo-style)

**Anonymous:** logo · *List your property* · *Help* · **Sign in** · **Register**.

**Signed in (guest):** logo · compact search pill (on search/listing pages) · *List your property* (or *Host dashboard* once a host) · **Trips** · **Inbox** (unread badge from `GET /conversations/unread-count`) · **Bell** (badge from `GET /notifications/unread-count`) · **Avatar menu**.

**Avatar menu** (sections appear by role):

| Section | Items | Shown when |
|---|---|---|
| Account | Profile, Security, My disputes, Reviews to write | always |
| Hosting | Host dashboard, My listings, Bookings, Payouts | role `HOST` |
| Become a host | "List your property" | signed in, not a host |
| Support | Dispute queue | `SUPPORT_AGENT` or `ADMIN` |
| Admin | Platform summary, Moderation, Users, Commission, Amenities, Audit | `ADMIN` |
| | Sign out | always |

**Compact search pill (from Airbnb).** On `/search` and `/listings/*` the header shows a single pill ("Lyon · Oct 3–6 · 2 guests"). Clicking it expands the full search bar in a popover/sheet.

### 7.3 Mobile navigation

* Anonymous: hamburger → Search, List your property, Help, Sign in/Register.
* Signed in: **bottom tab bar** with Search · Trips · Inbox (badge) · Account (as in the Vrbo app menu). Hosts get a fifth item, **Host**.
* The booking card on the listing page becomes a **sticky bottom bar** (price + "Check availability"), opening a sheet.

### 7.4 Host sidebar

Overview · Listings · Bookings (badge = `pendingRequests`) · Calendar (listing picker) · Payouts · Messages (→ shared inbox) · Reviews · *Back to travelling* (→ `/`).

### 7.5 Staff sidebar

| Section | Items | Role |
|---|---|---|
| Support | Dispute queue | SUPPORT_AGENT, ADMIN |
| Platform | Summary, Moderation queue, Users, Booking lookup, Listing lookup | ADMIN |
| Configuration | Commission, Amenities | ADMIN |
| Compliance | Audit log | ADMIN |

A support agent without `ADMIN` only ever sees the Support item; admin routes redirect them to the no-access page.

### 7.6 Route guards

Guards live in route-group layouts and are **UX only** (the API enforces everything).

```ts
type Gate = { auth?: true; anyRole?: Role[] };
// (account)  → { auth: true }
// (host)     → { auth: true, anyRole: ['HOST'] }
// (support)  → { auth: true, anyRole: ['SUPPORT_AGENT','ADMIN'] }
// (admin)    → { auth: true, anyRole: ['ADMIN'] }
```

| Situation | Behaviour |
|---|---|
| Session still bootstrapping | Skeleton, no redirect |
| Not signed in | `/login?next=<current path>` |
| Signed in, missing role | Forbidden page ("You don't have access to this area") with a link home. A non-host opening `/host/**` gets the *Become a host* call to action instead |
| API returns 403 after passing the guard | Same Forbidden page (roles may have changed server-side) |
| API returns 404 for an id | Not Found page, identical for "missing" and "not yours" |
| Suspended user | `ACCOUNT_SUSPENDED` message on login; mid-session token death sends to login |
| Email not verified | Persistent banner on all signed-in pages with *Resend email*; actions that need verification open a prompt first |

`/become-host` is reachable by any signed-in user (it is outside `/host/**` precisely because the backend's `/host/**` rule requires the `HOST` role).

---

## 8. Route inventory

Access legend: **P** public · **A** signed in · **H** host · **S** support/admin · **AD** admin. All non-public routes are `noindex`.

| Route | Access | Screen | Main endpoints |
|---|---|---|---|
| `/` | P | Landing page (Section 9) | `GET /search`, `GET /amenities`, `GET /search/suggestions/cities` |
| `/search` | P | Results (10.1) | `GET /search`, `GET /amenities` |
| `/listings/[id]` | P | Listing page (10.2) | `GET /listings/{id}`, `/calendar`, `/quote`, `/reviews`, `/ai/listings/{id}/review-summary` |
| `/hosts/[id]` | P | Host profile (10.3) | `GET /hosts/{id}` |
| `/login`, `/register` | P | Auth (10.4) | `POST /auth/login`, `/auth/register` |
| `/verify-email` | P | Verification (10.4) | `POST /auth/verify-email` |
| `/forgot-password`, `/reset-password` | P | Password reset (10.4) | `POST /auth/forgot-password`, `/auth/reset-password` |
| `/help`, `/how-it-works`, `/cancellation-policies`, `/terms`, `/privacy` | P | Static content (10.5) | none |
| `/checkout/[listingId]` | A | Checkout step 1 (11.1) | `GET quote`, `POST /bookings` |
| `/trips` | A | My trips (11.2) | `GET /dashboard/trips`, `GET /reviews/pending` |
| `/trips/[reference]` | A | Trip detail (11.3) | `GET /bookings/reference/{ref}`, `/payment`, `/cancellation-preview`, `POST /cancel`, `/ai/trip-plan` |
| `/trips/[reference]/pay` | A | Checkout step 2 / complete payment | `POST /bookings/{id}/pay` |
| `/trips/[reference]/review` | A | Write review (11.4) | `POST /bookings/{id}/reviews` |
| `/trips/[reference]/dispute` | A | Open dispute (11.7) | `POST /bookings/{id}/disputes` |
| `/reviews` | A | Reviews to write | `GET /reviews/pending` |
| `/inbox`, `/inbox/[conversationId]` | A | Messaging (11.5) | `/conversations/**` |
| `/notifications` | A | Notification list (11.6) | `/notifications/**` |
| `/account` | A | Profile (11.8) | `GET/PATCH /users/me` |
| `/account/security` | A | Password, delete account | `POST /auth/change-password`, `DELETE /users/me` |
| `/account/disputes` | A | My disputes | `GET /disputes/mine` |
| `/become-host` | A | Host onboarding (12.1) | `POST /users/me/become-host` |
| `/host` | H | Dashboard (12.3) | `GET /host/dashboard`, `/host/payouts/summary` |
| `/host/listings` | H | My listings | `GET /host/listings` |
| `/host/listings/new` | H | Wizard (12.2) | `POST /host/listings`, `PUT amenities`, `PUT house-rules`, photos, `POST submit` |
| `/host/listings/[id]` | H | Listing hub: Details, Photos, Amenities, Rules, Pricing, Calendar, Reviews (12.4) | `/host/listings/{id}/**`, `/seasonal-rates`, `/blocks` |
| `/host/bookings`, `/host/bookings/[id]` | H | Requests and reservations (12.5) | `GET /host/bookings`, `GET /bookings/{id}`, `POST approve/decline/cancel` |
| `/host/payouts` | H | Payouts (12.6) | `GET /host/payouts`, `/summary` |
| `/support`, `/support/disputes`, `/support/disputes/[id]` | S | Queue and case (13.1) | `/support/disputes/**` |
| `/admin` | AD | Platform summary (13.2) | `GET /admin/summary` |
| `/admin/listings`, `/admin/listings/[id]` | AD | Moderation (13.3) | `/admin/listings/**` |
| `/admin/users`, `/admin/users/[id]` | AD | Users (13.4) | `/admin/users/**` |
| `/admin/bookings`, `/admin/bookings/[id]` | AD | Booking lookup (13.5) | `GET /admin/bookings/{id}`, `GET /bookings/reference/{ref}` |
| `/admin/commission` | AD | Fees (13.6) | `/admin/commission-settings` |
| `/admin/amenities` | AD | Amenity catalogue (13.7) | `/admin/amenities/**`, `GET /amenities` |
| `/admin/audit` | AD | Audit log (13.8) | `GET /admin/audit` |
| `/forbidden`, `not-found`, `error` | P | Error pages | none |

---

## 9. Landing page (full specification)

**Goal:** within five seconds a visitor understands *what this is* (whole-home vacation rentals), *can start searching* (destination, dates, guests), and *trusts it* (clear prices, secure payment, real reviews). The page is the highest-traffic, most SEO-sensitive screen, so it is server-rendered, fast and built only from data the API actually provides.

### 9.1 Page map

```
┌──────────────────────────────────────────────────────────────────────────┐
│ HEADER  logo · List your property · Help · Sign in · Register           │
├──────────────────────────────────────────────────────────────────────────┤
│ 1. HERO (full-bleed photo, dark gradient for legibility)                │
│    H1  Find a whole home for your next trip                             │
│    sub Private homes, clear prices, secure payment.                     │
│    ┌─────────────────────────────────────────────────────────────┐      │
│    │ Where to?        │ Check-in – Check-out │ Guests    │ Search │      │
│    └─────────────────────────────────────────────────────────────┘      │
│    link: Search without dates                                           │
├──────────────────────────────────────────────────────────────────────────┤
│ 2. PROPERTY TYPE STRIP  Houses · Villas · Cabins · Condos · Apartments  │
├──────────────────────────────────────────────────────────────────────────┤
│ 3. TRUST BAR  Clear total prices · Secure payment · Verified reviews    │
│               · Message your host                                       │
├──────────────────────────────────────────────────────────────────────────┤
│ 4. TOP-RATED HOMES (carousel of 8 listing cards)                        │
├──────────────────────────────────────────────────────────────────────────┤
│ 5. POPULAR DESTINATIONS (tiles with city and "N homes")                 │
├──────────────────────────────────────────────────────────────────────────┤
│ 6. BOOK INSTANTLY (carousel: instantBook=true)                          │
├──────────────────────────────────────────────────────────────────────────┤
│ 7. HOW IT WORKS (3 steps)                                               │
├──────────────────────────────────────────────────────────────────────────┤
│ 8. NEW ON THE SITE (carousel: sort=NEWEST)                              │
├──────────────────────────────────────────────────────────────────────────┤
│ 9. HOST BAND  Earn from your property → /become-host                    │
├──────────────────────────────────────────────────────────────────────────┤
│ 10. FAQ (accordion)                                                     │
├──────────────────────────────────────────────────────────────────────────┤
│ FOOTER                                                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Section specifications

#### 1. Hero and search bar

| Item | Specification |
|---|---|
| Layout | Height `min(72vh, 640px)` desktop, auto on mobile. Background image via `next/image` with `priority`, `fetchPriority="high"`, AVIF/WebP, blur placeholder, dark teal gradient overlay (`rgba(15,23,42,.45)`) so white text passes contrast |
| Search bar | White surface, 16 px radius, 1 px border, three segments + button. Desktop: single row, 760–880 px wide. Mobile: stacked fields |
| **Where to?** | Combobox. Typing 2+ characters (debounced 250 ms) calls `GET /search/suggestions/cities?prefix=&limit=8`. Each option shows `city, country` and "N homes" (`listingCount`). Choosing an option sets `city` and `country`; free text sets `city` only. Keyboard: ↑/↓/Enter/Esc; `aria-activedescendant` |
| **Dates** | Range picker (two months on desktop, one on mobile). Past days disabled. Both dates or none (backend: `400 INVALID_DATE_RANGE` otherwise). Max 365 nights. "Search without dates" link submits with none |
| **Guests** | Popover stepper 1–50 (default 1; maximum 50 is the backend limit). No adults/children/pets split (not supported) |
| Search button | Primary teal, label "Search" (accent colour is **not** used here: no money moves) |
| Submit | Navigates to `/search?city=&country=&checkIn=&checkOut=&guests=` (names equal the backend's) |
| Validation | Inline: dates incomplete → "Choose both dates or search without dates"; `guests` out of range → clamped |
| Remember | Last search stored in `localStorage` (not personal data) to prefill |

Copy is original ("Find a whole home for your next trip"). No claim appears that the backend cannot back (no "24/7 support", no guarantees).

#### 2. Property type strip (Airbnb-style)

Horizontal scroll row of icon + label chips from the `PropertyType` enum: `HOUSE`, `VILLA`, `CABIN`, `CONDO`, `APARTMENT`, `STUDIO`, `OTHER` → "Other". Click → `/search?propertyType=CABIN`. A chip is hidden if `GET /search?propertyType=X&size=1` returns zero (resolved at build/ISR time). Sticky below the header on the search page, with the active type highlighted.

#### 3. Trust bar

Four items with icons, each tied to a real backend behaviour:

| Item | Backed by |
|---|---|
| **Clear total prices**: "See nightly rate, cleaning, service fee and tax before you book" | `priceBreakdown` on quote |
| **Secure payment**: "Pay with a protected payment token; we never see your card number" | tokenised `paymentToken`, card numbers rejected |
| **Honest reviews**: "Guests and hosts review each other, and both are revealed together" | blind two-way reviews |
| **Talk to your host**: "Ask questions before you book" | messaging module |

#### 4. Top-rated homes

`GET /search?sort=RATING_DESC&size=8`, filtered client-side to `reviewCount > 0`. Horizontal scroll-snap carousel (arrow buttons ≥ md, swipe on touch) of `ListingCard`s. Skeleton cards while loading; section hidden if fewer than 3 results. "See all" → `/search?sort=RATING_DESC`.

#### 5. Popular destinations

A **curated** list lives in `src/features/search/destinations.ts` (city, country, image), because the API has no "popular cities" endpoint. At build/ISR time, each entry is checked with `GET /search?city=X&size=1`; entries with `totalElements = 0` are dropped and the rest show "N homes" from `totalElements`. If fewer than 3 survive, the section is hidden. Tile click → `/search?city=X&country=Y`. This guarantees the landing page never links to an empty result.

#### 6. Book instantly

`GET /search?instantBook=true&sort=RATING_DESC&size=8`. Heading "Book instantly", sub "Confirmed the moment you pay". Same card component.

#### 7. How it works

Three steps with icons: **Search** (destination, dates, guests) → **Compare** (prices, amenities, reviews) → **Book** (instant, or request and hear back within 24 hours). Link to `/how-it-works`.

#### 8. New on the site

`GET /search?sort=NEWEST&size=8`.

#### 9. Host band

Full-width teal band (white text, accent not used): "Turn your property into income", three bullets (you set the price and calendar, you approve or allow instant booking, payouts after check-in), button **List your property** → `/become-host` (signed in) or `/register?next=/become-host`. Hosts see "Go to host dashboard" instead.

#### 10. FAQ

Accordion, content static. Questions that the backend can answer truthfully: How do instant booking and requests differ? When am I charged? (at payment; for requests the charge is taken and refunded in full if the host declines or does not answer within 24 hours) · What are the cancellation policies? (three policies, link to `/cancellation-policies`) · How do reviews work? · How do payouts work (24 hours after check-in)? · Is my payment information safe?

#### Footer

Columns: Explore (Search, Destinations), Hosting (List your property, How hosting works), Support (Help, Cancellation policies), Company (Terms, Privacy). No social links until they exist. Copyright line.

### 9.3 Data and caching

| Block | Call | ISR | Fallback when API fails |
|---|---|---|---|
| Top rated | `GET /search?sort=RATING_DESC&size=8` | 60 s | Section hidden |
| Destinations | up to 8 × `GET /search?city=…&size=1` | 300 s | Section hidden |
| Instant book | `GET /search?instantBook=true&size=8` | 60 s | Section hidden |
| New | `GET /search?sort=NEWEST&size=8` | 60 s | Section hidden |
| Property types | up to 7 × `GET /search?propertyType=…&size=1` | 300 s | Show all chips |

Every block fails independently (`Promise.allSettled`): the hero and search bar always render, even if the API is down. Page-level cache is regenerated in the background (stale-while-revalidate).

### 9.4 Responsive behaviour

| Breakpoint | Hero | Carousels | Destinations grid |
|---|---|---|---|
| `< 640` | Stacked search fields; dates and guests open full-screen sheets | 1.2 cards visible, swipe | 2 columns |
| `640–1023` | Two-row search bar | 2.5 cards | 3 columns |
| `≥ 1024` | One-row search bar | 4 cards, arrows | 4 columns |

### 9.5 Performance and SEO targets (landing)

* LCP ≤ 2.5 s on a mid-range phone over 4G: hero image preloaded and sized (`sizes="100vw"`), fonts via `next/font`, no client JS before the search bar except the combobox and carousel arrows (loaded as small islands). Initial JS ≤ 170 KB gzipped.
* CLS ≤ 0.1: all images have dimensions; carousels reserve height.
* `<title>`: "Vacation rental homes | {Brand}". Meta description, canonical URL, Open Graph image.
* JSON-LD `WebSite` with `SearchAction` pointing at `/search?city={query}`; `Organization` block.
* Accessible landmarks: `header`, `main`, `nav`, `footer`; H1 once; carousel regions labelled; all images with alt.

### 9.6 States

| State | Behaviour |
|---|---|
| Loading carousel | 4 skeleton cards of final height |
| Empty database | Only hero, trust bar, how it works, host band, FAQ render; no empty headings |
| Signed in | Header changes; hero unchanged; host band adapts |
| Offline / API down | Hero and static sections render; data sections hidden; search submits and shows the error state on `/search` |

---

## 10. Public pages

### 10.1 Search results `/search`

**Layout (Vrbo-like):** sticky compact search bar → property-type strip → filter chip row + sort → result count and list → pagination. Desktop: single column of horizontal cards or a 2-column grid (user toggle, remembered). Mobile: vertical cards; filters in a bottom sheet.

**URL ⇄ backend parameters (identical names):**

| UI control | Parameter | Rule enforced in the UI (backend enforces too) |
|---|---|---|
| Where to? | `city`, `country` | 2–100 chars; `country` ISO-2 |
| Dates | `checkIn`, `checkOut` | both or neither; `checkIn` ≥ today; ≤ 365 nights |
| Guests | `guests` | 1–50, default 1 |
| Price | `minPrice`, `maxPrice` | ≥ 0, ≤ 2 decimals, `minPrice ≤ maxPrice`. **Compared with the base nightly price**, so the slider is labelled "Nightly price (base)" |
| Property type | `propertyType` | one enum value |
| Bedrooms | `minBedrooms` | 0–50 (chips: Any, 1+, 2+, 3+, 4+, 5+) |
| Rating | `minRating` | 0–5 (chips: Any, 3+, 4+, 4.5+) |
| Instant Book | `instantBook` | boolean toggle |
| Amenities | `amenityIds` | up to 15; the listing must have **all**. Chips grouped by category from `GET /amenities` |
| Sort | `sort` | `RATING_DESC` (default, "Best rated"), `PRICE_ASC`, `PRICE_DESC`, `NEWEST` |
| Page | `page`, `size` | size 20 (max 50) |

**Result card (`ListingCard`):**

```
┌───────────────┬─────────────────────────────────────────────┐
│               │ Apartment · Lyon, FR                         │
│  cover photo  │ Skylight Loft above the Old Town             │
│  (4:3)        │ Sleeps 4 · 2 bedrooms                        │
│               │ ★ 4.82 (23)   [Instant Book]                 │
│               │ 🛜 Wi-Fi  🍳 Kitchen  ❄ A/C  🅿 Parking  (≤4) │
│               │                           $412 total         │
│               │                    3 nights · incl. taxes    │
└───────────────┴─────────────────────────────────────────────┘
```

* With dates: show `totalPrice` ("$412 total", "3 nights · includes taxes and fees") and the nightly base as a secondary line. Without dates: "From $120 / night" (base). If `totalPrice` is absent for one item while dates are set (backend skips a failed price), show the nightly price and "Price shown at checkout".
* `reviewCount = 0` → "New" instead of a rating (the API returns `averageRating = 0` for unrated listings).
* **Top rated** badge when `averageRating ≥ 4.8` and `reviewCount ≥ 5` (thresholds in config; purely presentational).
* The card links to `/listings/{id}?checkIn=&checkOut=&guests=` so dates carry over.
* No heart icon (no wishlist).

**States:** loading (8 skeletons) · empty (200 with empty page: "No homes match. Try removing a filter", with one-click chips to drop each active filter) · error (retry button, `traceId`) · `INVALID_DATE_RANGE`, `INVALID_SORT`, `MALFORMED_REQUEST` (clear the bad parameter and say so). 429: "Too many searches, try again in N seconds".

**Pagination:** numbered pager from `totalPages`; changing any filter resets to page 1; scroll to top on page change.

**SEO:** `/search?city=Lyon` is indexable with a city-specific title; any combination with dates, price or more than one filter is `noindex,follow` with canonical to the city page.

### 10.2 Listing page `/listings/[id]`

#### 10.2.1 Layout

```
Breadcrumb: Home › Lyon › Skylight Loft
┌───────────── gallery: 1 large + 4 small · "Show all N photos" ─────────────┐
Title · ★4.82 (23 reviews) · Lyon, France · [Top rated] [Instant Book]
┌── main column ──────────────────────────────┐ ┌── sticky booking card ──┐
│ Anchor tabs: Overview · Amenities · Policies │ │ $120 / night             │
│              · Reviews · Location            │ │ [Check-in][Check-out]    │
│ Sleeps 4 · 2 bedrooms · 2 beds · 1.5 baths   │ │ [Guests]                 │
│ Description (expand)                         │ │ ── price breakdown ──    │
│ Hosted by Ada · Member since 2025 → profile  │ │ [Book now] / [Request]   │
│ Amenities (grouped by category, show all)    │ │ Free cancellation until… │
│ House rules · Check-in 3:00 pm / out 11:00 am│ │ Message host             │
│ Cancellation policy card                     │ └──────────────────────────┘
│ Reviews (summary + list + sort)              │
│ Location map (approximate)                   │
└──────────────────────────────────────────────┘
Mobile: sticky bottom bar [ $120 night · Check availability ]
```

#### 10.2.2 Booking card behaviour (the most important widget)

| Step | Behaviour | Endpoint |
|---|---|---|
| Load calendar | Fetch two months ahead of the visible month (range ≤ 366 days) | `GET /listings/{id}/calendar?from=&to=` |
| Choose check-in | A date is selectable when its **night** is `available` | calendar |
| Choose check-out | Selectable when every night in `[checkIn, checkOut)` is available. **The check-out day itself may be unavailable** (check-out is exclusive). Compute `maxCheckOut` = first unavailable night after check-in (Appendix E). Dates earlier than `minNights` or later than `maxNights` are disabled with a tooltip | calendar + listing |
| Day cell | Shows `nightlyPrice` (small) when present; unavailable days are struck through; `reason` (`BOOKED`, `BLOCKED`, `PAST`, `OUTSIDE_WINDOW`) feeds the tooltip, never guest details (backend does not send any) | calendar |
| Guests | Stepper 1 to `maxGuests` | listing |
| Quote | When dates and guests are valid: `GET /listings/{id}/quote`, debounced 300 ms, `staleTime: 0` | quote |
| Breakdown | Rows: `nightCount` × average nightly (expandable to the per-night lines), discount (`discountLabel`), cleaning fee, service fee, taxes, **Total** | `priceBreakdown` |
| CTA | `instantBook` → **Book now**; else **Request to book** with helper "You'll be charged now. The host has 24 hours to respond; if they decline or don't answer you are refunded in full." Accent colour | listing |
| Errors | `BOOKING_CONFLICT` "Those dates were just taken" and re-fetch the calendar · `BUSINESS_RULE_VIOLATION` show the server `detail` (min/max nights, advance notice, booking window) · `INVALID_DATE_RANGE` · `LISTING_NOT_BOOKABLE` "This home isn't available to book" | quote |
| Not signed in | CTA goes to `/login?next=/checkout/{id}?checkIn=…` | |
| Own listing | CTA replaced by "This is your listing" + Edit link (client compares `host.id` with the user id; the server still blocks self-booking with 422) | |
| Unverified email | Prompt before navigating to checkout | |

**Free cancellation line.** For `FLEXIBLE` (24 h) and `MODERATE` (120 h) the card shows "Free cancellation until {date, time} ({listing timezone})" computed from `checkIn + checkInTime − threshold` in the listing's timezone (`lib/cancellation.ts`, covered by boundary and DST unit tests). `STRICT` shows the policy text only. The authoritative refund figure is always the server's `cancellation-preview` on the trip page.

#### 10.2.3 Other sections

| Section | Data and behaviour |
|---|---|
| Gallery | `photos` ordered by `sortOrder`, cover first. Lightbox with keyboard navigation, focus trap, swipe |
| Summary row | `maxGuests`, `bedrooms`, `beds`, `bathrooms` (0.5 steps shown as "1.5") |
| Description | Plain text only (backend strips HTML; the UI never uses `dangerouslySetInnerHTML`). Preserve line breaks; collapse after ~6 lines |
| Host | `host.displayName`, bio, rating; links to `/hosts/{id}` |
| Amenities | Grouped by category with icons; modal "Show all". Names from `amenities` on the listing |
| House rules, times | Ordered list; check-in/out times formatted in the **listing timezone** |
| Cancellation policy | `cancellationPolicyDescription` verbatim, plus a three-column illustrative timeline for the chosen enum |
| Reviews | `GET /listings/{id}/reviews?sort=NEWEST|HIGHEST|LOWEST&page&size`. Header: average and count. List: author display name, overall stars, date, comment, three sub-ratings when present. "New" state when none |
| AI summary | If `reviewCount ≥ 3`: `GET /ai/listings/{id}/review-summary`. `422` (too few) or `503 AI_UNAVAILABLE`: render nothing, no error |
| Location | Leaflet map with an **approximate circle** (not a pin) and the city name. Street address is not shown to the public (C5) |
| Contact host | Button opens a dialog with a message box (1–2000 chars). Sends `POST /conversations {listingId, message}`, then goes to the thread. Hidden on one's own listing (server returns 422). Requires verified email and sign-in |
| Plan your trip | Optional card: `POST /ai/trip-plan {city, days, interests}`; hidden on `503` |
| Admin bar | Visible to `ADMIN`: status badge, **Approve / Reject / Suspend / Reinstate** per status (13.3), and a **Remove** action on each review (13.3). Calls the admin endpoints |
| Owner bar | Visible to the owner: status badge, **Edit**, **Preview as guest** |

**Metadata:** `generateMetadata` with title, description (first 155 characters), canonical URL, Open Graph image (cover). JSON-LD `LodgingBusiness`/`VacationRental` with `aggregateRating` only when `reviewCount > 0`. Non-`ACTIVE` previews are `noindex`.

### 10.3 Host profile `/hosts/[id]`

`GET /hosts/{userId}` → avatar initial, `displayName`, `bio`, "Member since {year}", `activeListings`, `averageRating`, `reviewCount`. Never email, phone or address. Below: "Listings by this host" is **not available** (no endpoint) so the section is omitted rather than faked.

### 10.4 Authentication pages

| Page | Fields and rules (mirrors backend §7.4) | Calls and outcomes |
|---|---|---|
| **Login** | `email`, `password` | `POST /auth/login`. Errors: `INVALID_CREDENTIALS` → "Invalid email or password" (the same message for unknown email, wrong password, deleted account and temporary lock; never reveal which). After two failures highlight "Forgot password?". `ACCOUNT_SUSPENDED` → "This account is suspended". `RATE_LIMITED` → countdown from `Retry-After`. Success → store tokens, `GET /users/me`, go to `next` (validated to be a relative path) or `/` |
| **Register** | `email` (trim, lowercase, ≤ 254), `password` (8–72 **bytes**, a letter and a digit, no leading/trailing space, must not contain the email's local part; live checklist uses `TextEncoder` for byte length), `firstName`/`lastName` (1–60, letters, spaces, hyphens, apostrophes: `^[\p{L}][\p{L} '-]*$`), `phone` optional E.164 `^\+[1-9]\d{6,14}$` | `POST /auth/register` → `201`. `EMAIL_ALREADY_REGISTERED` → inline on the email field with link to login. On success the app signs the user in automatically (`POST /auth/login` with the same credentials; login works before verification) and shows a "Check your email" panel plus the verification banner |
| **Verify email** | `token` from the query string | `POST /auth/verify-email` runs **exactly once** (a ref guard prevents React Strict Mode from sending it twice, which would burn the single-use token and show a false error). `204` → success state with link to continue; `INVALID_OR_EXPIRED_TOKEN` → "This link has expired" with a resend form (`POST /auth/resend-verification`, always `202`, same message regardless of email) |
| **Forgot password** | `email` | `POST /auth/forgot-password` → always the same confirmation text |
| **Reset password** | `token` (query), `newPassword` with the same strength rules | `POST /auth/reset-password` → `204` then redirect to login with a notice. `INVALID_OR_EXPIRED_TOKEN` → link to request a new one. All sessions are revoked server-side |

Design: a centred card on the background colour, logo above, teal primary button, no accent colour.

### 10.5 Static pages

`/how-it-works`, `/cancellation-policies` (three policies explained with the exact thresholds from the backend: Flexible 24 h; Moderate 120 h full and 24 h half; Strict 168 h half; service fee refundable only on a full refund), `/help`, `/terms`, `/privacy`. Terms must exist before launch because host onboarding requires `acceptTerms = true`.


---

## 11. Guest area

### 11.1 Checkout (two steps, one hold)

The backend splits checkout in two calls so no database lock is held during payment. The UI mirrors that exactly and follows Vrbo's order: trip and contact details, house rules and policies, then payment.

```
Listing page ─► /checkout/[listingId]?checkIn&checkOut&guests          (Step 1: Review)
                   GET quote ─► user reviews ─► [Continue to payment]
                   POST /bookings (Idempotency-Key)  ─► 201 PENDING_PAYMENT, expiresAt
                ─► /trips/[reference]/pay                              (Step 2: Pay, countdown)
                   POST /bookings/{id}/pay {paymentToken}
                   ├─ CONFIRMED          ─► confirmation (instant book)
                   ├─ PENDING_APPROVAL   ─► confirmation (request sent)
                   └─ 402 PAYMENT_FAILED ─► failure screen (hold released)
```

#### 11.1.1 Step 1: Review (`/checkout/[listingId]`)

| Block | Content |
|---|---|
| Header | Progress "1 Review · 2 Pay", back link to the listing |
| Trip summary | Cover, title, city, dates, guests, "Edit" (returns to the listing with the same parameters). Check-in/out times in the listing timezone |
| Your details | Name and phone from the profile (read-only, "Edit in account"). The guest email is not shown to hosts |
| Message to host | Optional, ≤ 1000 chars, plain text (`message` field) |
| House rules and policies | Rules list, the cancellation policy description, and a required checkbox "I agree to the house rules and cancellation policy" (UI-only gate; the API has no such field) |
| Price panel (right, sticky) | Full `priceBreakdown` with per-night lines expandable, and the **Total** |
| Button | **Continue to payment** (primary teal: it holds dates but moves no money) |

On load the page fetches the listing and a fresh quote (`staleTime: 0`). If the quote fails with `BOOKING_CONFLICT` the user is returned to the listing with the calendar refreshed.

**Create-hold request** (per backend `CreateBookingRequest`): `listingId`, `checkIn`, `checkOut`, `guests`, `expectedTotal` = the quote's `totalAmount` **unchanged**, `message?`. The payment token is **not** part of this request (it is sent in step 2).

| Outcome | UI |
|---|---|
| `201` | Save `{reference,id}` and go to step 2 |
| `409 PRICE_CHANGED` | Body contains the new quote. Dialog: "The price changed from $X to $Y" with the new breakdown; **Accept new price** re-sends with the new `expectedTotal` and a **new** idempotency key (the payload changed); **Back** returns to the listing |
| `409 BOOKING_CONFLICT` | First check `GET /bookings/mine?status=PENDING_PAYMENT` for the caller's own hold on the same listing and dates (another tab or session). If found: "You already have a hold for these dates" → **Resume payment**. Otherwise: "Those dates were just booked" → back to the listing |
| `409 LISTING_NOT_BOOKABLE` | "This home is no longer available" → back to search |
| `409 CONCURRENT_MODIFICATION` | "Busy, please try again" with a retry button (same key) |
| `403 EMAIL_NOT_VERIFIED` | Verification prompt with resend |
| `422 BUSINESS_RULE_VIOLATION` | Show `detail` (examples: max 3 unpaid holds → link to Trips; your own listing; stay rules) |
| `422 IDEMPOTENCY_KEY_REUSED` | Regenerate the key and retry once (should not happen because the key is derived from the payload) |
| `400 VALIDATION_ERROR` | Map `fieldErrors` (usually `message`) |
| `429` | Countdown from `Retry-After` |

**Double-click protection:** the button is disabled on first click and an `Idempotency-Key` UUID is generated once per distinct payload and kept in `sessionStorage` (Appendix D), so a retry or reload of the same checkout returns the same booking instead of creating another.

#### 11.1.2 Step 2: Pay (`/trips/[reference]/pay`)

| Block | Content |
|---|---|
| Hold banner | "Your dates are held for **mm:ss**" counting down to `expiresAt` (Countdown component; colour turns warning under 3 minutes). At zero: inline "Your hold expired" with a link back to the listing; no more payment attempts |
| Payment method | `PaymentMethodField` (11.1.3) |
| Summary | Same price panel (from the booking's own snapshot, not a new quote) |
| Button | **Pay $X and book** (instant) or **Pay $X and send request** (request-to-book). **Accent colour.** The amount shown is `priceBreakdown.totalAmount`; the client never sends an amount |
| Explainer (request mode) | "The host has 24 hours to respond. If they decline or don't answer, you're refunded in full." |

The page is reachable from the trip page's **PAY** action, so a guest who left can come back; it only renders when `allowedActions` contains `PAY` and `expiresAt` is in the future, otherwise it redirects to the trip detail.

| Pay outcome | UI |
|---|---|
| `200`, status `CONFIRMED` | Confirmation "You're booked" |
| `200`, status `PENDING_APPROVAL` | Confirmation "Request sent to {host}" with the response deadline (`expiresAt`) |
| `402 PAYMENT_FAILED` | Read `failureCode`: `CARD_DECLINED` "Your payment was declined", `INSUFFICIENT_FUNDS` "Insufficient funds", `GATEWAY_TIMEOUT` "The payment provider didn't respond". The booking is now `PAYMENT_FAILED` and the dates are released, so the screen offers **Start again** (goes back to checkout with the same dates, a new hold and a new key). There is no "retry same booking" |
| `409 BOOKING_EXPIRED` | "Your hold expired. If you were charged, you'll be refunded automatically" |
| `409 INVALID_STATE_TRANSITION` | Already paid or changed: refetch the booking and show its real state |
| `404` | Not Found page |

**Confirmation screen** (Vrbo-style): large check, status sentence, reference code with copy button, dates, host name, what happens next, buttons *View trip* and *Message host*, plus the price summary. For requests it also shows a countdown to the host's deadline.

#### 11.1.3 Payment method field (provider-agnostic)

The API accepts only `paymentToken` (1–100 chars, `[A-Za-z0-9_-]+`) and rejects values that look like a 13–19 digit card number. **The app never handles card numbers.**

```ts
interface PaymentMethodField {            // mirrors the backend PaymentGateway interface
  render(): ReactNode;                    // the UI that collects the method
  getToken(): Promise<string>;            // resolves to the opaque token sent as paymentToken
}
```

| Mode (`NEXT_PUBLIC_PAYMENT_MODE`) | Implementation |
|---|---|
| `fake` (dev, demo) | `FakePaymentField`: a radio list of the gateway's test tokens with plain labels: `tok_success` "Succeeds", `tok_decline` "Card declined", `tok_insufficient` "Insufficient funds", `tok_timeout` "Gateway timeout (2 s)", `tok_flaky` "Fails first". Shown with a clear **TEST MODE** ribbon. Never present in production builds |
| `provider` | A provider's hosted field component that tokenises in the provider's iframe and returns the token (decision C9). The checkout code does not change |

### 11.2 My trips `/trips`

* Data: `GET /dashboard/trips` → `{upcoming, past, cancelled}`; `GET /reviews/pending` for the review banner.
* Tabs **Upcoming · Past · Cancelled** with counts. Upcoming includes `PENDING_PAYMENT`, `PENDING_APPROVAL` and `CONFIRMED` with check-out today or later.
* Trip card: cover, title, city, dates, nights, status badge, reference, and the single most relevant button from `allowedActions` (PAY → "Complete payment" with countdown; REVIEW → "Write a review"; otherwise "View trip").
* Banner when reviews are pending: "2 stays are waiting for your review. The window closes {date}" → `/reviews`.
* Empty states: "No upcoming trips. Start exploring" (button to `/`) per tab.
* `PENDING_PAYMENT` cards whose `expiresAt` has passed render as "Expired" (the scheduler will flip the status within a minute; the UI never waits for it).

### 11.3 Trip detail `/trips/[reference]`

Data: `GET /bookings/reference/{reference}`; payment: `GET /bookings/{id}/payment`; reviews: `GET /bookings/{id}/reviews`.

| Section | Content |
|---|---|
| Header | Listing title, reference (copy), status badge, host name |
| Status timeline | `history[]` rendered with `fromStatus → toStatus`, actor type, reason, time |
| Stay | Check-in/out dates, nights, guests. Times use the listing timezone when known (C11) and are otherwise omitted rather than shown in the wrong zone |
| Price | Snapshot `priceBreakdown` (guest lines only) and, when cancelled, `refundAmount` |
| Payment | `GET /bookings/{id}/payment`: status, amount, refunded total, refundable amount, refunds with status. A `FAILED` refund shows "We're retrying this refund automatically" (the scheduler retries up to 5 times) |
| Cancellation policy | `cancellationPolicyDescription` |
| Host | Display name, phone **only when** the API returns it (gated until `CONFIRMED`). Gated state text: "Contact details are shared once your booking is confirmed" |
| Actions | Rendered **only** from `allowedActions` (below) |
| Plan your stay | AI trip plan (hidden if AI is unavailable) for upcoming confirmed trips |
| Receipt | "Print receipt" (print stylesheet) |

| Action | Behaviour |
|---|---|
| `PAY` | Accent button → `/trips/{ref}/pay` with countdown |
| `CANCEL` | Dialog: loads `GET /bookings/{id}/cancellation-preview` and shows policy, hours until check-in, **refund amount** and **amount retained** exactly as returned. If `canCancel` is false it shows the server `reason` (for example the stay has started) and offers *Open a dispute* instead. Optional reason ≤ 500 chars. Destructive button "Cancel booking" → `POST /bookings/{id}/cancel`. Errors: `CANCELLATION_NOT_ALLOWED`, `INVALID_STATE_TRANSITION`. On success refetch and show the refund result |
| `REVIEW` | → `/trips/{ref}/review` |
| `MESSAGE` | Opens or creates the conversation (11.5) |
| `OPEN_DISPUTE` | → `/trips/{ref}/dispute` |

### 11.4 Reviews

`/reviews` lists `GET /reviews/pending` items: listing title, reference, `publishDeadline`, button *Write review* (disabled and labelled "Submitted" when `submitted`).

**Write review `/trips/[reference]/review`** (direction is derived by the server from who is calling):

| Caller | Fields | Rules |
|---|---|---|
| Guest (reviewing the stay) | `overallRating` 1–5 **required**; `cleanlinessRating`, `communicationRating`, `accuracyRating` 1–5 optional; `comment` ≤ 2000 | Star inputs are keyboard-operable radio groups |
| Host (reviewing the guest) | `overallRating` 1–5 required; `comment` ≤ 2000 | The three sub-ratings are **not rendered** (the API rejects them with 400) |

Explainer shown above the form: "Your review stays private until {the other person} has written theirs, or until {publishDeadline}." After submit: "Thanks! We'll publish it when both reviews are in or on {date}", and the page now shows the caller's own (hidden) review. Errors: `422` stay not completed or window closed; `409 DUPLICATE_RESOURCE` "You already reviewed this stay". Reviews cannot be edited, so there is a confirmation step.

### 11.5 Inbox `/inbox` and `/inbox/[conversationId]`

Two panes on desktop (list left, thread right); stacked screens on mobile.

| Piece | Behaviour |
|---|---|
| List | `GET /conversations` paged: listing thumbnail, counterpart name, last message preview, relative time, unread badge (`unreadCount`) |
| Thread | `GET /conversations/{id}/messages?limit=50` returns **newest first** with `nextCursor`. Display oldest-to-newest; "Load earlier" (or scroll up) calls `?before=<nextCursor>` and keeps scroll position |
| Bubble | `mine` decides side; sender name; time; `readAt` shows "Read" on the sender's last message. Text only (`white-space: pre-wrap`), no HTML, no auto-linking |
| Composer | Textarea 1–2000 chars, trimmed, whitespace-only blocked. Enter sends, Shift+Enter newline. Counter appears past 1800 |
| Sending | Optimistic bubble with "Sending…". `POST /conversations/{id}/messages {body}` with an `Idempotency-Key` UUID created per message; a failed send shows **Retry** reusing the same key, so a retry can never duplicate a message |
| Read state | When a thread is visible, call `POST /conversations/{id}/read`, then refresh the unread counts. Sending does not mark anything read (backend rule) |
| Polling | Open thread every 8 s while the tab is visible; list and unread badge every 30 s; paused when hidden; no WebSockets in v1 |
| Start a conversation | Only from a listing page: `POST /conversations {listingId, message}` (creates or reuses). Not available for one's own listing |
| Errors | `429` repeated-message guard → "You've sent that several times"; `403 EMAIL_NOT_VERIFIED` / `ACCOUNT_SUSPENDED`; `422` own listing; `503 SERVICE_UNAVAILABLE` → "Messages are temporarily unavailable" while the rest of the app works; deleted counterpart shows "Deleted User" |
| Drafts | Unsent text kept in `sessionStorage` per conversation |

### 11.6 Notifications

* **Bell:** badge from `GET /notifications/unread-count` (every 30 s); dropdown shows the latest 5 from `GET /notifications?size=5`.
* **Page `/notifications`:** `GET /notifications?unreadOnly=&page=&size=`; toggle "Unread only"; **Mark all read** (`PATCH /notifications/read-all`); clicking an item calls `PATCH /notifications/{id}/read` and navigates.
* **Link resolver:** `link` is a *frontend route* (backend rule). It is accepted only if it is a relative path beginning with `/`; otherwise, or if it matches no known route, the item opens `/notifications`. Expected destinations (⚠ C2):

| Type | Typical destination |
|---|---|
| `BOOKING_REQUESTED` | host booking detail |
| `BOOKING_CONFIRMED`, `BOOKING_DECLINED`, `BOOKING_CANCELLED`, `BOOKING_EXPIRED`, `BOOKING_COMPLETED`, `CHECK_IN_REMINDER`, `REFUND_ISSUED` | `/trips/{reference}` (guest) or host booking (host) |
| `PAYOUT_PAID` | `/host/payouts` |
| `REVIEW_REMINDER`, `REVIEW_PUBLISHED` | review page or trip page |
| `LISTING_APPROVED`, `LISTING_REJECTED`, `LISTING_SUSPENDED` | `/host/listings/{id}` |
| `DISPUTE_OPENED`, `DISPUTE_RESOLVED` | trip page, or support case for staff |
| `NEW_MESSAGE` | `/inbox/{conversationId}` |

### 11.7 Disputes

* **Open** (`/trips/[reference]/dispute`): shown only when `OPEN_DISPUTE` is in `allowedActions`. Fields: `category` (select; values come from the generated enum, labelled in plain English) and `description` 20–2000 characters. `POST /bookings/{id}/disputes`. Errors: `422` outside the eligible window (message shown), `409 DUPLICATE_RESOURCE` "A dispute is already open for this booking".
* Explainer: "Opening a dispute pauses the host's payout while our team reviews. Resolution is final."
* **My disputes** (`/account/disputes`): `GET /disputes/mine`, status badge, category, resolution type and note when resolved.

### 11.8 Account

| Page | Content |
|---|---|
| `/account` Profile | `GET /users/me`. Edit `firstName`, `lastName`, `phone` (same rules as registration); email is read-only (cannot change). `PATCH /users/me` sends only changed fields. Email-verified status with **Resend** |
| `/account/security` | **Change password**: current, new (strength rules, must differ). `POST /auth/change-password` → `204`; **all sessions are revoked**, so the app shows "Password changed. Please sign in again" and goes to login. **Delete account**: password confirm in a danger zone; `422 BUSINESS_RULE_VIOLATION` explains the blocker (active bookings, unpaid payouts, open dispute); success signs out and shows a goodbye page |
| `/account/disputes` | See 11.7 |


---

## 12. Host area

Guard: role `HOST`. Shell: host sidebar (7.4). A host is also a guest, so every guest screen remains available from the avatar menu.

### 12.1 Becoming a host `/become-host`

Any signed-in user can open it (it is deliberately outside `/host/**`).

| Field | Rule |
|---|---|
| `displayName` | 2–80 characters |
| `bio` | optional, ≤ 1000 |
| `acceptTerms` | checkbox, must be `true`; links to `/terms` |

`POST /users/me/become-host`. Pre-check: email must be verified (prompt otherwise; the API returns `403 EMAIL_NOT_VERIFIED`). `409 DUPLICATE_RESOURCE` → already a host, redirect to `/host`. On success, refetch `/users/me` (roles update server-side with no re-login), then show a welcome screen with a three-item checklist: *Create your first listing · Add photos · Submit for review*.

### 12.2 Listing wizard `/host/listings/new` (Airbnb-style steps, Vrbo-style plain language)

Progress bar and step list on the left (desktop) or top (mobile). Back/Next always available; a draft of steps 1–5 is kept in `localStorage` until the listing exists.

**Why two phases:** `POST /host/listings` requires *every* required field at once (title, description, address, coordinates, timezone, capacity, pricing, rules, policy). Steps 1–5 therefore collect locally and create the `DRAFT` at the end of step 5. Steps 6–9 each save through their own endpoint to the now-existing listing, and are resumable at `/host/listings/[id]`.

| Step | Fields | Validation (mirrors backend) | Saves |
|---|---|---|---|
| 1 Basics | `propertyType` (APARTMENT, HOUSE, VILLA, CABIN, CONDO, STUDIO, OTHER), `title`, `description` | title 10–120, description 50–5000, no HTML. **AI helper** (12.7) | local |
| 2 Location | `addressLine`, `city`, `stateRegion?`, `country` (ISO-3166 alpha-2, select), `postalCode?`, `latitude`, `longitude`, `timezone` | address 5–200, city 1–100, region ≤ 100, postal ≤ 20, lat ±90 and lon ±180 with ≤ 6 decimals, IANA timezone. Map picker (click or drag a pin). Timezone is suggested from the pin with `tz-lookup` and editable from `Intl.supportedValuesOf('timeZone')` | local |
| 3 Space | `maxGuests` 1–50, `bedrooms` 0–50, `beds` 1–100, `bathrooms` 0–50 in 0.5 steps | steppers; bathrooms step 0.5 | local |
| 4 Pricing | `baseNightlyPrice` 1.00–100000.00, `weekendMultiplier` 1.00–3.00 (Friday and Saturday nights), `cleaningFee` 0–10000.00, `weeklyDiscountPercent` 0–90 (7+ nights), `monthlyDiscountPercent` 0–90 (28+ nights, **≥ weekly**) | ≤ 2 decimals, never rounded; helper "Guests also pay a service fee and tax set by the platform". **No earnings calculator** (money maths stays on the server) | local |
| 5 Booking rules | `minNights` ≥ 1, `maxNights` ≤ 365 and ≥ min, `advanceNoticeDays` 0–60, `bookingWindowDays` 30–730, `checkInTime`, `checkOutTime` (`HH:mm`), `cancellationPolicy` (FLEXIBLE, MODERATE, STRICT as selectable cards with the description text), `instantBook` switch with explainer | cross-field rules enforced with zod `superRefine` | **`POST /host/listings`** → `201 DRAFT`, URL becomes `/host/listings/{id}?step=amenities` |
| 6 Amenities | multi-select grouped by category from `GET /amenities` (max 50) | ids must be active | `PUT /host/listings/{id}/amenities {amenityIds}` |
| 7 House rules | sortable list, max 15 items, each ≤ 200 chars | no HTML | `PUT /host/listings/{id}/house-rules {rules:[{text,sortOrder}]}` |
| 8 Photos | uploader (12.4.2) | ≥ 3 to submit, max 20 | per-file `POST …/photos` |
| 9 Review and submit | Checklist and preview; **Submit for review** | needs all required fields, ≥ 3 photos, a cover (first photo becomes the cover if none) and a verified email | `POST /host/listings/{id}/submit` → status `PENDING_REVIEW` |

Submit errors: `422 BUSINESS_RULE_VIOLATION` lists what is missing in its message; the checklist highlights the matching rows. After success: "Submitted. We'll review it and notify you." with the listing locked for editing.

### 12.3 Host dashboard `/host`

`GET /host/dashboard?from=&to=` (default current month in UTC; range ≤ 366 days and not older than 5 years) and `GET /host/payouts/summary`.

| Block | Fields |
|---|---|
| Range selector | Presets: This month (default), Last 30 days, Last 90 days, Year to date, Custom. Client enforces `from ≤ to`, ≤ 366 days |
| Needs your attention | `pendingRequests` with a countdown to `oldestPendingRequestExpiry` (warning colour under 6 h) → *Review requests*; `upcomingCheckIns` (next 7 days) |
| Earnings cards | `earnings.paidTotal`, `pendingTotal`, `heldTotal` (tooltip: held while a dispute is open), `thisMonthPaid` |
| Performance | `overallOccupancyRate` (percent with 1 decimal; the API returns 0 when the denominator is ≤ 0, so the UI never shows `NaN`), `averageRating` |
| Recent bookings | `recentBookings[]` table with status badges |
| Listings table | `listings[]`: cover, title, bookings, booked nights, blocked nights, occupancy, revenue, rating. Optional Recharts bar chart of revenue per listing, lazy-loaded |

Cached 60 s on the server, so the page shows an "Updated just now" label and a manual refresh.

### 12.4 Listings and the listing hub

**`/host/listings`:** `GET /host/listings?status=&page=&size=`. Cards or table with cover, title, city, status badge, price, rating; status filter chips; **New listing** button; empty state with the wizard CTA (host cap is 50 listings; the API's error is shown if reached).

**Status-driven actions** (what the UI offers; the API validates every transition):

| Status | Host actions | Notes |
|---|---|---|
| `DRAFT` | Edit, **Submit**, Delete | |
| `PENDING_REVIEW` | View, Delete | Editing is blocked: the API returns `409`, so the form is read-only with a banner "Under review" |
| `ACTIVE` | Edit, **Pause**, Delete | |
| `PAUSED` | Edit, **Resume**, Delete | Paused listings leave search; existing bookings stay valid |
| `REJECTED` | Edit and **resubmit**, Delete | Banner shows `rejectionReason` |
| `SUSPENDED` | View, Delete | Banner: "Suspended by an administrator"; only an admin can reinstate |
| `DELETED` | not listed | |

`DELETE` is confirmed in a dialog; `409 LISTING_HAS_ACTIVE_BOOKINGS` shows "You still have active bookings for this listing" with a link to host bookings filtered by that listing.

**`/host/listings/[id]` (hub, tabs):** Details · Photos · Amenities · House rules · Pricing and seasons · Calendar and blocks · Reviews. Each tab saves independently. Editing an `ACTIVE` listing:

* Price, text, amenities, rules and photos apply to **future bookings only**; the dialog on save says so (existing bookings keep their price snapshot).
* Changing `country`, `city`, coordinates, `addressLine` or `propertyType` sends the listing **back to review and out of search**. The form compares old and new values and shows a confirmation dialog naming the changed fields before calling `PUT /host/listings/{id}`.
* `409 CONCURRENT_MODIFICATION` → "Someone changed this listing. Reload" (optimistic locking).

#### 12.4.1 Pricing and seasonal rates tab

* Base pricing fields as in step 4 (full `PUT` update).
* **Seasonal rates:** `GET/POST /host/listings/{id}/seasonal-rates`, `PUT/DELETE …/{rateId}`. Form: `name` 2–60, `startDate`, `endDate` (**inclusive**: the last night covered), `nightlyPrice` 1.00–100000.00. Rules: end ≥ start, ≤ 366 days, end not in the past, no overlap (`409 DUPLICATE_RESOURCE` → "This overlaps another season"). Note: "Seasonal prices don't change existing bookings."

#### 12.4.2 Photos tab

| Rule | UI behaviour |
|---|---|
| Types JPEG, PNG, WebP; ≤ 5 MB; sides 400–8000 px; max 20 photos | Client pre-check (type, size, `createImageBitmap` for dimensions) with a per-file message; the server re-checks by magic bytes and decoding |
| Upload | `POST /host/listings/{id}/photos` multipart field `file`; two uploads at a time; per-file progress and retry. Errors: `400` empty file, `413` too large, `415` not a real image, `422` 21st photo |
| Order | Drag and drop (dnd-kit) then `PUT …/photos/order {photoIds}` which must contain **exactly** the listing's photos; the UI always sends the full ordered list |
| Cover | "Make cover" → `PATCH …/photos/{photoId}/cover`; deleting the cover promotes the next photo (the UI refetches) |
| Delete | `DELETE …/photos/{photoId}`; `422` if it would leave fewer than 3 photos on an `ACTIVE` or `PENDING_REVIEW` listing → message explains |
| Display | Thumbnails via `next/image`; a badge shows "Cover" |

#### 12.4.3 Calendar and blocks tab

* Calendar from `GET /listings/{id}/calendar` (public endpoint, so it shows only `BOOKED` / `BLOCKED` / `PAST` / `OUTSIDE_WINDOW` and per-night price, never guest details). Booked days link to *View reservations* filtered by listing.
* **Block dates:** click-and-drag a range, or use the form. The UI works with an **inclusive "last blocked night"** and sends `endDate = lastNight + 1 day` because the API's `endDate` is exclusive. Rules: start not in the past, ≤ 730 days, optional reason ≤ 200. `POST /host/listings/{id}/blocks`.
* Errors: `409 BOOKING_CONFLICT` "That range overlaps a reservation" · `409 DUPLICATE_RESOURCE` "That range overlaps another block".
* Block list `GET …/blocks` with **Remove** (`DELETE …/blocks/{blockId}`, confirm).

#### 12.4.4 Reviews tab

Published guest reviews for this listing via `GET /listings/{id}/reviews` (public). Writing reviews about guests happens from booking detail (12.5).

### 12.5 Host bookings `/host/bookings`

`GET /host/bookings?status=&listingId=&page=&size=`. Tabs: **Requests** (`PENDING_APPROVAL`), **Upcoming** (`CONFIRMED`), **Past** (`COMPLETED`), **Cancelled and other**. Columns: reference, guest first name, listing, dates, nights, `hostPayoutAmount`, status, and for requests a **time remaining** chip from `expiresAt`.

**Booking detail `/host/bookings/[id]`** (`GET /bookings/{id}`):

| Section | Content |
|---|---|
| Guest | First name before confirmation; last name and phone only after `CONFIRMED` (the API sets `gated`). A gated state reads "Full name and phone are shared once the booking is confirmed". **Guest email is never shown** (API never returns it) |
| Message from guest | The `message` text from checkout |
| Stay | Dates, nights, guests, check-in/out |
| Money (host view) | Accommodation subtotal, discount, cleaning fee, host commission, **your payout** (`hostPayoutAmount`). The guest's service fee and tax are not shown as host income |
| Timeline | `history[]` |
| Actions (from `allowedActions` only) | **APPROVE**: confirm dialog; `409 BOOKING_EXPIRED` → "This request expired" · **DECLINE**: reason 5–500 required; guest is refunded in full · **CANCEL**: reason 10–500; dialog warns "The guest is refunded in full, and cancellations count on your record"; only before check-in time (`CANCELLATION_NOT_ALLOWED` otherwise) · **REVIEW**: overall rating 1–5 and comment (no sub-ratings) · **OPEN_DISPUTE** · **MESSAGE** (⚠ C3: opens the guest's conversation if one exists, otherwise explains that the guest has not started one) |

### 12.6 Payouts `/host/payouts`

`GET /host/payouts/summary` → cards **Pending** (`pendingAmount`), **Paid** (`paidAmount`), **Held** (`heldAmount`, tooltip "Held while a dispute is open"), **Scheduled** (`scheduledCount`). `GET /host/payouts?status=&page=&size=` → table: booking, amount, status badge, `scheduledFor`, `paidAt`. Explainer: "Payouts are scheduled 24 hours after check-in."

### 12.7 AI listing-description helper

In wizard step 1 and the Details tab: a **Write a draft with AI** panel. Input: 1–15 short bullets (3–200 chars each) plus the already-chosen property type and city. `POST /ai/listing-description` → draft ≤ 1500 chars shown in a preview with **Use this draft** (copies into the editable description field) and **Discard**. Labelled "AI draft. Review before publishing"; never saved automatically (the API also does not save it). `503 AI_UNAVAILABLE` hides the panel for the rest of the session; `429` shows a countdown (10 per minute, 50 per day).

---

## 13. Support console and Admin panel

Neither Vrbo nor Airbnb publishes its internal tooling, so these two areas are **designed for the backend's actual capabilities** using common back-office patterns: dense tables, filters, detail pages with explicit consequence dialogs, and read-only audit.

**Shared back-office rules**

* Every destructive or irreversible action opens a confirmation dialog that states the consequence in one sentence and requires a reason where the API does.
* Reasons are free text with live length counters matching the API limits.
* Tables: sticky header, server-side pagination (size 20; audit 50), sortable only where the API sorts, URL-persisted filters, row click to detail, empty/error/loading states.
* Staff-only top bar has a **global lookup** (booking reference `BK-…`, or numeric ids for listings and users).
* Admin screens never display passwords, tokens or full payment data (the API does not return them).

### 13.1 Support console (`SUPPORT_AGENT`, `ADMIN`)

**Queue `/support/disputes`:** `GET /support/disputes?status=&page=&size=`. Tabs by status (Open, Under review, Resolved, Rejected). Columns: id, booking reference, category, status badge, raised date and age, assignee ("You", "Unassigned" or "Agent #id" from `assignedAgentId`).

**Case `/support/disputes/[id]`:** one call, `GET /support/disputes/{id}`, returns the dispute, booking, payment, status history and the two parties' chat messages.

> **Audit side effect:** every load of this endpoint writes a `DISPUTE_CONVERSATION_VIEWED` audit entry. The query is therefore configured with **no polling, no refetch on focus or reconnect and no prefetching**, and the page shows the notice "Viewing this case is recorded in the audit log".

| Panel | Content |
|---|---|
| Summary | Category, description, who raised it, dates |
| Booking | Reference, status, dates, parties, price snapshot |
| Payment | Amount, refunded total, **refundable amount**, refunds list |
| History | Booking status timeline |
| Conversation | Read-only transcript |
| Actions | **Assign to me** (`PATCH …/assign`, moves `OPEN` → `UNDER_REVIEW`; ⚠ C12 for admin reassignment). **Resolve** and **Reject** are enabled only when status is `UNDER_REVIEW` and the viewer is the assignee or an admin; otherwise a note explains why |

**Resolve form:** `resolutionType` radio: `FULL_REFUND` ("Refunds the full remaining amount: $X" using `refundableAmount`), `PARTIAL_REFUND` (amount input `0.01` to `refundableAmount`, ≤ 2 decimals), `NO_REFUND` (amount hidden); `note` 10–2000 required. A confirm dialog repeats the exact refund and states "Resolution is final. Both parties will be notified." Server errors shown verbatim: agent is a party to the dispute (`422`), refund exceeds remaining (`422`), wrong state (`409`). **Reject:** `note` 10–2000.

### 13.2 Admin: platform summary `/admin`

`GET /admin/summary?from=&to=` (default last 30 days, range ≤ 366 days).

| Block | Data |
|---|---|
| KPI cards | `grossMerchandiseValue`, `platformRevenue`, `newUsers`, `newListings`, `averageHostResponseHours` |
| Bookings by status | Bar chart from `bookingsByStatus` (a map keyed by status, coloured by the status tone map) |
| Disputes by status | Bar chart or list from `disputesByStatus` |
| Top cities | Table: city, country, bookings, revenue |
| Work queues | Shortcuts: pending listings (count from the queue), open disputes |

### 13.3 Admin: moderation `/admin/listings`

* **Queue:** `GET /admin/listings/pending` (oldest first): title, host, city, submitted age; row → review page.
* **Open by ID:** a box that opens `/admin/listings/{id}` for any status (compensates for the lack of an admin search endpoint, ⚠ C6). The same admin action bar also appears on the public listing page.
* **Review page** `/admin/listings/[id]` (`GET /admin/listings/{id}`): full read-only listing (gallery, all fields, amenities, rules, host, rejection reason), a **submit checklist** (≥ 3 photos, cover, required fields) and actions by status:

| Status | Actions | Input |
|---|---|---|
| `PENDING_REVIEW` | **Approve** (→ `ACTIVE`), **Reject** (→ `REJECTED`) | reject reason 10–500 |
| `ACTIVE`, `PAUSED` | **Suspend** (→ `SUSPENDED`) | reason required |
| `SUSPENDED` | **Reinstate** (→ `ACTIVE`) | none |

Errors: `422` host suspended or checklist not met; `409 INVALID_STATE_TRANSITION`.

* **Review removal:** on any review in the public list, admins see **Remove**: reason 5–500 → `DELETE /admin/reviews/{id}` with a JSON body; the rating recalculates server-side, so the page refetches the listing.

### 13.4 Admin: users `/admin/users`

`GET /admin/users?query=&role=&status=&page=&size=` (name or email search; wildcards are escaped server-side). Columns: id, name, email, role chips, status badge, host display name, created.

**Detail** `/admin/users/[id]` (`GET /admin/users/{id}`): profile, status, `suspensionReason`, roles. Actions:

| Action | Behaviour |
|---|---|
| Suspend | Reason 10–500. Dialog lists the consequences from the backend rules: sessions end immediately, active listings become suspended, pending host requests are declined with full refunds, pending payments expire, confirmed bookings are left alone and support is alerted |
| Unsuspend | Dialog notes that **listings are not restored automatically**; an admin must reinstate each one |
| Roles | Checkboxes for `SUPPORT_AGENT` and `ADMIN` only. `GUEST` is shown checked and locked; `HOST` is shown locked with "granted only through host onboarding". Sends only the grantable roles (⚠ C13) via `PATCH /admin/users/{id}/roles` |

Self-protection in the UI (the API also enforces it with `422`): the signed-in admin's own row has suspend and role changes disabled; other admins cannot be suspended; the last admin cannot be demoted.

### 13.5 Admin: booking lookup `/admin/bookings`

Input accepts a booking id or reference (`BK-…`). References use `GET /bookings/reference/{ref}` (staff are allowed); ids use `GET /admin/bookings/{id}`. Renders the same read-only booking view as trip detail plus the full status history. No mutations from here (disputes handle money).

### 13.6 Admin: commission `/admin/commission`

* **History:** `GET /admin/commission-settings` (paged): guest service fee %, host commission %, tax %, effective from, created by, created at. The row currently in force (greatest `effectiveFrom` ≤ now) is highlighted "Current".
* **New setting:** three percent fields 0–30 with ≤ 2 decimals, and `effectiveFrom` (date-time picker, shown in UTC and local time) with minimum **now + 2 minutes** (API: at least one minute in the future; never backdated). A diff against the current row is shown before submit, with the note "Applies to new bookings only. Existing bookings keep the rates they were made with." `POST /admin/commission-settings`; `409 DUPLICATE_RESOURCE` if `effectiveFrom` already exists.

### 13.7 Admin: amenities `/admin/amenities`

Table from `GET /amenities` (active only today, ⚠ C6) with name, category, icon preview, usage. **Add/Edit** dialog: `name` 2–60 (unique, case-insensitive: `409 DUPLICATE_RESOURCE`), `category`, `icon` key (select with preview, free text allowed). **Delete** explains "If this amenity is in use it will be deactivated instead" (`DELETE /admin/amenities/{id}`). The public amenity list is cached for 1 hour server-side; after an edit the UI refetches and notes that guests may see the change within the hour.

### 13.8 Admin: audit log `/admin/audit`

`GET /admin/audit?actor=&entityType=&action=&from=&to=&page=&size=` (read-only, size 50). Filters: actor id, entity type, **action** (select: `USER_SUSPENDED`, `USER_UNSUSPENDED`, `ROLE_CHANGED`, `HOST_ONBOARDED`, `LISTING_SUBMITTED`, `LISTING_APPROVED`, `LISTING_REJECTED`, `LISTING_SUSPENDED`, `LISTING_REINSTATED`, `LISTING_DELETED`, `COMMISSION_CHANGED`, `BOOKING_CANCELLED_BY_HOST`, `REFUND_ISSUED`, `PAYOUT_PAID`, `DISPUTE_OPENED`, `DISPUTE_ASSIGNED`, `DISPUTE_RESOLVED`, `DISPUTE_CONVERSATION_VIEWED`, `REVIEW_REMOVED`, `PLATFORM_ABSORBED_REFUND`), date range. Row: time, actor (id and roles), action badge, entity type and id (linked when a screen exists), IP address; expandable details with before/after rendered as a readable key/value diff.


---

## 14. Cross-cutting behaviour

### 14.1 Error-code UX matrix (every code in backend Section 11)

| Code (HTTP) | Default UX | Specific handling |
|---|---|---|
| `VALIDATION_ERROR` (400) | Map `fieldErrors[].field` to form fields; unmatched → form alert | All forms |
| `MALFORMED_REQUEST` (400) | "Something in that request wasn't valid" + `traceId` | Search: drop the bad parameter from the URL |
| `INVALID_DATE_RANGE` (400) | Inline on the date field | Search, quote, calendar, dashboards |
| `INVALID_PAGE_SIZE`, `INVALID_SORT` (400) | Reset to defaults silently | Search, tables |
| `INVALID_OR_EXPIRED_TOKEN` (400) | "This link is invalid or has expired" + request-new link | Verify email, reset password |
| `UNAUTHENTICATED` (401) | Refresh once and retry; on failure go to login with `next` | `api()` client |
| `INVALID_CREDENTIALS` (401) | "Invalid email or password" | Login only; never triggers refresh |
| `REFRESH_TOKEN_REUSED` (401) | Clear tokens, "For your security, please sign in again" | Token manager |
| `PAYMENT_FAILED` (402) | By `failureCode` (11.1.2) | Pay step |
| `FORBIDDEN` (403) | Forbidden page or inline "You can't do that" | Guards, actions |
| `ACCOUNT_SUSPENDED` (403) | "This account is suspended. Contact support" | Login; any call |
| `EMAIL_NOT_VERIFIED` (403) | Verification prompt with resend | Book, message, submit listing, become host |
| `RESOURCE_NOT_FOUND` (404) | Not Found page (never hints at existence) | Detail pages |
| `EMAIL_ALREADY_REGISTERED` (409) | Inline on email with login link | Register |
| `DUPLICATE_RESOURCE` (409) | Contextual message (already host, already reviewed, dispute open, overlapping season/block, amenity name taken) | Many |
| `BOOKING_CONFLICT` (409) | "Those dates aren't available" + refresh calendar | Quote, checkout, host blocks |
| `PRICE_CHANGED` (409) | New-price dialog using the quote in the body | Checkout |
| `INVALID_STATE_TRANSITION` (409) | "That's no longer possible" + refetch the resource | Any action |
| `BOOKING_EXPIRED` (409) | Hold or request expired message | Pay, approve |
| `CANCELLATION_NOT_ALLOWED` (409) | Show the reason; offer dispute | Cancel dialogs |
| `LISTING_NOT_BOOKABLE` (409) | "This home isn't available" | Checkout |
| `LISTING_HAS_ACTIVE_BOOKINGS` (409) | Explain and link to bookings | Delete listing |
| `CONCURRENT_MODIFICATION` (409) | "Changed elsewhere. Reload" with button | Edits |
| `BUSINESS_RULE_VIOLATION` (422) | Show the server's readable `detail` | Many |
| `IDEMPOTENCY_KEY_REUSED` (422) | Regenerate key, retry once | Booking, messages |
| `PAYLOAD_TOO_LARGE` (413), `UNSUPPORTED_MEDIA_TYPE` (415) | Per-file upload message | Photos |
| `RATE_LIMITED` (429) | Disable control; cooldown from `Retry-After` or 60 s | All |
| `AI_UNAVAILABLE` (503) | Hide the AI widget, no error toast | AI features |
| `SERVICE_UNAVAILABLE` (503) | Degrade the affected feature | Messaging |
| `INTERNAL_ERROR` (500) | "Something went wrong" + `traceId` + retry | Global |
| 405 | Developer error; logged | |

### 14.2 Loading, empty and error states

Every data view implements all four states: **loading** (skeleton shaped like the final content, no layout shift), **empty** (illustration-free text, one clear next action), **error** (message, **Try again**, `traceId` in small text), **populated**. Buttons that call the API show a spinner and are disabled while pending. Long lists use skeleton rows, not spinners.

### 14.3 Feedback patterns

| Pattern | Used for |
|---|---|
| Toast (4 s, `role="status"`) | Success of low-risk actions (saved, marked read, copied) |
| Inline alert | Form-level errors, business-rule errors next to the action |
| Banner (page top) | Email not verified, listing under review, suspended, test-mode payments |
| Dialog | Destructive confirmations; price-changed; consequences of admin actions |
| Full-page state | Not found, forbidden, fatal error |

### 14.4 Session and offline behaviour

* Session expiry mid-form: the form keeps its values, the refresh flow runs, and if it fails the user logs in and returns to the same URL (`next`). Checkout state is recoverable from the server hold.
* Offline: a banner "You're offline" (`navigator.onLine` plus failed request); mutations are disabled rather than queued.
* Tab visibility: polling pauses when hidden and resumes with a refetch.
* Multiple tabs: logout and login are broadcast (`BroadcastChannel('auth')`); refresh is serialised by Web Locks.

### 14.5 Polling schedule (no WebSockets in v1)

| Data | Interval | Condition |
|---|---|---|
| Open conversation messages | 8 s | Tab visible and thread open |
| Conversation list | 30 s | Visible |
| `conversations/unread-count`, `notifications/unread-count` | 30 s | Signed in and visible |
| Booking detail while `PENDING_PAYMENT` or `PENDING_APPROVAL` | 15 s | Visible; stops at terminal states |
| Host dashboard | none (manual refresh; server caches 60 s) | |
| Support case detail | **never** (each load is audited) | |

### 14.6 Query keys, stale times and invalidation

| Query key | `staleTime` | Notes |
|---|---|---|
| `['amenities']` | 1 h | Mirrors server cache |
| `['search', params]` | 30 s | |
| `['listing', id]` | 60 s | |
| `['quote', id, checkIn, checkOut, guests]` | **0** | Never cached for decisions |
| `['calendar', id, from, to]` | **0** on listing/checkout, 60 s elsewhere | |
| `['reviews', listingId, sort, page]` | 60 s | |
| `['me']` | 5 min | Refetch after role-changing actions |
| `['trips']`, `['booking', ref]` | 15 s | |
| `['hostDashboard', from, to]` | 60 s | |
| `['conversations']`, `['messages', id]` | 0 | Polled |

| Mutation | Invalidates |
|---|---|
| Create booking | `['trips']`, `['bookings','mine']` |
| Pay | `['booking', ref]`, `['trips']`, `['notifications']`, `['calendar', listingId]` |
| Cancel (guest) | `['booking', ref]`, `['trips']`, `['payment', id]`, `['calendar', listingId]` |
| Host approve, decline, cancel | `['hostBookings']`, `['booking', id]`, `['hostDashboard']`, `['calendar', listingId]`, `['payouts']` |
| Review submit | `['booking', id,'reviews']`, `['reviews','pending']`, `['listing', listingId]` |
| Send message | `['messages', id]`, `['conversations']`; mark read → unread counts |
| Listing edit, submit, pause, resume, delete | `['hostListings']`, `['listing', id]`, `['search']` |
| Photo upload, order, cover, delete | `['listing', id]`, `['hostListing', id]` |
| Block or seasonal rate change | `['calendar', id]`, `['seasonalRates', id]`, `['blocks', id]` |
| Admin listing action | `['adminListings']`, `['listing', id]`, `['search']` |
| Admin user action | `['adminUsers']`, `['adminUser', id]` |
| Commission create | `['commission']` |
| Become host, profile edit | `['me']` |

### 14.7 Formatting

| Value | Rule |
|---|---|
| Money | `new Intl.NumberFormat('en-US', {style:'currency', currency:'USD'})`; whole-dollar display only where the value is whole and space is tight (cards); breakdown always shows cents |
| Calendar dates | Parsed and formatted as `LocalDate` (no `Date` time-zone shift), for example "Oct 3, 2026" |
| Instants | `Intl.DateTimeFormat` with `timeZone` = the listing's IANA zone for check-in/out; user's local zone for everything else (messages, notifications) with a tooltip showing UTC |
| Ratings | Two decimals from the API shown with one decimal ("4.8") and stars; `reviewCount = 0` → "New" |
| Nights and guests | Pluralised ("1 night", "3 nights", "1 guest") |
| Percentages | Up to 2 decimals, trailing zeros trimmed |
| Relative time | `Intl.RelativeTimeFormat`, absolute in tooltip |

---

## 15. Quality

### 15.1 Accessibility (WCAG 2.2 AA)

* Semantic landmarks, one H1 per page, logical heading order, skip link.
* All controls keyboard-operable; visible focus; no keyboard traps; dialogs, drawers and popovers trap and restore focus (Radix).
* Combobox (destination), date picker (arrow keys, Page Up/Down for months, Home/End), star inputs (radio group), carousels (buttons, no auto-advance), lightbox: each follows the matching WAI-ARIA pattern.
* Status never by colour alone: badges include text; errors include an icon and text; charts have a data-table alternative.
* Contrast: palette values are pre-checked; no white text on highlight or soft backgrounds; focus ring ≥ 3:1.
* Forms: visible labels, `aria-describedby` for help and errors, `aria-invalid`, errors summarised and focused on submit, `autocomplete` attributes (`email`, `given-name`, `family-name`, `tel`, `new-password`, `current-password`).
* Live regions for toasts, countdowns (announce at 5 min, 1 min, 10 s only, not every second) and new messages.
* Touch targets ≥ 44 px; `prefers-reduced-motion` respected; zoom to 200% without loss.
* CI: axe on every route in Playwright; manual screen-reader pass (VoiceOver, NVDA) on landing, search, listing, checkout, inbox.

### 15.2 Performance

| Budget | Target |
|---|---|
| LCP | ≤ 2.5 s (p75, mobile 4G) |
| INP | ≤ 200 ms |
| CLS | ≤ 0.1 |
| JS per route (gzipped) | Landing ≤ 170 KB, search ≤ 220 KB, listing ≤ 250 KB (map and charts lazy), authenticated screens ≤ 300 KB |
| Images | Everything through `next/image`; hero preloaded; below-the-fold lazy |

Techniques: server components for public pages; dynamic imports for Leaflet, Recharts, lightbox, dnd-kit and the admin/host route groups; prefetch on hover for cards; `staleTime` aligned with backend caches; no layout-shifting skeletons; fonts self-hosted with `font-display: swap`. Lighthouse CI fails the build below 90 (performance) on landing, search and listing.

### 15.3 SEO

* Indexable: `/`, `/search?city=…` (city pages), `/listings/[id]` (ACTIVE only), `/hosts/[id]`, static pages. Everything else: `noindex`.
* `sitemap.ts` pages through `GET /search?size=50` at build/ISR time to emit listing and city URLs; `robots.ts` disallows authenticated areas.
* Titles and descriptions per page; canonical URLs; Open Graph and Twitter cards; JSON-LD (`WebSite` + `SearchAction`, listing `VacationRental`/`LodgingBusiness`, `BreadcrumbList`).
* Search URLs with dates, price or several filters: `noindex,follow` and canonical to the city page.

### 15.4 Security

| Area | Measure |
|---|---|
| XSS | React escaping only; **no `dangerouslySetInnerHTML`** anywhere (lint rule). All user text (descriptions, reviews, messages) is plain text. The backend also strips HTML |
| CSP | `default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: <API origin> https://*.tile.openstreetmap.org; connect-src 'self' <API origin>; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`. A payment provider adds its own origins (C9) |
| Headers | `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, mic, geolocation denied except the host map picker), HSTS in production |
| Tokens | Access token in memory; refresh token in `localStorage` (C10). Never logged, never in URLs, never sent to analytics. Strict CSP and dependency audits are the compensating controls |
| Open redirects | `next` accepted only when it starts with a single `/` and not `//` |
| Links | External links `rel="noopener noreferrer"` |
| Payments | No card number is ever read, stored or sent by this app; `paymentToken` only |
| Uploads | Client pre-checks are convenience; the server re-validates by content |
| PII | Do not put emails, phones or message text in analytics events, error reports or URLs |
| Dependencies | Lockfile, `pnpm audit` and Dependabot in CI; `eslint-plugin-no-secrets` |
| Test mode | The fake payment picker is excluded from production bundles by `NEXT_PUBLIC_PAYMENT_MODE` dead-code elimination, and a production build fails if `fake` is set |

### 15.5 Observability

`web-vitals` reported to the analytics endpoint; an error reporter (Sentry or equivalent) with **`traceId` from `ApiError` attached**, and scrubbing of tokens and PII; a feature-level breadcrumb trail for checkout (step, status codes, no personal data).

### 15.6 Testing strategy

| Level | Tooling | What |
|---|---|---|
| Unit | Vitest | `LocalDate` maths, `maxCheckOut`, `freeCancellationUntil` (boundaries 24 h, 120 h, DST change day), status maps, zod schemas (password bytes, E.164, money decimals), idempotency key derivation, notification link resolver |
| Component | Testing Library + MSW | Forms and their server-error mapping, booking card states, price breakdown, role-based menus, route guards |
| Contract | `/v3/api-docs` snapshot diff, generated types | Fails on removed paths or fields |
| E2E | Playwright against `docker compose up` with seed data | Flows below |
| Accessibility | axe in e2e, Storybook a11y addon | Zero serious violations |
| Performance | Lighthouse CI | Budgets above |

**Mandatory e2e scenarios** (seed users: `guest1@rentals.test`, `host1@rentals.test`, `support@rentals.test`, `admin@rentals.test`, password `Password123!`):

1. Visitor searches by city and dates, opens a listing, sees quote, is sent to login, returns to checkout.
2. Instant-book checkout with `tok_success` ends `CONFIRMED`; the same flow with a request-to-book listing ends `PENDING_APPROVAL`.
3. `tok_decline` and `tok_insufficient` show the correct messages and release the dates.
4. Double-click on **Continue to payment** creates exactly one booking (idempotency).
5. Price changes between quote and hold → price-changed dialog → accept → success.
6. Two guests race for the same dates: one succeeds, one sees "dates just taken".
7. Hold expiry: countdown reaches zero, pay is blocked.
8. Host approves, declines and lets a request expire (time-travel the backend clock in the test profile).
9. Guest cancels under each policy: the preview matches the refund actually issued.
10. Host cancels (full refund, warning shown).
11. Blind review: first review hidden, second reveals both.
12. Messaging: send, retry with same key shows one message, unread badge, read receipt.
13. Dispute: guest opens, agent assigns and resolves with partial refund, host payout shows held then adjusted.
14. Admin approves a pending listing; it appears in search.
15. Role matrix: guest gets Forbidden on `/host`, host on `/admin`, agent on `/admin`; another user's booking URL shows Not Found.
16. Two tabs refresh simultaneously: no logout (Web Locks), and a stale refresh token logs out cleanly.
17. Email verification link used once (Strict Mode safe) and a second use shows the expired state.

---

## 16. Deployment and CI

### 16.1 Container

Multi-stage Dockerfile: install with pnpm → `next build` with `output: 'standalone'` → run on `node:22-alpine` as a non-root user; health route `/healthz`. Added to `docker-compose.yml` as service `web` (port 3000, `depends_on` the backend with `condition: service_healthy`) with `NEXT_PUBLIC_API_BASE_URL` set to the **browser-reachable** backend URL and `API_INTERNAL_URL` set to the Docker network URL. Backend `APP_CORS_ORIGINS` and `APP_FRONTEND_URL` are set to the web origin.

### 16.2 Pipeline

1. Install (frozen lockfile) → lint → typecheck.
2. Fetch `/v3/api-docs` from the compose backend → regenerate types → fail on diff against the committed snapshot.
3. Unit and component tests with coverage gate (≥ 80% on `lib/`, `api/`, `features/booking`).
4. Build; fail if `NEXT_PUBLIC_PAYMENT_MODE=fake` in a production build.
5. Playwright e2e on the compose stack; axe; Lighthouse CI.
6. Build and push the image; deploy behind HTTPS (reverse proxy), long-cache immutable static assets, short cache for HTML.

### 16.3 Environments

`dev` (fake payments, MSW optional, MailHog for emails at `localhost:8025`), `staging` (fake payments, production-like headers), `prod` (provider payments, strict CSP, analytics on).

---

## 17. Delivery roadmap

Aligned with the backend build order so the frontend can progress in parallel.

| Phase | Backend phase | Frontend deliverable | Done when |
|---|---|---|---|
| F1 | 1 Auth and security | Project, tokens (CSS), UI kit, `api()` client, token manager, shells, guards, login/register/verify/reset, account profile, static landing skeleton | Register, verify, login, silent refresh across two tabs and logout work; axe clean |
| F2 | 2 Listings and moderation | Listing page (read), host onboarding, wizard (steps 1–9), photos, listing hub, admin moderation queue and review page | A listing goes DRAFT → ACTIVE through the UI |
| F3 | 3 Availability and pricing | Date picker with calendar data, booking card with quote, seasonal rates, host calendar and blocks, price breakdown component | Check-out-exclusive logic and quote errors tested |
| F4 | 4 Search and caching | Search page with all filters, autocomplete, **full landing page**, SEO and sitemap | Landing and search meet performance budgets |
| F5 | 5 Booking and payment | Checkout, pay step, confirmation, trips, trip detail with cancel preview, host bookings and payouts | Booking e2e scenarios 2–10 green |
| F6 | 6 Reviews, messaging, notifications | Review forms and lists, inbox, bell, notifications | Scenarios 11–12 green |
| F7 | 7 Disputes, dashboard, admin | Disputes (guest and support), host dashboard, admin summary, users, commission, amenities, audit | Scenarios 13–15 green |
| F8 | 8 AI and polish | AI widgets, performance and accessibility passes, empty/error state audit, docs | Definition of done (Section 19) |

**If time runs short, cut from the bottom** (mirrors the backend): AI widgets, then host dashboard charts, then disputes UI. F1–F5 alone make a complete, bookable product.

---

## 18. Endpoint coverage matrix

Every endpoint in backend Section 12 appears here with the screen that uses it. "Hook" names are in `features/<module>/api.ts`.

### Auth and user

| Method and path | Auth | Screen | Hook |
|---|---|---|---|
| `POST /auth/register` | public | Register | `useRegister` |
| `POST /auth/login` | public | Login, post-register sign-in | `useLogin` |
| `POST /auth/refresh` | public | Token manager only | `refreshOnce` |
| `POST /auth/logout` | user | Avatar menu | `useLogout` |
| `POST /auth/verify-email` | public | Verify page | `useVerifyEmail` |
| `POST /auth/resend-verification` | public | Banner, verify page | `useResendVerification` |
| `POST /auth/forgot-password` | public | Forgot password | `useForgotPassword` |
| `POST /auth/reset-password` | public | Reset password | `useResetPassword` |
| `POST /auth/change-password` | user | Account security | `useChangePassword` |
| `GET /users/me` | user | Session bootstrap, account | `useMe` |
| `PATCH /users/me` | user | Account profile | `useUpdateProfile` |
| `DELETE /users/me` | user | Account security | `useDeleteAccount` |
| `POST /users/me/become-host` | user | Become host | `useBecomeHost` |
| `GET /hosts/{userId}` | public | Host profile, listing host card | `useHostProfile` |

### Browse

| Method and path | Auth | Screen | Hook |
|---|---|---|---|
| `GET /search` | public | Landing blocks, search | `useSearch`, server `searchServer` |
| `GET /search/suggestions/cities` | public | Destination combobox | `useCitySuggestions` |
| `GET /listings/{id}` | public (owner/admin any status) | Listing page, previews | `useListing` |
| `GET /listings/{id}/calendar` | public | Date picker, host calendar | `useCalendar` |
| `GET /listings/{id}/quote` | public | Booking card, checkout step 1 | `useQuote` |
| `GET /listings/{id}/reviews` | public | Listing reviews | `useListingReviews` |
| `GET /ai/listings/{id}/review-summary` | public | Listing page | `useReviewSummary` |
| `GET /amenities` | public | Search filters, wizard, admin amenities | `useAmenities` |
| `GET /media/listings/{listingId}/{filename}` | public | Every image | `mediaUrl()` |
| `GET /health` | public | `/healthz` upstream check | none |

### Guest

| Method and path | Auth | Screen | Hook |
|---|---|---|---|
| `POST /bookings` | user | Checkout step 1 | `useCreateBooking` |
| `POST /bookings/{id}/pay` | guest | Pay step | `usePayBooking` |
| `GET /bookings/mine` | user | Hold resume lookup | `useMyBookings` |
| `GET /bookings/{id}` | party/staff | Host booking detail, polling | `useBooking` |
| `GET /bookings/reference/{ref}` | party/staff | Trip detail, admin lookup | `useBookingByRef` |
| `GET /bookings/{id}/cancellation-preview` | party | Cancel dialog | `useCancellationPreview` |
| `POST /bookings/{id}/cancel` | guest | Cancel dialog | `useCancelBooking` |
| `GET /bookings/{id}/payment` | guest | Trip detail | `usePayment` |
| `GET /dashboard/trips` | user | Trips | `useTrips` |
| `POST /bookings/{id}/reviews` | party | Review form | `useCreateReview` |
| `GET /bookings/{id}/reviews` | party | Trip detail | `useBookingReviews` |
| `GET /reviews/pending` | user | Trips banner, reviews page | `usePendingReviews` |
| `POST /bookings/{id}/disputes` | party | Dispute form | `useOpenDispute` |
| `GET /disputes/mine` | user | My disputes | `useMyDisputes` |
| `POST /ai/trip-plan` | user | Trip detail, listing page | `useTripPlan` |

### Messaging and notifications

| Method and path | Auth | Screen | Hook |
|---|---|---|---|
| `POST /conversations` | user | Contact host | `useStartConversation` |
| `GET /conversations` | user | Inbox list | `useConversations` |
| `GET /conversations/{id}` | participant | Thread header | `useConversation` |
| `GET /conversations/{id}/messages` | participant | Thread | `useMessages` (infinite) |
| `POST /conversations/{id}/messages` | participant | Composer | `useSendMessage` |
| `POST /conversations/{id}/read` | participant | Thread | `useMarkRead` |
| `GET /conversations/unread-count` | user | Header and tab bar badge | `useUnreadMessages` |
| `GET /notifications` | user | Bell, page | `useNotifications` |
| `GET /notifications/unread-count` | user | Bell badge | `useUnreadNotifications` |
| `PATCH /notifications/{id}/read` | user | Item click | `useMarkNotificationRead` |
| `PATCH /notifications/read-all` | user | Notifications page | `useMarkAllRead` |

### Host

| Method and path | Auth | Screen | Hook |
|---|---|---|---|
| `POST /host/listings` | HOST | Wizard step 5 | `useCreateListing` |
| `GET /host/listings` | HOST | My listings | `useHostListings` |
| `GET /host/listings/{id}` | HOST | Listing hub | `useHostListing` |
| `PUT /host/listings/{id}` | HOST | Hub details/pricing | `useUpdateListing` |
| `DELETE /host/listings/{id}` | HOST | Listings, hub | `useDeleteListing` |
| `POST /host/listings/{id}/submit` | HOST | Wizard step 9, hub | `useSubmitListing` |
| `POST /host/listings/{id}/pause` | HOST | Listings, hub | `usePauseListing` |
| `POST /host/listings/{id}/resume` | HOST | Listings, hub | `useResumeListing` |
| `PUT /host/listings/{id}/amenities` | HOST | Wizard step 6, hub | `useSetAmenities` |
| `PUT /host/listings/{id}/house-rules` | HOST | Wizard step 7, hub | `useSetHouseRules` |
| `GET /host/listings/{id}/house-rules` | HOST | Hub rules tab | `useHouseRules` |
| `POST /host/listings/{id}/photos` | HOST | Photo uploader | `useUploadPhoto` |
| `GET /host/listings/{id}/photos` | HOST | Photos tab (if listing payload lacks them) | `usePhotos` |
| `PUT /host/listings/{id}/photos/order` | HOST | Photos tab | `useReorderPhotos` |
| `PATCH /host/listings/{id}/photos/{photoId}/cover` | HOST | Photos tab | `useSetCover` |
| `DELETE /host/listings/{id}/photos/{photoId}` | HOST | Photos tab | `useDeletePhoto` |
| `GET /host/listings/{id}/blocks` | HOST | Calendar tab | `useBlocks` |
| `POST /host/listings/{id}/blocks` | HOST | Calendar tab | `useCreateBlock` |
| `DELETE /host/listings/{id}/blocks/{blockId}` | HOST | Calendar tab | `useDeleteBlock` |
| `GET /host/listings/{id}/seasonal-rates` | HOST | Pricing tab | `useSeasonalRates` |
| `POST /host/listings/{id}/seasonal-rates` | HOST | Pricing tab | `useCreateSeasonalRate` |
| `PUT /host/listings/{id}/seasonal-rates/{rateId}` | HOST | Pricing tab | `useUpdateSeasonalRate` |
| `DELETE /host/listings/{id}/seasonal-rates/{rateId}` | HOST | Pricing tab | `useDeleteSeasonalRate` |
| `GET /host/bookings` | HOST | Host bookings | `useHostBookings` |
| `POST /host/bookings/{id}/approve` | HOST | Host booking detail | `useApproveBooking` |
| `POST /host/bookings/{id}/decline` | HOST | Host booking detail | `useDeclineBooking` |
| `POST /host/bookings/{id}/cancel` | HOST | Host booking detail | `useHostCancelBooking` |
| `GET /host/payouts` | HOST | Payouts | `usePayouts` |
| `GET /host/payouts/summary` | HOST | Payouts, dashboard | `usePayoutSummary` |
| `GET /host/dashboard` | HOST | Dashboard | `useHostDashboard` |
| `GET /host/dashboard/listings` | HOST | Dashboard listings table | `useHostListingMetrics` |
| `POST /ai/listing-description` | HOST | Wizard step 1, hub | `useListingDraft` |

### Support and admin

| Method and path | Auth | Screen | Hook |
|---|---|---|---|
| `GET /support/disputes` | SUPPORT/ADMIN | Queue | `useSupportDisputes` |
| `GET /support/disputes/{id}` | SUPPORT/ADMIN | Case (no polling) | `useSupportDispute` |
| `PATCH /support/disputes/{id}/assign` | SUPPORT/ADMIN | Case | `useAssignDispute` |
| `POST /support/disputes/{id}/resolve` | SUPPORT/ADMIN | Case | `useResolveDispute` |
| `POST /support/disputes/{id}/reject` | SUPPORT/ADMIN | Case | `useRejectDispute` |
| `GET /admin/summary` | ADMIN | Summary | `useAdminSummary` |
| `GET /admin/listings/pending` | ADMIN | Moderation queue | `usePendingListings` |
| `GET /admin/listings/{id}` | ADMIN | Review page | `useAdminListing` |
| `POST /admin/listings/{id}/approve` | ADMIN | Review page, listing admin bar | `useApproveListing` |
| `POST /admin/listings/{id}/reject` | ADMIN | Review page | `useRejectListing` |
| `POST /admin/listings/{id}/suspend` | ADMIN | Review page, admin bar | `useSuspendListing` |
| `POST /admin/listings/{id}/reinstate` | ADMIN | Review page, admin bar | `useReinstateListing` |
| `GET /admin/users` | ADMIN | Users | `useAdminUsers` |
| `GET /admin/users/{id}` | ADMIN | User detail | `useAdminUser` |
| `POST /admin/users/{id}/suspend` | ADMIN | User detail | `useSuspendUser` |
| `POST /admin/users/{id}/unsuspend` | ADMIN | User detail | `useUnsuspendUser` |
| `PATCH /admin/users/{id}/roles` | ADMIN | User detail | `useSetRoles` |
| `GET /admin/bookings/{id}` | ADMIN | Booking lookup | `useAdminBooking` |
| `GET /admin/audit` | ADMIN | Audit log | `useAuditLog` |
| `GET /admin/commission-settings` | ADMIN | Commission | `useCommissionHistory` |
| `POST /admin/commission-settings` | ADMIN | Commission | `useCreateCommission` |
| `POST /admin/amenities` | ADMIN | Amenities | `useCreateAmenity` |
| `PUT /admin/amenities/{id}` | ADMIN | Amenities | `useUpdateAmenity` |
| `DELETE /admin/amenities/{id}` | ADMIN | Amenities | `useDeleteAmenity` |
| `DELETE /admin/reviews/{id}` | ADMIN | Listing reviews (admin bar) | `useRemoveReview` |

---

## 19. Definition of done

- [ ] Every endpoint in Section 18 is referenced by exactly one hook in `endpoints.ts`, and generated types compile with no `any` on API data.
- [ ] CI contract diff against `/v3/api-docs` passes; all ⚠ items in Section 2.5 are answered and the assumptions column updated.
- [ ] Every route in Section 8 exists, has the correct guard, `noindex` where required, and loading, empty, error and forbidden states.
- [ ] No money is computed in the browser; `expectedTotal` is always the quote's `totalAmount`; host-only money fields never render in guest views.
- [ ] Every error code in Section 14.1 has tested handling; no screen switches on `detail`.
- [ ] Booking, cancel, message and review flows are safe against double submission (idempotency keys, disabled buttons).
- [ ] Token refresh is single-flight across tabs; reuse detection never logs a healthy user out; logout propagates to all tabs.
- [ ] Role matrix tested: wrong role → Forbidden, someone else's resource → Not Found; the UI never exposes an admin or host control to a user who lacks the role.
- [ ] Landing page meets Section 9 (all blocks fail independently, hero renders with the API down) and the performance budgets.
- [ ] axe reports no serious or critical violations on any route; manual screen-reader pass done on the five key flows.
- [ ] No `dangerouslySetInnerHTML`, no card numbers handled, fake payment picker absent from production bundles, CSP enforced.
- [ ] `docker compose up --build` from a clean checkout starts backend and frontend and the 17 e2e scenarios pass.

---

## 20. Appendices

### Appendix A: design tokens (`src/styles/tokens.css`, Tailwind v4)

```css
@import "tailwindcss";

@theme {
  /* Palette 1: Coastal Teal */
  --color-primary: #0F766E;
  --color-primary-dark: #115E59;
  --color-accent: #C2410C;            /* money-moving actions only */
  --color-accent-dark: #9A3412;
  --color-bg: #F8FAFC;
  --color-surface: #FFFFFF;
  --color-text: #0F172A;
  --color-muted: #475569;
  --color-border: #E2E8F0;
  --color-highlight: #CCFBF1;         /* dark text only */

  /* Status: text / soft background / solid */
  --color-success: #15803D;  --color-success-text: #166534;  --color-success-soft: #DCFCE7;
  --color-warning: #B45309;  --color-warning-text: #92400E;  --color-warning-soft: #FEF3C7;
  --color-danger:  #B91C1C;  --color-danger-text:  #991B1B;  --color-danger-soft:  #FEE2E2;
  --color-info:    #1D4ED8;  --color-info-text:    #1E40AF;  --color-info-soft:    #DBEAFE;
  --color-neutral: #475569;  --color-neutral-text: #334155;  --color-neutral-soft: #E2E8F0;

  --font-sans: var(--font-inter), system-ui, sans-serif;
  --font-heading: var(--font-poppins), system-ui, sans-serif;

  --radius-control: 8px;
  --radius-card: 12px;
  --radius-hero: 16px;
}

body { background: var(--color-bg); color: var(--color-text); font-family: var(--font-sans); }
h1, h2, h3 { font-family: var(--font-heading); font-weight: 600; }
:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
```

### Appendix B: API client (`src/api/client.ts`, errors)

```ts
// errors.ts
export interface Problem {
  status: number; title?: string; detail?: string; code?: string; traceId?: string;
  timestamp?: string; path?: string; fieldErrors?: { field: string; message: string }[];
  [extra: string]: unknown;               // PRICE_CHANGED carries the new quote here
}
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, readonly problem: Problem, readonly retryAfter: number) {
    super(problem.detail ?? code);
  }
  get fieldErrors() { return this.problem.fieldErrors ?? []; }
  get traceId() { return this.problem.traceId; }
  static async from(res: Response) {
    let problem: Problem = { status: res.status };
    try { problem = await res.json(); } catch { /* non-JSON error */ }
    const ra = Number(res.headers.get('Retry-After'));      // null unless exposed by CORS (C4)
    return new ApiError(res.status, problem.code ?? `HTTP_${res.status}`, problem, Number.isFinite(ra) && ra > 0 ? ra : 60);
  }
}

// client.ts
import { tokens, refreshOnce } from './tokens';

type Scalar = string | number | boolean;
export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, Scalar | Scalar[] | null | undefined>;
  body?: unknown;                         // JSON, or FormData for photo upload
  auth?: 'none' | 'required' | 'optional';
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export const API_BASE = typeof window === 'undefined'
  ? process.env.API_INTERNAL_URL!
  : process.env.NEXT_PUBLIC_API_BASE_URL!;

function url(path: string, query?: ApiOptions['query']) {
  const u = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null || v === '') continue;
    (Array.isArray(v) ? v : [v]).forEach(x => u.searchParams.append(k, String(x)));   // amenityIds repeated
  }
  return u.toString();
}

export async function api<T>(path: string, o: ApiOptions = {}): Promise<T> {
  const auth = o.auth ?? 'required';
  const isForm = typeof FormData !== 'undefined' && o.body instanceof FormData;

  const send = () => fetch(url(path, o.query), {
    method: o.method ?? 'GET',
    signal: o.signal,
    headers: {
      Accept: 'application/json',
      ...(o.body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
      ...(o.idempotencyKey ? { 'Idempotency-Key': o.idempotencyKey } : {}),
      ...(auth !== 'none' && tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}),
    },
    body: o.body === undefined ? undefined : isForm ? (o.body as FormData) : JSON.stringify(o.body),
  });

  if (auth !== 'none' && tokens.refresh && tokens.accessExpiresSoon()) await refreshOnce();   // proactive

  let res = await send();
  if (res.status === 401 && auth !== 'none') {
    const p = await res.clone().json().catch(() => ({}) as Problem);
    if (p.code === 'UNAUTHENTICATED' && (await refreshOnce())) res = await send();           // reactive, once
  }
  if (!res.ok) throw await ApiError.from(res);
  return (res.status === 204 ? undefined : await res.json()) as T;
}
```

### Appendix C: token manager with cross-tab single-flight refresh (`src/api/tokens.ts`)

```ts
import { API_BASE } from './client';

const RT_KEY = 'rt.v1';
let access: string | null = null;
let accessExpiresAt = 0;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('auth') : null;

export const tokens = {
  get access() { return access; },
  get refresh() { return typeof localStorage === 'undefined' ? null : localStorage.getItem(RT_KEY); },
  accessExpiresSoon(ms = 30_000) { return !access || Date.now() > accessExpiresAt - ms; },
  set(p: { accessToken: string; refreshToken: string; expiresIn: number }) {   // expiresIn is in seconds
    access = p.accessToken;
    accessExpiresAt = Date.now() + p.expiresIn * 1000;
    localStorage.setItem(RT_KEY, p.refreshToken);
  },
  clear(broadcast = true) {
    access = null; accessExpiresAt = 0;
    localStorage.removeItem(RT_KEY);
    if (broadcast) channel?.postMessage('logout');
  },
};
channel?.addEventListener('message', e => { if (e.data === 'logout') tokens.clear(false); });

let inflight: Promise<boolean> | null = null;

/** One refresh at a time in this tab, and one at a time across all tabs. */
export function refreshOnce(): Promise<boolean> {
  inflight ??= run().finally(() => { inflight = null; });
  return inflight;
}

async function run(): Promise<boolean> {
  const exec = async (): Promise<boolean> => {
    const rt = tokens.refresh;                 // read INSIDE the lock: another tab may have rotated it
    if (!rt) return false;
    let res: Response;
    try {
      res = await fetch(API_BASE + '/auth/refresh', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
    } catch { return false; }                  // offline: keep tokens, try later
    if (res.status === 401) { tokens.clear(); return false; }   // expired or REFRESH_TOKEN_REUSED
    if (!res.ok) return false;                 // 429/5xx: keep tokens
    tokens.set(await res.json());              // rotation: new access AND new refresh token
    return true;
  };
  return navigator.locks ? navigator.locks.request('auth-refresh', exec) : exec();
}
```

### Appendix D: idempotency keys (`src/lib/idempotency.ts`)

```ts
async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

/** Same payload, same key (a retry or reload returns the same booking). Changed payload, new key. */
export async function idempotencyKeyFor(scope: string, payload: Record<string, unknown>) {
  const sorted = JSON.stringify(Object.fromEntries(Object.entries(payload).sort(([a], [b]) => a.localeCompare(b))));
  const slot = `idem:${scope}:${await sha256(sorted)}`;
  let key = sessionStorage.getItem(slot);
  if (!key) { key = crypto.randomUUID(); sessionStorage.setItem(slot, key); }   // UUID: 36 chars, within the 64-char column
  return key;
}
// POST /bookings   → idempotencyKeyFor('booking', { listingId, checkIn, checkOut, guests, expectedTotal, message })
// POST message     → crypto.randomUUID() per message; the same key is reused only when the user taps Retry
```

### Appendix E: dates, check-out-exclusive calendar and free-cancellation logic

```ts
// lib/local-date.ts : calendar dates are strings 'yyyy-MM-dd'; arithmetic in UTC avoids DST and timezone shifts
const dayNumber = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86_400_000;
export const nightsBetween = (a: string, b: string) => dayNumber(b) - dayNumber(a);
export const addDays = (s: string, n: number) =>
  new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10) + n)).toISOString().slice(0, 10);

// features/availability/rules.ts
export interface CalendarDay {
  date: string; available: boolean;
  reason: 'BOOKED' | 'BLOCKED' | 'PAST' | 'OUTSIDE_WINDOW' | null; nightlyPrice: number | null;
}

/** Latest valid check-out for a check-in: the first unavailable NIGHT after it (check-out is exclusive,
 *  so that day may itself be unavailable and still be a valid departure day). null = not limited in the loaded window. */
export function maxCheckOut(days: CalendarDay[], checkIn: string): string | null {
  const start = days.findIndex(d => d.date === checkIn);
  if (start < 0) return null;
  for (let i = start; i < days.length; i++) if (!days[i].available) return days[i].date;
  return null;
}

export function isCheckOutSelectable(
  days: CalendarDay[], checkIn: string, candidate: string, minNights: number, maxNights: number,
) {
  const nights = nightsBetween(checkIn, candidate);
  if (nights < minNights || nights > maxNights) return false;
  const limit = maxCheckOut(days, checkIn);
  return limit === null || candidate <= limit;          // ISO date strings compare correctly
}

// lib/cancellation.ts : display only; the server's cancellation-preview is the authority for money
import { fromZonedTime } from 'date-fns-tz';
const FREE_WINDOW_HOURS = { FLEXIBLE: 24, MODERATE: 120 } as const;   // thresholds are inclusive (>=) on the backend
export function freeCancellationUntil(
  policy: 'FLEXIBLE' | 'MODERATE' | 'STRICT', checkIn: string, checkInTime: string, timezone: string,
): Date | null {
  if (policy === 'STRICT') return null;
  const checkInInstant = fromZonedTime(`${checkIn}T${checkInTime}`, timezone);
  return new Date(checkInInstant.getTime() - FREE_WINDOW_HOURS[policy] * 3_600_000);
}
```

### Appendix F: status map and register schema

```ts
// lib/status.ts
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
type Entry = { label: string; tone: Tone };
export const bookingStatus: Record<string, Entry> = {
  CONFIRMED: { label: 'Confirmed', tone: 'success' },
  PENDING_PAYMENT: { label: 'Awaiting payment', tone: 'warning' },
  PENDING_APPROVAL: { label: 'Waiting for host', tone: 'warning' },
  COMPLETED: { label: 'Completed', tone: 'neutral' },
  DECLINED: { label: 'Declined', tone: 'danger' },
  EXPIRED: { label: 'Expired', tone: 'neutral' },
  PAYMENT_FAILED: { label: 'Payment failed', tone: 'danger' },
  CANCELLED_BY_GUEST: { label: 'Cancelled by guest', tone: 'danger' },
  CANCELLED_BY_HOST: { label: 'Cancelled by host', tone: 'danger' },
};
export const statusOf = (map: Record<string, Entry>, v: string): Entry =>
  map[v] ?? { label: v.replaceAll('_', ' ').toLowerCase(), tone: 'neutral' };   // forward compatible

// features/auth/schemas.ts : mirrors backend rules (server stays authoritative)
import { z } from 'zod';
const bytes = (s: string) => new TextEncoder().encode(s).length;       // BCrypt limit is 72 BYTES, not characters
const name = z.string().trim().min(1).max(60).regex(/^\p{L}[\p{L} '-]*$/u, 'Letters, spaces, hyphens and apostrophes only');

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email(),
  password: z.string()
    .refine(s => bytes(s) >= 8 && bytes(s) <= 72, 'Use 8 to 72 characters')
    .refine(s => /\p{L}/u.test(s) && /\d/.test(s), 'Include a letter and a digit')
    .refine(s => s === s.trim(), 'No leading or trailing spaces'),
  firstName: name,
  lastName: name,
  phone: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, 'Use international format, e.g. +14155550123').optional()
    .or(z.literal('').transform(() => undefined)),
}).superRefine((v, ctx) => {
  const local = v.email.split('@')[0];
  if (local && v.password.toLowerCase().includes(local.toLowerCase()))
    ctx.addIssue({ code: 'custom', path: ['password'], message: 'Must not contain your email name' });
});
```

### Appendix G: `.env.example`

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
API_INTERNAL_URL=http://app:8080/api/v1
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_PAYMENT_MODE=fake
NEXT_PUBLIC_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
```

*End of document.*
