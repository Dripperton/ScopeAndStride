import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Modal, Platform, ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Pressable as GHPressable } from 'react-native-gesture-handler';
import { useFocusEffect } from 'expo-router';
import { ChessKnight, Calendar, DollarSign, MoreHorizontal, Trophy, Stethoscope, Hammer, CalendarCheck, FileText, Repeat, CalendarDays } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useProfile } from '../lib/useProfile';
import { useLanguage } from '../lib/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import Brand from '../constants/brand';
import HomeButton from '../lib/HomeButton';
import { useBarnData } from '../lib/BarnDataContext';


const TYPE_COLORS: Record<string, string> = {
  lesson:  '#EAD9A8',
  vet:     '#FDECEA',
  farrier: '#EDE8F5',
  daily:   '#EDF5EF',
  other:   '#E8E8F0',
};

const TYPE_PILL_COLORS: Record<string, string> = {
  lesson:  '#C9A84C',
  vet:     '#E57373',
  farrier: '#9575CD',
  daily:   '#66BB6A',
  other:   '#9E9E9E',
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

function getMonthGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, month, d));
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function toDateStr(d: Date) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function formatHeader(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatMonthHeader(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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
  const [viewMode, setViewMode] = useState<'day' | 'month' | 'upcoming'>('month');
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekBase, setWeekBase] = useState(today);
  const [monthBase, setMonthBase] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [events, setEvents] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<{ date: string; events: any[] }[]>([]);
  const [monthEventsMap, setMonthEventsMap] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [monthLoading, setMonthLoading] = useState(false);
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
    } else if (viewMode === 'month') {
      fetchMonthEvents(monthBase.getFullYear(), monthBase.getMonth(), schedulePrivacy);
    } else {
      fetchUpcoming(schedulePrivacy);
    }
  }, [selectedDate, viewMode, schedulePrivacy, monthBase]));

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
    const grouped: Record<string, any[]> = {};
    for (const event of data || []) {
      if (!grouped[event.date]) grouped[event.date] = [];
      grouped[event.date].push(event);
    }
    setUpcomingEvents(Object.entries(grouped).map(([date, events]) => ({ date, events: applyPrivacy(events, privacy) })));
    setLoading(false);
  }

  async function fetchMonthEvents(year: number, month: number, privacy: 'show_details' | 'show_busy' = schedulePrivacy) {
    setMonthLoading(true);
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const { data } = await supabase
      .from('events')
      .select('*, horses(name)')
      .gte('date', start)
      .lte('date', end)
      .order('time', { ascending: true });
    const map: Record<string, any[]> = {};
    for (const event of applyPrivacy(data || [], privacy)) {
      if (!map[event.date]) map[event.date] = [];
      map[event.date].push(event);
    }
    setMonthEventsMap(map);
    setMonthLoading(false);
  }

  function selectDay(d: Date) {
    setSelectedDate(d);
    fetchEvents(toDateStr(d), schedulePrivacy);
  }

  function selectMonthDay(d: Date) {
    setSelectedDate(d);
  }

  function switchView(mode: 'day' | 'month' | 'upcoming') {
    setViewMode(mode);
    if (mode === 'upcoming') {
      fetchUpcoming(schedulePrivacy);
    } else if (mode === 'month') {
      fetchMonthEvents(monthBase.getFullYear(), monthBase.getMonth(), schedulePrivacy);
    } else {
      fetchEvents(toDateStr(selectedDate), schedulePrivacy);
    }
  }

  function goToToday() {
    const now = new Date();
    setWeekBase(now);
    setSelectedDate(now);
    if (viewMode === 'month') {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      setMonthBase(m);
      fetchMonthEvents(m.getFullYear(), m.getMonth(), schedulePrivacy);
    } else {
      fetchEvents(toDateStr(now), schedulePrivacy);
    }
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

  function prevMonth() {
    const d = new Date(monthBase);
    d.setMonth(d.getMonth() - 1);
    setMonthBase(d);
    fetchMonthEvents(d.getFullYear(), d.getMonth(), schedulePrivacy);
  }

  function nextMonth() {
    const d = new Date(monthBase);
    d.setMonth(d.getMonth() + 1);
    setMonthBase(d);
    fetchMonthEvents(d.getFullYear(), d.getMonth(), schedulePrivacy);
  }

  const isOnToday = viewMode === 'month'
    ? monthBase.getFullYear() === today.getFullYear() && monthBase.getMonth() === today.getMonth()
    : toDateStr(selectedDate) === toDateStr(today) && toDateStr(weekBase) === toDateStr(today);

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
    } else {
      await Share.share({ message: feedUrl });
    }
  }

  async function handleOpenApple() {
    const webcalUrl = feedUrl.replace('https://', 'webcal://');
    await Linking.openURL(webcalUrl);
  }

  const monthGrid = viewMode === 'month' ? getMonthGrid(monthBase.getFullYear(), monthBase.getMonth()) : [];
  const selectedDateStr = toDateStr(selectedDate);
  const monthDayEvents = monthEventsMap[selectedDateStr] || [];

  function renderEventCard(event: any) {
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
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <View style={styles.headerLeft}>
          <HomeButton />
          <View>
            <Text style={[styles.headerName, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Schedule')}</Text>
            <Text style={styles.headerBarn}>
              {viewMode === 'month' ? formatMonthHeader(monthBase) : formatHeader(selectedDate)}
            </Text>
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
        <View style={styles.viewToggleBtns}>
          <Pressable style={[styles.viewToggleBtn, viewMode === 'day' && styles.viewToggleBtnActive]} onPress={() => switchView('day')}>
            <Text style={[styles.viewToggleText, viewMode === 'day' && { color: C.headerText }]}>{t('Day')}</Text>
          </Pressable>
          <Pressable style={[styles.viewToggleBtn, viewMode === 'month' && styles.viewToggleBtnActive]} onPress={() => switchView('month')}>
            <Text style={[styles.viewToggleText, viewMode === 'month' && { color: C.headerText }]}>{t('Month')}</Text>
          </Pressable>
          <Pressable style={[styles.viewToggleBtn, viewMode === 'upcoming' && styles.viewToggleBtnActive]} onPress={() => switchView('upcoming')}>
            <Text style={[styles.viewToggleText, viewMode === 'upcoming' && { color: C.headerText }]}>{t('Upcoming')}</Text>
          </Pressable>
        </View>
        <Pressable
          style={({ hovered }: any) => [styles.syncBtn, hovered && styles.syncBtnHovered]}
          onPress={handleSubscribe}
        >
          <CalendarDays size={16} color={C.headerText} />
        </Pressable>
      </View>

      {/* Week strip (day view) */}
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
                {isTodayDay && !isSelected && <View style={[styles.todayDot, { backgroundColor: 'rgba(255,255,255,0.6)' }]} />}
              </Pressable>
            );
          })}
          <Pressable onPress={nextWeek} style={styles.weekArrow}>
            <Text style={styles.weekArrowText}>›</Text>
          </Pressable>
        </View>
      )}

      {/* Month grid */}
      {viewMode === 'month' && (
        <View style={[styles.monthGridContainer, { backgroundColor: C.card, borderBottomColor: C.cardBorder }]}>
          {/* Month nav */}
          <View style={styles.monthNavRow}>
            <Pressable onPress={prevMonth} style={styles.monthNavArrow}>
              <Text style={[styles.monthNavArrowText, { color: C.primary }]}>‹</Text>
            </Pressable>
            <Text style={[styles.monthNavTitle, { color: C.text, fontFamily: F.sansBold }]}>
              {monthBase.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
            <Pressable onPress={nextMonth} style={styles.monthNavArrow}>
              <Text style={[styles.monthNavArrowText, { color: C.primary }]}>›</Text>
            </Pressable>
          </View>

          {/* Day of week headers */}
          <View style={styles.monthDowRow}>
            {MONTH_DOW_LABELS.map((label, i) => (
              <View key={i} style={styles.monthDowCell}>
                <Text style={[styles.monthDowText, { color: C.textMuted, fontFamily: F.sansBold }]}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Grid rows */}
          {monthLoading ? (
            <ActivityIndicator size="small" color={C.primary} style={{ marginVertical: 20 }} />
          ) : (
            Array.from({ length: monthGrid.length / 7 }, (_, row) => (
              <View key={row} style={styles.monthWeekRow}>
                {monthGrid.slice(row * 7, row * 7 + 7).map((d, col) => {
                  if (!d) return <View key={col} style={styles.monthDayCell} />;
                  const dateStr = toDateStr(d);
                  const isToday = dateStr === toDateStr(today);
                  const isSelected = dateStr === selectedDateStr;
                  const dayEvents = monthEventsMap[dateStr] || [];
                  // Unique pill colors (up to 3 distinct types)
                  const pillColors = [...new Set(dayEvents.map(e => e.type?.toLowerCase() || 'other'))]
                    .slice(0, 3)
                    .map(type => TYPE_PILL_COLORS[type] || TYPE_PILL_COLORS.other);

                  return (
                    <Pressable key={col} style={styles.monthDayCell} onPress={() => selectMonthDay(d)}>
                      <View style={[
                        styles.monthDayNumWrap,
                        isToday && { backgroundColor: C.primary },
                        isSelected && !isToday && { backgroundColor: C.text },
                      ]}>
                        <Text style={[
                          styles.monthDayNum,
                          { color: C.text },
                          (isToday || isSelected) && { color: '#fff' },
                        ]}>{d.getDate()}</Text>
                      </View>
                      <View style={styles.monthPillRow}>
                        {pillColors.map((color, pi) => (
                          <View key={pi} style={[styles.monthPill, { backgroundColor: color }]} />
                        ))}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))
          )}
        </View>
      )}

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardDismissMode="none" keyboardShouldPersistTaps="handled">
        {viewMode === 'month' ? (
          monthDayEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <Calendar size={40} color={C.cardBorder} />
              <Text style={[styles.emptyTitle, { color: C.text, fontFamily: F.sansBold }]}>
                {selectedDateStr === toDateStr(today) ? t('Nothing today') : t('Nothing scheduled')}
              </Text>
              <Text style={[styles.emptyText, { color: C.textMuted }]}>
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
            </View>
          ) : (
            <>
              <View style={[styles.upcomingDateHeader, { marginTop: 12 }]}>
                <Text style={[styles.upcomingDateText, { color: C.textMuted, fontFamily: F.sansBold }]}>
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
              </View>
              {monthDayEvents.map(renderEventCard)}
            </>
          )
        ) : loading && events.length === 0 ? (
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
                  {dayEvents.map(renderEventCard)}
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
          events.map(renderEventCard)
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
              {t('Add your')} {Brand.barnName} {t('schedule to any calendar app. Events update automatically — you only need to do this once.')}
            </Text>

            {Platform.OS !== 'web' ? (
              <GHPressable style={[styles.primaryBtn, { backgroundColor: C.primary }]} onPress={handleOpenApple}>
                <Text style={[styles.primaryBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Open in Apple Calendar')}</Text>
              </GHPressable>
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
            <Text style={[styles.stepText, { color: C.text }]}>5. {t('Rename it')} <Text style={[styles.bold, { color: C.text }]}>{Brand.barnName}</Text> {t('if needed')}</Text>

            <View style={[styles.urlRow, { backgroundColor: C.background, borderColor: C.cardBorder }]}>
              <Text style={[styles.urlText, { color: C.textMuted }]} numberOfLines={1} selectable>{feedUrl}</Text>
            </View>
            <Pressable style={[styles.primaryBtn, { backgroundColor: C.primary }]} onPress={handleCopy}>
              <Text style={[styles.primaryBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>{copied ? t('Copied!') : t('Copy Link')}</Text>
            </Pressable>

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
  // Month grid
  monthGridContainer: { borderBottomWidth: 1, paddingBottom: 8 },
  monthNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 10 },
  monthNavArrow: { paddingHorizontal: 12, paddingVertical: 4 },
  monthNavArrowText: { fontSize: 24, lineHeight: 28, fontWeight: '300' },
  monthNavTitle: { fontSize: 15, fontWeight: '700' },
  monthDowRow: { flexDirection: 'row', paddingHorizontal: 4, marginBottom: 2 },
  monthDowCell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  monthDowText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  monthWeekRow: { flexDirection: 'row', paddingHorizontal: 4 },
  monthDayCell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  monthDayNumWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  monthDayNum: { fontSize: 13, fontWeight: '500' },
  monthPillRow: { flexDirection: 'row', gap: 2, marginTop: 2, height: 4 },
  monthPill: { width: 14, height: 4, borderRadius: 2 },
  // Body
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
  viewToggleRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 10, alignItems: 'center', justifyContent: 'space-between' },
  viewToggleBtns: { flexDirection: 'row', gap: 6 },
  viewToggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)' },
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
