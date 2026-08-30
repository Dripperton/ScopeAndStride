import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ChessKnight,
  Calendar,
  DollarSign,
  Settings,
  Users,
  MessageSquare,
  CalendarCheck,
  ClipboardList,
  LogOut,
  Bell,
  ChevronRight,
  ChevronDown,
  LayoutGrid,
  Globe,
  X,
  Sparkles,
  SlidersHorizontal,
  RotateCcw,
  Building2,
  CalendarDays,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useProfile } from '../lib/useProfile';
import { useLanguage } from '../lib/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import Brand from '../constants/brand';
import { daysUntil } from '../lib/dateUtils';
import BrandLogo from '../lib/BrandLogo';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ─────────────────────────────────────────────────────────────────────

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

type WidgetId =
  | 'stats' | 'digest' | 'alerts' | 'upcoming_events'
  | 'qa_horses' | 'qa_schedule' | 'qa_billing' | 'qa_board'
  | 'qa_daily_care' | 'qa_service_log' | 'qa_manage_users' | 'qa_concierge'
  | 'qa_my_horse';

interface Widget {
  id: WidgetId;
  label: string;
  visible: boolean;
  section?: 'dashboard' | 'quick_action';
}

const DEFAULT_OWNER_WIDGETS: Widget[] = [
  { id: 'stats', label: 'Stats Overview', visible: true, section: 'dashboard' },
  { id: 'digest', label: "Today's Briefing", visible: true, section: 'dashboard' },
  { id: 'upcoming_events', label: 'Upcoming Events', visible: true, section: 'dashboard' },
  { id: 'qa_horses', label: 'Horses', visible: true, section: 'quick_action' },
  { id: 'qa_schedule', label: 'Schedule', visible: true, section: 'quick_action' },
  { id: 'qa_billing', label: 'Billing', visible: true, section: 'quick_action' },
  { id: 'qa_board', label: 'Community Board', visible: true, section: 'quick_action' },
  { id: 'qa_daily_care', label: 'Daily Care', visible: true, section: 'quick_action' },
  { id: 'qa_service_log', label: 'Service Log', visible: true, section: 'quick_action' },
  { id: 'qa_manage_users', label: 'Manage Users', visible: true, section: 'quick_action' },
  { id: 'qa_concierge', label: 'Concierge', visible: true, section: 'quick_action' },
];

const DEFAULT_HORSE_OWNER_WIDGETS: Widget[] = [
  { id: 'digest', label: "Today's Briefing", visible: true, section: 'dashboard' },
  { id: 'upcoming_events', label: 'Upcoming Events', visible: false, section: 'dashboard' },
  { id: 'qa_my_horse', label: 'My Horse', visible: true, section: 'quick_action' },
  { id: 'qa_schedule', label: 'Schedule', visible: true, section: 'quick_action' },
  { id: 'qa_billing', label: 'Billing', visible: true, section: 'quick_action' },
  { id: 'qa_board', label: 'Community Board', visible: true, section: 'quick_action' },
  { id: 'qa_daily_care', label: 'Daily Care', visible: true, section: 'quick_action' },
];

const WIDGET_STORAGE_KEY = 'dashboard_widgets_v1';

