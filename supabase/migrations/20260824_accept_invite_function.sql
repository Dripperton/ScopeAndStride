-- Secure invite acceptance function
-- Runs with SECURITY DEFINER so it can bypass RLS to update the profile role
-- Uses auth.uid() and auth.email() internally — users can only accept their own invite

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
  -- Find pending invite for current user's email
  SELECT * INTO invite_record
  FROM invites
  WHERE email = current_email AND accepted = false
  LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  invite_role := CASE WHEN invite_record.role = 'rider' THEN 'horse_owner' ELSE invite_record.role END;

  -- Update profile with correct role from invite
  UPDATE profiles
  SET role = invite_role, barn_id = 'default', onboarding_complete = true
  WHERE id = current_user_id;

  -- Create horse link if applicable
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

  -- Mark invite as accepted
  UPDATE invites SET accepted = true WHERE id = invite_record.id;
END;
$$;
