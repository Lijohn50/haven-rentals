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
  storage_key VARCHAR(120) NOT NULL UNIQUE,
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
