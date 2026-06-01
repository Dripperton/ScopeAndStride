import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../../../lib/supabase';
import DateInput from '../../../lib/DateInput';
import { useLanguage } from '../../../lib/LanguageContext';
import { useTheme } from '../../../context/ThemeContext';

const CHANGE_TYPES = [
  'Feed Change',
  'Supplement',
  'Hay',
  'Medication',
  'Custom',
];

export default function AddDietaryEntry() {
  const router = useRouter();
  const { horseId } = useLocalSearchParams();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const [title, setTitle] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!title) { setError('Please select a change type.'); return; }
    if (!date.trim()) { setError('Date is required.'); return; }
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('dietary_records').insert({
      horse_id: horseId,
      title,
      date,
      notes: notes.trim(),
    });
    if (err) { setError(err.message); setSaving(false); return; }
    router.back();
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backText, { fontFamily: F.sans }]}>{t('Cancel')}</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Log Dietary Change')}</Text>
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
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Details')}</Text>

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Change Type').toUpperCase()}</Text>
          <Pressable
            style={[styles.dropdown, { backgroundColor: C.background, borderColor: C.cardBorder }]}
            onPress={() => setShowDropdown(prev => !prev)}
          >
            <Text style={[styles.dropdownText, { color: C.text, fontFamily: F.sans }, !title && { color: C.textMuted }]}>
              {title || 'Select a change type...'}
            </Text>
            <Text style={{ fontSize: 10, color: C.textMuted }}>{showDropdown ? '▲' : '▼'}</Text>
          </Pressable>
          {showDropdown && (
            <View style={[styles.dropdownList, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              {CHANGE_TYPES.map(type => (
                <Pressable
                  key={type}
                  style={({ hovered }: any) => [
                    styles.dropdownItem,
                    { borderBottomColor: C.cardSeparator },
                    title === type && { backgroundColor: C.activeBg },
                    hovered && { backgroundColor: C.background },
                  ]}
                  onPress={() => { setTitle(type); setShowDropdown(false); }}
                >
                  <Text style={[
                    styles.dropdownItemText,
                    { color: C.text, fontFamily: F.sans },
                    title === type && { color: C.primary, fontWeight: '600', fontFamily: F.sansBold },
                  ]}>
                    {type}
                  </Text>
                  {title === type && <Text style={{ fontSize: 13, color: C.primary }}>✓</Text>}
                </Pressable>
              ))}
            </View>
          )}

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('DATE')}</Text>
          <DateInput value={date} onChange={setDate} placeholder="Select date" />

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
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  fieldLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1, marginBottom: 6, marginTop: 12 },
  dropdown: { borderWidth: 1, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownText: { fontSize: 14 },
  dropdownList: { borderWidth: 1, borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  dropdownItemText: { fontSize: 14 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  errorText: { fontSize: 13, padding: 16 },
});
