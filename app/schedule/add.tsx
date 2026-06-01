import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Trophy, Stethoscope, Hammer, CalendarCheck, FileText } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../../lib/useProfile';
import DateInput from '../../lib/DateInput';
import { useLanguage } from '../../lib/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import HomeButton from '../../lib/HomeButton';

const TYPES = [
  { value: 'lesson',  label: 'Lesson',  Icon: Trophy },
  { value: 'vet',     label: 'Vet',     Icon: Stethoscope },
  { value: 'farrier', label: 'Farrier', Icon: Hammer },
  { value: 'daily',   label: 'Daily',   Icon: CalendarCheck },
  { value: 'other',   label: 'Other',   Icon: FileText },
];

const RECURRENCE_OPTIONS = [
  { value: '',         label: 'None' },
  { value: 'weekly',   label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly',  label: 'Monthly' },
];

function generateGroupId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function generateDates(startDate: string, recurring: string, endDate: string): string[] {
  const dates: string[] = [];
  const end = new Date(endDate + 'T12:00:00');
  const current = new Date(startDate + 'T12:00:00');
  while (current <= end) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    if (recurring === 'weekly') current.setDate(current.getDate() + 7);
    else if (recurring === 'biweekly') current.setDate(current.getDate() + 14);
    else if (recurring === 'monthly') current.setMonth(current.getMonth() + 1);
    else break;
  }
  return dates;
}

