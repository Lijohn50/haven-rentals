-- Ratings are mapped as Integer in the JPA entities; the physical type was SMALLINT.
ALTER TABLE reviews
  ALTER COLUMN overall_rating TYPE INTEGER,
  ALTER COLUMN cleanliness_rating TYPE INTEGER,
  ALTER COLUMN communication_rating TYPE INTEGER,
  ALTER COLUMN accuracy_rating TYPE INTEGER;