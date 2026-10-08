CREATE TABLE notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(120) NOT NULL,
  body VARCHAR(500) NOT NULL,
  link VARCHAR(200),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON notifications(user_id, read_at, created_at DESC);

CREATE TABLE audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id BIGINT REFERENCES users(id),
  action VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id BIGINT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);

CREATE OR REPLACE FUNCTION audit_logs_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_immutable BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();

CREATE TABLE listing_ai_summaries (
  listing_id BIGINT PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  review_count INT NOT NULL,
  summary VARCHAR(1500) NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reference Data: 25 Amenities
INSERT INTO amenities (name, category, icon, active) VALUES
('WiFi', 'Essentials', 'wifi', true),
('Kitchen', 'Essentials', 'kitchen', true),
('Air conditioning', 'Climate', 'ac', true),
('Heating', 'Climate', 'heating', true),
('Washer', 'Laundry', 'washer', true),
('Dryer', 'Laundry', 'dryer', true),
('Free parking', 'Parking', 'parking', true),
('Pool', 'Outdoor', 'pool', true),
('Hot tub', 'Outdoor', 'hot_tub', true),
('TV', 'Entertainment', 'tv', true),
('Dedicated workspace', 'Work', 'desk', true),
('Smoke alarm', 'Safety', 'alarm', true),
('First aid kit', 'Safety', 'first_aid', true),
('Fire extinguisher', 'Safety', 'extinguisher', true),
('Pets allowed', 'House rules', 'pets', true),
('Gym', 'Facilities', 'gym', true),
('BBQ grill', 'Outdoor', 'bbq', true),
('Balcony', 'Outdoor', 'balcony', true),
('Beach access', 'Location', 'beach', true),
('Elevator', 'Facilities', 'elevator', true),
('Crib', 'Family', 'crib', true),
('Hair dryer', 'Bathroom', 'dryer', true),
('Iron', 'Laundry', 'iron', true),
('Self check-in', 'Access', 'keypad', true),
('Carbon monoxide alarm', 'Safety', 'sensor', true);

-- Reference Data: Initial Commission Setting
INSERT INTO commission_settings (guest_service_fee_percent, host_commission_percent, tax_percent, effective_from)
VALUES (10.00, 3.00, 8.00, '1970-01-01 00:00:00+00');
