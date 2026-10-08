-- Externally hosted photos (e.g. a Cloudinary delivery URL) are never
-- uploaded to this application, so their byte size is unknown and the
-- service stores 0. Only files uploaded through the photo endpoint have a
-- real size, and those are always greater than zero.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'listing_photos_size_bytes_check'
          AND conrelid = 'listing_photos'::regclass
    ) THEN
        ALTER TABLE listing_photos DROP CONSTRAINT listing_photos_size_bytes_check;
    END IF;
END
$$;

ALTER TABLE listing_photos
    ADD CONSTRAINT listing_photos_size_bytes_nonneg CHECK (size_bytes >= 0);
