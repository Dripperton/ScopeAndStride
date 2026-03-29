import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Home, ChessKnight, Calendar, DollarSign, MoreHorizontal, Settings, Users, MessageSquare } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useProfile } from '../lib/useProfile';

interface Alert {
  horseId: number;
  horseName: string;
  message: string;
  severity: 'critical' | 'warning';
}

interface AlertSettings {
  id: string;
  coggins_days: number;
  farrier_days: number;
}

function daysUntil(dateStr: string) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function Dashboard() {
  const router = useRouter();
  const { profile, loading, isOwner, isStaff, isHorseOwner } = useProfile();
  const [horseCount, setHorseCount] = useState(0);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertSettings, setAlertSettings] = useState<AlertSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [editCoggins, setEditCoggins] = useState('30');
  const [editFarrier, setEditFarrier] = useState('14');
  const [savingSettings, setSavingSettings] = useState(false);
  const [todayEventCount, setTodayEventCount] = useState(0);
  const [outstanding, setOutstanding] = useState(0);
  const [myHorse, setMyHorse] = useState<any>(null);
  const [myFarrier, setMyFarrier] = useState<any>(null);
  const [myCoggins, setMyCoggins] = useState<any>(null);

  useEffect(() => { fetchAll(); }, [profile]);

  async function fetchAll() {
    if (isHorseOwner && profile?.horse_id) {
      fetchOwnerData(profile.horse_id);
    } else {
      const [{ count }, { count: eventCount }, { data: settings }] = await Promise.all([
        supabase.from('horses').select('*', { count: 'exact', head: true }),
        supabase.from('events').select('*', { count: 'exact', head: true }).eq('date', new Date().toISOString().split('T')[0]),
        supabase.from('alert_settings').select('*').eq('barn_id', 'default').single(),
      ]);
      if (count !== null) setHorseCount(count);
      if (eventCount !== null) setTodayEventCount(eventCount);
      const { data: invoiceData } = await supabase.from('invoices').select('status, invoice_line_items(amount)').neq('status', 'paid');
      if (invoiceData) {
        const total = invoiceData.reduce((sum: number, inv: any) => sum + (inv.invoice_line_items || []).reduce((s: number, item: any) => s + Number(item.amount), 0), 0);
        setOutstanding(total);
      }
      if (settings) {
        setAlertSettings(settings);
        setEditCoggins(String(settings.coggins_days));
        setEditFarrier(String(settings.farrier_days));
        await fetchAlerts(settings.coggins_days, settings.farrier_days);
      }
    }
  }

  async function fetchOwnerData(horseId: number) {
    const [{ data: horse }, { data: farrierData }, { data: medData }] = await Promise.all([
      supabase.from('horses').select('*').eq('id', horseId).single(),
      supabase.from('farrier_records').select('*').eq('horse_id', horseId).order('date', { ascending: false }).limit(1),
      supabase.from('medical_records').select('*').eq('horse_id', horseId).eq('type', 'coggins').order('date', { ascending: false }).limit(1),
    ]);
    if (horse) setMyHorse(horse);
    if (farrierData?.[0]) setMyFarrier(farrierData[0]);
    if (medData?.[0]) setMyCoggins(medData[0]);
  }

  async function fetchAlerts(cogginsDays: number, farrierDays: number) {
    const today = new Date();
    const [{ data: horses }, { data: medRecords }, { data: farrierRecords }] = await Promise.all([
      supabase.from('horses').select('id, name, alert'),
      supabase.from('medical_records').select('horse_id, type, expiry_date').eq('type', 'coggins'),
      supabase.from('farrier_records').select('horse_id, next_due').order('date', { ascending: false }),
    ]);
    const newAlerts: Alert[] = [];
    if (!horses) return;
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
  }

  async function saveSettings() {
    if (!alertSettings) return;
    const coggins = parseInt(editCoggins) || 30;
    const farrier = parseInt(editFarrier) || 14;
    setSavingSettings(true);
    await supabase.from('alert_settings').update({ coggins_days: coggins, farrier_days: farrier }).eq('id', alertSettings.id);
    setAlertSettings(prev => prev ? { ...prev, coggins_days: coggins, farrier_days: farrier } : prev);
    setSavingSettings(false);
    setShowSettings(false);
    await fetchAlerts(coggins, farrier);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#C9A85C" />
    </View>
  );

  const roleLabel = isOwner ? 'Barn Owner' : isStaff ? 'Staff' : 'Horse Owner';
  const roleBadgeColor = isOwner ? '#C9A85C' : isStaff ? '#7BA68A' : '#9A9285';
  const farrierDue = myFarrier?.next_due ? daysUntil(myFarrier.next_due) : null;
  const cogginsExpiry = myCoggins?.expiry_date ? daysUntil(myCoggins.expiry_date) : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoMark}>
            <Text style={styles.logoS}>S</Text>
            <View style={styles.logoRule} />
            <Text style={styles.logoS}>S</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Scope & Stride</Text>
            <Text style={styles.headerBarn}>Hollow Creek</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.roleBadge, { backgroundColor: roleBadgeColor + '22', borderColor: roleBadgeColor }]}>
            <Text style={[styles.roleBadgeText, { color: roleBadgeColor }]}>{roleLabel}</Text>
          </View>
          {(isOwner || isStaff) && (
            <Pressable
              style={({ hovered }: any) => [styles.gearBtn, hovered && styles.gearBtnHovered, showSettings && styles.gearBtnActive]}
              onPress={() => setShowSettings(prev => !prev)}
            >
              <Settings size={18} color="#C9A85C" />
            </Pressable>
          )}
          <Pressable
            style={({ hovered }: any) => [styles.signOutBtn, hovered && styles.signOutBtnHovered]}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>
      </View>

      {showSettings && (
        <View style={styles.settingsPanel}>
          <Text style={styles.settingsPanelTitle}>Alert Thresholds</Text>
          <View style={styles.settingsRow}>
            <View style={styles.settingsField}>
              <Text style={styles.settingsLabel}>COGGINS WARNING (days before expiry)</Text>
              <TextInput
                style={styles.settingsInput}
                value={editCoggins}
                onChangeText={setEditCoggins}
                keyboardType="numeric"
                placeholder="30"
                placeholderTextColor="#9A9285"
              />
            </View>
            <View style={styles.settingsField}>
              <Text style={styles.settingsLabel}>FARRIER WARNING (days before due)</Text>
              <TextInput
                style={styles.settingsInput}
                value={editFarrier}
                onChangeText={setEditFarrier}
                keyboardType="numeric"
                placeholder="14"
                placeholderTextColor="#9A9285"
              />
            </View>
          </View>
          <View style={styles.settingsActions}>
            <Pressable
              style={({ hovered }: any) => [styles.settingsSaveBtn, hovered && styles.settingsSaveBtnHovered]}
              onPress={saveSettings}
              disabled={savingSettings}
            >
              {savingSettings ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.settingsSaveBtnText}>Save</Text>}
            </Pressable>
            <Pressable onPress={() => setShowSettings(false)}>
              <Text style={styles.settingsCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeText}>Good morning{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}! 🌿</Text>
          <Text style={styles.welcomeSub}>
            {isHorseOwner && myHorse
              ? `Here's the latest on ${myHorse.name} at Hollow Creek.`
              : `Here's what's happening at Hollow Creek today.`}
          </Text>
        </View>

        {/* Horse Owner Summary Card */}
        {isHorseOwner && myHorse && (
          <Pressable
            style={({ hovered }: any) => [styles.horseOwnerCard, hovered && styles.horseOwnerCardHovered]}
            onPress={() => router.push(`/horse/${myHorse.id}`)}
          >
            <View style={[styles.horseOwnerAvatar, { backgroundColor: myHorse.color || '#2C4A35' }]}>
              <Text style={styles.horseOwnerEmoji}>🐴</Text>
            </View>
            <View style={styles.horseOwnerInfo}>
              <Text style={styles.horseOwnerName}>{myHorse.name}</Text>
              <Text style={styles.horseOwnerMeta}>{myHorse.breed} · {myHorse.board_type}</Text>
              <View style={styles.horseOwnerStats}>
                {farrierDue !== null && (
                  <View style={[styles.horseOwnerBadge, farrierDue <= 0 && styles.horseOwnerBadgeDanger, farrierDue > 0 && farrierDue <= 14 && styles.horseOwnerBadgeWarning]}>
                    <Text style={styles.horseOwnerBadgeText}>
                      {farrierDue <= 0 ? 'Farrier overdue' : `Farrier in ${farrierDue}d`}
                    </Text>
                  </View>
                )}
                {cogginsExpiry !== null && cogginsExpiry <= 30 && (
                  <View style={[styles.horseOwnerBadge, cogginsExpiry <= 0 && styles.horseOwnerBadgeDanger, cogginsExpiry > 0 && styles.horseOwnerBadgeWarning]}>
                    <Text style={styles.horseOwnerBadgeText}>
                      {cogginsExpiry <= 0 ? 'Coggins expired' : `Coggins in ${cogginsExpiry}d`}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={styles.horseOwnerChevron}>›</Text>
          </Pressable>
        )}

        {isHorseOwner && !myHorse && !loading && (
          <View style={styles.noHorseCard}>
            <Text style={styles.noHorseText}>No horse linked to your account yet. Contact your barn manager.</Text>
          </View>
        )}

        {/* Barn Owner / Staff Stats */}
        {(isOwner || isStaff) && (
          <View style={styles.statsGrid}>
            <Pressable style={({ hovered }: any) => [styles.statCard, hovered && styles.statCardHovered]} onPress={() => router.push('/horses')}>
              <Text style={styles.statNumber}>{horseCount}</Text>
              <Text style={styles.statLabel}>Horses</Text>
            </Pressable>
            <Pressable
              style={({ hovered }: any) => [styles.statCard, alerts.length > 0 && styles.statCardAlert, hovered && styles.statCardHovered]}
              onPress={() => router.push('/alerts')}
            >
              <Text style={[styles.statNumber, alerts.length > 0 && styles.statNumberAlert]}>{alerts.length}</Text>
              <Text style={styles.statLabel}>Alerts</Text>
            </Pressable>
            <Pressable style={({ hovered }: any) => [styles.statCard, hovered && styles.statCardHovered]} onPress={() => router.push('/schedule')}>
              <Text style={styles.statNumber}>{todayEventCount}</Text>
              <Text style={styles.statLabel}>Today's Events</Text>
            </Pressable>
            {isOwner && (
              <Pressable style={({ hovered }: any) => [styles.statCard, hovered && styles.statCardHovered]} onPress={() => router.push("/billing")}>
                <Text style={styles.statNumber}>{'$' + outstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                <Text style={styles.statLabel}>Outstanding</Text>
              </Pressable>
            )}
          </View>
        )}

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {(isOwner || isStaff) && (
            <Pressable
              style={({ hovered }: any) => [styles.actionCard, hovered && styles.actionCardHovered]}
              onPress={() => router.push('/horses')}
            >
              <ChessKnight size={28} color="#2C4A35" />
              <Text style={styles.actionLabel}>Horses</Text>
            </Pressable>
          )}
          {isHorseOwner && myHorse && (
            <Pressable
              style={({ hovered }: any) => [styles.actionCard, hovered && styles.actionCardHovered]}
              onPress={() => router.push(`/horse/${myHorse.id}`)}
            >
              <ChessKnight size={28} color="#2C4A35" />
              <Text style={styles.actionLabel}>My Horse</Text>
            </Pressable>
          )}
          <Pressable
            style={({ hovered }: any) => [styles.actionCard, hovered && styles.actionCardHovered]}
            onPress={() => router.push('/schedule')}
          >
            <Calendar size={28} color="#2C4A35" />
            <Text style={styles.actionLabel}>Schedule</Text>
          </Pressable>
          {(isOwner || isHorseOwner) && (
            <Pressable
              style={({ hovered }: any) => [styles.actionCard, hovered && styles.actionCardHovered]}
              onPress={() => router.push('/billing')}
            >
              <DollarSign size={28} color="#2C4A35" />
              <Text style={styles.actionLabel}>Billing</Text>
            </Pressable>
          )}
          {isOwner && (
            <Pressable
              style={({ hovered }: any) => [styles.actionCard, hovered && styles.actionCardHovered]}
              onPress={() => router.push('/concierge')}
            >
              <Settings size={28} color="#2C4A35" />
              <Text style={styles.actionLabel}>Settings</Text>
            </Pressable>
          )}
          {isOwner && (
            <Pressable
              style={({ hovered }: any) => [styles.actionCard, hovered && styles.actionCardHovered]}
              onPress={() => router.push('/manage-users')}
            >
              <Users size={28} color="#2C4A35" />
              <Text style={styles.actionLabel}>Manage Users</Text>
            </Pressable>
          )}
          <Pressable
            style={({ hovered }: any) => [styles.actionCard, hovered && styles.actionCardHovered]}
            onPress={() => router.push('/board')}
          >
            <MessageSquare size={28} color="#2C4A35" />
            <Text style={styles.actionLabel}>Board</Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <View style={styles.nav}>
        <Pressable style={styles.navItem}>
          <Home size={22} color="#2C4A35" strokeWidth={2.5} />
          <Text style={[styles.navLbl, styles.navActive]}>Home</Text>
        </Pressable>
        {(isOwner || isStaff) && (
          <Pressable style={styles.navItem} onPress={() => router.push('/horses')}>
            <ChessKnight size={22} color="#9A9285" />
            <Text style={styles.navLbl}>Horses</Text>
          </Pressable>
        )}
        {isHorseOwner && myHorse && (
          <Pressable style={styles.navItem} onPress={() => router.push(`/horse/${myHorse.id}`)}>
            <ChessKnight size={22} color="#9A9285" />
            <Text style={styles.navLbl}>My Horse</Text>
          </Pressable>
        )}
        <Pressable style={styles.navItem} onPress={() => router.push('/schedule')}>
          <Calendar size={22} color="#9A9285" />
          <Text style={styles.navLbl}>Schedule</Text>
        </Pressable>
        {(isOwner || isHorseOwner) && (
          <Pressable style={styles.navItem} onPress={() => router.push('/billing')}>
            <DollarSign size={22} color="#9A9285" />
            <Text style={styles.navLbl}>Billing</Text>
          </Pressable>
        )}
        <Pressable style={styles.navItem} onPress={() => router.push('/board')}>
          <MessageSquare size={22} color="#9A9285" />
          <Text style={styles.navLbl}>Board</Text>
        </Pressable>
        {isOwner && (
          <Pressable style={styles.navItem} onPress={() => router.push('/concierge')}>
            <MoreHorizontal size={22} color="#9A9285" />
            <Text style={styles.navLbl}>More</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: '#2C4A35', alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#FAF7F2' },
  header: { backgroundColor: '#2C4A35', padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: { alignItems: 'center', gap: 1 },
  logoS: { fontSize: 12, fontWeight: '800', color: '#C9A85C', lineHeight: 13 },
  logoRule: { width: 16, height: 1.5, backgroundColor: '#C9A85C' },
  headerTitle: { fontSize: 15, fontWeight: '600', color: '#C9A85C' },
  headerBarn: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roleBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  roleBadgeText: { fontSize: 11, fontWeight: '600' },
  gearBtn: { padding: 6, borderRadius: 6 },
  gearBtnHovered: { backgroundColor: 'rgba(255,255,255,0.1)' },
  gearBtnActive: { backgroundColor: 'rgba(201,168,92,0.2)' },
  signOutBtn: { padding: 6, borderRadius: 6 },
  signOutBtnHovered: { backgroundColor: 'rgba(255,255,255,0.1)' },
  signOutText: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  settingsPanel: { backgroundColor: '#1A3A25', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  settingsPanelTitle: { fontSize: 11, fontWeight: '700', color: '#C9A85C', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  settingsRow: { flexDirection: 'row', gap: 12 },
  settingsField: { flex: 1 },
  settingsLabel: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.4)', letterSpacing: 0.8, marginBottom: 6 },
  settingsInput: { backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: 10, fontSize: 14, color: 'white', textAlign: 'center' },
  settingsActions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  settingsSaveBtn: { backgroundColor: '#C9A85C', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  settingsSaveBtnHovered: { backgroundColor: '#B08C4A' },
  settingsSaveBtnText: { color: '#1A1A14', fontSize: 13, fontWeight: '700' },
  settingsCancelText: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  body: { flex: 1, padding: 16 },
  welcomeCard: { backgroundColor: '#2C4A35', borderRadius: 14, padding: 20, marginBottom: 16 },
  welcomeText: { fontSize: 18, fontWeight: '700', color: '#C9A85C', marginBottom: 4 },
  welcomeSub: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  horseOwnerCard: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 14, padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  horseOwnerCardHovered: { backgroundColor: '#F5F1EA', borderColor: '#C9A85C' },
  horseOwnerAvatar: { width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  horseOwnerEmoji: { fontSize: 28 },
  horseOwnerInfo: { flex: 1 },
  horseOwnerName: { fontSize: 18, fontWeight: '700', color: '#1A1A14', fontStyle: 'italic', marginBottom: 2 },
  horseOwnerMeta: { fontSize: 12, color: '#9A9285', marginBottom: 8 },
  horseOwnerStats: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  horseOwnerBadge: { backgroundColor: '#EDF5EF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  horseOwnerBadgeDanger: { backgroundColor: '#FDECEA' },
  horseOwnerBadgeWarning: { backgroundColor: '#FEF6E4' },
  horseOwnerBadgeText: { fontSize: 11, color: '#2C4A35', fontWeight: '500' },
  horseOwnerChevron: { fontSize: 22, color: '#C4BAA8' },
  noHorseCard: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 14, padding: 20, marginBottom: 16, alignItems: 'center' },
  noHorseText: { fontSize: 13, color: '#9A9285', textAlign: 'center', fontStyle: 'italic' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 12, padding: 16, flex: 1, minWidth: 80, alignItems: 'center' },
  statCardAlert: { borderColor: '#C9854A', backgroundColor: '#FFF8F0' },
  statCardHovered: { backgroundColor: '#F5F1EA', borderColor: '#C9A85C' },
  statNumber: { fontSize: 22, fontWeight: '700', color: '#2C4A35' },
  statNumberAlert: { color: '#C9854A' },
  statLabel: { fontSize: 11, color: '#9A9285', marginTop: 2 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#9A9285', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 4 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  actionCard: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 12, padding: 16, alignItems: 'center', gap: 8, minWidth: 80, flex: 1 },
  actionCardHovered: { backgroundColor: '#F5F1EA', borderColor: '#C9A85C' },
  actionLabel: { fontSize: 11, color: '#3A3830', fontWeight: '500', textAlign: 'center' },
  nav: { backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#E8E0CC', flexDirection: 'row', paddingBottom: 20, paddingTop: 8 },
  navItem: { flex: 1, alignItems: 'center', gap: 2 },
  navLbl: { fontSize: 9, color: '#9A9285' },
  navActive: { color: '#2C4A35', fontWeight: '600' },
});
