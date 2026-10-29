-- Auto-create a profile row when a new user is created in auth.users
-- Without this, accept_invite() UPDATE silently fails (no profile row to update)
-- and horse owners land on a broken dashboard with no profile data.
--
-- Uses CREATE OR REPLACE so it's safe to re-run if the trigger was previously
-- set up manually in the Supabase dashboard.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, onboarding_complete)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'invited_role', 'horse_owner'),
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
