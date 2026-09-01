import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Modal, Platform, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ChessKnight, Calendar, DollarSign, MoreHorizontal, Trophy, Stethoscope, Hammer, CalendarCheck, FileText, Repeat, CalendarDays } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useProfile } from '../lib/useProfile';
import { useLanguage } from '../lib/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import HomeButton from '../lib/HomeButton';
import { useBarnData } from '../lib/BarnDataContext';


const TYPE_COLORS: Record<string, string> = {
  lesson:  '#EAD9A8',
  vet:     '#FDECEA',
  farrier: '#EDE8F5',
  daily:   '#EDF5EF',
  other:   '#E8E8F0',
};

const TYPE_ICONS: Record<string, any> = {
  lesson:  Trophy,
  vet:     Stethoscope,
  farrier: Hammer,
  daily:   CalendarCheck,
  other:   FileText,
};

function getWeekDays(baseDate: Date) {
  const day = baseDate.getDay();
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toDateStr(d: Date) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function formatHeader(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://kzpdukjkttkaaligxsmb.supabase.co';

export default function Schedule() {
  const router = useRouter();
  const { isOwner, isStaff, isHorseOwner, horseLinks, profile } = useProfile();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const { barnSettings, cachedEvents, refreshEvents } = useBarnData();
  const today = new Date();
  const [viewMode, setViewMode] = useState<'day' | 'upcoming'>('day');
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekBase, setWeekBase] = useState(today);
  const [events, setEvents] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<{ date: string; events: any[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncModal, setSyncModal] = useState(false);
  const [feedUrl, setFeedUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [schedulePrivacy, setSchedulePrivacy] = useState<'show_details' | 'show_busy'>(
    barnSettings?.schedule_privacy ?? 'show_details'
  );

  useEffect(() => {
    if (barnSettings?.schedule_privacy) setSchedulePrivacy(barnSettings.schedule_privacy);
  }, [barnSettings?.schedule_privacy]);

  const weekDays = getWeekDays(weekBase);

  useFocusEffect(useCallback(() => {
    refreshEvents();
    if (viewMode === 'day') {
      fetchEvents(toDateStr(selectedDate), schedulePrivacy);
    } else {
      fetchUpcoming(schedulePrivacy);
    }
  }, [selectedDate, viewMode, schedulePrivacy]));

  const myHorseIds = new Set(horseLinks.map(l => l.horse_id));

  function applyPrivacy(eventsToFilter: any[], privacy: 'show_details' | 'show_busy'): any[] {
    if (!isHorseOwner || privacy === 'show_details') return eventsToFilter;
    return eventsToFilter.map(event => {
      if (myHorseIds.has(event.horse_id)) return event;
      const type = event.type?.toLowerCase() || 'other';
      if (type === 'lesson') {
        return { ...event, title: 'Busy', horses: null, assignee: null };
      }
      const typeLabel: Record<string, string> = { vet: 'Vet Appointment', farrier: 'Farrier', daily: 'Daily Care', other: 'Other' };
      return { ...event, title: typeLabel[type] ?? 'Busy', horses: null, assignee: null };
    });
  }

  async function fetchEvents(dateStr: string, privacy: 'show_details' | 'show_busy' = schedulePrivacy) {
    if (events.length === 0) setLoading(true);
    const { data } = await supabase
      .from('events')
      .select('*, horses(name)')
      .eq('date', dateStr)
      .order('time', { ascending: true });
    setEvents(applyPrivacy(data || [], privacy));
    setLoading(false);
  }

  async function fetchUpcoming(privacy: 'show_details' | 'show_busy' = schedulePrivacy) {
    if (events.length === 0) setLoading(true);
    const start = toDateStr(today);
    const end30 = new Date(today);
    end30.setDate(today.getDate() + 30);
    const end = toDateStr(end30);
    const { data } = await supabase
      .from('events')
      .select('*, horses(name)')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    // Group by date
    const grouped: Record<string, any[]> = {};
    for (const event of data || []) {
      if (!grouped[event.date]) grouped[event.date] = [];
      grouped[event.date].push(event);
    }
    setUpcomingEvents(Object.entries(grouped).map(([date, events]) => ({ date, events: applyPrivacy(events, privacy) })));
    setLoading(false);
  }

  function selectDay(d: Date) {
    setSelectedDate(d);
    fetchEvents(toDateStr(d), schedulePrivacy);
  }

  function switchView(mode: 'day' | 'upcoming') {
    setViewMode(mode);
    if (mode === 'upcoming') {
      fetchUpcoming(schedulePrivacy);
    } else {
      fetchEvents(toDateStr(selectedDate), schedulePrivacy);
    }
  }

  function goToToday() {
    const now = new Date();
    setWeekBase(now);
    setSelectedDate(now);
    fetchEvents(toDateStr(now), schedulePrivacy);
  }

  function prevWeek() {
    const d = new Date(weekBase);
    d.setDate(d.getDate() - 7);
    setWeekBase(d);
  }

  function nextWeek() {
    const d = new Date(weekBase);
    d.setDate(d.getDate() + 7);
    setWeekBase(d);
  }

  const isOnToday = toDateStr(selectedDate) === toDateStr(today) && toDateStr(weekBase) === toDateStr(today);

  async function handleSubscribe() {
    const { data } = await supabase
      .from('profiles')
      .select('calendar_token')
      .eq('id', profile?.id)
      .single();
    const token = data?.calendar_token;
    if (!token) return;
    const url = `${SUPABASE_URL}/functions/v1/calendar-feed?token=${token}`;
    setFeedUrl(url);
    setCopied(false);
    setSyncModal(true);
  }

  async function handleCopy() {
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }

  function handleOpenApple() {
    Linking.openURL(feedUrl.replace('https://', 'webcal://'));
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <View style={styles.headerLeft}>
          <HomeButton />
          <View>
            <Text style={[styles.headerName, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Schedule')}</Text>
            <Text style={styles.headerBarn}>{formatHeader(selectedDate)}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {!isOnToday && (
            <Pressable
              style={({ hovered }: any) => [styles.todayBtn, hovered && styles.todayBtnHovered]}
              onPress={goToToday}
            >
              <Text style={styles.todayBtnText}>{t('Today')}</Text>
            </Pressable>
          )}
          <Pressable
            style={({ hovered }: any) => [styles.syncBtn, hovered && styles.syncBtnHovered]}
            onPress={handleSubscribe}
          >
            <CalendarDays size={14} color={C.secondary} />
            <Text style={[styles.syncBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Sync Calendar')}</Text>
          </Pressable>
          {(isOwner || isStaff) && !isHorseOwner && (
            <Pressable
              style={styles.addBtn}
              onPress={() => router.push({ pathname: '/schedule/add', params: { date: toDateStr(selectedDate) } })}
            >
              <Text style={[styles.addBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>+ {t('Event')}</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* View toggle */}
      <View style={[styles.viewToggleRow, { backgroundColor: C.primary }]}>
        <Pressable style={[styles.viewToggleBtn, viewMode === 'day' && styles.viewToggleBtnActive]} onPress={() => switchView('day')}>
          <Text style={[styles.viewToggleText, viewMode === 'day' && { color: C.headerText }]}>{t('Day')}</Text>
        </Pressable>
        <Pressable style={[styles.viewToggleBtn, viewMode === 'upcoming' && styles.viewToggleBtnActive]} onPress={() => switchView('upcoming')}>
          <Text style={[styles.viewToggleText, viewMode === 'upcoming' && { color: C.headerText }]}>{t('Upcoming')}</Text>
        </Pressable>
      </View>

      {viewMode === 'day' && (
        <View style={[styles.weekRow, { backgroundColor: C.primary }]}>
          <Pressable onPress={prevWeek} style={styles.weekArrow}>
            <Text style={styles.weekArrowText}>‹</Text>
          </Pressable>
          {weekDays.map((d, i) => {
            const isSelected = toDateStr(d) === toDateStr(selectedDate);
            const isTodayDay = toDateStr(d) === toDateStr(today);
            return (
              <Pressable key={i} style={[styles.dayBtn, isSelected && styles.dayBtnActive]} onPress={() => selectDay(d)}>
                <Text style={[styles.dayLabel, isSelected && { color: C.headerText }]}>{DAY_LABELS[i]}</Text>
                <Text style={[styles.dayNum, isSelected && { color: C.headerText }]}>{d.getDate()}</Text>
                {isTodayDay && !isSelected && <View style={[styles.todayDot, { backgroundColor: C.secondary }]} />}
              </Pressable>
            );
          })}
          <Pressable onPress={nextWeek} style={styles.weekArrow}>
            <Text style={styles.weekArrowText}>›</Text>
          </Pressable>
        </View>
      )}

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {loading && events.length === 0 ? (
          <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 40 }} />
        ) : viewMode === 'upcoming' ? (
          upcomingEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <Calendar size={40} color={C.cardBorder} />
              <Text style={[styles.emptyTitle, { color: C.text, fontFamily: F.sansBold }]}>{t('Nothing upcoming')}</Text>
              <Text style={[styles.emptyText, { color: C.textMuted }]}>{t('No events in the next 30 days.')}</Text>
            </View>
          ) : (
            upcomingEvents.map(({ date, events: dayEvents }) => {
              const d = new Date(date + 'T00:00:00');
              const isToday = date === toDateStr(today);
              return (
                <View key={date}>
                  <View style={styles.upcomingDateHeader}>
                    <Text style={[styles.upcomingDateText, { color: C.textMuted, fontFamily: F.sansBold }]}>
                      {isToday ? t('Today') : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                    {isToday && <View style={[styles.todayPill, { backgroundColor: C.secondary }]}><Text style={[styles.todayPillText, { fontFamily: F.sansBold }]}>{t('Today')}</Text></View>}
                  </View>
                  {dayEvents.map((event) => {
                    const color = TYPE_COLORS[event.type?.toLowerCase()] || TYPE_COLORS.other;
                    const IconComponent = TYPE_ICONS[event.type?.toLowerCase()] || FileText;
                    return (
                      <Pressable
                        key={event.id}
                        style={({ hovered }: any) => [styles.eventCard, hovered && styles.eventCardHovered]}
                        onPress={() => (isOwner || isStaff) && router.push({ pathname: '/schedule/edit', params: { eventId: event.id } })}
                      >
                        <View style={styles.eventTime}>
                          <Text style={[styles.eventTimeText, { color: C.textWarm, fontFamily: F.sansBold }]}>{event.time || '—'}</Text>
                        </View>
                        <View style={[styles.eventBar, { backgroundColor: color }]}>
                          <View style={styles.eventIconWrap}>
                            <IconComponent size={16} color={C.text} />
                          </View>
                          <View style={styles.eventInfo}>
                            <Text style={[styles.eventTitle, { color: C.text, fontFamily: F.sansBold }]}>{event.title}</Text>
                            {event.horses?.name ? <Text style={[styles.eventAssignee, { color: C.textMuted }]}>{event.horses.name}</Text> : null}
                            {event.assignee ? <Text style={[styles.eventAssignee, { color: C.textMuted }]}>{event.assignee}</Text> : null}
                          </View>
                          <View style={styles.eventMeta}>
                            {event.recurring_group_id ? <Repeat size={11} color={C.textMuted} /> : null}
                            <View style={styles.eventTypeBadge}>
                              <Text style={[styles.eventTypeText, { color: C.text, fontFamily: F.sansMedium }]}>{event.type || 'Other'}</Text>
                            </View>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              );
            })
          )
        ) : events.length === 0 ? (
          <View style={styles.emptyState}>
            <Calendar size={40} color={C.cardBorder} />
            <Text style={[styles.emptyTitle, { color: C.text, fontFamily: F.sansBold }]}>{t('Nothing scheduled')}</Text>
            <Text style={[styles.emptyText, { color: C.textMuted }]}>{t('Tap + Event to add something.')}</Text>
          </View>
        ) : (
          events.map((event) => {
            const color = TYPE_COLORS[event.type?.toLowerCase()] || TYPE_COLORS.other;
            const IconComponent = TYPE_ICONS[event.type?.toLowerCase()] || FileText;
            return (
              <Pressable
                key={event.id}
                style={({ hovered }: any) => [styles.eventCard, hovered && styles.eventCardHovered]}
                onPress={() => (isOwner || isStaff) && router.push({ pathname: '/schedule/edit', params: { eventId: event.id } })}
              >
                <View style={styles.eventTime}>
                  <Text style={[styles.eventTimeText, { color: C.textWarm, fontFamily: F.sansBold }]}>{event.time || '—'}</Text>
                </View>
                <View style={[styles.eventBar, { backgroundColor: color }]}>
                  <View style={styles.eventIconWrap}>
                    <IconComponent size={16} color={C.text} />
                  </View>
                  <View style={styles.eventInfo}>
                    <Text style={[styles.eventTitle, { color: C.text, fontFamily: F.sansBold }]}>{event.title}</Text>
                    {event.horses?.name ? <Text style={[styles.eventAssignee, { color: C.textMuted }]}>{event.horses.name}</Text> : null}
                    {event.assignee ? <Text style={[styles.eventAssignee, { color: C.textMuted }]}>{event.assignee}</Text> : null}
                  </View>
                  <View style={styles.eventMeta}>
                    {event.recurring_group_id ? <Repeat size={11} color={C.textMuted} /> : null}
                    <View style={styles.eventTypeBadge}>
                      <Text style={[styles.eventTypeText, { color: C.text, fontFamily: F.sansMedium }]}>{event.type || 'Other'}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      <Modal visible={syncModal} transparent animationType="fade" onRequestClose={() => setSyncModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSyncModal(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: C.card }]} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <CalendarDays size={20} color={C.primary} />
              <Text style={[styles.modalTitle, { color: C.text, fontFamily: F.sansBold }]}>{t('Sync to Your Calendar')}</Text>
            </View>
            <Text style={[styles.modalBody, { color: C.textMuted }]}>
              {t('Add your Scope & Stride schedule to any calendar app. Events update automatically — you only need to do this once.')}
            </Text>

            {Platform.OS !== 'web' ? (
              <Pressable style={[styles.primaryBtn, { backgroundColor: C.primary }]} onPress={handleOpenApple}>
                <Text style={[styles.primaryBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Open in Apple Calendar')}</Text>
              </Pressable>
            ) : null}

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: C.cardBorder }]} />
              <Text style={[styles.dividerText, { color: C.textMuted, fontFamily: F.sansBold }]}>{Platform.OS === 'web' ? t('Google Calendar') : t('Or add to Google Calendar')}</Text>
              <View style={[styles.dividerLine, { backgroundColor: C.cardBorder }]} />
            </View>

            <Text style={[styles.stepText, { color: C.text }]}>1. {t('Copy the link below')}</Text>
            <Text style={[styles.stepText, { color: C.text }]}>2. {t('Open')} <Text style={[styles.bold, { color: C.text }]}>calendar.google.com</Text></Text>
            <Text style={[styles.stepText, { color: C.text }]}>3. {t('Click the')} <Text style={[styles.bold, { color: C.text }]}>+</Text> {t('next to "Other calendars"')} → <Text style={[styles.bold, { color: C.text }]}>{t('From URL')}</Text></Text>
            <Text style={[styles.stepText, { color: C.text }]}>4. {t('Paste the link and click')} <Text style={[styles.bold, { color: C.text }]}>{t('Add calendar')}</Text></Text>
            <Text style={[styles.stepText, { color: C.text }]}>5. {t('Rename it')} <Text style={[styles.bold, { color: C.text }]}>Scope & Stride</Text> {t('if needed')}</Text>

            <View style={[styles.urlRow, { backgroundColor: C.background, borderColor: C.cardBorder }]}>
              <Text style={[styles.urlText, { color: C.textMuted }]} numberOfLines={1}>{feedUrl}</Text>
            </View>
            {Platform.OS === 'web' ? (
              <Pressable style={[styles.primaryBtn, { backgroundColor: C.primary }]} onPress={handleCopy}>
                <Text style={[styles.primaryBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>{copied ? t('Copied!') : t('Copy Link')}</Text>
              </Pressable>
            ) : null}

            <Pressable style={[styles.closeBtn, { borderColor: C.cardBorder }]} onPress={() => setSyncModal(false)}>
              <Text style={[styles.closeBtnText, { color: C.textMuted, fontFamily: F.sansMedium }]}>{t('Done')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerName: { fontSize: 15, fontWeight: '600' },
  headerBarn: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  todayBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6 },
  todayBtnHovered: { backgroundColor: 'rgba(255,255,255,0.2)' },
  todayBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500' },
  addBtn: { backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6 },
  addBtnText: { fontSize: 13, fontWeight: '600' },
  weekRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 12 },
  weekArrow: { paddingHorizontal: 6, paddingVertical: 6 },
  weekArrowText: { fontSize: 22, color: 'rgba(255,255,255,0.5)', lineHeight: 24 },
  dayBtn: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8 },
  dayBtnActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  dayLabel: { fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 },
  dayNum: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  todayDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  body: { flex: 1, padding: 12 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptyText: { fontSize: 13 },
  eventCard: { flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'stretch' },
  eventCardHovered: { opacity: 0.85 },
  eventTime: { width: 58, paddingTop: 12, alignItems: 'flex-end' },
  eventTimeText: { fontSize: 10, fontWeight: '600' },
  eventBar: { flex: 1, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventIconWrap: { width: 24, alignItems: 'center' },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 13, fontWeight: '600' },
  eventAssignee: { fontSize: 11, marginTop: 2 },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eventTypeBadge: { backgroundColor: 'rgba(255,255,255,0.6)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  eventTypeText: { fontSize: 10, fontWeight: '500' },
  viewToggleRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  viewToggleBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)' },
  viewToggleBtnActive: { backgroundColor: 'rgba(255,255,255,0.35)' },
  viewToggleText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  upcomingDateHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 6, paddingHorizontal: 2 },
  upcomingDateText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  todayPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  todayPillText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  syncBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  syncBtnHovered: { backgroundColor: 'rgba(255,255,255,0.32)' },
  syncBtnText: { fontSize: 12, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { borderRadius: 20, padding: 24, width: '100%', maxWidth: 480, gap: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  modalBody: { fontSize: 13, lineHeight: 19 },
  stepText: { fontSize: 13, lineHeight: 22 },
  bold: { fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 11, fontWeight: '600' },
  urlRow: { borderWidth: 1, borderRadius: 10, padding: 12 },
  urlText: { fontSize: 11, fontFamily: 'monospace' },
  primaryBtn: { borderRadius: 10, padding: 14, alignItems: 'center' },
  primaryBtnText: { fontSize: 14, fontWeight: '700' },
  closeBtn: { borderWidth: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  closeBtnText: { fontSize: 14, fontWeight: '500' },
});