// ── Helpers ───────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const { profile, loading, profileLoadError, isOwner, isStaff, isHorseOwner, horseLinks, primaryHorse, refresh } = useProfile();
  const { language, t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;

  // ── Barn owner / staff state
  const [horseCount, setHorseCount] = useState(0);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertSettings, setAlertSettings] = useState<AlertSettings | null>(null);
  const [todayEventCount, setTodayEventCount] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [outstanding, setOutstanding] = useState(0);
  const [boardBadgeCount, setBoardBadgeCount] = useState(0);
  const [qbConnected, setQbConnected] = useState(false);
  const [qbConnecting, setQbConnecting] = useState(false);

  // ── Settings panel state
  const [showSettings, setShowSettings] = useState(false);
  const [editCoggins, setEditCoggins] = useState('30');
  const [editFarrier, setEditFarrier] = useState('14');
  const [savingSettings, setSavingSettings] = useState(false);

  // ── Horse owner state
  const [selectedHorseId, setSelectedHorseId] = useState<number | null>(null);
  const [myHorse, setMyHorse] = useState<any>(null);
  const [myFarrier, setMyFarrier] = useState<any>(null);
  const [myBalance, setMyBalance] = useState<number>(0);

  // ── Digest state
  const [digest, setDigest] = useState<string | null>(null);
  const [digestGeneratedAt, setDigestGeneratedAt] = useState<string | null>(null);
  const [digestLoading, setDigestLoading] = useState(false);

  // ── Widget system
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [showWidgetSheet, setShowWidgetSheet] = useState(false);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  // ── Load widget preferences
  useEffect(() => {
    async function loadWidgets() {
      const defaultWidgets = isHorseOwner ? DEFAULT_HORSE_OWNER_WIDGETS : DEFAULT_OWNER_WIDGETS;
      try {
        const key = `${WIDGET_STORAGE_KEY}_${isHorseOwner ? 'horse_owner' : 'staff'}`;
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
          const parsed: Widget[] = JSON.parse(stored);
          // Merge stored visibility with current default list (handles new widgets added later)
          const merged = defaultWidgets.map(w => ({
            ...w,
            visible: parsed.find(p => p.id === w.id)?.visible ?? w.visible,
          }));
          setWidgets(merged);
        } else {
          setWidgets(defaultWidgets);
        }
      } catch {
        setWidgets(defaultWidgets);
      }
    }
    if (!loading) loadWidgets();
  }, [loading, isHorseOwner]);

  // ── Save widget preferences when changed
  async function saveWidgets(updated: Widget[]) {
    const key = `${WIDGET_STORAGE_KEY}_${isHorseOwner ? 'horse_owner' : 'staff'}`;
    await AsyncStorage.setItem(key, JSON.stringify(updated));
    setWidgets(updated);
  }

  // ── Bottom sheet animation
  function openWidgetSheet() {
    setShowWidgetSheet(true);
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }).start();
  }
  function closeWidgetSheet() {
    Animated.timing(sheetAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setShowWidgetSheet(false));
  }

  // ── Digest fetching
  async function fetchDigest(forceRefresh = false) {
    if (!profile) return;
    setDigestLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-digest', {
        body: {
          userId: profile.id,
          role: profile.role,
          horseIds: horseLinks.map(l => l.horse_id),
          forceRefresh,
          language,
        },
      });
      if (data?.digest) {
        setDigest(data.digest);
        setDigestGeneratedAt(data.generated_at);
      }
    } catch (err) {
      console.error('Digest fetch error:', err);
    } finally {
      setDigestLoading(false);
    }
  }

  // ── Data fetching
  useEffect(() => {
    if (!profile) return;
    if (isHorseOwner) {
      const id = selectedHorseId ?? primaryHorse?.id ?? null;
      if (id) fetchOwnerData(id);
    } else {
      fetchBarnData();
    }
    fetchBoardBadge();
    fetchDigest();
  }, [profile, selectedHorseId]);

  useEffect(() => {
    if (isOwner && profile?.id) fetchQbStatus();
  }, [isOwner, profile?.id]);

  // Initialize selectedHorseId from primaryHorse
  useEffect(() => {
    if (isHorseOwner && primaryHorse?.id && !selectedHorseId) {
      setSelectedHorseId(primaryHorse.id);
    }
  }, [primaryHorse]);

  async function fetchBarnData() {
    const [{ count }, { count: eventCount }, { data: settings }, { data: events }, { data: invoiceData }, { data: alertHorses }, { data: farrierVisits }] = await Promise.all([
      supabase.from('horses').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }).eq('date', new Date().toISOString().split('T')[0]),
      supabase.from('alert_settings').select('*').eq('barn_id', 'default').single(),
      supabase.from('events').select('id, title, date, time').gte('date', new Date().toISOString().split('T')[0]).order('date').order('time').limit(5),
      supabase.from('invoices').select('status, invoice_line_items(amount)').neq('status', 'paid'),
      supabase.from('horses').select('id, name, alert, coggins_expiry_date'),
      supabase.from('service_visits').select('horse_id, next_appointment_date').eq('service_type', 'farrier').not('next_appointment_date', 'is', null).order('date', { ascending: false }),
    ]);

    if (count !== null) setHorseCount(count);
    if (eventCount !== null) setTodayEventCount(eventCount);
    if (events) setUpcomingEvents(events);

    if (invoiceData) {
      const total = invoiceData.reduce((sum: number, inv: any) =>
        sum + (inv.invoice_line_items || []).reduce((s: number, item: any) => s + Number(item.amount), 0), 0);
      setOutstanding(total);
    }

    if (settings) {
      setAlertSettings(settings);
      setEditCoggins(String(settings.coggins_days));
      setEditFarrier(String(settings.farrier_days));
      computeAndSetAlerts(settings.coggins_days, settings.farrier_days, alertHorses, farrierVisits);
    }
  }

  function computeAndSetAlerts(cogginsDays: number, farrierDays: number, horses: any[] | null, farrierVisits: any[] | null) {
    const today = new Date();
    const newAlerts: Alert[] = [];
    if (!horses) return;
    horses.forEach(horse => {
      if (horse.alert) newAlerts.push({ horseId: horse.id, horseName: horse.name, message: t('Manual alert flagged'), severity: 'critical' });
      if (horse.coggins_expiry_date) {
        const diff = Math.ceil((new Date(horse.coggins_expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 0) newAlerts.push({ horseId: horse.id, horseName: horse.name, message: t('Coggins expired'), severity: 'critical' });
        else if (diff <= cogginsDays) newAlerts.push({ horseId: horse.id, horseName: horse.name, message: t('Coggins expires in {count} days', { count: diff }), severity: 'warning' });
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
        if (diff <= 0) newAlerts.push({ horseId, horseName: horse.name, message: t('Farrier overdue'), severity: 'critical' });
        else if (diff <= farrierDays) newAlerts.push({ horseId, horseName: horse.name, message: t('Farrier due in {count} days', { count: diff }), severity: 'warning' });
      });
    }
    setAlerts(newAlerts);
  }

  async function fetchAlerts(cogginsDays: number, farrierDays: number) {
    const [{ data: horses }, { data: farrierVisits }] = await Promise.all([
      supabase.from('horses').select('id, name, alert, coggins_expiry_date'),
      supabase.from('service_visits').select('horse_id, next_appointment_date').eq('service_type', 'farrier').not('next_appointment_date', 'is', null).order('date', { ascending: false }),
    ]);
    computeAndSetAlerts(cogginsDays, farrierDays, horses, farrierVisits);
  }

  async function fetchOwnerData(horseId: number) {
    const [{ data: horse }, { data: farrierData }, { data: invoiceData }] = await Promise.all([
      supabase.from('horses').select('*').eq('id', horseId).single(),
      supabase.from('service_visits').select('*').eq('horse_id', horseId).eq('service_type', 'farrier').not('next_appointment_date', 'is', null).order('date', { ascending: false }).limit(1),
      supabase.from('invoices').select('status, invoice_line_items(amount)').eq('horse_id', horseId).neq('status', 'paid'),
    ]);
    if (horse) setMyHorse(horse);
    if (farrierData?.[0]) setMyFarrier(farrierData[0]);
    if (invoiceData) {
      const total = invoiceData.reduce((sum: number, inv: any) =>
        sum + (inv.invoice_line_items || []).reduce((s: number, item: any) => s + Number(item.amount), 0), 0);
      setMyBalance(total);
    }
  }

  async function fetchQbStatus() {
    const { data } = await supabase.from('barn_integrations').select('id').eq('user_id', profile!.id).eq('provider', 'quickbooks').single();
    setQbConnected(!!data);
  }

  async function fetchBoardBadge() {
    const lastSeen = await AsyncStorage.getItem('last_seen_board');
    let query = supabase.from('posts').select('id', { count: 'exact', head: true });
    if (lastSeen) query = query.gt('created_at', lastSeen);
    const { count } = await query;
    setBoardBadgeCount(count || 0);
  }

  async function handleConnectQB() {
    if (!profile?.id) return;
    setQbConnecting(true);
    const { data, error } = await supabase.functions.invoke('quickbooks-oauth-connect', { body: { userId: profile.id } });
    setQbConnecting(false);
    if (error || !data?.url) { alert('Could not start QuickBooks connection.'); return; }
    const { Linking } = await import('react-native');
    Linking.openURL(data.url);
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

  // ── Render guards
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: C.primary }]}>
        <ActivityIndicator size="large" color={C.secondary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: C.background, padding: 32 }]}>
        <Text style={{ color: C.text, fontSize: 15, fontWeight: '600', marginBottom: 8, textAlign: 'center' }}>
          Could not load your profile
        </Text>
        {profileLoadError && (
          <Text style={{ color: C.textMuted, fontSize: 11, fontFamily: 'monospace', textAlign: 'center', marginBottom: 16, lineHeight: 16 }}>
            {profileLoadError}
          </Text>
        )}
        <Pressable
          onPress={refresh}
          style={{ backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12, marginBottom: 10 }}
        >
          <Text style={{ color: 'white', fontWeight: '600' }}>Retry</Text>
        </Pressable>
        <Pressable onPress={() => supabase.auth.signOut()}>
          <Text style={{ color: C.textMuted, fontSize: 13 }}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  const farrierDue = myFarrier?.next_appointment_date ? daysUntil(myFarrier.next_appointment_date) : null;
  const cogginsExpiry = myHorse?.coggins_expiry_date ? daysUntil(myHorse.coggins_expiry_date) : null;
  const isWidget = (id: WidgetId) => widgets.find(w => w.id === id)?.visible ?? true;

  // ── Shared header
  const Header = (
    <View style={[styles.header, { backgroundColor: C.primary }]}>
      <View style={styles.headerLeft}>
        <BrandLogo context="header" />
        <View>
          <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{Brand.appName}</Text>
          <Text style={[styles.headerBarn, { color: 'rgba(255,255,255,0.4)' }]}>{Brand.barnName}</Text>
        </View>
      </View>
      <View style={styles.headerRight}>
        {(isOwner || isStaff) && (
          <Pressable
            style={({ hovered }: any) => [styles.iconBtn, hovered && styles.iconBtnHovered, showSettings && { backgroundColor: C.secondaryAlpha20 }]}
            onPress={() => setShowSettings(prev => !prev)}
          >
            <Settings size={20} color={C.secondary} />
          </Pressable>
        )}
        <Pressable
          style={({ hovered }: any) => [styles.iconBtn, hovered && styles.iconBtnHovered]}
          onPress={handleSignOut}
        >
          <LogOut size={20} color="rgba(255,255,255,0.45)" />
        </Pressable>
      </View>
    </View>
  );

  // ── Settings panel (owner/staff only)
  const SettingsPanel = showSettings && (isOwner || isStaff) ? (
    <View style={[styles.settingsPanel, { backgroundColor: C.primaryDark }]}>
      <Text style={[styles.settingsPanelTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Alert Thresholds')}</Text>
      <View style={styles.settingsRow}>
        <View style={styles.settingsField}>
          <Text style={styles.settingsLabel}>{t('Coggins alert (days)').toUpperCase()}</Text>
          <TextInput
            style={styles.settingsInput}
            value={editCoggins}
            onChangeText={setEditCoggins}
            keyboardType="numeric"
            placeholder="30"
            placeholderTextColor="rgba(255,255,255,0.3)"
          />
        </View>
        <View style={styles.settingsField}>
          <Text style={styles.settingsLabel}>{t('Farrier alert (days)').toUpperCase()}</Text>
          <TextInput
            style={styles.settingsInput}
            value={editFarrier}
            onChangeText={setEditFarrier}
            keyboardType="numeric"
            placeholder="14"
            placeholderTextColor="rgba(255,255,255,0.3)"
          />
        </View>
      </View>
      <View style={styles.settingsActions}>
        <Pressable
          style={({ hovered }: any) => [styles.settingsSaveBtn, { backgroundColor: hovered ? C.secondaryDark : C.secondary }]}
          onPress={saveSettings}
          disabled={savingSettings}
        >
          {savingSettings
            ? <ActivityIndicator color="white" size="small" />
            : <Text style={[styles.settingsSaveBtnText, { fontFamily: F.sansBold }]}>{t('Save')}</Text>}
        </Pressable>
        <Pressable onPress={() => setShowSettings(false)}>
          <Text style={styles.settingsCancelText}>{t('Cancel')}</Text>
        </Pressable>
      </View>

      {isOwner && (
        <>
          <View style={styles.settingsDivider} />
          <Text style={[styles.settingsPanelTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Integrations')}</Text>
          <View style={styles.qbRow}>
            <View>
              <Text style={[styles.qbLabel, { color: C.headerText }]}>QuickBooks Online</Text>
              <Text style={styles.qbStatus}>{qbConnected ? t('Connected — invoices sync automatically') : t('Not connected')}</Text>
            </View>
            {qbConnected ? (
              <View style={styles.qbConnectedBadge}>
                <Text style={styles.qbConnectedText}>{t('Connected')}</Text>
              </View>
            ) : (
              <Pressable
                style={({ hovered }: any) => [styles.qbConnectBtn, { backgroundColor: hovered ? C.secondaryAlpha30 : C.secondaryAlpha15 }]}
                onPress={handleConnectQB}
                disabled={qbConnecting}
              >
                {qbConnecting
                  ? <ActivityIndicator color={C.secondary} size="small" />
                  : <Text style={[styles.qbConnectBtnText, { color: C.secondary, fontFamily: F.sansMedium }]}>{t('Connect')}</Text>}
              </Pressable>
            )}
          </View>
        </>
      )}

      {/* Language — shown for all roles that can open settings */}
      <View style={styles.settingsDivider} />
      <LanguageSettingRow C={C} F={F} t={t} language={language} profile={profile} />
    </View>
  ) : null;

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {Header}
      {SettingsPanel}

      {/* ── Static Concierge bar — always visible above scroll */}
      {(isOwner || isStaff) && (
        <ConciergeBar C={C} F={F} t={t} onPress={() => router.push('/concierge')} />
      )}

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

        {/* ═══════════════════════════════════════════════════════════════════
            BARN OWNER / STAFF LAYOUT
        ═══════════════════════════════════════════════════════════════════ */}
        {(isOwner || isStaff) && (
          <>
            {/* Unified navigation grid — merged stats + quick actions */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t(greeting())}{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</Text>
                <Pressable
                  style={({ hovered }: any) => [styles.customizeBtn, hovered && { backgroundColor: C.activeBg }]}
                  onPress={openWidgetSheet}
                >
                  <SlidersHorizontal size={12} color={C.secondary} />
                  <Text style={[styles.customizeBtnText, { color: C.secondary, fontFamily: F.sansMedium }]}>{t('Customize')}</Text>
                </Pressable>
              </View>
              <View style={[styles.sectionCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                <View style={styles.actionsGrid}>
                  {isWidget('qa_horses') && (
                    <ActionTile icon={<ChessKnight size={28} color="white" />} label={t('Horses')} badge={false} badgeCount={horseCount || undefined} onPress={() => router.push('/horses')} C={C} />
                  )}
                  {isWidget('qa_schedule') && (
                    <ActionTile icon={<Calendar size={28} color="white" />} label={t('Calendar')} badgeCount={todayEventCount || undefined} onPress={() => router.push('/schedule')} C={C} />
)}
                  <ActionTile icon={<CalendarDays size={28} color="white" />} label={t('Lessons')} onPress={() => router.push('/scheduling')} C={C} />
                  {isOwner && isWidget('qa_billing') && (
                    <ActionTile icon={<DollarSign size={28} color="white" />} label={t('Billing')} badgeCount={outstanding > 0 ? Math.round(outstanding) : undefined} onPress={() => router.push('/billing')} C={C} />
                  )}
                  <ActionTile
                    icon={<Bell size={28} color="white" />}
                    label={t('Alerts')}
                    badge={alerts.length > 0}
                    badgeCount={alerts.length || undefined}
                    onPress={() => router.push('/alerts')}
                    C={C}
                  />
                  {isWidget('qa_board') && (
                    <ActionTile
                      icon={<MessageSquare size={28} color="white" />}
                      label={t('Community Board')}
                      badgeCount={boardBadgeCount || undefined}
                      badgeColor="error"
                      onPress={() => {
                        setBoardBadgeCount(0);
                        const now = new Date().toISOString();
                        AsyncStorage.setItem('last_seen_board', now);
                        router.push('/board');
                      }}
                      C={C}
                    />
                  )}
                  {isWidget('qa_daily_care') && (
                    <ActionTile icon={<CalendarCheck size={28} color="white" />} label={t('Daily Care')} onPress={() => router.push('/daily-care')} C={C} />
                  )}
                  {isWidget('qa_service_log') && (
                    <ActionTile icon={<ClipboardList size={28} color="white" />} label={t('Service Log')} onPress={() => router.push('/service-log')} C={C} />
                  )}
                  {isOwner && isWidget('qa_manage_users') && (
                    <ActionTile icon={<Users size={28} color="white" />} label={t('Manage Users')} onPress={() => router.push('/manage-users')} C={C} />
                  )}
                  {isOwner && (
                    <ActionTile icon={<Building2 size={28} color="white" />} label={t('Barn Settings')} onPress={() => router.push('/barn-settings')} C={C} />
                  )}
                </View>
              </View>
            </View>

            {/* Widget: Today's Briefing — collapsible */}
            {isWidget('digest') && (
              <DigestCard
                digest={digest}
                generatedAt={digestGeneratedAt}
                loading={digestLoading}
                onRefresh={() => fetchDigest(true)}
                C={C} F={F} t={t}
              />
            )}

            {/* Widget: Upcoming Events — collapsible */}
            {isWidget('upcoming_events') && upcomingEvents.length > 0 && (
              <CollapsibleSection title={t('Upcoming Events')} icon={<Calendar size={14} color={C.textMuted} />} C={C} F={F}>
                {upcomingEvents.map((event) => (
                  <View key={event.id} style={styles.eventRow}>
                    <View style={[styles.eventDateBadge, { backgroundColor: C.secondaryAlpha10 }]}>
                      <Text style={[styles.eventDateText, { color: C.secondary, fontFamily: F.sansBold }]}>
                        {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                    <View style={styles.eventInfo}>
                      <Text style={[styles.eventTitle, { color: C.text, fontFamily: F.sansMedium }]}>{event.title}</Text>
                      {event.time && <Text style={[styles.eventTime, { color: C.textMuted }]}>{event.time}</Text>}
                    </View>
                  </View>
                ))}
                <Pressable onPress={() => router.push('/schedule')} style={styles.seeAllBtn}>
                  <Text style={[styles.seeAllText, { color: C.secondary }]}>{t('View full schedule')}</Text>
                </Pressable>
              </CollapsibleSection>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            HORSE OWNER LAYOUT
        ═══════════════════════════════════════════════════════════════════ */}
        {isHorseOwner && (
          <>
            {/* Multi-horse selector */}
            {horseLinks.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horseSelectorScroll} contentContainerStyle={styles.horseSelectorContent}>
                {horseLinks.filter(l => l.horses).map(link => (
                  <Pressable
                    key={link.horse_id}
                    style={[
                      styles.horseSelectorChip,
                      { borderColor: selectedHorseId === link.horse_id ? C.secondary : C.cardBorder },
                      selectedHorseId === link.horse_id && { backgroundColor: C.secondaryAlpha10 },
                    ]}
                    onPress={() => setSelectedHorseId(link.horse_id)}
                  >
                    <View style={[styles.horseSelectorDot, { backgroundColor: link.horses?.color || C.primary }]} />
                    <Text style={[
                      styles.horseSelectorLabel,
                      { color: selectedHorseId === link.horse_id ? C.secondary : C.text, fontFamily: selectedHorseId === link.horse_id ? F.sansBold : F.sans },
                    ]}>
                      {link.horses?.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* Horse summary card */}
            {myHorse ? (
              <Pressable
                style={({ hovered }: any) => [styles.horseCard, { backgroundColor: C.card, borderColor: hovered ? C.secondary : C.cardBorder }]}
                onPress={() => router.push(`/horse/${myHorse.id}`)}
              >
                <View style={[styles.horseAvatar, { backgroundColor: myHorse.color || C.primary }]}>
                  <Text style={styles.horseEmoji}>🐴</Text>
                </View>
                <View style={styles.horseInfo}>
                  <Text style={[styles.horseName, { color: C.text, fontFamily: F.serif }]}>{myHorse.name}</Text>
                  <Text style={[styles.horseMeta, { color: C.textMuted, fontFamily: F.sans }]}>
                    {[myHorse.breed, myHorse.board_type].filter(Boolean).join(' · ')}
                  </Text>
                  <View style={styles.horseBadges}>
                    {farrierDue !== null && (
                      <View style={[styles.badge, farrierDue <= 0 ? { backgroundColor: C.errorBg } : farrierDue <= 14 ? { backgroundColor: C.warningBg } : { backgroundColor: C.activeBg }]}>
                        <Text style={[styles.badgeText, { color: farrierDue <= 0 ? C.error : farrierDue <= 14 ? C.warning : C.secondary }]}>
                          {farrierDue <= 0 ? t('Farrier overdue') : t('Farrier in {count}d', { count: farrierDue })}
                        </Text>
                      </View>
                    )}
                    {cogginsExpiry !== null && cogginsExpiry <= 30 && (
                      <View style={[styles.badge, cogginsExpiry <= 0 ? { backgroundColor: C.errorBg } : { backgroundColor: C.warningBg }]}>
                        <Text style={[styles.badgeText, { color: cogginsExpiry <= 0 ? C.error : C.warning }]}>
                          {cogginsExpiry <= 0 ? t('Coggins expired') : t('Coggins in {count}d', { count: cogginsExpiry })}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <ChevronRight size={18} color={C.textMuted} />
              </Pressable>
            ) : (
              <View style={[styles.noHorseCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                <Text style={[styles.noHorseText, { color: C.textMuted, fontFamily: F.sans }]}>
                  {t('No horse linked to your account yet. Contact your barn manager.')}
                </Text>
              </View>
            )}

            {/* ── Concierge bar */}
            <Pressable
              style={({ hovered }: any) => [
                styles.digestCard,
                { backgroundColor: C.card, borderColor: hovered ? C.secondary : C.cardBorder, flexDirection: 'row', alignItems: 'center', gap: 10 },
                hovered && styles.conciergeBarHovered,
              ]}
              onPress={() => router.push('/concierge')}
            >
              <View style={[styles.conciergeIcon, { backgroundColor: C.secondary }]}>
                <Sparkles size={14} color="white" />
              </View>
              <View style={[styles.conciergeInput, { backgroundColor: C.background, borderColor: C.cardBorder }]}>
                <Text style={[styles.conciergePlaceholder, { color: C.textMuted, fontFamily: F.sans }]}>
                  {t('Ask')} <Text style={{ color: C.secondary, fontFamily: F.sansMedium }}>{t('Concierge')}</Text> {t('anything...')}
                </Text>
              </View>
              <View style={[styles.conciergePill, { backgroundColor: C.secondary }]}>
                <Text style={[styles.conciergePillText, { fontFamily: F.sansBold }]}>AI</Text>
              </View>
            </Pressable>

            {/* Widget: Today's Briefing */}
            {isWidget('digest') && (
              <DigestCard
                digest={digest}
                generatedAt={digestGeneratedAt}
                loading={digestLoading}
                onRefresh={() => fetchDigest(true)}
                C={C} F={F} t={t}
              />
            )}

            {/* Balance card */}
            {myBalance > 0 && (
              <Pressable
                style={({ hovered }: any) => [styles.balanceCard, { backgroundColor: hovered ? C.activeBg : C.card, borderColor: C.cardBorder }]}
                onPress={() => router.push('/billing')}
              >
                <DollarSign size={18} color={C.secondary} />
                <Text style={[styles.balanceText, { color: C.text, fontFamily: F.sansMedium }]}>
                  {t('Outstanding balance')}: <Text style={[styles.balanceAmount, { color: C.secondary, fontFamily: F.sansBold }]}>
                    ${myBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                </Text>
                <ChevronRight size={14} color={C.textMuted} />
              </Pressable>
            )}

            {/* Quick Actions — individually toggleable */}
            {myHorse && widgets.some(w => w.section === 'quick_action' && w.visible) && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Quick Actions')}</Text>
                  <Pressable
                    style={({ hovered }: any) => [styles.customizeBtn, hovered && { backgroundColor: C.activeBg }]}
                    onPress={openWidgetSheet}
                  >
                    <SlidersHorizontal size={12} color={C.secondary} />
                    <Text style={[styles.customizeBtnText, { color: C.secondary, fontFamily: F.sansMedium }]}>{t('Customize')}</Text>
                  </Pressable>
                </View>
                <View style={[styles.sectionCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                  <View style={styles.actionsGrid}>
                    {isWidget('qa_my_horse') && (
                      <ActionTile icon={<ChessKnight size={28} color="white" />} label={t('My Horse')} onPress={() => router.push(`/horse/${myHorse.id}`)} C={C} />
                    )}
                    {isWidget('qa_schedule') && (
                      <ActionTile icon={<Calendar size={28} color="white" />} label={t('Calendar')} onPress={() => router.push('/schedule')} C={C} />
                    )}
                    <ActionTile icon={<CalendarDays size={28} color="white" />} label={t('Lessons')} onPress={() => router.push('/scheduling')} C={C} />
                    {isWidget('qa_billing') && (
                      <ActionTile icon={<DollarSign size={28} color="white" />} label={t('Billing')} onPress={() => router.push('/billing')} C={C} />
                    )}
                    {isWidget('qa_board') && (
                      <ActionTile
                        icon={<MessageSquare size={28} color="white" />}
                        label={t('Community Board')}
                        badgeCount={boardBadgeCount || undefined}
                        badgeColor="error"
                        onPress={() => {
                          setBoardBadgeCount(0);
                          const now = new Date().toISOString();
                          AsyncStorage.setItem('last_seen_board', now);
                          router.push('/board');
                        }}
                        C={C}
                      />
                    )}
                    {isWidget('qa_daily_care') && (
                      <ActionTile
                        icon={<CalendarCheck size={28} color="white" />}
                        label={t('Daily Care')}
                        onPress={() => router.push({ pathname: '/horse/daily-care/view', params: { horseId: myHorse.id, horseName: myHorse.name } })}
                        C={C}
                      />
                    )}
                  </View>
                </View>
              </View>
            )}
          </>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>

      {/* ── Customize Widgets Bottom Sheet */}
      <WidgetSheet
        visible={showWidgetSheet}
        widgets={widgets}
        onClose={closeWidgetSheet}
        onSave={saveWidgets}
        sheetAnim={sheetAnim}
        C={C}
        F={F}
        t={t}
        language={language}
        profile={profile}
      />
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RoleChip({ isOwner, isStaff, isHorseOwner, C, F, t }: any) {
  const label = isOwner ? t('Barn Owner') : isStaff ? t('Staff') : t('Horse Owner');
  const bg = isOwner ? C.secondaryAlpha20 : isStaff ? 'rgba(76,175,80,0.18)' : 'rgba(255,255,255,0.1)';
  const color = isOwner ? C.secondary : isStaff ? '#66BB6A' : 'rgba(255,255,255,0.6)';
  return (
    <View style={[styles.roleChip, { backgroundColor: bg }]}>
      <Text style={[styles.roleChipText, { color, fontFamily: F.sansBold }]}>{label}</Text>
    </View>
  );
}

function SectionBlock({ title, icon, children, C, F }: any) {
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {icon}
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{title}</Text>
        </View>
      </View>
      <View style={[styles.sectionCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
        {children}
      </View>
    </View>
  );
}

function StatCard({ value, label, onPress, alert, C, F }: any) {
  return (
    <Pressable
      style={({ hovered }: any) => [
        styles.statCard,
        { backgroundColor: alert ? '#FFF8F0' : C.card, borderColor: alert ? C.warning : C.cardBorder },
        hovered && { backgroundColor: C.cardSeparator, borderColor: C.secondary },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.statNumber, { color: alert ? C.warning : C.primary, fontFamily: F.sansBold }]} adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: C.textMuted, fontFamily: F.sans }]} adjustsFontSizeToFit numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function DigestCard({ digest, generatedAt, loading, onRefresh, C, F, t }: any) {
  const [open, setOpen] = useState(false);

  if (loading && !digest) {
    return (
      <View style={[styles.digestCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
        <View style={styles.digestHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} color={C.secondary} />
            <Text style={[styles.digestTitle, { color: C.text, fontFamily: F.sansBold }]}>
              {t("Today's Briefing")}
            </Text>
          </View>
        </View>
        <ActivityIndicator color={C.secondary} style={{ marginVertical: 12 }} />
      </View>
    );
  }

  if (!digest) return null;

  return (
    <View style={[styles.digestCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
      <Pressable style={styles.digestHeader} onPress={() => setOpen(prev => !prev)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Sparkles size={14} color={C.secondary} />
          <Text style={[styles.digestTitle, { color: C.text, fontFamily: F.sansBold }]}>
            {t("Today's Briefing")}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={(e) => { e.stopPropagation(); onRefresh(); }}
            disabled={loading}
            style={({ hovered }: any) => [styles.digestRefresh, hovered && { backgroundColor: C.activeBg }]}
          >
            {loading
              ? <ActivityIndicator size="small" color={C.secondary} />
              : <RotateCcw size={13} color={C.secondary} />}
          </Pressable>
          <ChevronDown
            size={14}
            color={C.textMuted}
            style={open ? { transform: [{ rotate: '180deg' }] } : undefined}
          />
        </View>
      </Pressable>

      {open && (
        <>
          <Text style={[styles.digestText, { color: C.text, fontFamily: F.sans }]}>
            {digest}
          </Text>
          {generatedAt && (
            <Text style={[styles.digestTimestamp, { color: C.textMuted, fontFamily: F.sans }]}>
              {t('Generated')} {new Date(generatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

function ConciergeBar({ C, F, t, onPress }: any) {
  return (
    <Pressable
      style={({ hovered }: any) => [
        styles.conciergeBar,
        { backgroundColor: C.card, borderColor: hovered ? C.secondary : C.cardBorder },
        hovered && styles.conciergeBarHovered,
      ]}
      onPress={onPress}
    >
      <View style={[styles.conciergeIcon, { backgroundColor: C.secondary }]}>
        <Sparkles size={14} color="white" />
      </View>
      <View style={[styles.conciergeInput, { backgroundColor: C.background, borderColor: C.cardBorder }]}>
        <Text style={[styles.conciergePlaceholder, { color: C.textMuted, fontFamily: F.sans }]}>
          {t('Ask')} <Text style={{ color: C.secondary, fontFamily: F.sansMedium }}>{t('Concierge')}</Text> {t('anything...')}
        </Text>
      </View>
      <View style={[styles.conciergePill, { backgroundColor: C.secondary }]}>
        <Text style={[styles.conciergePillText, { fontFamily: F.sansBold }]}>AI</Text>
      </View>
    </Pressable>
  );
}

function ActionTile({ icon, label, onPress, badge, badgeCount, badgeColor, C }: any) {
  const bgColor = badgeColor === 'error' ? C.error : C.secondary;
  return (
    <Pressable
      style={({ hovered }: any) => [
        styles.actionTile,
        { backgroundColor: hovered ? C.primaryDark : C.primary },
      ]}
      onPress={onPress}
    >
      {badge && <View style={[styles.badgeDot, { backgroundColor: C.error, borderColor: C.primary }]} />}
      {badgeCount !== undefined && (
        <View style={[styles.badgeCountWrap, { backgroundColor: bgColor }]}>
          <Text style={styles.badgeCountText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
        </View>
      )}
      {icon}
      <Text style={styles.actionLabel} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

function CollapsibleSection({ title, icon, children, C, F }: any) {
  const [open, setOpen] = useState(true);
  return (
    <View style={[styles.digestCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
      <Pressable style={styles.digestHeader} onPress={() => setOpen(prev => !prev)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {icon}
          <Text style={[styles.digestTitle, { color: C.text, fontFamily: F.sansBold }]}>{title}</Text>
        </View>
        <ChevronDown
          size={14}
          color={C.textMuted}
          style={open ? { transform: [{ rotate: '180deg' }] } : undefined}
        />
      </Pressable>
      {open && children}
    </View>
  );
}

function LanguageSettingRow({ C, F, t, language, profile }: any) {
  const { setLanguage } = useLanguage();

  return (
    <View>
      <Text style={[styles.settingsPanelTitle, { color: 'rgba(255,255,255,0.85)', fontFamily: F?.sansBold, marginBottom: 8 }]}>
        {t('Language')}
      </Text>
      <View style={styles.langRow}>
        <Pressable
          style={[styles.langBtn, language === 'en' && { backgroundColor: C.secondary }]}
          onPress={() => persistLanguage('en', setLanguage, profile?.id)}
        >
          <Globe size={13} color={language === 'en' ? 'white' : 'rgba(255,255,255,0.5)'} />
          <Text style={[styles.langBtnText, { color: language === 'en' ? 'white' : 'rgba(255,255,255,0.5)', fontFamily: F?.sansBold }]}>EN</Text>
        </Pressable>
        <Pressable
          style={[styles.langBtn, language === 'es' && { backgroundColor: C.secondary }]}
          onPress={() => persistLanguage('es', setLanguage, profile?.id)}
        >
          <Globe size={13} color={language === 'es' ? 'white' : 'rgba(255,255,255,0.5)'} />
          <Text style={[styles.langBtnText, { color: language === 'es' ? 'white' : 'rgba(255,255,255,0.5)', fontFamily: F?.sansBold }]}>ES</Text>
        </Pressable>
      </View>
    </View>
  );
}

async function persistLanguage(lang: 'en' | 'es', setLanguage: (l: 'en' | 'es') => void, profileId?: string) {
  setLanguage(lang);
  if (profileId) {
    await supabase.from('profiles').update({ language: lang }).eq('id', profileId);
  }
}

function WidgetSheet({ visible, widgets, onClose, onSave, sheetAnim, C, F, t, language, profile }: any) {
  const [local, setLocal] = useState<Widget[]>(widgets);
  const { setLanguage } = useLanguage();

  useEffect(() => { setLocal(widgets); }, [widgets]);

  function toggle(id: WidgetId) {
    setLocal(prev => prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w));
  }

  function handleSave() {
    onSave(local);
    onClose();
  }

  const translateY = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose} />
      <Animated.View style={[styles.sheet, { backgroundColor: C.card, transform: [{ translateY }] }]}>
        <View style={[styles.sheetHandle, { backgroundColor: C.cardBorder }]} />
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: C.text, fontFamily: F.sansBold }]}>{t('Customize Dashboard')}</Text>
          <Pressable onPress={onClose} style={styles.sheetClose}>
            <X size={18} color={C.textMuted} />
          </Pressable>
        </View>
        <Text style={[styles.sheetSubtitle, { color: C.textMuted }]}>{t('Show or hide sections on your dashboard')}</Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Dashboard sections */}
          {local.filter(w => w.section === 'dashboard').length > 0 && (
            <>
              <Text style={[styles.sheetGroupTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Dashboard Sections')}</Text>
              {local.filter(w => w.section === 'dashboard').map(widget => (
                <View key={widget.id} style={[styles.widgetRow, { borderBottomColor: C.cardBorder }]}>
                  <Text style={[styles.widgetLabel, { color: C.text, fontFamily: F.sansMedium }]}>{widget.label}</Text>
                  <Switch
                    value={widget.visible}
                    onValueChange={() => toggle(widget.id)}
                    trackColor={{ false: C.cardBorder, true: C.secondaryAlpha30 }}
                    thumbColor={widget.visible ? C.secondary : C.textMuted}
                  />
                </View>
              ))}
            </>
          )}

          {/* Quick action tiles */}
          <Text style={[styles.sheetGroupTitle, { color: C.textMuted, fontFamily: F.sansBold, marginTop: 16 }]}>{t('Quick Actions')}</Text>
          {local.filter(w => w.section === 'quick_action').map(widget => (
            <View key={widget.id} style={[styles.widgetRow, { borderBottomColor: C.cardBorder }]}>
              <Text style={[styles.widgetLabel, { color: C.text, fontFamily: F.sansMedium }]}>{widget.label}</Text>
              <Switch
                value={widget.visible}
                onValueChange={() => toggle(widget.id)}
                trackColor={{ false: C.cardBorder, true: C.secondaryAlpha30 }}
                thumbColor={widget.visible ? C.secondary : C.textMuted}
              />
            </View>
          ))}

          {/* Language preference */}
          <View style={[styles.sheetLangSection, { borderTopColor: C.cardBorder }]}>
            <Text style={[styles.sheetLangTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Language')}</Text>
            <View style={styles.sheetLangRow}>
              <Pressable
                style={[styles.sheetLangBtn, { backgroundColor: language === 'en' ? C.secondaryAlpha15 : C.activeBg, borderColor: language === 'en' ? C.secondary : C.cardBorder }]}
                onPress={() => persistLanguage('en', setLanguage, profile?.id)}
              >
                <Text style={[styles.sheetLangBtnText, { color: language === 'en' ? C.secondary : C.textMuted, fontFamily: language === 'en' ? F.sansBold : F.sans }]}>English</Text>
              </Pressable>
              <Pressable
                style={[styles.sheetLangBtn, { backgroundColor: language === 'es' ? C.secondaryAlpha15 : C.activeBg, borderColor: language === 'es' ? C.secondary : C.cardBorder }]}
                onPress={() => persistLanguage('es', setLanguage, profile?.id)}
              >
                <Text style={[styles.sheetLangBtnText, { color: language === 'es' ? C.secondary : C.textMuted, fontFamily: language === 'es' ? F.sansBold : F.sans }]}>Espanol</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        <Pressable
          style={({ hovered }: any) => [styles.sheetSaveBtn, { backgroundColor: hovered ? C.secondaryDark : C.secondary }]}
          onPress={handleSave}
        >
          <Text style={[styles.sheetSaveBtnText, { fontFamily: F.sansBold }]}>{t('Done')}</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1 },

  // Header
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 15, fontWeight: '600' },
  headerBarn: { fontSize: 10 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  iconBtnHovered: { backgroundColor: 'rgba(255,255,255,0.2)' },

  // Settings panel
  settingsPanel: { padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  settingsPanelTitle: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  settingsRow: { flexDirection: 'row', gap: 12 },
  settingsField: { flex: 1 },
  settingsLabel: { fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.8, marginBottom: 6 },
  settingsInput: { backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: 10, fontSize: 14, color: 'white', textAlign: 'center' },
  settingsActions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  settingsSaveBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  settingsSaveBtnText: { color: 'white', fontSize: 13 },
  settingsCancelText: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  settingsDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 14 },
  qbRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qbLabel: { fontSize: 13, fontWeight: '600' },
  qbStatus: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  qbConnectedBadge: { backgroundColor: 'rgba(76,175,80,0.2)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  qbConnectedText: { fontSize: 12, color: '#81C784', fontWeight: '600' },
  qbConnectBtn: { borderRadius: 6, paddingHorizontal: 14, paddingVertical: 7 },
  qbConnectBtnText: { fontSize: 13, fontWeight: '600' },
  langRow: { flexDirection: 'row', gap: 8 },
  langBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' },
  langBtnText: { fontSize: 13 },

  // Body
  body: { flex: 1, padding: 16 },

  // Welcome card
  welcomeCard: { borderRadius: 16, padding: 20, marginBottom: 16 },
  welcomeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8 },
  welcomeText: { fontSize: 22, flex: 1 },
  welcomeSub: { fontSize: 13 },
  roleChip: { borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4 },
  roleChipText: { fontSize: 10 },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: { borderWidth: 1, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 8, flex: 1, minWidth: 80, alignItems: 'center' },
  statNumber: { fontSize: 20, textAlign: 'center', width: '100%' },
  statLabel: { fontSize: 10, marginTop: 2, textAlign: 'center', width: '100%' },

  // Digest card
  digestCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 12 },
  digestHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 },
  digestTitle: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6 },
  digestRefresh: { padding: 6, borderRadius: 6 },
  digestSummary: { fontSize: 14, lineHeight: 21, marginBottom: 4 },
  digestToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 2, borderRadius: 6, marginTop: 4 },
  digestToggleText: { fontSize: 13 },
  digestText: { fontSize: 14, lineHeight: 22, marginTop: 10 },
  digestActions: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 12, gap: 8 },
  digestActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 },
  digestActionText: { flex: 1, fontSize: 13 },
  digestGenerating: { fontSize: 13, textAlign: 'center', marginBottom: 8 },
  digestTimestamp: { fontSize: 11, marginTop: 10 },

  // Concierge bar
  conciergeBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, padding: 12, gap: 10, marginHorizontal: 16, marginTop: 12, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  conciergeInline: { marginHorizontal: -16, marginBottom: 4 },
  conciergeBarHovered: { shadowOpacity: 0.12 },
  conciergeIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  conciergeInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  conciergePlaceholder: { fontSize: 14 },
  conciergePill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  conciergePillText: { fontSize: 10, letterSpacing: 0.5, color: 'white' },

  // Sections
  sectionBlock: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingVertical: 8 },
  sectionTitle: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionCard: { borderRadius: 14, borderWidth: 1 },
  customizeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  customizeBtnText: { fontSize: 11 },

  // Alerts
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  alertDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  alertInfo: { flex: 1 },
  alertHorse: { fontSize: 13 },
  alertMsg: { fontSize: 12, marginTop: 1 },
  seeAllBtn: { padding: 12, alignItems: 'center' },
  seeAllText: { fontSize: 13 },

  // Events
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  eventDateBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, minWidth: 50, alignItems: 'center' },
  eventDateText: { fontSize: 11 },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 13 },
  eventTime: { fontSize: 12, marginTop: 1 },

  // Quick actions
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 12 },
  actionTile: { borderRadius: 16, paddingVertical: 20, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', gap: 8, width: 100, minHeight: 100 },
  actionLabel: { fontSize: 11, color: 'white', fontWeight: '600', textAlign: 'center', lineHeight: 15 },
  badgeDot: { position: 'absolute', top: 10, right: 10, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  badgeCountWrap: { position: 'absolute', top: -6, right: -6, minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderWidth: 2, borderColor: 'white' },
  badgeCountText: { color: 'white', fontSize: 12, fontWeight: '700' },

  // Horse owner
  horseSelectorScroll: { marginBottom: 12 },
  horseSelectorContent: { gap: 8, paddingRight: 4 },
  horseSelectorChip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, backgroundColor: 'white' },
  horseSelectorDot: { width: 8, height: 8, borderRadius: 4 },
  horseSelectorLabel: { fontSize: 13 },

  horseCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  horseAvatar: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  horseEmoji: { fontSize: 26 },
  horseInfo: { flex: 1 },
  horseName: { fontSize: 20, marginBottom: 2 },
  horseMeta: { fontSize: 12, marginBottom: 8 },
  horseBadges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '500' },

  noHorseCard: { borderRadius: 16, borderWidth: 1, padding: 20, marginBottom: 12, alignItems: 'center' },
  noHorseText: { fontSize: 13, textAlign: 'center', fontStyle: 'italic' },

  balanceCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  balanceText: { flex: 1, fontSize: 13 },
  balanceAmount: { fontSize: 15 },

  // Widget sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 20 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sheetTitle: { fontSize: 18 },
  sheetClose: { padding: 4 },
  sheetSubtitle: { fontSize: 13, marginBottom: 20 },
  widgetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  widgetLabel: { fontSize: 15 },
  sheetGroupTitle: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  sheetLangSection: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 16, paddingTop: 16 },
  sheetLangTitle: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  sheetLangRow: { flexDirection: 'row', gap: 10 },
  sheetLangBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
  sheetLangBtnText: { fontSize: 14 },
  sheetSaveBtn: { borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 20 },
  sheetSaveBtnText: { color: 'white', fontSize: 16 },
});