export default function AddEvent() {
  const router = useRouter();
  const { isOwner, isStaff } = useProfile();
  const { t } = useLanguage();
  const theme = useTheme(); const C = theme.colors; const F = theme.fonts;
  const { date: initialDate } = useLocalSearchParams();

  const [horses, setHorses] = useState<{ id: string; name: string }[]>([]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState((initialDate as string) || '');
  const [time, setTime] = useState('');
  const [type, setType] = useState('other');
  const [assignee, setAssignee] = useState('');
  const [notes, setNotes] = useState('');
  const [horseId, setHorseId] = useState('');
  const [recurring, setRecurring] = useState('');
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('horses').select('id, name').order('name').then(({ data }) => {
      setHorses(data || []);
    });
  }, []);

  if (!isOwner && !isStaff) {
    return (
      <View style={{ flex: 1, backgroundColor: C.background, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <Text style={{ fontSize: 16, color: C.textMuted, textAlign: 'center', fontFamily: F.sans }}>{t("You don't have permission to add events.")}</Text>
      </View>
    );
  }

  async function handleSave() {
    if (!title.trim()) { setError(t('Title is required.')); return; }
    if (!date.trim()) { setError(t('Date is required.')); return; }
    if (recurring && !recurringEndDate) { setError(t('End date is required for recurring events.')); return; }
    setSaving(true);
    setError('');

    const dates = recurring ? generateDates(date, recurring, recurringEndDate) : [date];
    const groupId = recurring ? generateGroupId() : null;

    const records = dates.map(d => ({
      title: title.trim(),
      date: d,
      time: time.trim() || null,
      type,
      assignee: assignee.trim() || null,
      notes: notes.trim() || null,
      horse_id: horseId || null,
      recurring: recurring || null,
      recurring_group_id: groupId,
    }));

    const { error: err } = await supabase.from('events').insert(records);
    if (err) { setError(err.message); setSaving(false); return; }
    router.back();
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <HomeButton />
        <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Add Event')}</Text>
        <Pressable
          style={({ hovered }: any) => [styles.saveBtn, hovered && styles.saveBtnHovered]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#1A1A14" size="small" /> : <Text style={[styles.saveBtnText, { fontFamily: F.sansBold }]}>{t('Save')}</Text>}
        </Pressable>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Event Type')}</Text>
          <View style={styles.typeGrid}>
            {TYPES.map(({ value, label, Icon }) => (
              <Pressable
                key={value}
                style={[styles.typeOption, { borderWidth: 1.5, borderColor: C.cardBorder }, type === value && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                onPress={() => setType(value)}
              >
                <Icon size={20} color={type === value ? C.primary : C.textMuted} />
                <Text style={[styles.typeLabel, { color: C.textMuted, fontFamily: F.sansMedium }, type === value && { color: C.primary, fontWeight: '700', fontFamily: F.sansBold }]}>{t(label)}</Text>
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
            placeholder="e.g. Lesson — Sterling"
            placeholderTextColor={C.textMuted}
            autoFocus
          />
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Date').toUpperCase()}</Text>
          <DateInput value={date} onChange={setDate} placeholder="Select date" />
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Time').toUpperCase()}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
            value={time}
            onChangeText={setTime}
            placeholder="e.g. 9:00 AM"
            placeholderTextColor={C.textMuted}
          />
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Assigned To').toUpperCase()}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
            value={assignee}
            onChangeText={setAssignee}
            placeholder="e.g. Trainer Kim"
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

        {horses.length > 0 && (
          <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Horse')}</Text>
            <View style={styles.horseList}>
              <Pressable
                style={[styles.horseOption, { borderWidth: 1.5, borderColor: C.cardBorder }, !horseId && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                onPress={() => setHorseId('')}
              >
                <Text style={[styles.horseLabel, { color: C.textMuted, fontFamily: F.sansMedium }, !horseId && { color: C.primary, fontWeight: '700', fontFamily: F.sansBold }]}>{t('None')}</Text>
              </Pressable>
              {horses.map(h => (
                <Pressable
                  key={h.id}
                  style={[styles.horseOption, { borderWidth: 1.5, borderColor: C.cardBorder }, horseId === h.id && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                  onPress={() => setHorseId(h.id)}
                >
                  <Text style={[styles.horseLabel, { color: C.textMuted, fontFamily: F.sansMedium }, horseId === h.id && { color: C.primary, fontWeight: '700', fontFamily: F.sansBold }]}>{h.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Recurring')}</Text>
          <View style={styles.recurringRow}>
            {RECURRENCE_OPTIONS.map(opt => (
              <Pressable
                key={opt.value}
                style={[styles.recurringOption, { borderWidth: 1.5, borderColor: C.cardBorder }, recurring === opt.value && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                onPress={() => setRecurring(opt.value)}
              >
                <Text style={[styles.recurringLabel, { color: C.textMuted, fontFamily: F.sansMedium }, recurring === opt.value && { color: C.primary, fontWeight: '700', fontFamily: F.sansBold }]}>{t(opt.label)}</Text>
              </Pressable>
            ))}
          </View>
          {recurring ? (
            <>
              <Text style={[styles.fieldLabel, { marginTop: 16, color: C.textMuted, fontFamily: F.sansBold }]}>{t('Repeat Until').toUpperCase()}</Text>
              <DateInput value={recurringEndDate} onChange={setRecurringEndDate} placeholder="Select end date" />
            </>
          ) : null}
        </View>

        {error ? <Text style={[styles.errorText, { color: C.error }]}>{error}</Text> : null}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  saveBtn: { backgroundColor: 'transparent', paddingHorizontal: 4, paddingVertical: 4, borderRadius: 0, borderWidth: 0 },
  saveBtnHovered: {},
  saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  body: { flex: 1 },
  section: { margin: 16, marginBottom: 0, borderRadius: 14, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeOption: { borderRadius: 10, padding: 12, alignItems: 'center', minWidth: 80, flex: 1, gap: 6 },
  typeLabel: { fontSize: 11, fontWeight: '500' },
  fieldLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  horseList: { gap: 6 },
  horseOption: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  horseLabel: { fontSize: 13, fontWeight: '500' },
  recurringRow: { flexDirection: 'row', gap: 8 },
  recurringOption: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  recurringLabel: { fontSize: 12, fontWeight: '500' },
  errorText: { fontSize: 13, padding: 16 },
});
