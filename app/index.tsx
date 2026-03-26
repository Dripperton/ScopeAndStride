import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function Index() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');

  async function handleAuth() {
    if (!email.trim() || !password.trim()) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    setError('');
    if (isSignUp) {
      const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }
      // After signup, check for a matching invite and apply role + horse_id
      if (data?.user) {
        const { data: invite } = await supabase
          .from('invites')
          .select('*')
          .eq('email', email.trim().toLowerCase())
          .eq('accepted', false)
          .single();

        if (invite) {
          // Update the new user's profile with role and horse_id from invite
          await supabase.from('profiles').update({
            role: invite.role,
            horse_id: invite.horse_id || null,
          }).eq('id', data.user.id);

          // Mark invite as accepted so it can't be reused
          await supabase.from('invites').update({ accepted: true }).eq('id', invite.id);
        }
      }
      setError('Check your email to confirm your account.');
      setLoading(false);
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) { setError(signInError.message); setLoading(false); }
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.logoMark}>
          <Text style={styles.logoS}>S</Text>
          <View style={styles.logoRule} />
          <Text style={styles.logoS}>S</Text>
        </View>
        <Text style={styles.wordmark}>Scope & Stride</Text>
        <Text style={styles.tagline}>Barn management, refined.</Text>
      </View>

      <View style={styles.form}>
        {error ? <Text style={[styles.errorText, error.startsWith('Check') && styles.infoText]}>{error}</Text> : null}

        <View style={styles.inputWrap}>
          <Text style={styles.label}>Email</Text>
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

        <View style={styles.inputWrap}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#C4BAA8"
            secureTextEntry
          />
        </View>

        {!isSignUp && (
          <Pressable onPress={() => router.navigate("/forgot-password")} style={styles.forgotWrap}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>
        )}

        <Pressable
          style={({ hovered }: any) => [styles.btn, hovered && styles.btnHovered]}
          onPress={handleAuth}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#2C4A35" />
            : <Text style={styles.btnText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
          }
        </Pressable>

        <Pressable onPress={() => { setIsSignUp(!isSignUp); setError(''); }} style={styles.switchWrap}>
          <Text style={styles.switchText}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <Text style={styles.switchLink}>{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2C4A35' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  logoMark: { alignItems: 'center', gap: 2 },
  logoS: { fontSize: 36, fontWeight: '800', color: '#C9A85C', lineHeight: 38 },
  logoRule: { width: 40, height: 2, backgroundColor: '#C9A85C' },
  wordmark: { fontSize: 28, fontWeight: '300', color: '#FAF7F2', letterSpacing: 2 },
  tagline: { fontSize: 13, color: 'rgba(250,247,242,0.5)', letterSpacing: 1 },
  form: { backgroundColor: '#FAF7F2', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 32, gap: 12 },
  errorText: { color: '#8B2E2E', fontSize: 13, textAlign: 'center' },
  infoText: { color: '#2C4A35' },
  inputWrap: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 12, padding: 14 },
  label: { fontSize: 11, color: '#9A9285', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { fontSize: 15, color: '#1A1A14', paddingVertical: 4 },
  forgotWrap: { alignItems: 'flex-end', marginTop: -4 },
  forgotText: { fontSize: 13, color: '#B08C4A' },
  btn: { backgroundColor: '#C9A85C', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  btnHovered: { backgroundColor: '#B08C4A' },
  btnText: { color: '#2C4A35', fontSize: 15, fontWeight: '700' },
  switchWrap: { alignItems: 'center', paddingBottom: 8 },
  switchText: { fontSize: 13, color: '#9A9285' },
  switchLink: { color: '#2C4A35', fontWeight: '600' },
});
