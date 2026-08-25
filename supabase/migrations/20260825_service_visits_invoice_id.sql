-- Track which service visits have been converted to invoice line items
ALTER TABLE service_visits ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL;
