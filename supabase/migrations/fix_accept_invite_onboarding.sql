-- Fix accept_invite() to route horse owners through onboarding on first login.
-- Previously set onboarding_complete = true immediately, bypassing the 3-step
-- onboarding screen entirely. Now horse_owner role gets onboarding_complete = false
-- so _layout.tsx routes them to /onboarding after accepting the invite.
-- Staff and other roles still skip onboarding (onboarding_complete = true).

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
    -- Horse owners go through onboarding to fill in their own horse/vet/farrier details.
    -- All other roles (staff, owner) skip onboarding.
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
