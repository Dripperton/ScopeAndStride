-- ============================================================
-- MULTI-TENANT MIGRATION: Add barn_id isolation to all tables
--
-- Strategy:
--   • barn_settings.id is the barn's UUID — every other table
--     references it as barn_id
--   • Direct ownership (horses, events, posts, etc.): explicit
--     barn_id column + RLS uses get_my_barn_id()
--   • Child tables (medical_records, etc.): RLS uses EXISTS
--     through the parent FK — no extra column needed
--   • SECURITY DEFINER helpers avoid RLS recursion on profiles
--
-- Run order: apply to the existing scope-and-stride project.
-- HHF data is backfilled automatically (single barn_settings row).
-- ============================================================


-- ── 0. Slug on barn_settings ──────────────────────────────────────────────────
-- Gives each barn a stable human-readable key the app brand config references.
ALTER TABLE barn_settings ADD COLUMN IF NOT EXISTS slug text;
UPDATE barn_settings SET slug = 'hidden-hill-farm' WHERE slug IS NULL;
ALTER TABLE barn_settings ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS barn_settings_slug_idx ON barn_settings(slug);


-- ── 1. SECURITY DEFINER helpers ───────────────────────────────────────────────
-- These bypass RLS on profiles so they can be safely called inside RLS policies
-- on other tables without triggering infinite recursion (see: 42P17 fix).

CREATE OR REPLACE FUNCTION get_my_barn_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT barn_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;


-- ── 2. profiles ───────────────────────────────────────────────────────────────
-- Existing barn_id is text ('default'). Convert to uuid FK.
ALTER TABLE profiles DROP COLUMN IF EXISTS barn_id;
ALTER TABLE profiles ADD COLUMN barn_id uuid REFERENCES barn_settings(id) ON DELETE CASCADE;
UPDATE profiles SET barn_id = (SELECT id FROM barn_settings LIMIT 1);
ALTER TABLE profiles ALTER COLUMN barn_id SET NOT NULL;

-- Update handle_new_user() to accept barn_id from invite metadata.
-- Invite flow passes barn_id via raw_user_meta_data->'barn_id'.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  meta_barn_id uuid;
BEGIN
  meta_barn_id := (NEW.raw_user_meta_data->>'barn_id')::uuid;

  INSERT INTO public.profiles (id, email, role, onboarding_complete, barn_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'invited_role', 'horse_owner'),
    false,
    meta_barn_id
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Service role can insert" ON profiles;
DROP POLICY IF EXISTS "profiles_read" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;

-- Own profile always readable; owners/staff see all profiles in their barn
CREATE POLICY "profiles_read" ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR barn_id = get_my_barn_id()
  );

CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (true);  -- handle_new_user trigger inserts with SECURITY DEFINER


-- ── 3. horses ─────────────────────────────────────────────────────────────────
ALTER TABLE horses ADD COLUMN IF NOT EXISTS barn_id uuid REFERENCES barn_settings(id) ON DELETE CASCADE;
UPDATE horses SET barn_id = (SELECT id FROM barn_settings LIMIT 1) WHERE barn_id IS NULL;
ALTER TABLE horses ALTER COLUMN barn_id SET NOT NULL;

ALTER TABLE horses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "horses_read" ON horses;
DROP POLICY IF EXISTS "horses_write" ON horses;
DROP POLICY IF EXISTS "horses_delete" ON horses;

CREATE POLICY "horses_read" ON horses FOR SELECT
  USING (barn_id = get_my_barn_id());

CREATE POLICY "horses_write" ON horses FOR INSERT
  WITH CHECK (barn_id = get_my_barn_id());

CREATE POLICY "horses_update" ON horses FOR UPDATE
  USING (barn_id = get_my_barn_id());

CREATE POLICY "horses_delete" ON horses FOR DELETE
  USING (barn_id = get_my_barn_id() AND get_my_role() IN ('owner', 'staff'));


