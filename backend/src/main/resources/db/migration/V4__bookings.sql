CREATE TABLE bookings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reference VARCHAR(12) NOT NULL UNIQUE,
  listing_id BIGINT NOT NULL REFERENCES listings(id),
  guest_id BIGINT NOT NULL REFERENCES users(id),
  host_id BIGINT NOT NULL REFERENCES users(id),
  idempotency_key VARCHAR(64),
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  nights INT NOT NULL CHECK (nights BETWEEN 1 AND 365),
  guests_count INT NOT NULL CHECK (guests_count BETWEEN 1 AND 50),
  status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING_PAYMENT','PENDING_APPROVAL','CONFIRMED','COMPLETED',
     'DECLINED','EXPIRED','PAYMENT_FAILED','CANCELLED_BY_GUEST','CANCELLED_BY_HOST')),
  instant_book BOOLEAN NOT NULL,
  guest_message VARCHAR(1000),
  nightly_subtotal NUMERIC(12,2) NOT NULL CHECK (nightly_subtotal >= 0),
  discount_total NUMERIC(12,2) NOT NULL CHECK (discount_total >= 0),
  cleaning_fee NUMERIC(12,2) NOT NULL CHECK (cleaning_fee >= 0),
  service_fee NUMERIC(12,2) NOT NULL CHECK (service_fee >= 0),
  tax_total NUMERIC(12,2) NOT NULL CHECK (tax_total >= 0),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  host_commission NUMERIC(12,2) NOT NULL CHECK (host_commission >= 0),
  host_payout_amount NUMERIC(12,2) NOT NULL CHECK (host_payout_amount >= 0),
  price_breakdown JSONB NOT NULL,
  cancellation_policy VARCHAR(10) NOT NULL,
  listing_timezone VARCHAR(50) NOT NULL,
  check_in_time TIME NOT NULL,
  check_out_time TIME NOT NULL,
  expires_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
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

CREATE TABLE booking_status_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  from_status VARCHAR(20),
  to_status VARCHAR(20) NOT NULL,
  actor_id BIGINT REFERENCES users(id),
  actor_type VARCHAR(10) NOT NULL CHECK (actor_type IN ('GUEST','HOST','SUPPORT','ADMIN','SYSTEM')),
  reason VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
