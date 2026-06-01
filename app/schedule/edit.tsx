import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Trophy, Stethoscope, Hammer, CalendarCheck, FileText, Repeat } from 'lucide-react-native';
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

async function confirmSeriesAction(action: 'edit' | 'delete'): Promise<'one' | 'future' | null> {
  const verb = action === 'edit' ? 'update' : 'delete';
  if (Platform.OS === 'web') {
    const all = window.confirm(
      `This is a recurring event.\n\nOK = ${verb} this and all future events\nCancel = ${verb} this event only`
    );
    return all ? 'future' : 'one';
  }
  return new Promise(resolve => {
    Alert.alert(
      'Recurring Event',
      `How would you like to ${verb} this event?`,
      [
        { text: 'This Event Only', onPress: () => resolve('one') },
        { text: 'This & Future Events', style: 'destructive', onPress: () => resolve('future') },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ]
    );
  });
}

export default function EditEvent() {
  const router = useRouter();
  const { isOwner, isStaff } = useProfile();
  const { t } = useLanguage();
  const theme = useTheme(); const C = theme.colors; const F = theme.fonts;
  const { eventId } = useLocalSearchParams();

  const [horses, setHorses] = useState<{ id: string; name: string }[]>([]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [type, setType] = useState('other');
  const [assignee, setAssignee] = useState('');
  const [notes, setNotes] = useState('');
  const [horseId, setHorseId] = useState('');
  const [recurring, setRecurring] = useState<string | null>(null);
  const [recurringGroupId, setRecurringGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('horses').select('id, name').order('name').then(({ data }) => {
      setHorses(data || []);
    });
    async function fetchEvent() {
      const { data } = await supabase.from('events').select('*').eq('id', eventId).single();
      if (data) {
        setTitle(data.title || '');
        setDate(data.date || '');
        setTime(data.time || '');
        setType(data.type || 'other');
        setAssignee(data.assignee || '');
        setNotes(data.notes || '');
        setHorseId(data.horse_id || '');
        setRecurring(data.recurring || null);
        setRecurringGroupId(data.recurring_group_id || null);
      }
      setLoading(false);
    }
    fetchEvent();
  }, [eventId]);

  async function handleSave() {
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!date.trim()) { setError('Date is required.'); return; }
    setSaving(true);
    setError('');

    const updates = {
      title: title.trim(),
      date,
      time: time.trim() || null,
      type,
      assignee: assignee.trim() || null,
      notes: notes.trim() || null,
      horse_id: horseId || null,
    };

    if (recurringGroupId) {
      const scope = await confirmSeriesAction('edit');
      if (!scope) { setSaving(false); return; }
      if (scope === 'future') {
        await supabase.from('events')
          .update(updates)
          .eq('recurring_group_id', recurringGroupId)
          .gte('date', date);
      } else {
        await supabase.from('events').update(updates).eq('id', eventId);
      }
    } else {
      const { error: err } = await supabase.from('events').update(updates).eq('id', eventId);
      if (err) { setError(err.message); setSaving(false); return; }
    }

    router.back();
  }

  async function handleDelete() {
    if (recurringGroupId) {
      const scope = await confirmSeriesAction('delete');
      if (!scope) return;
      setDeleting(true);
      if (scope === 'future') {
        await supabase.from('events')
          .delete()
          .eq('recurring_group_id', recurringGroupId)
          .gte('date', date);
      } else {
        await supabase.from('events').delete().eq('id', eventId);
      }
      router.back();
      return;
    }

    if (Platform.OS === 'web') {
      if (!window.confirm('Delete this event?')) return;
    } else {
      try {
        await new Promise<void>((resolve, reject) => {
          Alert.alert('Delete Event', 'Are you sure? This cannot be undone.', [
            { text: 'Cancel', style: 'cancel', onPress: () => reject() },
            { text: 'Delete', style: 'destructive', onPress: () => resolve() },
          ]);
        });
      } catch { return; }
    }
    setDeleting(true);
    await supabase.from('events').delete().eq('id', eventId);
    router.back();
  }

  if (!isOwner && !isStaff) {
    return (
      <View style={{ flex: 1, backgroundColor: C.background, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <Text style={{ fontSize: 16, color: C.textMuted, textAlign: 'center', fontFamily: F.sans }}>You don't have permission to edit events.</Text>
      </View>
    );
  }

  if (loading) return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 80 }} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <HomeButton />
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Edit Event')}</Text>
          {recurring && (
            <View style={[styles.recurringBadge, { backgroundColor: C.secondaryAlpha15 }]}>
              <Repeat size={10} color={C.headerText} />
              <Text style={[styles.recurringBadgeText, { color: C.headerText, fontFamily: F.sansBold }]}>{recurring}</Text>
            </View>
          )}
        </View>
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
            placeholderTextColor={C.textMuted}
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

        {error ? <Text style={[styles.errorText, { color: C.error }]}>{error}</Text> : null}

        <Pressable
          style={({ hovered }: any) => [styles.deleteBtn, { backgroundColor: C.error }, hovered && styles.deleteBtnHovered]}
          onPress={handleDelete}
          disabled={deleting}
        >
          {deleting ? <ActivityIndicator color="white" size="small" /> : <Text style={[styles.deleteBtnText, { color: C.card, fontFamily: F.sansBold }]}>{t('Delete Event')}</Text>}
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCenter: { alignItems: 'center', gap: 4 },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  recurringBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  recurringBadgeText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
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
  errorText: { fontSize: 13, padding: 16 },
  deleteBtn: { margin: 16, borderRadius: 12, padding: 16, alignItems: 'center' },
  deleteBtnHovered: { backgroundColor: '#6B1E1E' },
  deleteBtnText: { fontSize: 14, fontWeight: '600' },
});
