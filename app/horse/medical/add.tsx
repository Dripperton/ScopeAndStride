import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../../../lib/supabase';
import DateInput from '../../../lib/DateInput';
import { useLanguage } from '../../../lib/LanguageContext';
import { useTheme } from '../../../context/ThemeContext';

const TYPES = [
  { value: 'coggins', label: 'Coggins', icon: '📋' },
  { value: 'vaccination', label: 'Vaccination', icon: '💉' },
  { value: 'vet_visit', label: 'Vet Visit', icon: '🩺' },
  { value: 'medication', label: 'Medication', icon: '💊' },
  { value: 'custom', label: 'Custom', icon: '📝' },
];

export default function AddMedicalEntry() {
  const router = useRouter();
  const { horseId, defaultType } = useLocalSearchParams();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const [type, setType] = useState((defaultType as string) || 'vaccination');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');

  async function handleImportPDF() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const file = result.assets[0];
    setParsing(true);
    setError('');
    try {
      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = (supabase as any).supabaseUrl as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/parse-vet-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ pdf_base64: base64 }),
      });

      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Could not parse PDF.'); return; }

      if (json.type) setType(json.type);
      if (json.title) setTitle(json.title);
      if (json.date) setDate(json.date);
      if (json.notes) setNotes(json.notes);
    } catch (e: any) {
      setError('Failed to read PDF. Try again.');
    } finally {
      setParsing(false);
    }
  }

  const showExpiry = type === 'coggins' || type === 'vaccination';
  const selectedType = TYPES.find(t => t.value === type);

  async function handleSave() {
    if (!date.trim()) { setError('Date is required.'); return; }
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('medical_records').insert({
      horse_id: horseId,
      type,
      title: title.trim() || selectedType?.label,
      date,
      expiry_date: expiryDate || null,
      notes: notes.trim(),
    });
    if (err) { setError(err.message); setSaving(false); return; }
    router.back();
  }

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: C.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backText, { fontFamily: F.sans }]}>{t('Cancel')}</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Add Medical Entry')}</Text>
        <Pressable
          style={{ backgroundColor: 'transparent' }}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#1A1A14" size="small" /> : <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', fontFamily: F.sansBold }}>{t('Save')}</Text>}
        </Pressable>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardDismissMode="none" keyboardShouldPersistTaps="handled" onScrollBeginDrag={Keyboard.dismiss}>
        <Pressable
          style={[styles.importBtn, { borderColor: C.primary, backgroundColor: C.activeBg }]}
          onPress={handleImportPDF}
          disabled={parsing}
        >
          {parsing
            ? <ActivityIndicator size="small" color={C.primary} />
            : <Text style={[styles.importBtnText, { color: C.primary, fontFamily: F.sansBold }]}>📄 {t('Import from PDF')}</Text>}
        </Pressable>

        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Entry Type')}</Text>
          <View style={styles.typeGrid}>
            {TYPES.map(tp => (
              <Pressable
                key={tp.value}
                style={[
                  styles.typeOption,
                  { borderWidth: 1.5, borderColor: C.cardBorder, backgroundColor: C.card },
                  type === tp.value && { borderColor: C.primary, backgroundColor: C.activeBg },
                ]}
                onPress={() => setType(tp.value)}
              >
                <Text style={styles.typeIcon}>{tp.icon}</Text>
                <Text style={[
                  styles.typeLabel,
                  { color: C.textMuted, fontFamily: F.sansMedium },
                  type === tp.value && { color: C.primary, fontFamily: F.sansBold, fontWeight: '700' },
                ]}>{t(tp.label)}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Details')}</Text>
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Title').toUpperCase()}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
            value={title}
            onChangeText={setTitle}
            placeholder={selectedType?.label || 'e.g. Rabies Vaccine'}
            placeholderTextColor={C.textMuted}
          />
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('DATE')}</Text>
          <DateInput value={date} onChange={setDate} placeholder="Select date" />
          {showExpiry ? (
            <View>
              <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('EXPIRY DATE')}</Text>
              <DateInput value={expiryDate} onChange={setExpiryDate} placeholder="Select date" />
            </View>
          ) : null}
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('NOTES')}</Text>
          <TextInput
            style={[styles.input, styles.notesInput, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional notes..."
            placeholderTextColor={C.textMuted}
            multiline
          />
        </View>

        {error ? <Text style={[styles.errorText, { color: C.error, fontFamily: F.sans }]}>{error}</Text> : null}
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  importBtn: { margin: 16, marginBottom: 8, borderWidth: 1.5, borderRadius: 12, padding: 14, alignItems: 'center', borderStyle: 'dashed' },
  importBtnText: { fontSize: 14 },
  backText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  body: { flex: 1 },
  section: { margin: 16, marginBottom: 0, borderRadius: 14, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeOption: { borderRadius: 10, padding: 12, alignItems: 'center', minWidth: 80, flex: 1 },
  typeIcon: { fontSize: 20, marginBottom: 4 },
  typeLabel: { fontSize: 11, fontWeight: '500' },
  fieldLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  errorText: { fontSize: 13, padding: 16 },
});
