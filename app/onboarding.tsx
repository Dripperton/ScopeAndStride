import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useProfile } from '../lib/useProfile';

const STEPS = ['Your Horse', 'Vet & Emergency', 'Farrier & Care', 'All Done'];

export default function Onboarding() {
  const router = useRouter();
  const { profile } = useProfile();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Step 1 — Horse details
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
    if (step === 0) return horseName.trim().length > 0;
    if (step === 1) return vetName.trim().length > 0 && vetPhone.trim().length > 0;
    return true;
  }

  async function handleFinish() {
    if (!profile) return;
    setSaving(true);
    setError('');

    try {
      const horseId = profile.horse_id;

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
            custom_field_label: emergencyAuth.trim() ? 'Emergency Auth' : null,
            custom_field_value: emergencyAuth.trim() || null,
          })
          .eq('id', horseId);

        // Add vet record
        if (vetName.trim()) {
          await supabase.from('medical_records').insert({
            horse_id: horseId,
            type: 'custom',
            title: `Primary Vet: ${vetName.trim()}${vetPhone.trim() ? ' — ' + vetPhone.trim() : ''}`,
            date: new Date().toISOString().split('T')[0],
            notes: `Emergency clinic: ${emergencyClinic.trim() || 'Not specified'}\nBackup contact: ${emergencyContact.trim() || 'Not specified'}${emergencyContactPhone.trim() ? ' — ' + emergencyContactPhone.trim() : ''}`,
          });
        }

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
            notes: `Farrier: ${farrierName.trim()}${farrierPhone.trim() ? ' — ' + farrierPhone.trim() : ''}${quirks.trim() ? '\nHorse notes: ' + quirks.trim() : ''}`,
          });
        }
      }

      // Mark onboarding complete regardless
      await supabase
        .from('profiles')
      setStep(3);
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
    }

    setSaving(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoMark}>
          <Text style={styles.logoS}>S</Text>
          <View style={styles.logoRule} />
          <Text style={styles.logoS}>S</Text>
        </View>
        <Text style={styles.headerTitle}>Welcome to Scope & Stride</Text>
        <Text style={styles.headerSub}>Let's get your horse set up</Text>
      </View>

      {step < 3 && (
        <View style={styles.progress}>
          {STEPS.slice(0, 3).map((label, i) => (
            <View key={i} style={styles.progressStep}>
              <View style={[styles.progressDot, i <= step && styles.progressDotActive]}>
                <Text style={[styles.progressDotText, i <= step && styles.progressDotTextActive]}>
                  {i < step ? '✓' : i + 1}
                </Text>
              </View>
              <Text style={[styles.progressLabel, i === step && styles.progressLabelActive]}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      )}

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

        {step === 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tell us about your horse</Text>
            <Text style={styles.sectionSub}>This helps your barn manager keep accurate records.</Text>

            <Text style={styles.fieldLabel}>HORSE NAME *</Text>
            <TextInput style={styles.input} value={horseName} onChangeText={setHorseName} placeholder="e.g. Clifford" placeholderTextColor="#9A9285" />

            <Text style={styles.fieldLabel}>BREED</Text>
            <TextInput style={styles.input} value={breed} onChangeText={setBreed} placeholder="e.g. Warmblood, Thoroughbred" placeholderTextColor="#9A9285" />

            <Text style={styles.fieldLabel}>BOARD TYPE</Text>
            <TextInput style={styles.input} value={boardType} onChangeText={setBoardType} placeholder="e.g. Full Board, Training Board" placeholderTextColor="#9A9285" />
          </View>
        )}

        {step === 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vet & emergency information</Text>
            <Text style={styles.sectionSub}>Critical if something happens and we can't reach you.</Text>

            <Text style={styles.fieldLabel}>PRIMARY VET NAME *</Text>
            <TextInput style={styles.input} value={vetName} onChangeText={setVetName} placeholder="e.g. Dr. Sarah Jones" placeholderTextColor="#9A9285" />

            <Text style={styles.fieldLabel}>VET PHONE *</Text>
            <TextInput style={styles.input} value={vetPhone} onChangeText={setVetPhone} placeholder="e.g. (919) 555-0100" placeholderTextColor="#9A9285" keyboardType="phone-pad" />

            <Text style={styles.fieldLabel}>PREFERRED EMERGENCY CLINIC</Text>
            <TextInput style={styles.input} value={emergencyClinic} onChangeText={setEmergencyClinic} placeholder="e.g. NC State Equine Hospital" placeholderTextColor="#9A9285" />

            <Text style={styles.fieldLabel}>FINANCIAL AUTHORIZATION</Text>
            <TextInput style={[styles.input, styles.textArea]} value={emergencyAuth} onChangeText={setEmergencyAuth} placeholder="e.g. Authorized up to $5,000 without contact. Over $5,000 call me first." placeholderTextColor="#9A9285" multiline />

            <Text style={styles.fieldLabel}>BACKUP EMERGENCY CONTACT</Text>
            <TextInput style={styles.input} value={emergencyContact} onChangeText={setEmergencyContact} placeholder="Name" placeholderTextColor="#9A9285" />
            <TextInput style={[styles.input, { marginTop: 8 }]} value={emergencyContactPhone} onChangeText={setEmergencyContactPhone} placeholder="Phone number" placeholderTextColor="#9A9285" keyboardType="phone-pad" />
          </View>
        )}

        {step === 2 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Farrier & care preferences</Text>
            <Text style={styles.sectionSub}>Help us keep your horse on the right schedule.</Text>

            <Text style={styles.fieldLabel}>FARRIER NAME</Text>
            <TextInput style={styles.input} value={farrierName} onChangeText={setFarrierName} placeholder="e.g. Mike Smith" placeholderTextColor="#9A9285" />

            <Text style={styles.fieldLabel}>FARRIER PHONE</Text>
            <TextInput style={styles.input} value={farrierPhone} onChangeText={setFarrierPhone} placeholder="e.g. (919) 555-0200" placeholderTextColor="#9A9285" keyboardType="phone-pad" />

            <Text style={styles.fieldLabel}>SHOE TYPE</Text>
            <TextInput style={styles.input} value={shoeType} onChangeText={setShoeType} placeholder="e.g. Full shoes, barefoot, front shoes only" placeholderTextColor="#9A9285" />

            <Text style={styles.fieldLabel}>DIETARY NOTES</Text>
            <TextInput style={[styles.input, styles.textArea]} value={dietaryNotes} onChangeText={setDietaryNotes} placeholder="e.g. 2 scoops Tribute AM and PM, no alfalfa" placeholderTextColor="#9A9285" multiline />

            <Text style={styles.fieldLabel}>ANYTHING ELSE WE SHOULD KNOW?</Text>
            <TextInput style={[styles.input, styles.textArea]} value={quirks} onChangeText={setQuirks} placeholder="e.g. Spooks at tarps, needs SMBs for turnout, hates the farrier" placeholderTextColor="#9A9285" multiline />
          </View>
        )}

        {step === 3 && (
          <View style={styles.doneCard}>
            <Text style={styles.doneEmoji}>🐴</Text>
            <Text style={styles.doneTitle}>You're all set!</Text>
            <Text style={styles.doneSub}>
              Your barn manager now has everything they need. You can update any of this information anytime from your horse's profile.
            </Text>
            <Pressable
              style={({ hovered }: any) => [styles.doneBtn, hovered && styles.doneBtnHovered]}
              onPress={async () => { await supabase.from('profiles').update({ onboarding_complete: true }).eq('id', profile!.id); router.replace('/dashboard'); }}
            >
              <Text style={styles.doneBtnText}>Go to my dashboard</Text>
            </Pressable>
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <View style={{ height: 40 }} />
      </ScrollView>

      {step < 3 && (
        <View style={styles.footer}>
          {step > 0 ? (
            <Pressable style={styles.backBtn} onPress={() => setStep(s => s - 1)}>
              <Text style={styles.backBtnText}>Back</Text>
            </Pressable>
          ) : <View style={{ flex: 1 }} />}

          {step < 2 ? (
            <Pressable
              style={({ hovered }: any) => [styles.nextBtn, !canProceed() && styles.nextBtnDisabled, hovered && canProceed() && styles.nextBtnHovered]}
              onPress={() => canProceed() && setStep(s => s + 1)}
              disabled={!canProceed()}
            >
              <Text style={styles.nextBtnText}>Next</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ hovered }: any) => [styles.nextBtn, hovered && styles.nextBtnHovered]}
              onPress={handleFinish}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#2C4A35" size="small" /> : <Text style={styles.nextBtnText}>Finish</Text>}
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F2' },
  header: { backgroundColor: '#2C4A35', padding: 24, paddingTop: 56, alignItems: 'center', gap: 8 },
  logoMark: { alignItems: 'center', gap: 2, marginBottom: 4 },
  logoS: { fontSize: 14, fontWeight: '800', color: '#C9A85C', lineHeight: 15 },
  logoRule: { width: 20, height: 1.5, backgroundColor: '#C9A85C' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#C9A85C', textAlign: 'center' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
  progress: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24, padding: 20, backgroundColor: '#1A3A25' },
  progressStep: { alignItems: 'center', gap: 6 },
  progressDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  progressDotActive: { backgroundColor: '#C9A85C' },
  progressDotText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  progressDotTextActive: { color: '#2C4A35' },
  progressLabel: { fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.5 },
  progressLabelActive: { color: '#C9A85C' },
  body: { flex: 1, padding: 20 },
  section: { backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#E8E0CC', padding: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A14', marginBottom: 4 },
  sectionSub: { fontSize: 13, color: '#9A9285', marginBottom: 20, lineHeight: 18 },
  fieldLabel: { fontSize: 10, fontWeight: '600', color: '#9A9285', letterSpacing: 1, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#FAF7F2', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 10, padding: 13, fontSize: 14, color: '#1A1A14' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  doneCard: { alignItems: 'center', padding: 40, gap: 16 },
  doneEmoji: { fontSize: 64 },
  doneTitle: { fontSize: 24, fontWeight: '700', color: '#2C4A35', textAlign: 'center' },
  doneSub: { fontSize: 14, color: '#9A9285', textAlign: 'center', lineHeight: 22, maxWidth: 320 },
  doneBtn: { backgroundColor: '#2C4A35', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12, marginTop: 8 },
  doneBtnHovered: { backgroundColor: '#1A3A25' },
  doneBtnText: { color: '#C9A85C', fontSize: 15, fontWeight: '700' },
  footer: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: '#E8E0CC', backgroundColor: 'white' },
  backBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E8E0CC', alignItems: 'center' },
  backBtnText: { fontSize: 14, color: '#9A9285', fontWeight: '500' },
  nextBtn: { flex: 2, padding: 14, borderRadius: 10, backgroundColor: '#C9A85C', alignItems: 'center' },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnHovered: { backgroundColor: '#B08C4A' },
  nextBtnText: { fontSize: 14, color: '#2C4A35', fontWeight: '700' },
  errorText: { color: '#8B2E2E', fontSize: 13, textAlign: 'center', padding: 16 },
});
