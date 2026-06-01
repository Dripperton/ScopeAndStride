import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../lib/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export default function ForgotPassword() {
  const router = useRouter();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleReset() {
    if (!email.trim()) { setError(t('Please enter your email address.')); return; }
    setLoading(true);
    setError('');
    const redirectTo = Platform.OS === 'web'
      ? `${window.location.origin}/reset-password`
      : 'scopeandstride://reset-password';
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <Pressable onPress={() => router.back()} style={({ hovered }: any) => [styles.backBtn, hovered && { backgroundColor: C.secondaryAlpha15 }]}>
          <Text style={[styles.backText, { color: C.headerText, fontFamily: F.sans }]}>← {t('Back')}</Text>
        </Pressable>
        <Text style={[styles.headerName, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Reset Password')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>🔑</Text>
        </View>

        {sent ? (
          <View style={styles.successCard}>
            <Text style={[styles.successTitle, { color: C.primary, fontFamily: F.sansBold }]}>{t('Check your email')}</Text>
            <Text style={[styles.successText, { color: C.textMuted, fontFamily: F.sans }]}>{t('We sent a password reset link to {email}. Check your inbox and follow the link to set a new password.', { email })}</Text>
            <Pressable
              style={({ hovered }: any) => [styles.btn, { backgroundColor: C.secondary }, hovered && { backgroundColor: C.secondaryDark }]}
              onPress={() => router.replace('/')}
            >
              <Text style={[styles.btnText, { color: C.primary, fontFamily: F.sansBold }]}>{t('Back to Sign In')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={[styles.title, { color: C.text, fontFamily: F.sansBold }]}>{t('Forgot your password?')}</Text>
            <Text style={[styles.subtitle, { color: C.textMuted, fontFamily: F.sans }]}>{t("Enter the email address on your account and we'll send you a reset link.")}</Text>

            {error ? <Text style={[styles.errorText, { color: C.error, fontFamily: F.sans }]}>{error}</Text> : null}

            <View style={[styles.inputWrap, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <Text style={[styles.label, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Email Address')}</Text>
              <TextInput
                style={[styles.input, { color: C.text, fontFamily: F.sans }]}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={C.cardBorder}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Pressable
              style={({ hovered }: any) => [styles.btn, { backgroundColor: C.secondary }, hovered && { backgroundColor: C.secondaryDark }]}
              onPress={handleReset}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={C.primary} />
                : <Text style={[styles.btnText, { color: C.primary, fontFamily: F.sansBold }]}>{t('Send Reset Link')}</Text>
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
  backBtn: { width: 60, padding: 4, borderRadius: 6 },
  backText: { fontSize: 14 },
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
  successCard: { alignItems: 'center', gap: 16 },
  successTitle: { fontSize: 22, fontWeight: '700' },
  successText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
