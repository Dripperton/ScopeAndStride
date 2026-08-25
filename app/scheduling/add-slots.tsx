import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../../lib/useProfile';
import { useTheme } from '../../context/ThemeContext';
import { X } from 'lucide-react-native';

const WEEK_OPTIONS = [1, 2, 3, 4];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_OFFSETS: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

const HOUR_TIMES: string[] = [];
for (let h = 6; h <= 20; h++) {
  const ampm = h < 12 ? 'AM' : 'PM';
  const hour = h <= 12 ? h : h - 12;
  HOUR_TIMES.push(`${hour}:00 ${ampm}`);
}

const HALF_HOUR_TIMES: string[] = [];
for (let h = 6; h <= 20; h++) {
  const ampm = h < 12 ? 'AM' : 'PM';
  const hour = h <= 12 ? h : h - 12;
  HALF_HOUR_TIMES.push(`${hour}:00 ${ampm}`);
  if (h < 20) HALF_HOUR_TIMES.push(`${hour}:30 ${ampm}`);
}

const ALL_PRESET_TIMES = [...new Set([...HOUR_TIMES, ...HALF_HOUR_TIMES])];

const DURATION_OPTIONS = [
  { label: 'Half Hour', value: 30 },
  { label: 'Hour', value: 60 },
  { label: 'Custom', value: 0 },
];

