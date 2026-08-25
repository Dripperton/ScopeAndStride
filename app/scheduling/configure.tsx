import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../context/ThemeContext';
import DateInput from '../../lib/DateInput';

const SCHEDULING_TYPES = [
  { key: 'weekly', label: 'Weekly', description: 'Rider requests slots each week up to a cap' },
  { key: 'seasonal', label: 'Seasonal', description: 'Set once at the start of the season' },
  { key: 'drop_in', label: 'Drop-in', description: 'Rider requests as needed, no recurring slot' },
  { key: 'trainer_assigned', label: 'Trainer-assigned', description: 'Barn assigns slots directly, no rider request' },
  { key: 'rotating', label: 'Rotating', description: 'Same day, times rotate for fairness' },
  { key: 'package', label: 'Package', description: 'Rider has X lessons to use before expiry' },
];

export default function ConfigureScheduling() {
  const router = useRouter();
  const { horseId, horseName } = useLocalSearchParams();
  const theme = useTheme(); const C = theme.colors; const F = theme.fonts;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);

  const [type, setType] = useState('weekly');
  const [weeklyCap, setWeeklyCap] = useState('1');
  const [packageRemaining, setPackageRemaining] = useState('');
  const [packageExpiry, setPackageExpiry] = useState('');
  const [seasonStart, setSeasonStart] = useState('');
  const [seasonEnd, setSeasonEnd] = useState('');

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('horse_scheduling').select('*').eq('horse_id', horseId).single();
      if (data) {
        setSchedulingId(data.id);
        setType(data.scheduling_type || 'weekly');
        setWeeklyCap(String(data.weekly_cap || 1));
        setPackageRemaining(String(data.package_remaining || ''));
        setPackageExpiry(data.package_expiry || '');
        setSeasonStart(data.season_start || '');
        setSeasonEnd(data.season_end || '');
      }
      setLoading(false);
    }
    load();
  }, [horseId]);

  async function handleSave() {
    setSaving(true);
    const payload = {
      horse_id: horseId,
      scheduling_type: type,
      weekly_cap: ['weekly', 'rotating'].includes(type) ? parseInt(weeklyCap) || 1 : null,
      package_remaining: type === 'package' ? parseInt(packageRemaining) || null : null,
      package_expiry: type === 'package' ? packageExpiry || null : null,
      season_start: type === 'seasonal' ? seasonStart || null : null,
      season_end: type === 'seasonal' ? seasonEnd || null : null,
    };

    if (schedulingId) {
      await supabase.from('horse_scheduling').update(payload).eq('id', schedulingId);
    } else {
      await supabase.from('horse_scheduling').insert(payload);
    }
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
          <Text style={[styles.backText, { fontFamily: F.sans }]}>Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{horseName as string}</Text>
        <Pressable onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="white" size="small" /> :
            <Text style={[styles.saveText, { fontFamily: F.sansBold }]}>Save</Text>
          }
        </Pressable>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>HOW DOES THIS RIDER BOOK?</Text>
          {SCHEDULING_TYPES.map(st => (
            <Pressable
              key={st.key}
              style={[styles.typeOption, { borderColor: C.cardBorder }, type === st.key && { borderColor: C.primary, backgroundColor: C.activeBg }]}
              onPress={() => setType(st.key)}
            >
              <Text style={[styles.typeLabel, { color: C.text, fontFamily: F.sansBold }, type === st.key && { color: C.primary }]}>{st.label}</Text>
              <Text style={[styles.typeDesc, { color: C.textMuted, fontFamily: F.sans }]}>{st.description}</Text>
            </Pressable>
          ))}
        </View>

        {/* Weekly / Rotating cap */}
        {['weekly', 'rotating'].includes(type) && (
          <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>WEEKLY CAP</Text>
            <Text style={[styles.hint, { color: C.textMuted, fontFamily: F.sans }]}>Max lessons per week for this horse</Text>
            <View style={styles.capRow}>
              {['1', '2', '3', '4', '5', '6', '7'].map(n => (
                <Pressable
                  key={n}
                  style={[styles.capChip, { borderColor: C.cardBorder }, weeklyCap === n && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                  onPress={() => setWeeklyCap(n)}
                >
                  <Text style={[styles.capChipText, { color: C.textMuted, fontFamily: F.sans }, weeklyCap === n && { color: C.primary, fontFamily: F.sansBold }]}>{n}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Package */}
        {type === 'package' && (
          <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>PACKAGE DETAILS</Text>
            <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>LESSONS REMAINING</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
              value={packageRemaining}
              onChangeText={setPackageRemaining}
              placeholder="e.g. 10"
              placeholderTextColor={C.textMuted}
              keyboardType="number-pad"
            />
            <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>EXPIRY DATE</Text>
            <DateInput value={packageExpiry} onChange={setPackageExpiry} placeholder="Select expiry date" />
          </View>
        )}

        {/* Seasonal */}
        {type === 'seasonal' && (
          <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>SEASON DATES</Text>
            <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>SEASON START</Text>
            <DateInput value={seasonStart} onChange={setSeasonStart} placeholder="Select start date" />
            <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>SEASON END</Text>
            <DateInput value={seasonEnd} onChange={setSeasonEnd} placeholder="Select end date" />
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
  headerTitle: { fontSize: 16, fontWeight: '600', fontStyle: 'italic' },
  saveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  body: { flex: 1, padding: 16 },
  section: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  hint: { fontSize: 12, marginBottom: 10, marginTop: -8 },
  typeOption: { borderWidth: 1.5, borderRadius: 10, padding: 14, marginBottom: 8 },
  typeLabel: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  typeDesc: { fontSize: 12 },
  capRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  capChip: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  capChipText: { fontSize: 14 },
  fieldLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
});
