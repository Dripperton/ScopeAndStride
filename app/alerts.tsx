import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Home, CheckCircle } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useProfile } from '../lib/useProfile';

interface Alert {
  horseId: number;
  horseName: string;
  message: string;
  severity: 'critical' | 'warning';
}

export default function AlertsScreen() {
  const router = useRouter();
  const { isOwner, isStaff } = useProfile();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOwner || isStaff) fetchAlerts();
    else setLoading(false);
  }, [isOwner, isStaff]);

  async function fetchAlerts() {
    const today = new Date();
    const [{ data: settings }, { data: horses }, { data: medRecords }, { data: farrierRecords }] = await Promise.all([
      supabase.from('alert_settings').select('*').eq('barn_id', 'default').single(),
      supabase.from('horses').select('id, name, alert'),
      supabase.from('medical_records').select('horse_id, type, expiry_date').eq('type', 'coggins'),
      supabase.from('farrier_records').select('horse_id, next_due').order('date', { ascending: false }),
    ]);
    const cogginsDays = settings?.coggins_days ?? 30;
    const farrierDays = settings?.farrier_days ?? 14;
    const newAlerts: Alert[] = [];
    if (!horses) { setLoading(false); return; }
    horses.forEach(horse => {
      if (horse.alert) newAlerts.push({ horseId: horse.id, horseName: horse.name, message: 'Manual alert flagged', severity: 'critical' });
    });
    if (medRecords) {
      const cogginsMap: Record<number, string> = {};
      medRecords.forEach(r => { if (r.expiry_date && !cogginsMap[r.horse_id]) cogginsMap[r.horse_id] = r.expiry_date; });
      Object.entries(cogginsMap).forEach(([horseIdStr, expiryDate]) => {
        const horseId = Number(horseIdStr);
        const horse = horses.find(h => h.id === horseId);
        if (!horse) return;
        const diff = Math.ceil((new Date(expiryDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 0) newAlerts.push({ horseId, horseName: horse.name, message: 'Coggins expired', severity: 'critical' });
        else if (diff <= cogginsDays) newAlerts.push({ horseId, horseName: horse.name, message: `Coggins expires in ${diff} day${diff === 1 ? '' : 's'}`, severity: 'warning' });
      });
    }
    if (farrierRecords) {
      const farrierMap: Record<number, string> = {};
      farrierRecords.forEach(r => { if (r.next_due && !farrierMap[r.horse_id]) farrierMap[r.horse_id] = r.next_due; });
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
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={({ hovered }: any) => [styles.homeBtn, hovered && styles.homeBtnHovered]} onPress={() => router.push('/dashboard')}>
            <Home size={18} color="#C9A85C" />
          </Pressable>
          <Text style={styles.headerTitle}>Alerts</Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 16, color: '#9A9285', textAlign: 'center', padding: 40 }}>You don't have permission to view alerts.</Text>
        </View>
      </View>
    );
  }

  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={({ hovered }: any) => [styles.homeBtn, hovered && styles.homeBtnHovered]} onPress={() => router.push('/dashboard')}>
          <Home size={18} color="#C9A85C" />
        </Pressable>
        <Text style={styles.headerTitle}>Alerts</Text>
        <View style={{ width: 48 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2C4A35" style={{ marginTop: 60 }} />
      ) : alerts.length === 0 ? (
        <View style={styles.emptyState}>
          <CheckCircle size={48} color="#7BA68A" />
          <Text style={styles.emptyTitle}>All clear</Text>
          <Text style={styles.emptyText}>No alerts right now. Check back later.</Text>
        </View>
      ) : (
        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          {criticalAlerts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Critical</Text>
              <View style={styles.alertCard}>
                {criticalAlerts.map((alert, i) => (
                  <Pressable
                    key={`c-${i}`}
                    style={({ hovered }: any) => [styles.alertRow, hovered && styles.alertRowHovered, i === criticalAlerts.length - 1 && styles.alertRowLast]}
                    onPress={() => router.push(`/horse/${alert.horseId}`)}
                  >
                    <View style={[styles.alertDot, styles.alertDotCritical]} />
                    <View style={styles.alertInfo}>
                      <Text style={styles.alertHorse}>{alert.horseName}</Text>
                      <Text style={styles.alertText}>{alert.message}</Text>
                    </View>
                    <Text style={styles.alertChevron}>›</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          {warningAlerts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Upcoming</Text>
              <View style={styles.alertCard}>
                {warningAlerts.map((alert, i) => (
                  <Pressable
                    key={`w-${i}`}
                    style={({ hovered }: any) => [styles.alertRow, hovered && styles.alertRowHovered, i === warningAlerts.length - 1 && styles.alertRowLast]}
                    onPress={() => router.push(`/horse/${alert.horseId}`)}
                  >
                    <View style={[styles.alertDot, styles.alertDotWarning]} />
                    <View style={styles.alertInfo}>
                      <Text style={styles.alertHorse}>{alert.horseName}</Text>
                      <Text style={styles.alertText}>{alert.message}</Text>
                    </View>
                    <Text style={styles.alertChevron}>›</Text>
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
  container: { flex: 1, backgroundColor: '#FAF7F2' },
  header: { backgroundColor: '#2C4A35', padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#C9A85C' },
  homeBtn: { width: 32, height: 32, backgroundColor: 'rgba(201,168,92,0.15)', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  homeBtnHovered: { backgroundColor: 'rgba(201,168,92,0.3)' },
  body: { flex: 1 },
  section: { margin: 16, marginBottom: 0 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#9A9285', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  alertCard: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 12, overflow: 'hidden' },
  alertRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F5F1EA', gap: 12 },
  alertRowHovered: { backgroundColor: '#FAF7F2' },
  alertRowLast: { borderBottomWidth: 0 },
  alertDot: { width: 10, height: 10, borderRadius: 5 },
  alertDotCritical: { backgroundColor: '#8B2E2E' },
  alertDotWarning: { backgroundColor: '#C9854A' },
  alertInfo: { flex: 1 },
  alertHorse: { fontSize: 14, fontWeight: '600', color: '#1A1A14' },
  alertText: { fontSize: 13, color: '#9A9285', marginTop: 2 },
  alertChevron: { fontSize: 20, color: '#C4BAA8' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#2C4A35' },
  emptyText: { fontSize: 14, color: '#9A9285' },
});
