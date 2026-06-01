import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../../../lib/supabase';
import DateInput from '../../../lib/DateInput';
import { useLanguage } from '../../../lib/LanguageContext';
import { useTheme } from '../../../context/ThemeContext';

const BASE_SERVICES = ['Full Trim', 'Shoe FR/Trim BK', 'Full Shoes'];
const MATERIALS     = ['Steel', 'Aluminum'];
const MODIFICATIONS = ['Pads', 'Packing', 'Clips', 'Rocker Toe', 'Rolled Toe', 'Square Toe', 'Trailers', 'Egg Bar', 'Straight Bar', 'Hoof Repair'];

function deriveShoeType(services: string[]): string {
  if (services.includes('Full Shoes')) return 'Full Shoe';
  if (services.includes('Shoe FR/Trim BK')) return 'Front Only';
  if (services.includes('Full Trim')) return 'Barefoot Trim';
  return 'Custom';
}

function addWeeks(dateStr: string, weeks: number): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + weeks * 7);
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

export default function EditFarrierEntry() {
  const router = useRouter();
  const { recordId, horseId } = useLocalSearchParams();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const [date, setDate] = useState('');
  const [nextDue, setNextDue] = useState('');
  const [farrierName, setFarrierName] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchRecord() {
      const { data } = await supabase.from('farrier_records').select('*').eq('id', recordId).single();
      if (data) {
        setDate(data.date || '');
        setNextDue(data.next_due || '');
        setFarrierName(data.farrier_name || '');
        setServices(Array.isArray(data.services) ? data.services : []);
        setNotes(data.notes || '');
      }
      setLoading(false);
    }
    fetchRecord();
  }, [recordId]);

  function handleDateChange(val: string) {
    setDate(val);
    if (val && !nextDue) setNextDue(addWeeks(val, 6));
  }

  function toggleService(item: string) {
    setServices(prev => prev.includes(item) ? prev.filter(s => s !== item) : [...prev, item]);
  }

  async function handleSave() {
    if (!date.trim()) { setError('Date is required.'); return; }
    setSaving(true);
    setError('');
    const shoeType = deriveShoeType(services);
    const [{ error: recErr }, { error: horseErr }] = await Promise.all([
      supabase.from('farrier_records').update({
        date, next_due: nextDue || null,
        farrier_name: farrierName.trim(),
        shoe_type: shoeType,
        services,
        notes: notes.trim(),
      }).eq('id', recordId),
      supabase.from('horses').update({
        farrier_name: farrierName.trim(),
        shoe_type: shoeType,
      }).eq('id', horseId),
    ]);
    if (recErr || horseErr) { setError((recErr || horseErr)?.message || 'Save failed'); setSaving(false); return; }
    router.back();
  }

  async function handleDelete() {
    const confirmed = Platform.OS === 'web' ? confirm('Delete this farrier record?') : true;
    if (!confirmed) return;
    setDeleting(true);
    await supabase.from('farrier_records').delete().eq('id', recordId);
    router.back();
  }

  if (loading) return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 80 }} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backText, { fontFamily: F.sans }]}>{t('Cancel')}</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Edit Farrier Entry')}</Text>
        <Pressable
          style={{ backgroundColor: 'transparent' }}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#1A1A14" size="small" /> : <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', fontFamily: F.sansBold }}>{t('Save')}</Text>}
        </Pressable>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Visit Details')}</Text>
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Date Shod').toUpperCase()}</Text>
          <DateInput value={date} onChange={handleDateChange} placeholder="Select date" />
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Next Due').toUpperCase()}</Text>
          <DateInput value={nextDue} onChange={setNextDue} placeholder="Select date" />
          {date ? (
            <View style={styles.quickFill}>
              <Text style={[styles.quickFillLabel, { color: C.textMuted, fontFamily: F.sans }]}>{t('Quick fill')}:</Text>
              <Pressable
                style={({ hovered }: any) => [
                  styles.quickBtn,
                  { backgroundColor: C.activeBg, borderColor: C.primary },
                  hovered && { backgroundColor: C.primary },
                ]}
                onPress={() => setNextDue(addWeeks(date, 6))}
              >
                <Text style={[styles.quickBtnText, { color: C.primary, fontFamily: F.sansBold }]}>+6 {t('weeks')}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Services')}</Text>

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Base Service').toUpperCase()}</Text>
          <View style={styles.chipGrid}>
            {BASE_SERVICES.map(item => (
              <Pressable
                key={item}
                style={[
                  styles.chip,
                  { borderColor: C.cardBorder },
                  services.includes(item) && { borderColor: C.primary, backgroundColor: C.activeBg },
                ]}
                onPress={() => toggleService(item)}
              >
                <Text style={[
                  styles.chipText,
                  { color: C.textMuted, fontFamily: F.sans },
                  services.includes(item) && { color: C.primary, fontWeight: '600', fontFamily: F.sansBold },
                ]}>{item}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Material').toUpperCase()}</Text>
          <View style={styles.chipGrid}>
            {MATERIALS.map(item => (
              <Pressable
                key={item}
                style={[
                  styles.chip,
                  { borderColor: C.cardBorder },
                  services.includes(item) && { borderColor: C.primary, backgroundColor: C.activeBg },
                ]}
                onPress={() => toggleService(item)}
              >
                <Text style={[
                  styles.chipText,
                  { color: C.textMuted, fontFamily: F.sans },
                  services.includes(item) && { color: C.primary, fontWeight: '600', fontFamily: F.sansBold },
                ]}>{item}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Modifications').toUpperCase()}</Text>
          <View style={styles.chipGrid}>
            {MODIFICATIONS.map(item => (
              <Pressable
                key={item}
                style={[
                  styles.chip,
                  { borderColor: C.cardBorder },
                  services.includes(item) && { borderColor: C.primary, backgroundColor: C.activeBg },
                ]}
                onPress={() => toggleService(item)}
              >
                <Text style={[
                  styles.chipText,
                  { color: C.textMuted, fontFamily: F.sans },
                  services.includes(item) && { color: C.primary, fontWeight: '600', fontFamily: F.sansBold },
                ]}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Farrier Info')}</Text>
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Farrier Name').toUpperCase()}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
            value={farrierName}
            onChangeText={setFarrierName}
            placeholder="e.g. John Smith"
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
        </View>

        {error ? <Text style={[styles.errorText, { color: C.error, fontFamily: F.sans }]}>{error}</Text> : null}

        <Pressable
          style={({ hovered }: any) => [
            styles.deleteBtn,
            { backgroundColor: C.error },
            hovered && { backgroundColor: '#6B1E1E' },
          ]}
          onPress={handleDelete}
          disabled={deleting}
        >
          {deleting ? <ActivityIndicator color="white" size="small" /> : <Text style={[styles.deleteBtnText, { color: C.card, fontFamily: F.sansBold }]}>{t('Delete Entry')}</Text>}
        </Pressable>

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
  body: { flex: 1 },
  section: { margin: 16, marginBottom: 0, borderRadius: 14, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  fieldLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  quickFill: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  quickFillLabel: { fontSize: 12 },
  quickBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  quickBtnText: { fontSize: 12, fontWeight: '600' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 13 },
  errorText: { fontSize: 13, padding: 16 },
  deleteBtn: { margin: 16, borderRadius: 12, padding: 16, alignItems: 'center' },
  deleteBtnText: { fontSize: 14, fontWeight: '600' },
});