-- ── 4. events ─────────────────────────────────────────────────────────────────
ALTER TABLE events ADD COLUMN IF NOT EXISTS barn_id uuid REFERENCES barn_settings(id) ON DELETE CASCADE;
UPDATE events SET barn_id = (SELECT id FROM barn_settings LIMIT 1) WHERE barn_id IS NULL;
ALTER TABLE events ALTER COLUMN barn_id SET NOT NULL;

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "events_read" ON events;
DROP POLICY IF EXISTS "events_write" ON events;
DROP POLICY IF EXISTS "events_update" ON events;
DROP POLICY IF EXISTS "events_delete" ON events;

CREATE POLICY "events_read" ON events FOR SELECT
  USING (barn_id = get_my_barn_id());

CREATE POLICY "events_write" ON events FOR INSERT
  WITH CHECK (barn_id = get_my_barn_id() AND get_my_role() IN ('owner', 'staff'));

CREATE POLICY "events_update" ON events FOR UPDATE
  USING (barn_id = get_my_barn_id() AND get_my_role() IN ('owner', 'staff'));

CREATE POLICY "events_delete" ON events FOR DELETE
  USING (barn_id = get_my_barn_id() AND get_my_role() IN ('owner', 'staff'));


-- ── 5. posts ──────────────────────────────────────────────────────────────────
ALTER TABLE posts ADD COLUMN IF NOT EXISTS barn_id uuid REFERENCES barn_settings(id) ON DELETE CASCADE;
UPDATE posts SET barn_id = (SELECT id FROM barn_settings LIMIT 1) WHERE barn_id IS NULL;
ALTER TABLE posts ALTER COLUMN barn_id SET NOT NULL;

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "posts_read" ON posts;
DROP POLICY IF EXISTS "posts_write" ON posts;
DROP POLICY IF EXISTS "posts_update" ON posts;
DROP POLICY IF EXISTS "posts_delete" ON posts;

CREATE POLICY "posts_read" ON posts FOR SELECT
  USING (barn_id = get_my_barn_id());

CREATE POLICY "posts_write" ON posts FOR INSERT
  WITH CHECK (barn_id = get_my_barn_id());

CREATE POLICY "posts_update" ON posts FOR UPDATE
  USING (barn_id = get_my_barn_id() AND (author_id = auth.uid() OR get_my_role() IN ('owner', 'staff')));

CREATE POLICY "posts_delete" ON posts FOR DELETE
  USING (barn_id = get_my_barn_id() AND (author_id = auth.uid() OR get_my_role() IN ('owner', 'staff')));


-- ── 6. invites ────────────────────────────────────────────────────────────────
ALTER TABLE invites ADD COLUMN IF NOT EXISTS barn_id uuid REFERENCES barn_settings(id) ON DELETE CASCADE;
UPDATE invites SET barn_id = (SELECT id FROM barn_settings LIMIT 1) WHERE barn_id IS NULL;
ALTER TABLE invites ALTER COLUMN barn_id SET NOT NULL;

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read their own invite" ON invites;
DROP POLICY IF EXISTS "invites_read" ON invites;
DROP POLICY IF EXISTS "invites_write" ON invites;
DROP POLICY IF EXISTS "invites_delete" ON invites;

CREATE POLICY "invites_read" ON invites FOR SELECT
  USING (email = auth.email() OR barn_id = get_my_barn_id());

CREATE POLICY "invites_write" ON invites FOR INSERT
  WITH CHECK (barn_id = get_my_barn_id() AND get_my_role() IN ('owner', 'staff'));

CREATE POLICY "invites_delete" ON invites FOR DELETE
  USING (barn_id = get_my_barn_id() AND get_my_role() IN ('owner', 'staff'));


-- ── 7. barn_integrations ──────────────────────────────────────────────────────
ALTER TABLE barn_integrations ADD COLUMN IF NOT EXISTS barn_id uuid REFERENCES barn_settings(id) ON DELETE CASCADE;
UPDATE barn_integrations SET barn_id = (SELECT id FROM barn_settings LIMIT 1) WHERE barn_id IS NULL;
ALTER TABLE barn_integrations ALTER COLUMN barn_id SET NOT NULL;

ALTER TABLE barn_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "barn_integrations_read" ON barn_integrations;
DROP POLICY IF EXISTS "barn_integrations_write" ON barn_integrations;

