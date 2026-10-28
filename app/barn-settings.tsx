import { useEffect, useState } from 'react';
import { Keyboard, ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Pencil } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useProfile } from '../lib/useProfile';
import { useLanguage } from '../lib/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import HomeButton from '../lib/HomeButton';
import { useBarnData } from '../lib/BarnDataContext';

export default function BarnSettings() {
  const router = useRouter();
  const { isOwner, loading: profileLoading } = useProfile();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const { barnSettings, refreshBarnSettings } = useBarnData();

  const [schedulePrivacy, setSchedulePrivacy] = useState<'show_details' | 'show_busy'>('show_details');
  const [trainers, setTrainers] = useState<string[]>([]);
  const [newTrainer, setNewTrainer] = useState('');
  const [editingTrainer, setEditingTrainer] = useState<{ index: number; value: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (barnSettings) {
      setSchedulePrivacy(barnSettings.schedule_privacy);
      setTrainers(barnSettings.trainers || []);
      setLoading(false);
    }
  }, [barnSettings]);

  async function handleAddTrainer() {
    const name = newTrainer.trim();
    if (!name) return;
    const updated = [...trainers, name];
    setTrainers(updated);
    setNewTrainer('');
    const { error: err } = await supabase.from('barn_settings').update({ trainers: updated }).eq('id', barnSettings!.id);
    if (err) { Alert.alert('Save failed', err.message); return; }
    await refreshBarnSettings();
  }

  async function handleRemoveTrainer(name: string) {
    Alert.alert('Remove Trainer', `Remove ${name} from the trainer list?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const updated = trainers.filter(t => t !== name);
        setTrainers(updated);
        await supabase.from('barn_settings').update({ trainers: updated }).eq('id', barnSettings!.id);
        await refreshBarnSettings();
      }},
    ]);
  }

  async function handleSaveEditTrainer() {
    if (!editingTrainer) return;
    const name = editingTrainer.value.trim();
    if (!name) return;
    const updated = trainers.map((t, i) => (i === editingTrainer.index ? name : t));
    setTrainers(updated);
    setEditingTrainer(null);
    await supabase.from('barn_settings').update({ trainers: updated }).eq('id', barnSettings!.id);
    await refreshBarnSettings();
  }

  async function handlePrivacyToggle(value: boolean) {
    const newPrivacy = value ? 'show_busy' : 'show_details';
    setSchedulePrivacy(newPrivacy);
    setSaving(true);
    await supabase.from('barn_settings').update({ schedule_privacy: newPrivacy }).eq('id', barnSettings!.id);
    await refreshBarnSettings();
    setSaving(false);
  }

  if (profileLoading || loading) {
    return (
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 80 }} />
      </View>
    );
  }

  if (!isOwner) {
    return (
      <View style={[styles.container, { backgroundColor: C.background, alignItems: 'center', justifyContent: 'center', padding: 40 }]}>
        <Text style={{ fontSize: 16, color: C.textMuted, textAlign: 'center' }}>
          {t("You don't have permission to access this page.")}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <HomeButton />
        <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Barn Settings')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardDismissMode="interactive" onScrollBeginDrag={Keyboard.dismiss}>
        <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Schedule')}</Text>
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: C.text, fontFamily: F.sansBold }]}>{t('Schedule Privacy')}</Text>
              <Text style={[styles.settingDesc, { color: C.textMuted }]}>
                {schedulePrivacy === 'show_busy'
                  ? t("Riders see time slots as Busy — lesson details and horse names are hidden from other riders.")
                  : t("Riders can see full event details including who is riding when.")}
              </Text>
            </View>
            <View style={styles.switchWrap}>
              {saving ? (
                <ActivityIndicator size="small" color={C.primary} />
              ) : (
                <Switch
                  value={schedulePrivacy === 'show_busy'}
                  onValueChange={handlePrivacyToggle}
                  trackColor={{ false: C.cardBorder, true: C.primary }}
                  thumbColor="white"
                />
              )}
            </View>
          </View>
          <View style={[styles.privacyExample, { backgroundColor: C.background, borderColor: C.cardBorder }]}>
            <Text style={[styles.privacyExampleLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>
              {schedulePrivacy === 'show_busy' ? t('RIDERS SEE').toUpperCase() : t('RIDERS SEE').toUpperCase()}
            </Text>
            {schedulePrivacy === 'show_busy' ? (
              <>
                <Text style={[styles.privacyExampleRow, { color: C.text }]}>• {t('Their own lessons — full details')}</Text>
                <Text style={[styles.privacyExampleRow, { color: C.text }]}>• {t("Other lessons — 'Busy'")}</Text>
                <Text style={[styles.privacyExampleRow, { color: C.text }]}>• {t("Vet / Farrier — type label only")}</Text>
              </>
            ) : (
              <>
                <Text style={[styles.privacyExampleRow, { color: C.text }]}>• {t('All events — full title and horse name')}</Text>
              </>
            )}
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold, marginTop: 24 }]}>{t('Trainers')}</Text>
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.settingDesc, { color: C.textMuted }]}>{t('These names appear in the "Assigned To" picker when adding events.')}</Text>
          {trainers.map((name, index) => (
            <View key={index} style={[styles.trainerRow, { borderColor: C.cardBorder }]}>
              {editingTrainer?.index === index ? (
                <>
                  <TextInput
                    style={[styles.trainerInput, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans, flex: 1 }]}
                    value={editingTrainer.value}
                    onChangeText={v => setEditingTrainer({ index, value: v })}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleSaveEditTrainer}
                  />
                  <Pressable onPress={handleSaveEditTrainer} style={[styles.addTrainerBtn, { backgroundColor: C.primary }]}>
                    <Text style={{ color: C.headerText, fontFamily: F.sansBold, fontSize: 13 }}>Save</Text>
                  </Pressable>
                  <Pressable onPress={() => setEditingTrainer(null)} style={[styles.addTrainerBtn, { backgroundColor: C.cardBorder }]}>
                    <Text style={{ color: C.text, fontFamily: F.sansBold, fontSize: 13 }}>Cancel</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={[styles.settingLabel, { color: C.text, fontFamily: F.sans, flex: 1 }]}>{name}</Text>
                  <Pressable onPress={() => setEditingTrainer({ index, value: name })} style={{ marginRight: 12 }}>
                    <Pencil size={15} color={C.textMuted} />
                  </Pressable>
                  <Pressable onPress={() => handleRemoveTrainer(name)}>
                    <Text style={{ color: C.error, fontSize: 13, fontFamily: F.sansBold }}>Remove</Text>
                  </Pressable>
                </>
              )}
            </View>
          ))}
          <View style={styles.addTrainerRow}>
            <TextInput
              style={[styles.trainerInput, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
              value={newTrainer}
              onChangeText={setNewTrainer}
              placeholder="Trainer name"
              placeholderTextColor={C.textMuted}
              onSubmitEditing={handleAddTrainer}
              returnKeyType="done"
            />
            <Pressable
              style={[styles.addTrainerBtn, { backgroundColor: C.primary }]}
              onPress={handleAddTrainer}
            >
              <Text style={{ color: C.headerText, fontFamily: F.sansBold, fontSize: 13 }}>Add</Text>
            </Pressable>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold, marginTop: 24 }]}>Admin</Text>
        <Pressable
          style={[styles.card, { backgroundColor: C.card, borderColor: C.cardBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
          onPress={() => router.push('/admin/setup')}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingLabel, { color: C.text, fontFamily: F.sansBold }]}>Barn Setup</Text>
            <Text style={[styles.settingDesc, { color: C.textMuted }]}>Import horses, send owner invites, configure alert thresholds</Text>
          </View>
          <Text style={{ color: C.textMuted, fontSize: 18 }}>›</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  headerSpacer: { width: 32 },
  body: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 14 },
  settingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  settingDesc: { fontSize: 12, lineHeight: 18 },
  switchWrap: { width: 52, alignItems: 'center', paddingTop: 2 },
  privacyExample: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 4 },
  privacyExampleLabel: { fontSize: 10, letterSpacing: 0.5, marginBottom: 4 },
  privacyExampleRow: { fontSize: 12, lineHeight: 20 },
  trainerRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingTop: 10, marginTop: 6 },
  addTrainerRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  trainerInput: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 14 },
  addTrainerBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, justifyContent: 'center' },
});
