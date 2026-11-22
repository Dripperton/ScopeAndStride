import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import type { Session } from '@supabase/supabase-js';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

// Per-barn credentials come from the brand JSON via app.config.js
// Fallback values ensure the HHF dev build still works if extra is missing
const supabaseUrl = extra.supabaseUrl || 'https://kzpdukjkttkaaligxsmb.supabase.co';
const supabaseKey = extra.supabaseAnonKey || 'sb_publishable_6HLbfXt3q5rjEi8eoq8lJg_B_LlNqV6';

// iOS Keychain (expo-secure-store) has no initialization delay unlike AsyncStorage v2
// (NitroModules). SecureStore's 2KB limit is handled by chunking large values.
// In-memory cache (memStore) backs every read/write so that if the Keychain write
// fails silently the session is still available within the same app session.
const CHUNK_SIZE = 1900;
const memStore = new Map<string, string>();

const SecureStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const direct = await SecureStore.getItemAsync(key);
      if (direct != null) {
        memStore.set(key, direct);
        return direct;
      }
      const countStr = await SecureStore.getItemAsync(`${key}__count`);
      if (countStr) {
        const count = parseInt(countStr, 10);
        const chunks = await Promise.all(
          Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}__${i}`))
        );
        if (chunks.every(c => c != null)) {
          const val = (chunks as string[]).join('');
          memStore.set(key, val);
          return val;
        }
      }
    } catch {}
    return memStore.get(key) ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    memStore.set(key, value);
    try {
      if (value.length <= CHUNK_SIZE) {
        await SecureStore.setItemAsync(key, value);
        const countStr = await SecureStore.getItemAsync(`${key}__count`);
        if (countStr) {
          const count = parseInt(countStr, 10);
          await Promise.all([
            SecureStore.deleteItemAsync(`${key}__count`),
            ...Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}__${i}`)),
          ]);
        }
      } else {
        const chunks: string[] = [];
        for (let i = 0; i < value.length; i += CHUNK_SIZE) chunks.push(value.slice(i, i + CHUNK_SIZE));
        await Promise.all([
          SecureStore.setItemAsync(`${key}__count`, String(chunks.length)),
          ...chunks.map((c, i) => SecureStore.setItemAsync(`${key}__${i}`, c)),
        ]);
        await SecureStore.deleteItemAsync(key);
      }
    } catch {}
  },
  removeItem: async (key: string): Promise<void> => {
    memStore.delete(key);
    try {
      const countStr = await SecureStore.getItemAsync(`${key}__count`);
      if (countStr) {
        const count = parseInt(countStr, 10);
        await Promise.all([
          SecureStore.deleteItemAsync(`${key}__count`),
          ...Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}__${i}`)),
        ]);
      }
      await SecureStore.deleteItemAsync(key);
    } catch {}
  },
};

// Last-resort token cache: set synchronously from onAuthStateChange, used by
// customFetch to inject a valid JWT even when getSession() fails to read storage.
let _cachedToken: string | null = null;

// Injects the cached user JWT for all non-auth requests so PostgREST RLS works
// even if SecureStore can't return the session.
const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  if (_cachedToken) {
    const url = typeof input === 'string' ? input : (input as Request).url;
    if (!url.includes('/auth/v1/')) {
      const headers = new Headers(init?.headers as HeadersInit | undefined);
      headers.set('Authorization', `Bearer ${_cachedToken}`);
      return fetch(input, { ...init, headers });
    }
  }
  return fetch(input, init);
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: SecureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
  global: { fetch: customFetch },
});

// Keep _cachedToken fresh from every auth event (fires before fetchProfile runs)
supabase.auth.onAuthStateChange((_event, session: Session | null) => {
  _cachedToken = session?.access_token ?? null;
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