CREATE POLICY "barn_integrations_read" ON barn_integrations FOR SELECT
  USING (barn_id = get_my_barn_id() AND get_my_role() IN ('owner', 'staff'));

CREATE POLICY "barn_integrations_write" ON barn_integrations FOR ALL
  USING (barn_id = get_my_barn_id() AND get_my_role() = 'owner')
  WITH CHECK (barn_id = get_my_barn_id() AND get_my_role() = 'owner');


-- ── 8. lesson_slots ───────────────────────────────────────────────────────────
ALTER TABLE lesson_slots ADD COLUMN IF NOT EXISTS barn_id uuid REFERENCES barn_settings(id) ON DELETE CASCADE;
UPDATE lesson_slots SET barn_id = (SELECT id FROM barn_settings LIMIT 1) WHERE barn_id IS NULL;
ALTER TABLE lesson_slots ALTER COLUMN barn_id SET NOT NULL;

ALTER TABLE lesson_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lesson_slots_read" ON lesson_slots;
DROP POLICY IF EXISTS "lesson_slots_write" ON lesson_slots;

CREATE POLICY "lesson_slots_read" ON lesson_slots FOR SELECT
  USING (barn_id = get_my_barn_id());

CREATE POLICY "lesson_slots_write" ON lesson_slots FOR INSERT
  WITH CHECK (barn_id = get_my_barn_id() AND get_my_role() IN ('owner', 'staff'));

CREATE POLICY "lesson_slots_update" ON lesson_slots FOR UPDATE
  USING (barn_id = get_my_barn_id() AND get_my_role() IN ('owner', 'staff'));

CREATE POLICY "lesson_slots_delete" ON lesson_slots FOR DELETE
  USING (barn_id = get_my_barn_id() AND get_my_role() IN ('owner', 'staff'));


-- ── 9. scheduling_settings ────────────────────────────────────────────────────
-- Was a singleton (id=1). Convert to per-barn.
ALTER TABLE scheduling_settings DROP CONSTRAINT IF EXISTS scheduling_settings_pkey CASCADE;
ALTER TABLE scheduling_settings ALTER COLUMN id DROP DEFAULT;
ALTER TABLE scheduling_settings ALTER COLUMN id TYPE uuid USING gen_random_uuid();
ALTER TABLE scheduling_settings ADD PRIMARY KEY (id);
ALTER TABLE scheduling_settings ADD COLUMN IF NOT EXISTS barn_id uuid REFERENCES barn_settings(id) ON DELETE CASCADE;
UPDATE scheduling_settings SET barn_id = (SELECT id FROM barn_settings LIMIT 1) WHERE barn_id IS NULL;
ALTER TABLE scheduling_settings ALTER COLUMN barn_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS scheduling_settings_barn_idx ON scheduling_settings(barn_id);

ALTER TABLE scheduling_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scheduling_settings_read" ON scheduling_settings;
DROP POLICY IF EXISTS "scheduling_settings_write" ON scheduling_settings;

CREATE POLICY "scheduling_settings_read" ON scheduling_settings FOR SELECT
  USING (barn_id = get_my_barn_id());

CREATE POLICY "scheduling_settings_write" ON scheduling_settings FOR ALL
  USING (barn_id = get_my_barn_id() AND get_my_role() IN ('owner', 'staff'))
  WITH CHECK (barn_id = get_my_barn_id() AND get_my_role() IN ('owner', 'staff'));


-- ── 10. scheduling_caps ───────────────────────────────────────────────────────
-- Was unique on duration_minutes. Convert to per-barn.
DROP INDEX IF EXISTS scheduling_caps_duration_minutes_key;
ALTER TABLE scheduling_caps ADD COLUMN IF NOT EXISTS barn_id uuid REFERENCES barn_settings(id) ON DELETE CASCADE;
UPDATE scheduling_caps SET barn_id = (SELECT id FROM barn_settings LIMIT 1) WHERE barn_id IS NULL;
ALTER TABLE scheduling_caps ALTER COLUMN barn_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS scheduling_caps_barn_duration_idx ON scheduling_caps(barn_id, duration_minutes);

