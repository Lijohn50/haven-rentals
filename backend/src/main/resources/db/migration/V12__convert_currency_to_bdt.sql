-- V12: Adjust price check constraints for BDT scale and convert legacy USD records

-- 1. Widen listings price check constraints
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_base_nightly_price_check;
ALTER TABLE listings ADD CONSTRAINT listings_base_nightly_price_check 
    CHECK (base_nightly_price BETWEEN 50.00 AND 1000000.00);

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_cleaning_fee_check;
ALTER TABLE listings ADD CONSTRAINT listings_cleaning_fee_check 
    CHECK (cleaning_fee BETWEEN 0.00 AND 50000.00);

-- 2. Convert existing historical listings from USD to BDT (~120x multiplier)
-- Only converts rows with base_nightly_price < 1000 (identifying existing USD seed data)
UPDATE listings 
SET base_nightly_price = round(base_nightly_price * 120, 2),
    cleaning_fee = round(cleaning_fee * 120, 2)
WHERE base_nightly_price < 1000;

-- 3. Convert existing seasonal rates
UPDATE seasonal_rates
SET nightly_rate = round(nightly_rate * 120, 2)
WHERE nightly_rate < 1000;

-- 4. Convert existing bookings
UPDATE bookings
SET nightly_subtotal = round(nightly_subtotal * 120, 2),
    discount_total = round(discount_total * 120, 2),
    cleaning_fee = round(cleaning_fee * 120, 2),
    service_fee = round(service_fee * 120, 2),
    tax_total = round(tax_total * 120, 2),
    total_amount = round(total_amount * 120, 2),
    host_commission = round(host_commission * 120, 2),
    host_payout_amount = round(host_payout_amount * 120, 2)
WHERE total_amount < 2000;

-- 5. Convert existing financial transaction records
UPDATE payments
SET amount = round(amount * 120, 2)
WHERE amount < 2000;

UPDATE payouts
SET amount = round(amount * 120, 2)
WHERE amount < 2000;

UPDATE refunds
SET amount = round(amount * 120, 2)
WHERE amount < 2000;
