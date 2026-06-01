import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Wrench, Stethoscope, Syringe, Pill, Activity, FileText } from 'lucide-react-native';
import { supabase } from '../../../lib/supabase';
import { useProfile } from '../../../lib/useProfile';
import DateInput from '../../../lib/DateInput';
import { useLanguage } from '../../../lib/LanguageContext';
import { useTheme } from '../../../context/ThemeContext';

const SERVICE_TYPES = [
  { value: 'farrier',     label: 'Farrier',     Icon: Wrench,      color: '#B08C4A' },
  { value: 'vet',         label: 'Vet',          Icon: Stethoscope, color: '#1A3A4A' },
  { value: 'vaccination', label: 'Vaccination',  Icon: Syringe,     color: '#4A3B6B' },
  { value: 'medication',  label: 'Medication',   Icon: Pill,        color: '#6B4226' },
  { value: 'bodywork',    label: 'Bodywork',     Icon: Activity,    color: '#4A7C59' },
  { value: 'dental',      label: 'Dental',       Icon: FileText,    color: '#3A3830' },
  { value: 'other',       label: 'Other',        Icon: FileText,    color: '#9A9285' },
];

const SHOWS_NEXT_APPT = ['farrier', 'vet', 'bodywork', 'dental'];
const SHOWS_EXPIRY = ['vaccination'];

export default function AddServiceVisit() {
  const router = useRouter();
  const { canEdit } = useProfile();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const { horseId } = useLocalSearchParams();

  const [serviceType, setServiceType] = useState('farrier');
  const [date, setDate] = useState('');
  const [providerName, setProviderName] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [nextAppointmentDate, setNextAppointmentDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [amount, setAmount] = useState('');
  const [externalInvoiceUrl, setExternalInvoiceUrl] = useState('');
  const [barnInvoiced, setBarnInvoiced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!canEdit) {
    return (
      <View style={{ flex: 1, backgroundColor: C.background, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <Text style={{ fontSize: 16, color: C.textMuted, textAlign: 'center', fontFamily: F.sans }}>You don't have permission to add service records.</Text>
      </View>
    );
  }

  async function handleSave() {
    if (!date.trim()) { setError('Date is required.'); return; }
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('service_visits').insert({
      horse_id: horseId,
      date,
      service_type: serviceType,
      provider_name: providerName.trim() || null,
      title: title.trim() || null,
      notes: notes.trim() || null,
      next_appointment_date: nextAppointmentDate || null,
      expiry_date: expiryDate || null,
      amount: amount ? parseFloat(amount) : null,
      external_invoice_url: externalInvoiceUrl.trim() || null,
      barn_invoiced: barnInvoiced,
      source: 'manual',
    });
    if (err) { setError(err.message); setSaving(false); return; }
    router.back();
  }

  const showNextAppt = SHOWS_NEXT_APPT.includes(serviceType);
  const showExpiry = SHOWS_EXPIRY.includes(serviceType);

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>{t('Cancel')}</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Add Service Visit')}</Text>
        <Pressable
          style={({ hovered }: any) => [styles.saveBtn, hovered && { opacity: 0.8 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={[styles.saveBtnText, { fontFamily: F.sansBold }]}>{t('Save')}</Text>}
        </Pressable>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Service Type')}</Text>
          <View style={styles.typeGrid}>
            {SERVICE_TYPES.map(({ value, label, Icon, color }) => (
              <Pressable
                key={value}
                style={[styles.typeOption, { borderColor: C.cardBorder }, serviceType === value && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                onPress={() => setServiceType(value)}
              >
                <Icon size={18} color={serviceType === value ? color : C.textMuted} />
                <Text style={[styles.typeLabel, { color: C.textMuted, fontFamily: F.sansMedium }, serviceType === value && { color: C.primary, fontFamily: F.sansBold }]}>{t(label)}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Visit Details')}</Text>

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('DATE')}</Text>
          <DateInput value={date} onChange={setDate} placeholder="Select date" />

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('YOUR NAME / PRACTICE')}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
            value={providerName}
            onChangeText={setProviderName}
            placeholder="e.g. John Smith"
            placeholderTextColor={C.textMuted}
          />

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('WHAT WAS DONE')}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Full set aluminum, Front shoes only"
            placeholderTextColor={C.textMuted}
          />

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('NOTES')}</Text>
          <TextInput
            style={[styles.input, styles.notesInput, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional notes..."
            placeholderTextColor={C.textMuted}
            multiline
          />

          {showNextAppt ? (
            <>
              <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('NEXT APPOINTMENT')}</Text>
              <DateInput value={nextAppointmentDate} onChange={setNextAppointmentDate} placeholder="Select date" />
            </>
          ) : null}

          {showExpiry ? (
            <>
              <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('EXPIRY DATE')}</Text>
              <DateInput value={expiryDate} onChange={setExpiryDate} placeholder="Select date" />
            </>
          ) : null}
        </View>

        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Billing (Optional)')}</Text>

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('AMOUNT ($)')}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
            value={amount}
            onChangeText={setAmount}
            placeholder="e.g. 150.00"
            placeholderTextColor={C.textMuted}
            keyboardType="decimal-pad"
          />

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('EXTERNAL INVOICE LINK')}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
            value={externalInvoiceUrl}
            onChangeText={setExternalInvoiceUrl}
            placeholder="Paste link from provider's system"
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
            keyboardType="url"
          />

          {amount ? (
            <Pressable style={styles.checkRow} onPress={() => setBarnInvoiced(!barnInvoiced)}>
              <View style={[styles.checkbox, { borderColor: C.cardBorder }, barnInvoiced && { backgroundColor: C.primary, borderColor: C.primary }]}>
                {barnInvoiced ? <Text style={[styles.checkmark, { color: C.card }]}>✓</Text> : null}
              </View>
              <Text style={[styles.checkLabel, { color: C.text, fontFamily: F.sans }]}>{t('Bill through barn')}</Text>
            </Pressable>
          ) : null}
        </View>

        {error ? <Text style={[styles.errorText, { color: C.error, fontFamily: F.sans }]}>{error}</Text> : null}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  saveBtn: { backgroundColor: 'transparent', paddingHorizontal: 4, paddingVertical: 4, borderRadius: 0, borderWidth: 0 },
  saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  body: { flex: 1 },
  section: { margin: 16, marginBottom: 0, borderRadius: 14, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeOption: { borderWidth: 1.5, borderRadius: 10, padding: 10, alignItems: 'center', minWidth: 80, flex: 1, gap: 4 },
  typeLabel: { fontSize: 10, fontWeight: '500' },
  fieldLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1, marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkmark: { fontSize: 12, fontWeight: '700' },
  checkLabel: { flex: 1, fontSize: 13, lineHeight: 18 },
  errorText: { fontSize: 13, padding: 16 },
});