ALTER TABLE scheduling_caps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scheduling_caps_read" ON scheduling_caps;
DROP POLICY IF EXISTS "scheduling_caps_write" ON scheduling_caps;

CREATE POLICY "scheduling_caps_read" ON scheduling_caps FOR SELECT
  USING (barn_id = get_my_barn_id());

CREATE POLICY "scheduling_caps_write" ON scheduling_caps FOR ALL
  USING (barn_id = get_my_barn_id() AND get_my_role() IN ('owner', 'staff'))
  WITH CHECK (barn_id = get_my_barn_id() AND get_my_role() IN ('owner', 'staff'));


-- ── 11. note_templates ────────────────────────────────────────────────────────
ALTER TABLE note_templates ADD COLUMN IF NOT EXISTS barn_id uuid REFERENCES barn_settings(id) ON DELETE CASCADE;
UPDATE note_templates SET barn_id = (SELECT id FROM barn_settings LIMIT 1) WHERE barn_id IS NULL;
ALTER TABLE note_templates ALTER COLUMN barn_id SET NOT NULL;

ALTER TABLE note_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "note_templates_read" ON note_templates;
DROP POLICY IF EXISTS "note_templates_write" ON note_templates;

CREATE POLICY "note_templates_read" ON note_templates FOR SELECT
  USING (barn_id = get_my_barn_id());

CREATE POLICY "note_templates_write" ON note_templates FOR ALL
  USING (barn_id = get_my_barn_id() AND get_my_role() IN ('owner', 'staff'))
  WITH CHECK (barn_id = get_my_barn_id() AND get_my_role() IN ('owner', 'staff'));


-- ── 12. recurring_templates ───────────────────────────────────────────────────
ALTER TABLE recurring_templates ADD COLUMN IF NOT EXISTS barn_id uuid REFERENCES barn_settings(id) ON DELETE CASCADE;
UPDATE recurring_templates SET barn_id = (SELECT id FROM barn_settings LIMIT 1) WHERE barn_id IS NULL;
ALTER TABLE recurring_templates ALTER COLUMN barn_id SET NOT NULL;

ALTER TABLE recurring_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recurring_templates_read" ON recurring_templates;
DROP POLICY IF EXISTS "recurring_templates_write" ON recurring_templates;

CREATE POLICY "recurring_templates_read" ON recurring_templates FOR SELECT
  USING (barn_id = get_my_barn_id());

CREATE POLICY "recurring_templates_write" ON recurring_templates FOR ALL
  USING (barn_id = get_my_barn_id() AND get_my_role() IN ('owner', 'staff'))
  WITH CHECK (barn_id = get_my_barn_id() AND get_my_role() IN ('owner', 'staff'));


-- ── 13. alert_settings ────────────────────────────────────────────────────────
-- Existing barn_id is text. Convert to uuid FK.
ALTER TABLE alert_settings DROP COLUMN IF EXISTS barn_id;
ALTER TABLE alert_settings ADD COLUMN barn_id uuid REFERENCES barn_settings(id) ON DELETE CASCADE;
UPDATE alert_settings SET barn_id = (SELECT id FROM barn_settings LIMIT 1) WHERE barn_id IS NULL;
ALTER TABLE alert_settings ALTER COLUMN barn_id SET NOT NULL;

ALTER TABLE alert_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alert_settings_read" ON alert_settings;
DROP POLICY IF EXISTS "alert_settings_write" ON alert_settings;

CREATE POLICY "alert_settings_read" ON alert_settings FOR SELECT
  USING (barn_id = get_my_barn_id());

CREATE POLICY "alert_settings_write" ON alert_settings FOR ALL
  USING (barn_id = get_my_barn_id() AND get_my_role() IN ('owner', 'staff'))
  WITH CHECK (barn_id = get_my_barn_id() AND get_my_role() IN ('owner', 'staff'));