function getMondayOfWeek(offset: number) {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function toDateStr(d: Date) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export default function AddSlots() {
  const router = useRouter();
  const { profile } = useProfile();
  const theme = useTheme(); const C = theme.colors; const F = theme.fonts;

  const [weeksAhead, setWeeksAhead] = useState(1);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [duration, setDuration] = useState<30 | 60 | 0>(60);
  const [customDuration, setCustomDuration] = useState('');
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [customTime, setCustomTime] = useState('');
  const [riderCap, setRiderCap] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const presetTimes = duration === 30 ? HALF_HOUR_TIMES : HOUR_TIMES;

  function toggleDay(day: string) {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  }

  async function selectDuration(val: 30 | 60 | 0) {
    setDuration(val);
    if (val === 30) setSelectedTimes(prev => prev.filter(t => HALF_HOUR_TIMES.includes(t) || !ALL_PRESET_TIMES.includes(t)));
    if (val === 60) setSelectedTimes(prev => prev.filter(t => HOUR_TIMES.includes(t) || !ALL_PRESET_TIMES.includes(t)));
    if (val === 30 || val === 60) {
      const { data } = await supabase.from('scheduling_caps').select('max_riders').eq('duration_minutes', val).single();
      if (data) setRiderCap(data.max_riders);
    }
  }

  function toggleTime(time: string) {
    setSelectedTimes(prev => prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time]);
  }

  function addCustomTime() {
    const t = customTime.trim();
    if (!t || selectedTimes.includes(t)) return;
    setSelectedTimes(prev => [...prev, t]);
    setCustomTime('');
  }

  function removeTime(time: string) {
    setSelectedTimes(prev => prev.filter(t => t !== time));
  }

  function effectiveDurationMinutes(): number {
    if (duration === 30) return 30;
    if (duration === 60) return 60;
    return parseInt(customDuration) || 45;
  }

  async function handleSave() {
    if (selectedDays.length === 0 || selectedTimes.length === 0) return;
    setSaving(true);

    const duration_minutes = effectiveDurationMinutes();
    const slots: { date: string; time: string; is_open: boolean; created_by: string | undefined; duration_minutes: number; max_riders: number }[] = [];

    for (let week = 0; week < weeksAhead; week++) {
      const monday = getMondayOfWeek(week);
      for (const day of selectedDays) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + DAY_OFFSETS[day]);
        const dateStr = toDateStr(d);
        for (const time of selectedTimes) {
          slots.push({ date: dateStr, time, is_open: true, created_by: profile?.id, duration_minutes, max_riders: riderCap });
        }
      }
    }

    const { error } = await supabase.from('lesson_slots').insert(slots);
    setSaving(false);
    if (error) {
      alert(`Failed to save slots: ${error.message}`);
      return;
    }
    setSaved(true);
    setTimeout(() => router.back(), 800);
  }

  const canSave = selectedDays.length > 0 && selectedTimes.length > 0 && (duration !== 0 || customDuration.trim() !== '');
  const totalSlots = selectedDays.length * selectedTimes.length * weeksAhead;

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backText, { fontFamily: F.sans }]}>Cancel</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>Open Slots</Text>
        <Pressable onPress={handleSave} disabled={!canSave || saving || saved}>
          {saving ? <ActivityIndicator color="white" size="small" /> :
            <Text style={[styles.saveText, { fontFamily: F.sansBold }, (!canSave || saved) && { opacity: 0.4 }]}>
              {saved ? 'Saved!' : 'Save'}
            </Text>
          }
        </Pressable>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

        {/* How many weeks */}
        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>HOW MANY WEEKS</Text>
          <View style={styles.chipRow}>
            {WEEK_OPTIONS.map(w => (
              <Pressable
                key={w}
                style={[styles.chip, { borderColor: C.cardBorder }, weeksAhead === w && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                onPress={() => setWeeksAhead(w)}
              >
                <Text style={[styles.chipText, { color: C.textMuted, fontFamily: F.sans }, weeksAhead === w && { color: C.primary, fontFamily: F.sansBold }]}>
                  {w === 1 ? 'This week' : `${w} weeks`}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Days of week */}
        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>DAYS</Text>
          <View style={styles.chipRow}>
            {DAYS.map(day => (
              <Pressable
                key={day}
                style={[styles.chip, { borderColor: C.cardBorder }, selectedDays.includes(day) && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                onPress={() => toggleDay(day)}
              >
                <Text style={[styles.chipText, { color: C.textMuted, fontFamily: F.sans }, selectedDays.includes(day) && { color: C.primary, fontFamily: F.sansBold }]}>
                  {day}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Slot duration */}
        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>SLOT LENGTH</Text>
          <View style={styles.chipRow}>
            {DURATION_OPTIONS.map(opt => (
              <Pressable
                key={opt.value}
                style={[styles.chip, { borderColor: C.cardBorder }, duration === opt.value && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                onPress={() => selectDuration(opt.value as 30 | 60 | 0)}
              >
                <Text style={[styles.chipText, { color: C.textMuted, fontFamily: F.sans }, duration === opt.value && { color: C.primary, fontFamily: F.sansBold }]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {duration === 0 && (
            <View style={[styles.customRow, { marginTop: 12 }]}>
              <TextInput
                style={[styles.customInput, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
                value={customDuration}
                onChangeText={setCustomDuration}
                placeholder="Minutes (e.g. 45)"
                placeholderTextColor={C.textMuted}
                keyboardType="number-pad"
              />
            </View>
          )}
          <View style={[styles.capRow, { marginTop: 12 }]}>
            <Text style={[styles.capLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>RIDERS PER SLOT</Text>
            <View style={styles.capChips}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <Pressable
                  key={n}
                  style={[styles.capChip, { borderColor: C.cardBorder }, riderCap === n && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                  onPress={() => setRiderCap(n)}
                >
                  <Text style={[styles.capChipText, { color: C.textMuted, fontFamily: F.sans }, riderCap === n && { color: C.primary, fontFamily: F.sansBold }]}>
                    {n}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Times — grid adapts to duration */}
        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>TIMES</Text>
          <View style={styles.timeGrid}>
            {presetTimes.map(time => (
              <Pressable
                key={time}
                style={[styles.timeChip, { borderColor: C.cardBorder }, selectedTimes.includes(time) && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                onPress={() => toggleTime(time)}
              >
                <Text style={[styles.timeChipText, { color: C.textMuted, fontFamily: F.sans }, selectedTimes.includes(time) && { color: C.primary, fontFamily: F.sansBold }]}>
                  {time}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Custom times added via input */}
          {selectedTimes.filter(t => !ALL_PRESET_TIMES.includes(t)).map(t => (
            <View key={t} style={[styles.customTag, { backgroundColor: C.activeBg, borderColor: C.primary }]}>
              <Text style={[styles.customTagText, { color: C.primary, fontFamily: F.sansBold }]}>{t}</Text>
              <Pressable onPress={() => removeTime(t)}>
                <X size={12} color={C.primary} />
              </Pressable>
            </View>
          ))}

          <View style={styles.customRow}>
            <TextInput
              style={[styles.customInput, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
              value={customTime}
              onChangeText={setCustomTime}
              placeholder="Custom time (e.g. 9:45 AM)"
              placeholderTextColor={C.textMuted}
              onSubmitEditing={addCustomTime}
              returnKeyType="done"
            />
            <Pressable
              style={[styles.customAddBtn, { backgroundColor: customTime.trim() ? C.primary : C.cardBorder }]}
              onPress={addCustomTime}
              disabled={!customTime.trim()}
            >
              <Text style={[styles.customAddBtnText, { fontFamily: F.sansBold }]}>Add</Text>
            </Pressable>
          </View>
        </View>

        {/* Preview */}
        {canSave && (
          <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>PREVIEW</Text>
            <Text style={[styles.previewText, { color: C.text, fontFamily: F.sans }]}>
              {selectedDays.join(', ')} · {selectedTimes.join(', ')} · {effectiveDurationMinutes()} min
            </Text>
            <Text style={[styles.previewCount, { color: C.textMuted, fontFamily: F.sans }]}>
              {totalSlots} total slot{totalSlots !== 1 ? 's' : ''} across {weeksAhead} week{weeksAhead !== 1 ? 's' : ''} · up to {riderCap} rider{riderCap !== 1 ? 's' : ''} each
            </Text>
          </View>
        )}

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
  saveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  body: { flex: 1, padding: 16 },
  section: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  timeChip: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  timeChipText: { fontSize: 12 },
  customTag: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8 },
  customTagText: { fontSize: 12 },
  customRow: { flexDirection: 'row', gap: 8 },
  customInput: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 13 },
  customAddBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, justifyContent: 'center' },
  customAddBtnText: { color: 'white', fontSize: 13 },
  capRow: { gap: 8 },
  capLabel: { fontSize: 10, letterSpacing: 1 },
  capChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  capChip: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  capChipText: { fontSize: 13 },
  previewText: { fontSize: 14, marginBottom: 4 },
  previewCount: { fontSize: 12 },
});
