import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { useProfile } from '../../../lib/useProfile';
import DateInput from '../../../lib/DateInput';
import { useLanguage } from '../../../lib/LanguageContext';
import { useTheme } from '../../../context/ThemeContext';

function today() {
  return new Date().toISOString().split('T')[0];
}

export default function AddDailyCare() {
  const router = useRouter();
  const { horseId, logId } = useLocalSearchParams();
  const { profile, canEdit } = useProfile();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const [loading, setLoading] = useState(!!logId);
  const [saving, setSaving] = useState(false);
  const [horseName, setHorseName] = useState('');

  const [date, setDate] = useState(today());
  const [groomed, setGroomed] = useState(false);
  const [turnedOut, setTurnedOut] = useState(false);
  const [turnoutDuration, setTurnoutDuration] = useState('');
  const [ridden, setRidden] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    async function fetchHorse() {
      const { data } = await supabase.from('horses').select('name').eq('id', horseId).single();
      if (data) setHorseName(data.name);
    }
    fetchHorse();

    if (logId) {
      supabase.from('daily_care_logs').select('*').eq('id', logId).single().then(({ data }) => {
        if (data) {
          setDate(data.date);
          setGroomed(data.groomed || false);
          setTurnedOut(data.turned_out || false);
          setTurnoutDuration(data.turnout_duration || '');
          setRidden(data.ridden || false);
          setNotes(data.notes || '');
        }
        setLoading(false);
      });
    }
  }, [horseId, logId]);

  async function handleSave() {
    setSaving(true);
    await supabase.from('daily_care_logs').upsert({
      horse_id: horseId,
      date,
      groomed,
      turned_out: turnedOut,
      turnout_duration: turnedOut ? (turnoutDuration || null) : null,
      ridden,
      notes: notes.trim() || null,
      created_by: profile?.id,
    }, { onConflict: 'horse_id,date' });
    setSaving(false);
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
          <Text style={styles.backText}>{t('Cancel')}</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{horseName || t('Daily Care')}</Text>
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
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Date')}</Text>
          <DateInput value={date} onChange={setDate} />
        </View>

        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Care Log')}</Text>

          <Pressable style={[styles.checkRow, { borderBottomColor: C.cardSeparator }]} onPress={() => setGroomed(!groomed)}>
            <View style={[styles.checkbox, { borderColor: C.cardBorder }, groomed && { backgroundColor: C.primary, borderColor: C.primary }]}>
              {groomed && <Text style={[styles.checkmark, { color: C.card }]}>✓</Text>}
            </View>
            <Text style={[styles.checkLabel, { color: C.text, fontFamily: F.sans }]}>{t('Groomed')}</Text>
          </Pressable>

          <Pressable style={[styles.checkRow, { borderBottomColor: C.cardSeparator }]} onPress={() => setTurnedOut(!turnedOut)}>
            <View style={[styles.checkbox, { borderColor: C.cardBorder }, turnedOut && { backgroundColor: C.primary, borderColor: C.primary }]}>
              {turnedOut && <Text style={[styles.checkmark, { color: C.card }]}>✓</Text>}
            </View>
            <Text style={[styles.checkLabel, { color: C.text, fontFamily: F.sans }]}>{t('Turned Out')}</Text>
          </Pressable>

          {turnedOut && (
            <TextInput
              style={[styles.input, styles.durationInput, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
              value={turnoutDuration}
              onChangeText={setTurnoutDuration}
              placeholder="Duration (e.g. 2 hours, all day)"
              placeholderTextColor={C.textMuted}
            />
          )}

          <Pressable style={[styles.checkRow, { borderBottomColor: C.cardSeparator }]} onPress={() => setRidden(!ridden)}>
            <View style={[styles.checkbox, { borderColor: C.cardBorder }, ridden && { backgroundColor: C.primary, borderColor: C.primary }]}>
              {ridden && <Text style={[styles.checkmark, { color: C.card }]}>✓</Text>}
            </View>
            <Text style={[styles.checkLabel, { color: C.text, fontFamily: F.sans }]}>{t('Ridden')}</Text>
          </Pressable>
        </View>

        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Notes')}</Text>
          <TextInput
            style={[styles.input, styles.notesInput, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any observations, incidents, or notes for the owner..."
            placeholderTextColor={C.textMuted}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '600', fontStyle: 'italic' },
  saveBtn: { backgroundColor: 'transparent', paddingHorizontal: 4, paddingVertical: 4, borderRadius: 0, borderWidth: 0 },
  saveBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  body: { flex: 1, padding: 16 },
  section: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkmark: { fontSize: 13, fontWeight: '700' },
  checkLabel: { fontSize: 15 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
  durationInput: { marginTop: 8, marginLeft: 34 },
  notesInput: { minHeight: 96, textAlignVertical: 'top' },
});
