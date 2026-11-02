-- Allows a user to permanently delete their own account and all associated data.
-- Runs as SECURITY DEFINER so it has access to auth.users.
CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _email text;
BEGIN
  SELECT email INTO _email FROM profiles WHERE id = _user_id;

  -- Remove user-specific associations
  DELETE FROM horse_users WHERE user_id = _user_id;
  DELETE FROM alert_settings WHERE user_id = _user_id;
  DELETE FROM invites WHERE email = _email;

  -- Remove profile
  DELETE FROM profiles WHERE id = _user_id;

  -- Remove auth user (cascades session invalidation)
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;

-- Only authenticated users can call this
REVOKE ALL ON FUNCTION delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_own_account() TO authenticated;
