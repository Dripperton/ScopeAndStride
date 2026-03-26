import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleReset() {
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: 'http://localhost:8081/reset-password' });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ hovered }: any) => [styles.backBtn, hovered && styles.backBtnHovered]}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerName}>Reset Password</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>🔑</Text>
        </View>

        {sent ? (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Check your email</Text>
            <Text style={styles.successText}>We sent a password reset link to {email}. Check your inbox and follow the link to set a new password.</Text>
            <Pressable
              style={({ hovered }: any) => [styles.btn, hovered && styles.btnHovered]}
              onPress={() => router.replace('/')}
            >
              <Text style={styles.btnText}>Back to Sign In</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.title}>Forgot your password?</Text>
            <Text style={styles.subtitle}>Enter the email address on your account and we'll send you a reset link.</Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.inputWrap}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#C4BAA8"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Pressable
              style={({ hovered }: any) => [styles.btn, hovered && styles.btnHovered]}
              onPress={handleReset}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#2C4A35" />
                : <Text style={styles.btnText}>Send Reset Link</Text>
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
  backBtn: { width: 60, padding: 4, borderRadius: 6 },
  backBtnHovered: { backgroundColor: 'rgba(201,168,92,0.15)' },
  backText: { color: '#C9A85C', fontSize: 14 },
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
  successCard: { alignItems: 'center', gap: 16 },
  successTitle: { fontSize: 22, fontWeight: '700', color: '#2C4A35' },
  successText: { fontSize: 14, color: '#9A9285', textAlign: 'center', lineHeight: 22 },
});