-- ── 14. daily_digests ─────────────────────────────────────────────────────────
-- Existing barn_id is text. Convert to uuid FK.
ALTER TABLE daily_digests DROP CONSTRAINT IF EXISTS daily_digests_barn_id_date_role_user_id_key;
ALTER TABLE daily_digests DROP COLUMN IF EXISTS barn_id;
ALTER TABLE daily_digests ADD COLUMN barn_id uuid REFERENCES barn_settings(id) ON DELETE CASCADE;
UPDATE daily_digests SET barn_id = (SELECT id FROM barn_settings LIMIT 1) WHERE barn_id IS NULL;
ALTER TABLE daily_digests ALTER COLUMN barn_id SET NOT NULL;
CREATE UNIQUE INDEX daily_digests_barn_date_role_user_idx ON daily_digests(barn_id, date, role, user_id);

DROP POLICY IF EXISTS "owners_staff_read_digests" ON daily_digests;
DROP POLICY IF EXISTS "horse_owner_read_own_digest" ON daily_digests;
DROP POLICY IF EXISTS "service_insert_digests" ON daily_digests;

ALTER TABLE daily_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "digests_read" ON daily_digests FOR SELECT
  USING (barn_id = get_my_barn_id() AND (get_my_role() IN ('owner', 'staff') OR user_id = auth.uid()));

CREATE POLICY "digests_insert" ON daily_digests FOR INSERT
  WITH CHECK (true);  -- edge function uses service role


-- ── 15. barn_settings RLS ─────────────────────────────────────────────────────
ALTER TABLE barn_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "barn_settings_read" ON barn_settings;
DROP POLICY IF EXISTS "barn_settings_write" ON barn_settings;

-- Everyone in the barn can read settings; only owners can update
CREATE POLICY "barn_settings_read" ON barn_settings FOR SELECT
  USING (id = get_my_barn_id());

CREATE POLICY "barn_settings_write" ON barn_settings FOR UPDATE
  USING (id = get_my_barn_id() AND get_my_role() = 'owner');


-- ── 16. Child tables: RLS via parent FK ───────────────────────────────────────
-- These tables don't get a barn_id column — they inherit isolation through
-- their parent FK (e.g. horse_id → horses.barn_id = get_my_barn_id()).

-- medical_records
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "medical_records_read" ON medical_records;
DROP POLICY IF EXISTS "medical_records_write" ON medical_records;
DROP POLICY IF EXISTS "medical_records_delete" ON medical_records;

CREATE POLICY "medical_records_read" ON medical_records FOR SELECT
  USING (EXISTS (SELECT 1 FROM horses h WHERE h.id = medical_records.horse_id AND h.barn_id = get_my_barn_id()));

CREATE POLICY "medical_records_write" ON medical_records FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM horses h WHERE h.id = medical_records.horse_id AND h.barn_id = get_my_barn_id()));

CREATE POLICY "medical_records_update" ON medical_records FOR UPDATE
  USING (EXISTS (SELECT 1 FROM horses h WHERE h.id = medical_records.horse_id AND h.barn_id = get_my_barn_id()));

CREATE POLICY "medical_records_delete" ON medical_records FOR DELETE
  USING (EXISTS (SELECT 1 FROM horses h WHERE h.id = medical_records.horse_id AND h.barn_id = get_my_barn_id()));

-- farrier_records
ALTER TABLE farrier_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "farrier_records_read" ON farrier_records;
DROP POLICY IF EXISTS "farrier_records_write" ON farrier_records;

CREATE POLICY "farrier_records_read" ON farrier_records FOR SELECT
  USING (EXISTS (SELECT 1 FROM horses h WHERE h.id = farrier_records.horse_id AND h.barn_id = get_my_barn_id()));

CREATE POLICY "farrier_records_write" ON farrier_records FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM horses h WHERE h.id = farrier_records.horse_id AND h.barn_id = get_my_barn_id()));

CREATE POLICY "farrier_records_update" ON farrier_records FOR UPDATE
  USING (EXISTS (SELECT 1 FROM horses h WHERE h.id = farrier_records.horse_id AND h.barn_id = get_my_barn_id()));

