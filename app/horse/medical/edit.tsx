import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Platform } from 'react-native';
import { supabase } from '../../../lib/supabase';
import DateInput from '../../../lib/DateInput';

const TYPES = [
  { value: 'coggins', label: 'Coggins', icon: '📋' },
  { value: 'vaccination', label: 'Vaccination', icon: '💉' },
  { value: 'vet_visit', label: 'Vet Visit', icon: '🩺' },
  { value: 'medication', label: 'Medication', icon: '💊' },
  { value: 'custom', label: 'Custom', icon: '📝' },
];

export default function EditMedicalEntry() {
  const router = useRouter();
  const { recordId } = useLocalSearchParams();
  const [type, setType] = useState('vaccination');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const showExpiry = type === 'coggins' || type === 'vaccination';

  useEffect(() => {
    async function fetchRecord() {
      const { data } = await supabase.from('medical_records').select('*').eq('id', recordId).single();
      if (data) {
        setType(data.type || 'vaccination');
        setTitle(data.title || '');
        setDate(data.date || '');
        setExpiryDate(data.expiry_date || '');
        setNotes(data.notes || '');
      }
      setLoading(false);
    }
    fetchRecord();
  }, [recordId]);

  async function handleSave() {
    if (!date.trim()) { setError('Date is required.'); return; }
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('medical_records').update({
      type, title: title.trim(), date,
      expiry_date: expiryDate || null,
      notes: notes.trim(),
    }).eq('id', recordId);
    if (err) { setError(err.message); setSaving(false); return; }
    router.back();
  }

  async function handleDelete() {
    const confirmed = Platform.OS === 'web'
      ? confirm('Delete this medical record?')
      : true;
    if (!confirmed) return;
    setDeleting(true);
    await supabase.from('medical_records').delete().eq('id', recordId);
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
        <Text style={styles.headerTitle}>Edit Entry</Text>
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
          <Text style={styles.sectionTitle}>Entry Type</Text>
          <View style={styles.typeGrid}>
            {TYPES.map(t => (
              <Pressable
                key={t.value}
                style={[styles.typeOption, type === t.value && styles.typeOptionSelected]}
                onPress={() => setType(t.value)}
              >
                <Text style={styles.typeIcon}>{t.icon}</Text>
                <Text style={[styles.typeLabel, type === t.value && styles.typeLabelSelected]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <Text style={styles.fieldLabel}>TITLE</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Rabies Vaccine"
            placeholderTextColor="#9A9285"
          />
          <Text style={styles.fieldLabel}>DATE</Text>
          <DateInput value={date} onChange={setDate} placeholder="Select date" />
          {showExpiry ? (
            <View>
              <Text style={styles.fieldLabel}>EXPIRY DATE</Text>
              <DateInput value={expiryDate} onChange={setExpiryDate} placeholder="Select date" />
            </View>
          ) : null}
          <Text style={styles.fieldLabel}>NOTES</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional notes..."
            placeholderTextColor="#9A9285"
            multiline
          />
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
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#9A9285', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeOption: { borderWidth: 1.5, borderColor: '#E8E0CC', borderRadius: 10, padding: 12, alignItems: 'center', minWidth: 80, flex: 1 },
  typeOptionSelected: { borderColor: '#2C4A35', backgroundColor: '#EDF5EF' },
  typeIcon: { fontSize: 20, marginBottom: 4 },
  typeLabel: { fontSize: 11, color: '#9A9285', fontWeight: '500' },
  typeLabelSelected: { color: '#2C4A35', fontWeight: '700' },
  fieldLabel: { fontSize: 10, fontWeight: '600', color: '#9A9285', letterSpacing: 1, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#FAF7F2', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 10, padding: 12, fontSize: 14, color: '#1A1A14' },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  errorText: { color: '#8B2E2E', fontSize: 13, padding: 16 },
  deleteBtn: { margin: 16, backgroundColor: '#8B2E2E', borderRadius: 12, padding: 16, alignItems: 'center' },
  deleteBtnHovered: { backgroundColor: '#6B1E1E' },
  deleteBtnText: { color: 'white', fontSize: 14, fontWeight: '600' },
});
