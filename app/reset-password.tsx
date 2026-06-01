import { useState, useEffect } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../lib/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export default function ResetPassword() {
  const router = useRouter();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      // Web: parse the access_token from the URL hash
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.replace('#', '?'));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = params.get('type');

      if (type === 'recovery' && accessToken) {
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken || '' })
          .then(({ error }) => {
            if (error) setError(t('Invalid or expired reset link. Please request a new one.'));
            else setReady(true);
          });
      } else {
        setError(t('Invalid or expired reset link. Please request a new one.'));
      }
    } else {
      // Native: _layout.tsx already handled the PASSWORD_RECOVERY event
      // and set the session before navigating here, so we're ready
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setReady(true);
        } else {
          setError(t('Invalid or expired reset link. Please request a new one.'));
        }
      });
    }
  }, []);

  async function handleUpdate() {
    if (!password.trim()) { setError(t('Please enter a new password.')); return; }
    if (password !== confirm) { setError(t('Passwords do not match.')); return; }
    if (password.length < 6) { setError(t('Password must be at least 6 characters.')); return; }
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
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <View style={{ width: 60 }} />
        <Text style={[styles.headerName, { color: C.headerText, fontFamily: F.sansBold }]}>{t('New Password')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>🔒</Text>
        </View>

        {done ? (
          <View style={styles.successCard}>
            <Text style={[styles.successTitle, { color: C.primary, fontFamily: F.sansBold }]}>{t('Password updated!')}</Text>
            <Text style={[styles.successText, { color: C.textMuted, fontFamily: F.sans }]}>{t('Taking you to your dashboard…')}</Text>
            <ActivityIndicator color={C.primary} style={{ marginTop: 16 }} />
          </View>
        ) : !ready ? (
          <View style={styles.successCard}>
            {error ? (
              <>
                <Text style={[styles.errorText, { color: C.error, fontFamily: F.sans }]}>{error}</Text>
                <Pressable
                  style={({ hovered }: any) => [styles.btn, { backgroundColor: C.secondary }, hovered && { backgroundColor: C.secondaryDark }]}
                  onPress={() => router.replace('/forgot-password')}
                >
                  <Text style={[styles.btnText, { color: C.primary, fontFamily: F.sansBold }]}>{t('Request New Link')}</Text>
                </Pressable>
              </>
            ) : (
              <ActivityIndicator color={C.primary} size="large" />
            )}
          </View>
        ) : (
          <>
            <Text style={[styles.title, { color: C.text, fontFamily: F.sansBold }]}>{t('Set a new password')}</Text>
            <Text style={[styles.subtitle, { color: C.textMuted, fontFamily: F.sans }]}>{t('Choose a strong password for your Scope & Stride account.')}</Text>

            {error ? <Text style={[styles.errorText, { color: C.error, fontFamily: F.sans }]}>{error}</Text> : null}

            <View style={[styles.inputWrap, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <Text style={[styles.label, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('New Password')}</Text>
              <TextInput
                style={[styles.input, { color: C.text, fontFamily: F.sans }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Min. 6 characters"
                placeholderTextColor={C.cardBorder}
                secureTextEntry
              />
            </View>

            <View style={[styles.inputWrap, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <Text style={[styles.label, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Confirm Password')}</Text>
              <TextInput
                style={[styles.input, { color: C.text, fontFamily: F.sans }]}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Re-enter your password"
                placeholderTextColor={C.cardBorder}
                secureTextEntry
              />
            </View>

            <Pressable
              style={({ hovered }: any) => [styles.btn, { backgroundColor: C.secondary }, hovered && { backgroundColor: C.secondaryDark }]}
              onPress={handleUpdate}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={C.primary} />
                : <Text style={[styles.btnText, { color: C.primary, fontFamily: F.sansBold }]}>{t('Update Password')}</Text>
              }
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerName: { fontSize: 15, fontWeight: '600' },
  body: { flex: 1, padding: 32, alignItems: 'center' },
  iconWrap: { marginTop: 24, marginBottom: 24 },
  icon: { fontSize: 52 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  errorText: { fontSize: 13, marginBottom: 16, textAlign: 'center' },
  inputWrap: { width: '100%', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 16 },
  label: { fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { fontSize: 15, paddingVertical: 4 },
  btn: { width: '100%', padding: 16, borderRadius: 10, alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '700' },
  successCard: { alignItems: 'center', gap: 8 },
  successTitle: { fontSize: 22, fontWeight: '700' },
  successText: { fontSize: 14, textAlign: 'center' },
});
