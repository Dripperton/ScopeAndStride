import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../lib/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import Brand from '../constants/brand';

export default function Index() {
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const theme = useTheme();
  const F = theme.fonts;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<any>(null);

  async function handleAuth() {
    if (!email.trim() || !password.trim()) {
      setError(t('Please enter your email and password.'));
      return;
    }
    setLoading(true);
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError(signInError.message);
    }
    setLoading(false);
  }

  async function handleLanguageChange(lang: 'en' | 'es') {
    setLanguage(lang);
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      {/* ── Dark hero section with barn branding */}
      <View style={styles.hero}>
        <View style={styles.logoMark}>
          <Text style={[styles.logoInitials, { fontFamily: F.sansBold }]}>HHF</Text>
        </View>
        <Text style={[styles.barnName, { fontFamily: F.serif }]}>{Brand.barnName}</Text>
        <Text style={[styles.poweredBy, { fontFamily: F.sans }]}>
          {t('Powered by')} Scope & Stride
        </Text>
      </View>

      {/* ── Form section */}
      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formCard}>
          {error ? (
            <Text style={[styles.errorText, { fontFamily: F.sans }]}>{error}</Text>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: F.sansMedium }]}>{t('Email')}</Text>
            <TextInput
              style={[
                styles.input,
                { fontFamily: F.sans },
                emailFocused && styles.inputFocused,
              ]}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#9A9AA8"
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { fontFamily: F.sansMedium }]}>{t('Password')}</Text>
            <View style={[
              styles.passwordRow,
              passwordFocused && styles.inputFocused,
            ]}>
              <TextInput
                ref={passwordRef}
                style={[styles.passwordInput, { fontFamily: F.sans }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#9A9AA8"
                secureTextEntry={!showPassword}
                returnKeyType="go"
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                onSubmitEditing={handleAuth}
              />
              <Pressable onPress={() => setShowPassword(prev => !prev)} style={styles.eyeBtn}>
                {showPassword ? <EyeOff size={18} color="#9A9AA8" /> : <Eye size={18} color="#9A9AA8" />}
              </Pressable>
            </View>
          </View>

          <Pressable onPress={() => router.navigate('/forgot-password')} style={styles.forgotWrap}>
            <Text style={[styles.forgotText, { fontFamily: F.sans }]}>{t('Forgot password?')}</Text>
          </Pressable>

          <Pressable
            style={({ hovered }: any) => [styles.btn, hovered && styles.btnHovered]}
            onPress={handleAuth}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={[styles.btnText, { fontFamily: F.sansBold }]}>{t('Sign In')}</Text>}
          </Pressable>
        </View>

        <Text style={[styles.noAccount, { fontFamily: F.sans }]}>
          {t("Don't have an account?")}{' '}
          <Text style={styles.noAccountEmphasis}>{t('Contact your barn manager')}</Text>
        </Text>

        {/* ── Language toggle */}
        <View style={styles.langRow}>
          <Pressable onPress={() => handleLanguageChange('en')}>
            <Text style={[
              styles.langOption,
              { fontFamily: language === 'en' ? F.sansBold : F.sans },
              language === 'en' && styles.langOptionActive,
            ]}>
              English
            </Text>
          </Pressable>
          <Text style={styles.langDivider}>·</Text>
          <Pressable onPress={() => handleLanguageChange('es')}>
            <Text style={[
              styles.langOption,
              { fontFamily: language === 'es' ? F.sansBold : F.sans },
              language === 'es' && styles.langOptionActive,
            ]}>
              Español
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A1A' },

  // Hero
  hero: { paddingTop: 80, paddingBottom: 40, paddingHorizontal: 24, alignItems: 'center', gap: 10, backgroundColor: '#1A1A1A' },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#2B5FD9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  logoInitials: { fontSize: 18, color: '#FFFFFF', letterSpacing: 1.5 },
  barnName: { fontSize: 24, color: '#F5F5F8', letterSpacing: 0.3 },
  poweredBy: { fontSize: 12, color: '#7A7A8A', letterSpacing: 0.3 },

  // Form
  formScroll: { flex: 1, backgroundColor: '#F5F5F8', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  formContent: { padding: 24, paddingTop: 28 },
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 24, gap: 14 },

  errorText: { color: '#8B2E2E', fontSize: 13, textAlign: 'center', backgroundColor: '#FDECEA', padding: 10, borderRadius: 8 },

  inputGroup: { gap: 6 },
  label: { fontSize: 12, color: '#5A5A6A', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    fontSize: 15,
    color: '#1A1A1A',
    backgroundColor: '#F5F5F8',
    borderWidth: 1,
    borderColor: '#C4C4CC',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputFocused: { borderColor: '#2B5FD9', backgroundColor: '#FFFFFF' },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F8',
    borderWidth: 1,
    borderColor: '#C4C4CC',
    borderRadius: 8,
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 10 },

  forgotWrap: { alignItems: 'flex-end', marginTop: -4 },
  forgotText: { fontSize: 13, color: '#2B5FD9' },

  btn: { backgroundColor: '#1A1A1A', paddingVertical: 16, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', marginTop: 4 },
  btnHovered: { backgroundColor: '#333333' },
  btnText: { color: '#FFFFFF', fontSize: 15, paddingHorizontal: 2 },

  noAccount: { fontSize: 13, color: '#5A5A6A', textAlign: 'center', marginTop: 20, lineHeight: 20 },
  noAccountEmphasis: { color: '#1A1A1A', fontWeight: '600' },

  // Language
  langRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 24, paddingBottom: 20 },
  langOption: { fontSize: 14, color: '#9A9AA8', paddingHorizontal: 2 },
  langOptionActive: { color: '#5A5A6A' },
  langDivider: { fontSize: 14, color: '#C4C4CC' },
});
