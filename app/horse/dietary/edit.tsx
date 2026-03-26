import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../../../lib/supabase';
import DateInput from '../../../lib/DateInput';

const CHANGE_TYPES = [
  'Feed Change',
  'Supplement',
  'Hay',
  'Medication',
  'Custom',
];

export default function EditDietaryEntry() {
  const router = useRouter();
  const { recordId } = useLocalSearchParams();
  const [title, setTitle] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchRecord() {
      const { data } = await supabase.from('dietary_records').select('*').eq('id', recordId).single();
      if (data) {
        setTitle(data.title || '');
        setDate(data.date || '');
        setNotes(data.notes || '');
      }
      setLoading(false);
    }
    fetchRecord();
  }, [recordId]);

  async function handleSave() {
    if (!title) { setError('Please select a change type.'); return; }
    if (!date.trim()) { setError('Date is required.'); return; }
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('dietary_records').update({
      title,
      date,
      notes: notes.trim(),
    }).eq('id', recordId);
    if (err) { setError(err.message); setSaving(false); return; }
    router.back();
  }

  async function handleDelete() {
    const confirmed = Platform.OS === 'web' ? confirm('Delete this dietary record?') : true;
    if (!confirmed) return;
    setDeleting(true);
    await supabase.from('dietary_records').delete().eq('id', recordId);
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
        <Text style={styles.headerTitle}>Edit Dietary Entry</Text>
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
          <Text style={styles.sectionTitle}>Details</Text>

          <Text style={styles.fieldLabel}>CHANGE TYPE</Text>
          <Pressable
            style={styles.dropdown}
            onPress={() => setShowDropdown(prev => !prev)}
          >
            <Text style={[styles.dropdownText, !title && styles.dropdownPlaceholder]}>
              {title || 'Select a change type...'}
            </Text>
            <Text style={styles.dropdownChevron}>{showDropdown ? '▲' : '▼'}</Text>
          </Pressable>
          {showDropdown && (
            <View style={styles.dropdownList}>
              {CHANGE_TYPES.map(type => (
                <Pressable
                  key={type}
                  style={({ hovered }: any) => [
                    styles.dropdownItem,
                    title === type && styles.dropdownItemSelected,
                    hovered && styles.dropdownItemHovered,
                  ]}
                  onPress={() => { setTitle(type); setShowDropdown(false); }}
                >
                  <Text style={[styles.dropdownItemText, title === type && styles.dropdownItemTextSelected]}>
                    {type}
                  </Text>
                  {title === type && <Text style={styles.dropdownCheck}>✓</Text>}
                </Pressable>
              ))}
            </View>
          )}

          <Text style={styles.fieldLabel}>DATE</Text>
          <DateInput value={date} onChange={setDate} placeholder="Select date" />

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
  fieldLabel: { fontSize: 10, fontWeight: '600', color: '#9A9285', letterSpacing: 1, marginBottom: 6, marginTop: 12 },
  dropdown: { backgroundColor: '#FAF7F2', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownText: { fontSize: 14, color: '#1A1A14' },
  dropdownPlaceholder: { color: '#9A9285' },
  dropdownChevron: { fontSize: 10, color: '#9A9285' },
  dropdownList: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F5F1EA' },
  dropdownItemSelected: { backgroundColor: '#EDF5EF' },
  dropdownItemHovered: { backgroundColor: '#FAF7F2' },
  dropdownItemText: { fontSize: 14, color: '#1A1A14' },
  dropdownItemTextSelected: { color: '#2C4A35', fontWeight: '600' },
  dropdownCheck: { fontSize: 13, color: '#2C4A35' },
  input: { backgroundColor: '#FAF7F2', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 10, padding: 12, fontSize: 14, color: '#1A1A14' },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  errorText: { color: '#8B2E2E', fontSize: 13, padding: 16 },
  deleteBtn: { margin: 16, backgroundColor: '#8B2E2E', borderRadius: 12, padding: 16, alignItems: 'center' },
  deleteBtnHovered: { backgroundColor: '#6B1E1E' },
  deleteBtnText: { color: 'white', fontSize: 14, fontWeight: '600' },
});