CREATE POLICY "farrier_records_delete" ON farrier_records FOR DELETE
  USING (EXISTS (SELECT 1 FROM horses h WHERE h.id = farrier_records.horse_id AND h.barn_id = get_my_barn_id()));

-- dietary_records
ALTER TABLE dietary_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dietary_records_read" ON dietary_records;

CREATE POLICY "dietary_records_read" ON dietary_records FOR SELECT
  USING (EXISTS (SELECT 1 FROM horses h WHERE h.id = dietary_records.horse_id AND h.barn_id = get_my_barn_id()));

CREATE POLICY "dietary_records_write" ON dietary_records FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM horses h WHERE h.id = dietary_records.horse_id AND h.barn_id = get_my_barn_id()));

CREATE POLICY "dietary_records_update" ON dietary_records FOR UPDATE
  USING (EXISTS (SELECT 1 FROM horses h WHERE h.id = dietary_records.horse_id AND h.barn_id = get_my_barn_id()));

CREATE POLICY "dietary_records_delete" ON dietary_records FOR DELETE
  USING (EXISTS (SELECT 1 FROM horses h WHERE h.id = dietary_records.horse_id AND h.barn_id = get_my_barn_id()));

-- daily_care_logs
ALTER TABLE daily_care_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_care_logs_read" ON daily_care_logs;

CREATE POLICY "daily_care_logs_read" ON daily_care_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM horses h WHERE h.id = daily_care_logs.horse_id AND h.barn_id = get_my_barn_id()));

CREATE POLICY "daily_care_logs_write" ON daily_care_logs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM horses h WHERE h.id = daily_care_logs.horse_id AND h.barn_id = get_my_barn_id()));

CREATE POLICY "daily_care_logs_update" ON daily_care_logs FOR UPDATE
  USING (EXISTS (SELECT 1 FROM horses h WHERE h.id = daily_care_logs.horse_id AND h.barn_id = get_my_barn_id()));

-- service_visits
ALTER TABLE service_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_visits_read" ON service_visits;

CREATE POLICY "service_visits_read" ON service_visits FOR SELECT
  USING (EXISTS (SELECT 1 FROM horses h WHERE h.id = service_visits.horse_id AND h.barn_id = get_my_barn_id()));

CREATE POLICY "service_visits_write" ON service_visits FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM horses h WHERE h.id = service_visits.horse_id AND h.barn_id = get_my_barn_id()));

CREATE POLICY "service_visits_update" ON service_visits FOR UPDATE
  USING (EXISTS (SELECT 1 FROM horses h WHERE h.id = service_visits.horse_id AND h.barn_id = get_my_barn_id()));

CREATE POLICY "service_visits_delete" ON service_visits FOR DELETE
  USING (EXISTS (SELECT 1 FROM horses h WHERE h.id = service_visits.horse_id AND h.barn_id = get_my_barn_id()));

-- invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoices_read" ON invoices;

CREATE POLICY "invoices_read" ON invoices FOR SELECT
  USING (EXISTS (SELECT 1 FROM horses h WHERE h.id = invoices.horse_id AND h.barn_id = get_my_barn_id()));

CREATE POLICY "invoices_write" ON invoices FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM horses h WHERE h.id = invoices.horse_id AND h.barn_id = get_my_barn_id()) AND get_my_role() IN ('owner', 'staff'));

CREATE POLICY "invoices_update" ON invoices FOR UPDATE
  USING (EXISTS (SELECT 1 FROM horses h WHERE h.id = invoices.horse_id AND h.barn_id = get_my_barn_id()) AND get_my_role() IN ('owner', 'staff'));

CREATE POLICY "invoices_delete" ON invoices FOR DELETE
  USING (EXISTS (SELECT 1 FROM horses h WHERE h.id = invoices.horse_id AND h.barn_id = get_my_barn_id()) AND get_my_role() IN ('owner', 'staff'));

-- invoice_line_items
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoice_line_items_read" ON invoice_line_items;

CREATE POLICY "invoice_line_items_read" ON invoice_line_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM invoices i
    JOIN horses h ON h.id = i.horse_id
    WHERE i.id = invoice_line_items.invoice_id AND h.barn_id = get_my_barn_id()
  ));

