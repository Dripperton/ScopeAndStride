-- Allow invited users to read their own invite record by email
-- This is required so _layout.tsx can process the invite on first sign-in
CREATE POLICY "Users can read their own invite"
  ON invites
  FOR SELECT
  USING (email = auth.email());
