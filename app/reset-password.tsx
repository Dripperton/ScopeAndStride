import { useState, useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Parse the access_token from the URL hash
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace('#', '?'));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type = params.get('type');

    if (type === 'recovery' && accessToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken || '' })
        .then(({ error }) => {
          if (error) setError('Invalid or expired reset link. Please request a new one.');
          else setReady(true);
        });
    } else {
      setError('Invalid or expired reset link. Please request a new one.');
    }
  }, []);

  async function handleUpdate() {
    if (!password.trim()) { setError('Please enter a new password.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setDone(true);
      setLoading(false);
      setTimeout(() => router.replace('/dashboard'), 2000);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ width: 60 }} />
        <Text style={styles.headerName}>New Password</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>🔒</Text>
        </View>

        {done ? (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Password updated!</Text>
            <Text style={styles.successText}>Taking you to your dashboard…</Text>
            <ActivityIndicator color="#2C4A35" style={{ marginTop: 16 }} />
          </View>
        ) : !ready ? (
          <View style={styles.successCard}>
            {error ? (
              <>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable
                  style={({ hovered }: any) => [styles.btn, hovered && styles.btnHovered]}
                  onPress={() => router.replace('/forgot-password')}
                >
                  <Text style={styles.btnText}>Request New Link</Text>
                </Pressable>
              </>
            ) : (
              <ActivityIndicator color="#2C4A35" size="large" />
            )}
          </View>
        ) : (
          <>
            <Text style={styles.title}>Set a new password</Text>
            <Text style={styles.subtitle}>Choose a strong password for your Scope & Stride account.</Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.inputWrap}>
              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Min. 6 characters"
                placeholderTextColor="#C4BAA8"
                secureTextEntry
              />
            </View>

            <View style={styles.inputWrap}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Re-enter your password"
                placeholderTextColor="#C4BAA8"
                secureTextEntry
              />
            </View>

            <Pressable
              style={({ hovered }: any) => [styles.btn, hovered && styles.btnHovered]}
              onPress={handleUpdate}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#2C4A35" />
                : <Text style={styles.btnText}>Update Password</Text>
              }
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F2' },
  header: { backgroundColor: '#2C4A35', padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerName: { fontSize: 15, fontWeight: '600', color: '#C9A85C' },
  body: { flex: 1, padding: 32, alignItems: 'center' },
  iconWrap: { marginTop: 24, marginBottom: 24 },
  icon: { fontSize: 52 },
  title: { fontSize: 22, fontWeight: '700', color: '#1A1A14', marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#9A9285', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  errorText: { color: '#8B2E2E', fontSize: 13, marginBottom: 16, textAlign: 'center' },
  inputWrap: { width: '100%', backgroundColor: 'white', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 12, padding: 14, marginBottom: 16 },
  label: { fontSize: 11, color: '#9A9285', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { fontSize: 15, color: '#1A1A14', paddingVertical: 4 },
  btn: { width: '100%', backgroundColor: '#C9A85C', padding: 16, borderRadius: 10, alignItems: 'center' },
  btnHovered: { backgroundColor: '#B08C4A' },
  btnText: { color: '#2C4A35', fontSize: 15, fontWeight: '700' },
  successCard: { alignItems: 'center', gap: 8 },
  successTitle: { fontSize: 22, fontWeight: '700', color: '#2C4A35' },
  successText: { fontSize: 14, color: '#9A9285', textAlign: 'center' },
});
