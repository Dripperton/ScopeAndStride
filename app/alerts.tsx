import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CheckCircle } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useProfile } from '../lib/useProfile';
import { useLanguage } from '../lib/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import HomeButton from '../lib/HomeButton';
import Brand from '../constants/brand';

interface Alert {
  horseId: number;
  horseName: string;
  message: string;
  severity: 'critical' | 'warning';
}

export default function AlertsScreen() {
  const router = useRouter();
  const { isOwner, isStaff } = useProfile();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOwner || isStaff) fetchAlerts();
    else setLoading(false);
  }, [isOwner, isStaff]);

  async function fetchAlerts() {
    const today = new Date();
    const [{ data: settings }, { data: horses }, { data: farrierVisits }] = await Promise.all([
      supabase.from('alert_settings').select('*').eq('barn_id', 'default').single(),
      supabase.from('horses').select('id, name, alert, coggins_expiry_date'),
      supabase.from('service_visits').select('horse_id, next_appointment_date').eq('service_type', 'farrier').not('next_appointment_date', 'is', null).order('date', { ascending: false }),
    ]);
    const cogginsDays = settings?.coggins_days ?? 30;
    const farrierDays = settings?.farrier_days ?? 14;
    const newAlerts: Alert[] = [];
    if (!horses) { setLoading(false); return; }
    horses.forEach(horse => {
      if (horse.alert) newAlerts.push({ horseId: horse.id, horseName: horse.name, message: 'Manual alert flagged', severity: 'critical' });
      if (horse.coggins_expiry_date) {
        const diff = Math.ceil((new Date(horse.coggins_expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 0) newAlerts.push({ horseId: horse.id, horseName: horse.name, message: 'Coggins expired', severity: 'critical' });
        else if (diff <= cogginsDays) newAlerts.push({ horseId: horse.id, horseName: horse.name, message: `Coggins expires in ${diff} day${diff === 1 ? '' : 's'}`, severity: 'warning' });
      }
    });
    if (farrierVisits) {
      const farrierMap: Record<number, string> = {};
      farrierVisits.forEach(r => { if (r.next_appointment_date && !farrierMap[r.horse_id]) farrierMap[r.horse_id] = r.next_appointment_date; });
      Object.entries(farrierMap).forEach(([horseIdStr, nextDue]) => {
        const horseId = Number(horseIdStr);
        const horse = horses.find(h => h.id === horseId);
        if (!horse) return;
        const diff = Math.ceil((new Date(nextDue).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 0) newAlerts.push({ horseId, horseName: horse.name, message: 'Farrier overdue', severity: 'critical' });
        else if (diff <= farrierDays) newAlerts.push({ horseId, horseName: horse.name, message: `Farrier due in ${diff} day${diff === 1 ? '' : 's'}`, severity: 'warning' });
      });
    }
    setAlerts(newAlerts);
    setLoading(false);
  }

  if (!isOwner && !isStaff) {
    return (
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[styles.header, { backgroundColor: C.primary }]}>
          <HomeButton />
          <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Alerts')}</Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 16, color: C.textMuted, textAlign: 'center', padding: 40 }}>{t("You don't have permission to access this page.")}</Text>
        </View>
      </View>
    );
  }

  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <HomeButton />
        <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Alerts')}</Text>
        <View style={{ width: 48 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 60 }} />
      ) : alerts.length === 0 ? (
        <View style={styles.emptyState}>
          <CheckCircle size={48} color={C.success} />
          <Text style={[styles.emptyTitle, { color: C.primary, fontFamily: F.sansBold }]}>{t('All clear')}</Text>
          <Text style={[styles.emptyText, { color: C.textMuted }]}>{t('No alerts right now. Check back later.')}</Text>
        </View>
      ) : (
        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          {criticalAlerts.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Critical')}</Text>
              <View style={[styles.alertCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                {criticalAlerts.map((alert, i) => (
                  <Pressable
                    key={`c-${i}`}
                    style={({ hovered }: any) => [styles.alertRow, { borderBottomColor: C.cardSeparator }, hovered && { backgroundColor: C.background }, i === criticalAlerts.length - 1 && styles.alertRowLast]}
                    onPress={() => router.push(`/horse/${alert.horseId}`)}
                  >
                    <View style={[styles.alertDot, { backgroundColor: C.error }]} />
                    <View style={styles.alertInfo}>
                      <Text style={[styles.alertHorse, { color: C.text, fontFamily: F.sansBold }]}>{alert.horseName}</Text>
                      <Text style={[styles.alertText, { color: C.textMuted }]}>{alert.message}</Text>
                    </View>
                    <Text style={[styles.alertChevron, { color: C.cardBorder }]}>›</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          {warningAlerts.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Upcoming')}</Text>
              <View style={[styles.alertCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                {warningAlerts.map((alert, i) => (
                  <Pressable
                    key={`w-${i}`}
                    style={({ hovered }: any) => [styles.alertRow, { borderBottomColor: C.cardSeparator }, hovered && { backgroundColor: C.background }, i === warningAlerts.length - 1 && styles.alertRowLast]}
                    onPress={() => router.push(`/horse/${alert.horseId}`)}
                  >
                    <View style={[styles.alertDot, { backgroundColor: C.warning }]} />
                    <View style={styles.alertInfo}>
                      <Text style={[styles.alertHorse, { color: C.text, fontFamily: F.sansBold }]}>{alert.horseName}</Text>
                      <Text style={[styles.alertText, { color: C.textMuted }]}>{alert.message}</Text>
                    </View>
                    <Text style={[styles.alertChevron, { color: C.cardBorder }]}>›</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  body: { flex: 1 },
  section: { margin: 16, marginBottom: 0 },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  alertCard: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  alertRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, gap: 12 },
  alertRowLast: { borderBottomWidth: 0 },
  alertDot: { width: 10, height: 10, borderRadius: 5 },
  alertInfo: { flex: 1 },
  alertHorse: { fontSize: 14, fontWeight: '600' },
  alertText: { fontSize: 13, marginTop: 2 },
  alertChevron: { fontSize: 20 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14 },
});
