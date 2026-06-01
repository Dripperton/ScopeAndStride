# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npx expo start       # Start dev server (opens QR code for Expo Go or simulator)
npx expo start --ios     # Launch iOS simulator directly
npx expo start --android # Launch Android emulator directly
npm run lint         # Run ESLint via expo lint
```

There are no automated tests in this project.

## Architecture

**ScopeAndStride** is a React Native/Expo barn management app. Key structural facts:

### Routing
Expo Router with file-based routing under `app/`. All navigation is stack-based (`headerShown: false` globally). `app/_layout.tsx` is the auth gate — it watches the Supabase session and redirects to `/` (unauthenticated), `/onboarding` (new horse owners), or `/dashboard` (everyone else). Public routes: `index`, `forgot-password`, `reset-password`.

### Auth & Roles
Supabase email/password auth. Three roles enforced via the `useProfile` hook (`lib/useProfile.ts`):
- `owner` — full access, can manage users and delete
- `staff` — can edit but not delete or manage users  
- `horse_owner` — read-only, scoped to their own horse

The hook exposes `isOwner`, `isStaff`, `isHorseOwner`, `canEdit`, `canDelete`, `canManageUsers`. All permission checks in components rely on this hook.

### Data Layer
No service/repository layer. Every screen queries Supabase directly inside `useEffect` or `useFocusEffect`. The Supabase client is a singleton at `lib/supabase.ts`. Data refreshes on screen focus (useFocusEffect pattern) rather than via subscriptions.

### State Management
No global state library. Local `useState` only. The one shared piece of state is the auth session, managed in `_layout.tsx`.

### Design System
All colors are in `constants/colors.ts` as named exports (`Colors.hunterGreen`, `Colors.gold`, etc.). Every screen defines its own `StyleSheet.create()` at the bottom of the file — there are no shared layout/card components. The visual language is: hunter green headers, gold accents, cream/sand backgrounds.

### Shared Utilities (`lib/`)
- `supabase.ts` — Supabase client singleton
- `useProfile.ts` — user profile + role/permission hook
- `useAttachments.ts` — image/PDF attachment picker hook (used by board)
- `DateInput.tsx` — reusable date picker component

### Supabase Schema (key tables)
`profiles`, `horses`, `medical_records`, `farrier_records`, `dietary_records`, `events`, `invoices`, `invoice_line_items`, `posts`, `post_comments`, `post_reactions`, `post_attachments`, `invites`, `alert_settings`

Post attachments are stored in the `post-attachments` Supabase Storage bucket.

### Known Limitations
- No offline support; all reads and writes require network
- Minimal error handling — most failures use `alert()` with no retry logic
- Alert threshold calculations (coggins expiry, farrier due dates) are done client-side in JS
