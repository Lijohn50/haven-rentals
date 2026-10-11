-- V12: Adjust price check constraints for BDT scale and convert legacy USD records

-- 1. Widen listings price check constraints (legacy USD ceiling 100000.00
--    becomes up to 12000000.00 in BDT; converted rows stay far below that)
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_base_nightly_price_check;
ALTER TABLE listings ADD CONSTRAINT listings_base_nightly_price_check
    CHECK (base_nightly_price BETWEEN 50.00 AND 1000000.00);

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_cleaning_fee_check;
-- cleaning_fee ceiling was 10000.00 USD, i.e. up to 1200000.00 after conversion
ALTER TABLE listings ADD CONSTRAINT listings_cleaning_fee_check
    CHECK (cleaning_fee BETWEEN 0.00 AND 1200000.00);

-- 2. Widen the seasonal rate check BEFORE converting: the old ceiling
--    (100000.00) is exceeded by any rate >= 833.34 once multiplied by 120
ALTER TABLE seasonal_rates DROP CONSTRAINT IF EXISTS seasonal_rates_nightly_price_check;
ALTER TABLE seasonal_rates ADD CONSTRAINT seasonal_rates_nightly_price_check
    CHECK (nightly_price BETWEEN 1.00 AND 1000000.00);

-- 3. Convert existing historical listings from USD to BDT (~120x multiplier)
-- Only converts rows with base_nightly_price < 1000 (identifying existing USD seed data)
UPDATE listings
SET base_nightly_price = round(base_nightly_price * 120, 2),
    cleaning_fee = round(cleaning_fee * 120, 2)
WHERE base_nightly_price < 1000;

-- 4. Convert existing seasonal rates (column is nightly_price, see V3)
UPDATE seasonal_rates
SET nightly_price = round(nightly_price * 120, 2)
WHERE nightly_price < 1000;

-- 5. Convert existing bookings
UPDATE bookings
SET nightly_subtotal = round(nightly_subtotal * 120, 2),
    discount_total = round(discount_total * 120, 2),
    cleaning_fee = round(cleaning_fee * 120, 2),
    service_fee = round(service_fee * 120, 2),
    tax_total = round(tax_total * 120, 2),
    total_amount = round(total_amount * 120, 2),
    host_commission = round(host_commission * 120, 2),
    host_payout_amount = round(host_payout_amount * 120, 2),
    refund_amount = round(refund_amount * 120, 2)
WHERE total_amount < 2000;

-- 6. Convert existing financial transaction records
UPDATE payments
SET amount = round(amount * 120, 2),
    refunded_total = round(refunded_total * 120, 2)
WHERE amount < 2000;

UPDATE payouts
SET amount = round(amount * 120, 2)
WHERE amount < 2000;

UPDATE refunds
SET amount = round(amount * 120, 2)
WHERE amount < 2000;