CREATE POLICY "invoice_line_items_write" ON invoice_line_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM invoices i
    JOIN horses h ON h.id = i.horse_id
    WHERE i.id = invoice_line_items.invoice_id AND h.barn_id = get_my_barn_id()
  ) AND get_my_role() IN ('owner', 'staff'));

CREATE POLICY "invoice_line_items_delete" ON invoice_line_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM invoices i
    JOIN horses h ON h.id = i.horse_id
    WHERE i.id = invoice_line_items.invoice_id AND h.barn_id = get_my_barn_id()
  ) AND get_my_role() IN ('owner', 'staff'));

-- horse_users
ALTER TABLE horse_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "horse_users_read" ON horse_users;

CREATE POLICY "horse_users_read" ON horse_users FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM horses h WHERE h.id = horse_users.horse_id AND h.barn_id = get_my_barn_id())
  );

CREATE POLICY "horse_users_write" ON horse_users FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM horses h WHERE h.id = horse_users.horse_id AND h.barn_id = get_my_barn_id()));

CREATE POLICY "horse_users_delete" ON horse_users FOR DELETE
  USING (EXISTS (SELECT 1 FROM horses h WHERE h.id = horse_users.horse_id AND h.barn_id = get_my_barn_id()));

-- horse_scheduling
ALTER TABLE horse_scheduling ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "horse_scheduling_read" ON horse_scheduling;

CREATE POLICY "horse_scheduling_read" ON horse_scheduling FOR SELECT
  USING (EXISTS (SELECT 1 FROM horses h WHERE h.id = horse_scheduling.horse_id AND h.barn_id = get_my_barn_id()));

CREATE POLICY "horse_scheduling_write" ON horse_scheduling FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM horses h WHERE h.id = horse_scheduling.horse_id AND h.barn_id = get_my_barn_id()));

CREATE POLICY "horse_scheduling_update" ON horse_scheduling FOR UPDATE
  USING (EXISTS (SELECT 1 FROM horses h WHERE h.id = horse_scheduling.horse_id AND h.barn_id = get_my_barn_id()));

-- horse_records
ALTER TABLE horse_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "horse_records_read" ON horse_records;

CREATE POLICY "horse_records_read" ON horse_records FOR SELECT
  USING (EXISTS (SELECT 1 FROM horses h WHERE h.id = horse_records.horse_id AND h.barn_id = get_my_barn_id()));

CREATE POLICY "horse_records_write" ON horse_records FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM horses h WHERE h.id = horse_records.horse_id AND h.barn_id = get_my_barn_id()));

CREATE POLICY "horse_records_delete" ON horse_records FOR DELETE
  USING (EXISTS (SELECT 1 FROM horses h WHERE h.id = horse_records.horse_id AND h.barn_id = get_my_barn_id()));

-- recurring_template_line_items
ALTER TABLE recurring_template_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rtli_read" ON recurring_template_line_items;

CREATE POLICY "rtli_read" ON recurring_template_line_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM recurring_templates rt WHERE rt.id = recurring_template_line_items.template_id AND rt.barn_id = get_my_barn_id()));

CREATE POLICY "rtli_write" ON recurring_template_line_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM recurring_templates rt WHERE rt.id = recurring_template_line_items.template_id AND rt.barn_id = get_my_barn_id()));

CREATE POLICY "rtli_delete" ON recurring_template_line_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM recurring_templates rt WHERE rt.id = recurring_template_line_items.template_id AND rt.barn_id = get_my_barn_id()));

-- post_comments
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "post_comments_read" ON post_comments;

CREATE POLICY "post_comments_read" ON post_comments FOR SELECT
  USING (EXISTS (SELECT 1 FROM posts p WHERE p.id = post_comments.post_id AND p.barn_id = get_my_barn_id()));

CREATE POLICY "post_comments_write" ON post_comments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM posts p WHERE p.id = post_comments.post_id AND p.barn_id = get_my_barn_id()));

