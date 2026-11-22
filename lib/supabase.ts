import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

// Per-barn credentials come from the brand JSON via app.config.js
// Fallback values ensure the HHF dev build still works if extra is missing
const supabaseUrl = extra.supabaseUrl || 'https://kzpdukjkttkaaligxsmb.supabase.co';
const supabaseKey = extra.supabaseAnonKey || 'sb_publishable_6HLbfXt3q5rjEi8eoq8lJg_B_LlNqV6';

// Hybrid storage: memory-first for instant reads, AsyncStorage for cross-restart persistence.
// getSession() re-reads storage on every call in auth-js, so AsyncStorage v2 (NitroModules)
// returning null during initialization caused every PostgREST query to run as anon.
const _mem: Record<string, string> = {};
const HybridStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (key in _mem) return _mem[key];
    // NitroModules (AsyncStorage v2) may throw OR return null during early cold-start
    // initialization. Keep them in separate try-catches so a throw on the first attempt
    // doesn't skip the retry (a single try-catch would short-circuit to null on throw).
    for (let i = 0; i < 5; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 400));
      try {
        const v = await AsyncStorage.getItem(key);
        if (v !== null) { _mem[key] = v; return v; }
      } catch {}
    }
    return null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    _mem[key] = value;
    try { await AsyncStorage.setItem(key, value); } catch {}
  },
  removeItem: async (key: string): Promise<void> => {
    delete _mem[key];
    try { await AsyncStorage.removeItem(key); } catch {}
  },
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: HybridStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
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
// Handles three formats:
//   1. Query string tokens:  scopeandstride://auth-callback?access_token=...&refresh_token=...
//      (forwarded by the web intermediary at /auth-callback — iOS preserves query strings)
//   2. PKCE code:            scopeandstride://auth-callback?code=...
//   3. Hash tokens (legacy): scopeandstride://#access_token=...  (iOS often strips these)
export function handleDeepLinkUrl(url: string | null) {
  if (!url) return;

  const queryString = url.split('?')[1]?.split('#')[0];
  if (queryString) {
    const queryParams = new URLSearchParams(queryString);
    const accessToken = queryParams.get('access_token');
    const refreshToken = queryParams.get('refresh_token');
    const code = queryParams.get('code');

    if (accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      return;
    }
    if (code) {
      supabase.auth.exchangeCodeForSession(code);
      return;
    }
  }

  // Legacy: hash tokens (often stripped by iOS for custom URL schemes)
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

// Cold start is handled in _layout.tsx after onAuthStateChange is set up,
// so PASSWORD_RECOVERY fires into a live listener.
