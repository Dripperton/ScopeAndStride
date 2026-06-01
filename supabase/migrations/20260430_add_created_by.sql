-- Migration: add created_by to horses, invoices, invoice_line_items
-- Tracks which user created each record for audit and filtering purposes.

ALTER TABLE horses
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

ALTER TABLE invoice_line_items
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Optional: backfill with current null (no historical data to attribute)
-- To enforce going forward, add NOT NULL constraints only after application
-- has been deployed and is writing created_by on all new inserts.

COMMENT ON COLUMN horses.created_by IS 'User who created this horse record';
COMMENT ON COLUMN invoices.created_by IS 'User who created this invoice';
COMMENT ON COLUMN invoice_line_items.created_by IS 'User who created this line item';