CREATE POLICY "post_comments_delete" ON post_comments FOR DELETE
  USING (EXISTS (SELECT 1 FROM posts p WHERE p.id = post_comments.post_id AND p.barn_id = get_my_barn_id())
    AND (author_id = auth.uid() OR get_my_role() IN ('owner', 'staff')));

-- post_reactions
ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "post_reactions_read" ON post_reactions;

CREATE POLICY "post_reactions_read" ON post_reactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM posts p WHERE p.id = post_reactions.post_id AND p.barn_id = get_my_barn_id()));

CREATE POLICY "post_reactions_write" ON post_reactions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM posts p WHERE p.id = post_reactions.post_id AND p.barn_id = get_my_barn_id()));

CREATE POLICY "post_reactions_delete" ON post_reactions FOR DELETE
  USING (user_id = auth.uid());

-- comment_reactions
ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comment_reactions_read" ON comment_reactions;

CREATE POLICY "comment_reactions_read" ON comment_reactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM post_comments pc
    JOIN posts p ON p.id = pc.post_id
    WHERE pc.id = comment_reactions.comment_id AND p.barn_id = get_my_barn_id()
  ));

CREATE POLICY "comment_reactions_write" ON comment_reactions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM post_comments pc
    JOIN posts p ON p.id = pc.post_id
    WHERE pc.id = comment_reactions.comment_id AND p.barn_id = get_my_barn_id()
  ));

CREATE POLICY "comment_reactions_delete" ON comment_reactions FOR DELETE
  USING (user_id = auth.uid());

-- post_attachments
ALTER TABLE post_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "post_attachments_read" ON post_attachments;

CREATE POLICY "post_attachments_read" ON post_attachments FOR SELECT
  USING (EXISTS (SELECT 1 FROM posts p WHERE p.id = post_attachments.post_id AND p.barn_id = get_my_barn_id()));

CREATE POLICY "post_attachments_write" ON post_attachments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM posts p WHERE p.id = post_attachments.post_id AND p.barn_id = get_my_barn_id()));

-- lesson_requests
ALTER TABLE lesson_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lesson_requests_read" ON lesson_requests;

CREATE POLICY "lesson_requests_read" ON lesson_requests FOR SELECT
  USING (
    requested_by = auth.uid()
    OR EXISTS (SELECT 1 FROM lesson_slots ls WHERE ls.id = lesson_requests.slot_id AND ls.barn_id = get_my_barn_id())
  );

CREATE POLICY "lesson_requests_write" ON lesson_requests FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM lesson_slots ls WHERE ls.id = lesson_requests.slot_id AND ls.barn_id = get_my_barn_id()));

CREATE POLICY "lesson_requests_update" ON lesson_requests FOR UPDATE
  USING (
    requested_by = auth.uid()
    OR (get_my_role() IN ('owner', 'staff') AND EXISTS (SELECT 1 FROM lesson_slots ls WHERE ls.id = lesson_requests.slot_id AND ls.barn_id = get_my_barn_id()))
  );


-- ── 17. Update accept_invite() to set barn_id on the new profile ──────────────
CREATE OR REPLACE FUNCTION accept_invite()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invite_record invites%ROWTYPE;
  invite_role text;
  current_user_id uuid := auth.uid();
  current_email text := auth.email();
BEGIN
  SELECT * INTO invite_record
  FROM invites
  WHERE email = current_email AND accepted = false
  LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  invite_role := CASE WHEN invite_record.role = 'rider' THEN 'horse_owner' ELSE invite_record.role END;

  UPDATE profiles
  SET
    role = invite_role,
    barn_id = invite_record.barn_id,
    onboarding_complete = CASE WHEN invite_role = 'horse_owner' THEN false ELSE true END
  WHERE id = current_user_id;

  IF invite_role = 'horse_owner' AND invite_record.horse_id IS NOT NULL THEN
    INSERT INTO horse_users (horse_id, user_id, relationship, billing_contact)
    VALUES (
      invite_record.horse_id,
      current_user_id,
      COALESCE(invite_record.relationship, 'owner'),
      COALESCE(invite_record.billing_contact, false)
    )
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE invites SET accepted = true WHERE id = invite_record.id;
END;
$$;
