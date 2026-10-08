-- Hibernate maps these as String/varchar; align the physical types so schema validation passes.
ALTER TABLE listings
  ALTER COLUMN country TYPE VARCHAR(2) USING BTRIM(country);

ALTER TABLE refresh_tokens
  ALTER COLUMN token_hash TYPE VARCHAR(64) USING BTRIM(token_hash);

ALTER TABLE one_time_tokens
  ALTER COLUMN token_hash TYPE VARCHAR(64) USING BTRIM(token_hash);