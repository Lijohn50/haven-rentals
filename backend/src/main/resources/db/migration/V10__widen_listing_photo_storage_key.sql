-- Photo references can now be an absolute Cloudinary delivery URL rather than a local
-- storage key. A full "https://res.cloudinary.com/<cloud>/image/upload/<transform>/<id>"
-- regularly exceeds the original 120 character budget.
ALTER TABLE listing_photos
  ALTER COLUMN storage_key TYPE VARCHAR(500);