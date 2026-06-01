import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateInput from '../../lib/DateInput';
import { useTheme } from '../../context/ThemeContext';

const SUPABASE_FN = 'https://kzpdukjkttkaaligxsmb.supabase.co/functions/v1/service-entry';

const SERVICE_TYPES = [
  { value: 'farrier',     label: 'Farrier' },
  { value: 'vet',         label: 'Vet' },
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'medication',  label: 'Medication' },
  { value: 'bodywork',    label: 'Bodywork' },
  { value: 'dental',      label: 'Dental' },
  { value: 'other',       label: 'Other' },
];

const SHOWS_NEXT_APPT = ['farrier', 'vet', 'bodywork', 'dental'];
const SHOWS_EXPIRY    = ['vaccination'];

export default function ServiceEntryForm() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const [horseName, setHorseName] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  const [serviceType, setServiceType] = useState('farrier');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [providerName, setProviderName] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [nextAppt, setNextAppt] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${SUPABASE_FN}?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setLoadError(data.error); }
        else { setHorseName(data.name); }
        setLoading(false);
      })
      .catch(() => { setLoadError('Could not load horse info.'); setLoading(false); });
  }, [token]);

  async function handleSubmit() {
    if (!date) { setError('Date is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${SUPABASE_FN}?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_type: serviceType,
          date,
          provider_name: providerName.trim() || null,
          title: title.trim() || null,
          notes: notes.trim() || null,
          next_appointment_date: nextAppt || null,
          expiry_date: expiryDate || null,
          amount: amount || null,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else { setSuccess(true); }
    } catch {
      setError('Network error. Please try again.');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: C.background }]}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.center, { backgroundColor: C.background }]}>
        <Text style={[styles.errorTitle, { color: C.error, fontFamily: F.sansBold }]}>Not found</Text>
        <Text style={[styles.errorSub, { color: C.textMuted, fontFamily: F.sans }]}>{loadError}</Text>
      </View>
    );
  }

  if (success) {
    return (
      <View style={[styles.center, { backgroundColor: C.background }]}>
        <Text style={styles.successCheck}>✓</Text>
        <Text style={[styles.successTitle, { color: C.primary, fontFamily: F.sansBold }]}>Visit Logged</Text>
        <Text style={[styles.successSub, { color: C.textMuted, fontFamily: F.sans }]}>Your service visit for {horseName} has been recorded. The barn team will be notified.</Text>
      </View>
    );
  }

  const showNextAppt = SHOWS_NEXT_APPT.includes(serviceType);
  const showExpiry   = SHOWS_EXPIRY.includes(serviceType);

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <Text style={styles.barn}>Scope &amp; Stride</Text>
        <Text style={[styles.horseName, { color: C.secondary, fontFamily: F.sansBold }]}>{horseName}</Text>
        <Text style={styles.subtitle}>Log a service visit for this horse</Text>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>Service Type</Text>
          <View style={styles.typeGrid}>
            {SERVICE_TYPES.map(({ value, label }) => (
              <Pressable
                key={value}
                style={[
                  styles.typeOption, { borderColor: C.cardBorder },
                  serviceType === value && { borderColor: C.primary, backgroundColor: C.activeBg },
                  value === 'other' && styles.typeOptionFull,
                ]}
                onPress={() => setServiceType(value)}
              >
                <Text style={[styles.typeLabel, { color: C.textMuted, fontFamily: F.sansMedium }, serviceType === value && { color: C.primary, fontFamily: F.sansBold }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>Visit Details</Text>

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>DATE <Text style={{ color: C.error }}>*</Text></Text>
          <DateInput value={date} onChange={setDate} placeholder="Select date" />

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>YOUR NAME / PRACTICE</Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
            value={providerName}
            onChangeText={setProviderName}
            placeholder="e.g. John Smith Farriery"
            placeholderTextColor={C.textMuted}
          />

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>WHAT WAS DONE</Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Full set aluminum, Front shoes only"
            placeholderTextColor={C.textMuted}
          />

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>NOTES</Text>
          <TextInput
            style={[styles.input, styles.notesInput, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything the barn should know…"
            placeholderTextColor={C.textMuted}
            multiline
          />

          {showNextAppt ? (
            <>
              <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>NEXT APPOINTMENT</Text>
              <DateInput value={nextAppt} onChange={setNextAppt} placeholder="Select date" />
            </>
          ) : null}

          {showExpiry ? (
            <>
              <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>EXPIRY / VALIDITY DATE</Text>
              <DateInput value={expiryDate} onChange={setExpiryDate} placeholder="Select date" />
            </>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>Billing (Optional)</Text>
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>AMOUNT CHARGED ($)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
            value={amount}
            onChangeText={setAmount}
            placeholder="e.g. 150.00"
            placeholderTextColor={C.textMuted}
            keyboardType="decimal-pad"
          />
        </View>

        {error ? <Text style={[styles.errorText, { color: C.error, fontFamily: F.sans }]}>{error}</Text> : null}

        <Pressable
          style={({ hovered }: any) => [styles.submitBtn, { backgroundColor: C.primary }, hovered && { backgroundColor: C.primaryDark }, saving && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="white" size="small" />
            : <Text style={[styles.submitBtnText, { fontFamily: F.sansBold }]}>Submit Visit</Text>}
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  header: { padding: 20, paddingTop: Platform.OS === 'web' ? 20 : 52, paddingBottom: 24 },
  barn: { fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  horseName: { fontSize: 22, fontWeight: '700', fontStyle: 'italic' },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 },
  body: { flex: 1 },
  card: { margin: 16, marginBottom: 0, borderRadius: 14, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeOption: { borderWidth: 1.5, borderRadius: 10, padding: 10, alignItems: 'center', minWidth: 80, flex: 1 },
  typeOptionFull: { flexBasis: '100%', flex: 0 },
  typeLabel: { fontSize: 13, fontWeight: '500' },
  fieldLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1, marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  errorText: { fontSize: 13, padding: 16 },
  submitBtn: { margin: 16, borderRadius: 12, padding: 16, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
  errorTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  errorSub: { fontSize: 14, textAlign: 'center' },
  successCheck: { fontSize: 56, marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  successSub: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
