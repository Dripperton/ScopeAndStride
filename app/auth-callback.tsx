import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

// Web-only intermediary page.
// Supabase redirects here after verifying a magic link, invite, or password reset.
// PKCE flow:     ?code=...        (query string)
// Implicit flow: #access_token=... (hash fragment — iOS strips these from custom URL schemes)
// This page reads whichever format arrived and redirects to the native app using
// query params (not a hash), which iOS custom URL schemes preserve correctly.
export default function AuthCallback() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // PKCE: code arrives as a query param
    const queryParams = new URLSearchParams(window.location.search);
    const code = queryParams.get('code');
    if (code) {
      window.location.href = `scopeandstride://auth-callback?code=${encodeURIComponent(code)}`;
      return;
    }

    // Implicit: tokens arrive in the hash fragment
    const hash = window.location.hash.slice(1);
    if (!hash) return;

    const hashParams = new URLSearchParams(hash);
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const type = hashParams.get('type');
    // Also handle code in hash (some Supabase versions)
    const hashCode = hashParams.get('code');

    if (hashCode) {
      window.location.href = `scopeandstride://auth-callback?code=${encodeURIComponent(hashCode)}`;
      return;
    }

    if (accessToken && refreshToken) {
      window.location.href =
        `scopeandstride://auth-callback?access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&type=${type ?? ''}`;
    }
  }, []);

  return null;
}
