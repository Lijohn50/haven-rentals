-- Ensure listings with "Studio" in their title have property_type set to 'STUDIO'
UPDATE listings
SET property_type = 'STUDIO'
WHERE title ILIKE '%Studio%'
  AND property_type <> 'STUDIO';
