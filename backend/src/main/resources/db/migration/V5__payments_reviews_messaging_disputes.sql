CREATE TABLE payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES bookings(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING','SUCCEEDED','FAILED','PARTIALLY_REFUNDED','REFUNDED')),
  idempotency_key VARCHAR(80) NOT NULL UNIQUE,
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
  idempotency_key VARCHAR(80) NOT NULL UNIQUE,
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

CREATE TABLE conversations (
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
