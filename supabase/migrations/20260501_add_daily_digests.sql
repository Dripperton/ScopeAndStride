-- Migration: daily_digests table for cached AI briefings

CREATE TABLE daily_digests (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  barn_id      text NOT NULL DEFAULT 'default',
  date         date NOT NULL DEFAULT CURRENT_DATE,
  role         text NOT NULL DEFAULT 'owner',
  user_id      uuid REFERENCES auth.users(id),
  digest_text  text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(barn_id, date, role, user_id)
);

CREATE INDEX idx_daily_digests_lookup ON daily_digests (barn_id, date, role, user_id);

ALTER TABLE daily_digests ENABLE ROW LEVEL SECURITY;

-- Owners and staff can read barn-wide digests
CREATE POLICY "owners_staff_read_digests" ON daily_digests
  FOR SELECT USING (
    role IN ('owner', 'staff')
    AND EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('owner', 'staff')
    )
  );

-- Horse owners can read only their own digests
CREATE POLICY "horse_owner_read_own_digest" ON daily_digests
  FOR SELECT USING (
    role = 'horse_owner' AND user_id = auth.uid()
  );

-- Service role inserts (edge function)
CREATE POLICY "service_insert_digests" ON daily_digests
  FOR INSERT WITH CHECK (true);
