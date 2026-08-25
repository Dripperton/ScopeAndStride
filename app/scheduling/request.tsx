import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../../lib/useProfile';
import { useTheme } from '../../context/ThemeContext';

export default function RequestSlot() {
  const router = useRouter();
  const { slotId, date, time, duration, spotsLeft } = useLocalSearchParams();
  const { profile, horseLinks } = useProfile();
  const theme = useTheme(); const C = theme.colors; const F = theme.fonts;

  const [horses, setHorses] = useState<any[]>([]);
  const [selectedHorseId, setSelectedHorseId] = useState<number | null>(null);
  const [horseScheduling, setHorseScheduling] = useState<Record<number, any>>({});
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [dupError, setDupError] = useState(false);
  const [capError, setCapError] = useState(false);

  useEffect(() => {
    const myHorseIds = horseLinks.map(l => l.horse_id);
    if (myHorseIds.length === 0) return;
    Promise.all([
      supabase.from('horses').select('id, name').in('id', myHorseIds),
      supabase.from('horse_scheduling').select('*').in('horse_id', myHorseIds),
    ]).then(([{ data: horsesData }, { data: schedData }]) => {
      const schedMap: Record<number, any> = {};
      schedData?.forEach((s: any) => { schedMap[s.horse_id] = s; });
      setHorseScheduling(schedMap);
      // Filter out trainer_assigned horses — trainer books for them directly
      const eligible = (horsesData || []).filter((h: any) => schedMap[h.id]?.scheduling_type !== 'trainer_assigned');
      setHorses(eligible);
      if (eligible.length === 1) setSelectedHorseId(eligible[0].id);
    });
  }, [horseLinks]);

  function formatTimeRange(timeStr: string, durationMinutes?: number): string {
    if (!durationMinutes) return timeStr;
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return timeStr;
    let hours = parseInt(match[1]);
    const mins = parseInt(match[2]);
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && hours !== 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    const endTotal = hours * 60 + mins + durationMinutes;
    const endH24 = Math.floor(endTotal / 60) % 24;
    const endMins = endTotal % 60;
    const endAmpm = endH24 < 12 ? 'AM' : 'PM';
    const endH12 = endH24 === 0 ? 12 : endH24 > 12 ? endH24 - 12 : endH24;
    const endStr = `${endH12}:${String(endMins).padStart(2, '0')} ${endAmpm}`;
    const startStr = ampm === endAmpm ? `${match[1]}:${match[2]}` : timeStr;
    return `${startStr}-${endStr}`;
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  async function handleSubmit() {
    if (!selectedHorseId || !slotId) return;
    setSaving(true);
    setDupError(false);
    setCapError(false);

    // Check for duplicate request
    const { data: existing } = await supabase
      .from('lesson_requests')
      .select('id')
      .eq('slot_id', slotId)
      .eq('horse_id', selectedHorseId)
      .in('status', ['pending', 'approved'])
      .maybeSingle();
    if (existing) { setSaving(false); setDupError(true); return; }

    // Check weekly cap for weekly/rotating scheduling types
    const sched = horseScheduling[selectedHorseId];
    if (sched && ['weekly', 'rotating'].includes(sched.scheduling_type) && sched.weekly_cap) {
      const slotDate = new Date((date as string) + 'T00:00:00');
      const slotDay = slotDate.getDay();
      const weekStart = new Date(slotDate);
      weekStart.setDate(slotDate.getDate() - ((slotDay + 6) % 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const { data: weekSlots } = await supabase.from('lesson_slots').select('id').gte('date', weekStart.toISOString().split('T')[0]).lte('date', weekEnd.toISOString().split('T')[0]);
      if (weekSlots && weekSlots.length > 0) {
        const { count } = await supabase.from('lesson_requests').select('*', { count: 'exact', head: true }).eq('horse_id', selectedHorseId).in('status', ['pending', 'approved']).in('slot_id', weekSlots.map((s: any) => s.id));
        if ((count || 0) >= sched.weekly_cap) { setSaving(false); setCapError(true); return; }
      }
    }

    await supabase.from('lesson_requests').insert({
      slot_id: slotId,
      horse_id: selectedHorseId,
      requested_by: profile?.id,
      status: 'pending',
      note: note.trim() || null,
    });
    setSaving(false);
    setDone(true);
    setTimeout(() => router.back(), 1000);
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backText, { fontFamily: F.sans }]}>Cancel</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>Request Slot</Text>
        <Pressable onPress={handleSubmit} disabled={!selectedHorseId || saving || done || horses.length === 0}>
          {saving ? <ActivityIndicator color="white" size="small" /> :
            <Text style={[styles.saveText, { fontFamily: F.sansBold }, (!selectedHorseId || done) && { opacity: 0.4 }]}>
              {done ? 'Sent!' : 'Submit'}
            </Text>
          }
        </Pressable>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {/* Slot summary */}
        <View style={[styles.slotSummary, { backgroundColor: C.primary }]}>
          <Text style={[styles.slotSummaryDate, { color: C.headerText, fontFamily: F.sansBold }]}>{formatDate(date as string)}</Text>
          <Text style={[styles.slotSummaryTime, { color: 'rgba(255,255,255,0.7)', fontFamily: F.sans }]}>
            {duration ? formatTimeRange(time as string, Number(duration)) : time as string}
          </Text>
          {spotsLeft && Number(spotsLeft) > 1 ? (
            <Text style={[styles.slotSummarySpots, { color: 'rgba(255,255,255,0.55)', fontFamily: F.sans }]}>
              {spotsLeft} spot{Number(spotsLeft) !== 1 ? 's' : ''} available
            </Text>
          ) : null}
        </View>

        {/* Horse picker (if multiple horses) */}
        {horses.length > 1 && (
          <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>WHICH HORSE?</Text>
            {horses.map(horse => (
              <Pressable
                key={horse.id}
                style={[styles.horseOption, { borderColor: C.cardBorder }, selectedHorseId === horse.id && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                onPress={() => setSelectedHorseId(horse.id)}
              >
                <Text style={[styles.horseName, { color: C.text, fontFamily: F.sansBold }, selectedHorseId === horse.id && { color: C.primary }]}>{horse.name}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {horses.length === 0 && (
          <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>NOT AVAILABLE</Text>
            <Text style={{ color: C.textMuted, fontFamily: F.sans, fontSize: 13 }}>
              Your trainer assigns lessons directly for your horse. No action needed.
            </Text>
          </View>
        )}

        {dupError && (
          <View style={[styles.section, { backgroundColor: '#FDECEA', borderColor: '#8B2E2E' }]}>
            <Text style={[styles.sectionTitle, { color: '#8B2E2E', fontFamily: F.sansBold }]}>ALREADY REQUESTED</Text>
            <Text style={{ color: '#8B2E2E', fontFamily: F.sans, fontSize: 13 }}>
              This horse already has a pending or approved request for this slot.
            </Text>
          </View>
        )}

        {capError && (
          <View style={[styles.section, { backgroundColor: '#FDECEA', borderColor: '#8B2E2E' }]}>
            <Text style={[styles.sectionTitle, { color: '#8B2E2E', fontFamily: F.sansBold }]}>WEEKLY LIMIT REACHED</Text>
            <Text style={{ color: '#8B2E2E', fontFamily: F.sans, fontSize: 13 }}>
              This horse has already reached the maximum number of lessons for this week.
            </Text>
          </View>
        )}

        {/* Note */}
        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>NOTE (OPTIONAL)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
            value={note}
            onChangeText={setNote}
            placeholder="Any requests or notes for your trainer..."
            placeholderTextColor={C.textMuted}
            multiline
            numberOfLines={3}
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
  headerTitle: { fontSize: 16, fontWeight: '600' },
  saveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  body: { flex: 1 },
  slotSummary: { padding: 28, alignItems: 'center', gap: 6 },
  slotSummaryDate: { fontSize: 20, fontWeight: '700', fontStyle: 'italic' },
  slotSummaryTime: { fontSize: 15 },
  slotSummarySpots: { fontSize: 13, marginTop: 2 },
  section: { margin: 16, marginBottom: 0, borderRadius: 14, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  horseOption: { borderWidth: 1.5, borderRadius: 10, padding: 14, marginBottom: 8 },
  horseName: { fontSize: 14 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: 'top' },
});
