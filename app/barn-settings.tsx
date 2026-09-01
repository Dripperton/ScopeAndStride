import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (barnSettings) { setSchedulePrivacy(barnSettings.schedule_privacy); setLoading(false); }
  }, [barnSettings]);

  async function handlePrivacyToggle(value: boolean) {
    const newPrivacy = value ? 'show_busy' : 'show_details';
    setSchedulePrivacy(newPrivacy);
    setSaving(true);
    await supabase.from('barn_settings').update({ schedule_privacy: newPrivacy });
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

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
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
});
