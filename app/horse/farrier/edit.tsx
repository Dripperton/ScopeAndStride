import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../../../lib/supabase';
import DateInput from '../../../lib/DateInput';

const SHOE_TYPES = ['Full Shoe', 'Front Only', 'Hind Only', 'Barefoot Trim', 'Glue-On', 'Custom'];

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
  const [date, setDate] = useState('');
  const [nextDue, setNextDue] = useState('');
  const [farrierName, setFarrierName] = useState('');
  const [shoeType, setShoeType] = useState('');
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
        setShoeType(data.shoe_type || '');
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

  async function handleSave() {
    if (!date.trim()) { setError('Date is required.'); return; }
    setSaving(true);
    setError('');
    const [{ error: recErr }, { error: horseErr }] = await Promise.all([
      supabase.from('farrier_records').update({
        date, next_due: nextDue || null,
        farrier_name: farrierName.trim(),
        shoe_type: shoeType, notes: notes.trim(),
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
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2C4A35" style={{ marginTop: 80 }} />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Edit Farrier Entry</Text>
        <Pressable
          style={({ hovered }: any) => [styles.saveBtn, hovered && styles.saveBtnHovered]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#1A1A14" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </Pressable>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visit Details</Text>
          <Text style={styles.fieldLabel}>DATE SHOD</Text>
          <DateInput value={date} onChange={handleDateChange} placeholder="Select date" />
          <Text style={styles.fieldLabel}>NEXT DUE</Text>
          <DateInput value={nextDue} onChange={setNextDue} placeholder="Select date" />
          {date ? (
            <View style={styles.quickFill}>
              <Text style={styles.quickFillLabel}>Quick fill:</Text>
              <Pressable
                style={({ hovered }: any) => [styles.quickBtn, hovered && styles.quickBtnHovered]}
                onPress={() => setNextDue(addWeeks(date, 6))}
              >
                <Text style={styles.quickBtnText}>+6 weeks</Text>
              </Pressable>
            </View>
          ) : null}
          <Text style={styles.fieldLabel}>NOTES</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any notes about this visit…"
            placeholderTextColor="#9A9285"
            multiline
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Farrier Info</Text>
          <Text style={styles.fieldLabel}>FARRIER NAME</Text>
          <TextInput
            style={styles.input}
            value={farrierName}
            onChangeText={setFarrierName}
            placeholder="e.g. John Smith"
            placeholderTextColor="#9A9285"
          />
          <Text style={styles.fieldLabel}>SHOE TYPE</Text>
          <View style={styles.shoeGrid}>
            {SHOE_TYPES.map(s => (
              <Pressable
                key={s}
                style={[styles.shoeOption, shoeType === s && styles.shoeOptionSelected]}
                onPress={() => setShoeType(s)}
              >
                <Text style={[styles.shoeText, shoeType === s && styles.shoeTextSelected]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          style={({ hovered }: any) => [styles.deleteBtn, hovered && styles.deleteBtnHovered]}
          onPress={handleDelete}
          disabled={deleting}
        >
          {deleting ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.deleteBtnText}>Delete Entry</Text>}
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F2' },
  header: { backgroundColor: '#2C4A35', padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#C9A85C' },
  saveBtn: { backgroundColor: '#C9A85C', paddingHorizontal: 16, paddingVertical: 7, borderRadius: 6 },
  saveBtnHovered: { backgroundColor: '#B08C4A' },
  saveBtnText: { color: '#1A1A14', fontSize: 13, fontWeight: '700' },
  body: { flex: 1 },
  section: { margin: 16, marginBottom: 0, backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#E8E0CC', padding: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#9A9285', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  fieldLabel: { fontSize: 10, fontWeight: '600', color: '#9A9285', letterSpacing: 1, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#FAF7F2', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 10, padding: 12, fontSize: 14, color: '#1A1A14' },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  quickFill: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  quickFillLabel: { fontSize: 12, color: '#9A9285' },
  quickBtn: { backgroundColor: '#EDF5EF', borderWidth: 1, borderColor: '#2C4A35', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  quickBtnHovered: { backgroundColor: '#2C4A35' },
  quickBtnText: { fontSize: 12, color: '#2C4A35', fontWeight: '600' },
  shoeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  shoeOption: { borderWidth: 1.5, borderColor: '#E8E0CC', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  shoeOptionSelected: { borderColor: '#2C4A35', backgroundColor: '#EDF5EF' },
  shoeText: { fontSize: 13, color: '#9A9285' },
  shoeTextSelected: { color: '#2C4A35', fontWeight: '600' },
  errorText: { color: '#8B2E2E', fontSize: 13, padding: 16 },
  deleteBtn: { margin: 16, backgroundColor: '#8B2E2E', borderRadius: 12, padding: 16, alignItems: 'center' },
  deleteBtnHovered: { backgroundColor: '#6B1E1E' },
  deleteBtnText: { color: 'white', fontSize: 14, fontWeight: '600' },
});
