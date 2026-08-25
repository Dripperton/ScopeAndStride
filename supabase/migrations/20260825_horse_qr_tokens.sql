-- Backfill qr_token for all existing horses that don't have one
UPDATE horses SET qr_token = gen_random_uuid() WHERE qr_token IS NULL;

-- Auto-set qr_token on new horse inserts
CREATE OR REPLACE FUNCTION set_horse_qr_token()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.qr_token IS NULL THEN
    NEW.qr_token := gen_random_uuid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER horse_qr_token_trigger
  BEFORE INSERT ON horses
  FOR EACH ROW EXECUTE FUNCTION set_horse_qr_token();
