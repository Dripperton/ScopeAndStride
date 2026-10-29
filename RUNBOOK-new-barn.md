# New Barn Onboarding Runbook

Step-by-step guide to onboard a new white-label barn onto Scope & Stride.
Estimated time: ~90 minutes end-to-end.

---

## Step 1 — Create the Supabase project

1. Go to supabase.com → New project
2. Name it: `scope-and-stride-[barn-slug]` (e.g. `scope-and-stride-willow-creek`)
3. Note the **Project URL** and **anon key** and **service role key**
4. Under Settings → API, copy the **Project Ref** (used in CLI commands)

---

## Step 2 — Run migrations

```bash
supabase link --project-ref <project-ref>
supabase db push
```

This applies all migrations in `supabase/migrations/` to the new project.

---

## Step 3 — Deploy edge functions

```bash
supabase functions deploy billing-notifications --project-ref <project-ref>
supabase functions deploy concierge-chat --project-ref <project-ref>
```

Set required secrets on the new project:
```bash
supabase secrets set RESEND_API_KEY=<key> --project-ref <project-ref>
supabase secrets set OPENAI_API_KEY=<key> --project-ref <project-ref>
```

---

## Step 4 — Seed barn_settings

In the Supabase dashboard → SQL Editor, run:

```sql
insert into barn_settings (barn_name, schedule_privacy, trainers)
values ('<Barn Name>', 'show_details', '{}');
```

Optionally set brand colors if the barn has specific colors:

```sql
update barn_settings
set primary_color   = '#HEX',
    secondary_color = '#HEX',
    surface_color   = '#HEX'
where id = (select id from barn_settings limit 1);
```

---

## Step 5 — Create barn owner account

1. Supabase dashboard → Authentication → Users → Invite user
2. Send invite to barn owner email
3. In SQL Editor, set their role:
```sql
update profiles set role = 'owner' where email = 'owner@barnname.com';
```

---

## Step 6 — Create the brand file

Copy the template:

```bash
cp constants/brands/_template.json constants/brands/<barn-slug>.json
```

Fill in:

```json
{
  "slug": "barn-slug",
  "barnName": "Barn Name",
  "appName": "Short Name",
  "tagline": "",
  "bundleId": "com.scopeandstride.barnslug",
  "theme": {
    "primary":   "#HEX",
    "secondary": "#HEX",
    "surface":   "#HEX"
  }
}
```

Color guide:
- `primary` — header/nav background (usually the barn's primary brand color)
- `secondary` — buttons, highlights, active states (usually darker or contrasting)
- `surface` — app background (light neutral — warm white, cool grey, etc.)

---

## Step 7 — Add the EAS build profile

In `eas.json`, add:

```json
"production:<barn-slug>": {
  "extends": "production",
  "env": {
    "BRAND_SLUG": "<barn-slug>"
  }
}
```

And add a submit profile:

```json
"production:<barn-slug>": {}
```

---

## Step 8 — Update the Supabase client for this build

Create `.env.<barn-slug>` (not committed):

```
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Add these to the EAS profile's `env` block in `eas.json`:

```json
"production:<barn-slug>": {
  "extends": "production",
  "env": {
    "BRAND_SLUG": "<barn-slug>",
    "EXPO_PUBLIC_SUPABASE_URL": "https://<project-ref>.supabase.co",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY": "<anon-key>"
  }
}
```

---

## Step 9 — Build and submit

```bash
eas build --profile production:<barn-slug> --platform ios
eas submit --platform ios --latest
```

---

## Step 10 — App Store Connect setup

1. New app record in App Store Connect
2. Bundle ID: `com.scopeandstride.<barnslug>`
3. App name: `<Barn Name>` (or agreed white-label name)
4. Screenshots: use the barn's actual color scheme
5. Privacy policy URL: use the Scope & Stride privacy policy URL (or barn-specific if requested)

---

## Checklist

- [ ] Supabase project created and linked
- [ ] `db push` completed (all migrations applied)
- [ ] Edge functions deployed + secrets set
- [ ] `barn_settings` row seeded with barn name
- [ ] Barn owner account created + role set to `owner`
- [ ] Brand JSON file created in `constants/brands/`
- [ ] EAS profile added to `eas.json` (build + submit)
- [ ] Supabase env vars added to EAS profile
- [ ] Build submitted to App Store
- [ ] App Store Connect record created
- [ ] Onboarding call scheduled with barn manager (Day 7)
