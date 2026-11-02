import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../lib/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export default function Account() {
  const router = useRouter();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;

  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleUpdate() {
    if (!current.trim()) { setError(t('Please enter your current password.')); return; }
    if (!password.trim()) { setError(t('Please enter a new password.')); return; }
    if (password !== confirm) { setError(t('Passwords do not match.')); return; }
    if (password.length < 6) { setError(t('Password must be at least 6 characters.')); return; }

    setLoading(true);
    setError('');

    // Verify current password by re-signing in
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) { setError(t('Unable to verify account.')); setLoading(false); return; }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });
    if (signInError) {
      setError(t('Current password is incorrect.'));
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
    } else {
      setDone(true);
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: C.headerText, fontFamily: F.sans }]}>{'← ' + t('Back')}</Text>
        </Pressable>
        <Text style={[styles.headerName, { color: C.headerText, fontFamily: F.sansBold }]}>{t('My Account')}</Text>
        <View style={{ width: 80 }} />
      </View>

      <View style={styles.body}>
        <Text style={[styles.sectionTitle, { color: C.text, fontFamily: F.sansBold }]}>{t('Change Password')}</Text>

        {done ? (
          <View style={[styles.successCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <Text style={[styles.successTitle, { color: C.primary, fontFamily: F.sansBold }]}>{t('Password updated!')}</Text>
            <Text style={[styles.successText, { color: C.textMuted, fontFamily: F.sans }]}>{t('Your password has been changed successfully.')}</Text>
            <Pressable
              style={[styles.btn, { backgroundColor: C.primary }]}
              onPress={() => router.back()}
            >
              <Text style={[styles.btnText, { color: '#FFFFFF', fontFamily: F.sansBold }]}>{t('Done')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {error ? <Text style={[styles.errorText, { color: C.error, fontFamily: F.sans }]}>{error}</Text> : null}

            <View style={[styles.inputWrap, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <Text style={[styles.label, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Current Password')}</Text>
              <TextInput
                style={[styles.input, { color: C.text, fontFamily: F.sans }]}
                value={current}
                onChangeText={setCurrent}
                placeholder={t('Enter current password')}
                placeholderTextColor={C.cardBorder}
                secureTextEntry
              />
            </View>

            <View style={[styles.inputWrap, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <Text style={[styles.label, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('New Password')}</Text>
              <TextInput
                style={[styles.input, { color: C.text, fontFamily: F.sans }]}
                value={password}
                onChangeText={setPassword}
                placeholder={t('Min. 6 characters')}
                placeholderTextColor={C.cardBorder}
                secureTextEntry
              />
            </View>

            <View style={[styles.inputWrap, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <Text style={[styles.label, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Confirm New Password')}</Text>
              <TextInput
                style={[styles.input, { color: C.text, fontFamily: F.sans }]}
                value={confirm}
                onChangeText={setConfirm}
                placeholder={t('Re-enter new password')}
                placeholderTextColor={C.cardBorder}
                secureTextEntry
              />
            </View>

            <Pressable
              style={({ hovered }: any) => [styles.btn, { backgroundColor: C.primary }, hovered && { backgroundColor: C.primaryDark }]}
              onPress={handleUpdate}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={[styles.btnText, { color: '#FFFFFF', fontFamily: F.sansBold }]}>{t('Update Password')}</Text>
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
  backBtn: { width: 80 },
  backText: { fontSize: 14 },
  headerName: { fontSize: 15, fontWeight: '600' },
  body: { flex: 1, padding: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20 },
  errorText: { fontSize: 13, marginBottom: 16 },
  inputWrap: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 16 },
  label: { fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { fontSize: 15, paddingVertical: 4 },
  btn: { padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  btnText: { fontSize: 15, fontWeight: '700' },
  successCard: { borderWidth: 1, borderRadius: 16, padding: 24, alignItems: 'center', gap: 12 },
  successTitle: { fontSize: 20, fontWeight: '700' },
  successText: { fontSize: 14, textAlign: 'center' },
});
