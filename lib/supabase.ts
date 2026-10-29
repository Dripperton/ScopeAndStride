import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

// Per-barn credentials come from the brand JSON via app.config.js
// Fallback values ensure the HHF dev build still works if extra is missing
const supabaseUrl = extra.supabaseUrl || 'https://kzpdukjkttkaaligxsmb.supabase.co';
const supabaseKey = extra.supabaseAnonKey || 'sb_publishable_6HLbfXt3q5rjEi8eoq8lJg_B_LlNqV6';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // handled manually below for React Native
  },
});

// ── Auto-refresh token when app returns to foreground ─────────────────────────
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

// ── Deep link handler — establishes session from invite / magic link URLs ─────
// Supabase appends #access_token=...&refresh_token=... to the redirect URL
function handleDeepLinkUrl(url: string | null) {
  if (!url) return;
  const fragment = url.split('#')[1];
  if (!fragment) return;
  const params = new URLSearchParams(fragment);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  }
}

// App already running — receives deep link in foreground
Linking.addEventListener('url', ({ url }) => handleDeepLinkUrl(url));

// Cold start — app launched via deep link
Linking.getInitialURL().then(handleDeepLinkUrl);
