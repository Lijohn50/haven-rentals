CREATE TABLE availability_blocks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_id BIGINT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason VARCHAR(200),
  CONSTRAINT ck_block_range CHECK (end_date > start_date),
  CONSTRAINT no_overlapping_blocks EXCLUDE USING gist (
    listing_id WITH =, daterange(start_date, end_date, '[)') WITH &&)
);

CREATE TABLE seasonal_rates (
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
