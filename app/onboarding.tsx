import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useProfile } from '../lib/useProfile';
import { useLanguage } from '../lib/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const STEP_KEYS = ['Your Horse', 'Vet & Emergency', 'Farrier & Care', 'All Done'];

export default function Onboarding() {
  const router = useRouter();
  const { profile, primaryHorse } = useProfile();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Step 1 — Horse details
  const [fullName, setFullName] = useState('');
  const [horseName, setHorseName] = useState('');
  const [breed, setBreed] = useState('');
  const [boardType, setBoardType] = useState('');

  // Step 2 — Vet & Emergency
  const [vetName, setVetName] = useState('');
  const [vetPhone, setVetPhone] = useState('');
  const [emergencyClinic, setEmergencyClinic] = useState('');
  const [emergencyAuth, setEmergencyAuth] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');

  // Step 3 — Farrier & Care
  const [farrierName, setFarrierName] = useState('');
  const [farrierPhone, setFarrierPhone] = useState('');
  const [shoeType, setShoeType] = useState('');
  const [dietaryNotes, setDietaryNotes] = useState('');
  const [quirks, setQuirks] = useState('');

  function canProceed() {
    if (step === 0) return fullName.trim().length > 0 && horseName.trim().length > 0;
    if (step === 1) return vetName.trim().length > 0 && vetPhone.trim().length > 0;
    return true;
  }

  async function handleFinish() {
    if (!profile) return;
    setSaving(true);
    setError('');

    try {
      const horseId = primaryHorse?.id;

      // Update horse record if horse_id exists
      if (horseId) {
        await supabase
          .from('horses')
          .update({
            name: horseName.trim() || undefined,
            breed: breed.trim() || null,
            board_type: boardType.trim() || null,
            farrier_name: farrierName.trim() || null,
            shoe_type: shoeType.trim() || null,
            vet_name: vetName.trim() || null,
            vet_phone: vetPhone.trim() || null,
            emergency_clinic: emergencyClinic.trim() || null,
            emergency_auth: emergencyAuth.trim() || null,
            emergency_contact: emergencyContact.trim() || null,
            emergency_contact_phone: emergencyContactPhone.trim() || null,
            quirks: quirks.trim() || null,
          })
          .eq('id', horseId);

        // Add dietary note
        if (dietaryNotes.trim()) {
          await supabase.from('dietary_records').insert({
            horse_id: horseId,
            title: 'Owner notes — initial setup',
            date: new Date().toISOString().split('T')[0],
            notes: dietaryNotes.trim(),
          });
        }

        // Add farrier record
        if (farrierName.trim() || farrierPhone.trim()) {
          await supabase.from('farrier_records').insert({
            horse_id: horseId,
            date: new Date().toISOString().split('T')[0],
            shoe_type: shoeType.trim() || null,
            notes: `Farrier: ${farrierName.trim()}${farrierPhone.trim() ? ' — ' + farrierPhone.trim() : ''}`,
          });
        }
      }

      // Save name and mark onboarding complete
      await supabase
        .from('profiles')
        .update({ onboarding_complete: true, full_name: fullName.trim() })
        .eq('id', profile.id);
      setStep(3);
    } catch (e: any) {
      setError(e.message || t('Something went wrong. Please try again.'));
    }

    setSaving(false);
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <View style={styles.logoMark}>
          <Text style={[styles.logoS, { color: C.headerText, fontFamily: F.sansBold }]}>S</Text>
          <View style={[styles.logoRule, { backgroundColor: C.secondary }]} />
          <Text style={[styles.logoS, { color: C.headerText, fontFamily: F.sansBold }]}>S</Text>
        </View>
        <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Welcome to Scope & Stride')}</Text>
        <Text style={styles.headerSub}>{t("Let's get your horse set up")}</Text>
      </View>

      {step < 3 && (
        <View style={[styles.progress, { backgroundColor: C.primaryDark }]}>
          {STEP_KEYS.slice(0, 3).map((label, i) => (
            <View key={i} style={styles.progressStep}>
              <View style={[styles.progressDot, i <= step && { backgroundColor: C.secondary }]}>
                <Text style={[styles.progressDotText, i <= step && { color: C.primary }]}>
                  {i < step ? '✓' : i + 1}
                </Text>
              </View>
              <Text style={[styles.progressLabel, i === step && { color: C.headerText }]}>
                {t(label)}
              </Text>
            </View>
          ))}
        </View>
      )}

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

        {step === 0 && (
          <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: C.text, fontFamily: F.sansBold }]}>{t('Tell us about your horse')}</Text>
            <Text style={[styles.sectionSub, { color: C.textMuted, fontFamily: F.sans }]}>{t('This helps your barn manager keep accurate records.')}</Text>

            <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Your Name').toUpperCase()} *</Text>
            <TextInput style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={fullName} onChangeText={setFullName} placeholder="e.g. Sarah Henderson" placeholderTextColor={C.textMuted} />

            <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Horse Name').toUpperCase()} *</Text>
            <TextInput style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={horseName} onChangeText={setHorseName} placeholder="e.g. Clifford" placeholderTextColor={C.textMuted} />

            <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Breed').toUpperCase()}</Text>
            <TextInput style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={breed} onChangeText={setBreed} placeholder="e.g. Warmblood, Thoroughbred" placeholderTextColor={C.textMuted} />

            <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Board Type').toUpperCase()}</Text>
            <TextInput style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={boardType} onChangeText={setBoardType} placeholder="e.g. Full Board, Training Board" placeholderTextColor={C.textMuted} />
          </View>
        )}

        {step === 1 && (
          <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: C.text, fontFamily: F.sansBold }]}>{t('Vet & emergency information')}</Text>
            <Text style={[styles.sectionSub, { color: C.textMuted, fontFamily: F.sans }]}>{t("Critical if something happens and we can't reach you.")}</Text>

            <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Primary Vet').toUpperCase()} {t('Name').toUpperCase()} *</Text>
            <TextInput style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={vetName} onChangeText={setVetName} placeholder="e.g. Dr. Sarah Jones" placeholderTextColor={C.textMuted} />

            <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Vet Phone').toUpperCase()} *</Text>
            <TextInput style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={vetPhone} onChangeText={setVetPhone} placeholder="e.g. (919) 555-0100" placeholderTextColor={C.textMuted} keyboardType="phone-pad" />

            <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Preferred Emergency Clinic').toUpperCase()}</Text>
            <TextInput style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={emergencyClinic} onChangeText={setEmergencyClinic} placeholder="e.g. NC State Equine Hospital" placeholderTextColor={C.textMuted} />

            <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Financial Authorization').toUpperCase()}</Text>
            <TextInput style={[styles.input, styles.textArea, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={emergencyAuth} onChangeText={setEmergencyAuth} placeholder="e.g. Authorized up to $5,000 without contact. Over $5,000 call me first." placeholderTextColor={C.textMuted} multiline />

            <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Backup Contact').toUpperCase()}</Text>
            <TextInput style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={emergencyContact} onChangeText={setEmergencyContact} placeholder="Name" placeholderTextColor={C.textMuted} />
            <TextInput style={[styles.input, { marginTop: 8, backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={emergencyContactPhone} onChangeText={setEmergencyContactPhone} placeholder="Phone number" placeholderTextColor={C.textMuted} keyboardType="phone-pad" />
          </View>
        )}

        {step === 2 && (
          <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: C.text, fontFamily: F.sansBold }]}>{t('Farrier & care preferences')}</Text>
            <Text style={[styles.sectionSub, { color: C.textMuted, fontFamily: F.sans }]}>{t('Help us keep your horse on the right schedule.')}</Text>

            <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Farrier Name').toUpperCase()}</Text>
            <TextInput style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={farrierName} onChangeText={setFarrierName} placeholder="e.g. Mike Smith" placeholderTextColor={C.textMuted} />

            <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Farrier Phone').toUpperCase()}</Text>
            <TextInput style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={farrierPhone} onChangeText={setFarrierPhone} placeholder="e.g. (919) 555-0200" placeholderTextColor={C.textMuted} keyboardType="phone-pad" />

            <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Shoe Type').toUpperCase()}</Text>
            <TextInput style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={shoeType} onChangeText={setShoeType} placeholder="e.g. Full shoes, barefoot, front shoes only" placeholderTextColor={C.textMuted} />

            <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Dietary Notes').toUpperCase()}</Text>
            <TextInput style={[styles.input, styles.textArea, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={dietaryNotes} onChangeText={setDietaryNotes} placeholder="e.g. 2 scoops Tribute AM and PM, no alfalfa" placeholderTextColor={C.textMuted} multiline />

            <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Anything else we should know?').toUpperCase()}</Text>
            <TextInput style={[styles.input, styles.textArea, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={quirks} onChangeText={setQuirks} placeholder="e.g. Spooks at tarps, needs SMBs for turnout, hates the farrier" placeholderTextColor={C.textMuted} multiline />
          </View>
        )}

        {step === 3 && (
          <View style={styles.doneCard}>
            <Text style={styles.doneEmoji}>🐴</Text>
            <Text style={[styles.doneTitle, { color: C.primary, fontFamily: F.sansBold }]}>{t("You're all set!")}</Text>
            <Text style={[styles.doneSub, { color: C.textMuted, fontFamily: F.sans }]}>
              {t("Your barn manager now has everything they need. You can update any of this information anytime from your horse's profile.")}
            </Text>
            <Pressable
              style={({ hovered }: any) => [styles.doneBtn, { backgroundColor: C.primary }, hovered && { backgroundColor: C.primaryDark }]}
              onPress={() => router.replace('/dashboard')}
            >
              <Text style={[styles.doneBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Go to my dashboard')}</Text>
            </Pressable>
          </View>
        )}

        {error ? <Text style={[styles.errorText, { color: C.error, fontFamily: F.sans }]}>{error}</Text> : null}
        <View style={{ height: 40 }} />
      </ScrollView>

      {step < 3 && (
        <View style={[styles.footer, { borderTopColor: C.cardBorder, backgroundColor: C.card }]}>
          {step > 0 ? (
            <Pressable style={[styles.backBtn, { borderColor: C.cardBorder }]} onPress={() => setStep(s => s - 1)}>
              <Text style={[styles.backBtnText, { color: C.textMuted, fontFamily: F.sansMedium }]}>{t('Back')}</Text>
            </Pressable>
          ) : <View style={{ flex: 1 }} />}

          {step < 2 ? (
            <Pressable
              style={({ hovered }: any) => [styles.nextBtn, { backgroundColor: C.secondary }, !canProceed() && styles.nextBtnDisabled, hovered && canProceed() && { backgroundColor: C.secondaryDark }]}
              onPress={() => canProceed() && setStep(s => s + 1)}
              disabled={!canProceed()}
            >
              <Text style={[styles.nextBtnText, { color: C.primary, fontFamily: F.sansBold }]}>{t('Next')}</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ hovered }: any) => [styles.nextBtn, { backgroundColor: C.secondary }, hovered && { backgroundColor: C.secondaryDark }]}
              onPress={handleFinish}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color={C.primary} size="small" /> : <Text style={[styles.nextBtnText, { color: C.primary, fontFamily: F.sansBold }]}>{t('Finish')}</Text>}
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingTop: 56, alignItems: 'center', gap: 8 },
  logoMark: { alignItems: 'center', gap: 2, marginBottom: 4 },
  logoS: { fontSize: 14, fontWeight: '800', lineHeight: 15 },
  logoRule: { width: 20, height: 1.5 },
  headerTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
  progress: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24, padding: 20 },
  progressStep: { alignItems: 'center', gap: 6 },
  progressDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  progressDotText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  progressLabel: { fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.5 },
  body: { flex: 1, padding: 20 },
  section: { borderRadius: 16, borderWidth: 1, padding: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  sectionSub: { fontSize: 13, marginBottom: 20, lineHeight: 18 },
  fieldLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1, marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderRadius: 10, padding: 13, fontSize: 14 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  doneCard: { alignItems: 'center', padding: 40, gap: 16 },
  doneEmoji: { fontSize: 64 },
  doneTitle: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  doneSub: { fontSize: 14, textAlign: 'center', lineHeight: 22, maxWidth: 320 },
  doneBtn: { paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12, marginTop: 8 },
  doneBtnText: { fontSize: 15, fontWeight: '700' },
  footer: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1 },
  backBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '500' },
  nextBtn: { flex: 2, padding: 14, borderRadius: 10, alignItems: 'center' },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { fontSize: 14, fontWeight: '700' },
  errorText: { fontSize: 13, textAlign: 'center', padding: 16 },
});
