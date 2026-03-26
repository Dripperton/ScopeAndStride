import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Home, ChessKnight, Calendar, DollarSign, MoreHorizontal, Trophy, Stethoscope, Hammer, CalendarCheck, FileText } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

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

export default function Schedule() {
  const router = useRouter();
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekBase, setWeekBase] = useState(today);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const weekDays = getWeekDays(weekBase);

  useFocusEffect(useCallback(() => {
    fetchEvents(toDateStr(selectedDate));
  }, [selectedDate]));

  async function fetchEvents(dateStr: string) {
    setLoading(true);
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('date', dateStr)
      .order('time', { ascending: true });
    setEvents(data || []);
    setLoading(false);
  }

  function selectDay(d: Date) {
    setSelectedDate(d);
    fetchEvents(toDateStr(d));
  }

  function goToToday() {
    const now = new Date();
    setWeekBase(now);
    setSelectedDate(now);
    fetchEvents(toDateStr(now));
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>S{'\n'}S</Text>
          </View>
          <View>
            <Text style={styles.headerName}>Schedule</Text>
            <Text style={styles.headerBarn}>{formatHeader(selectedDate)}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {!isOnToday && (
            <Pressable
              style={({ hovered }: any) => [styles.todayBtn, hovered && styles.todayBtnHovered]}
              onPress={goToToday}
            >
              <Text style={styles.todayBtnText}>Today</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.addBtn}
            onPress={() => router.push({ pathname: '/schedule/add', params: { date: toDateStr(selectedDate) } })}
          >
            <Text style={styles.addBtnText}>+ Event</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.weekRow}>
        <Pressable onPress={prevWeek} style={styles.weekArrow}>
          <Text style={styles.weekArrowText}>‹</Text>
        </Pressable>
        {weekDays.map((d, i) => {
          const isSelected = toDateStr(d) === toDateStr(selectedDate);
          const isTodayDay = toDateStr(d) === toDateStr(today);
          return (
            <Pressable key={i} style={[styles.dayBtn, isSelected && styles.dayBtnActive]} onPress={() => selectDay(d)}>
              <Text style={[styles.dayLabel, isSelected && styles.dayLabelActive]}>{DAY_LABELS[i]}</Text>
              <Text style={[styles.dayNum, isSelected && styles.dayNumActive]}>{d.getDate()}</Text>
              {isTodayDay && !isSelected && <View style={styles.todayDot} />}
            </Pressable>
          );
        })}
        <Pressable onPress={nextWeek} style={styles.weekArrow}>
          <Text style={styles.weekArrowText}>›</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color="#2C4A35" style={{ marginTop: 40 }} />
        ) : events.length === 0 ? (
          <View style={styles.emptyState}>
            <Calendar size={40} color="#C4BAA8" />
            <Text style={styles.emptyTitle}>Nothing scheduled</Text>
            <Text style={styles.emptyText}>Tap + Event to add something.</Text>
          </View>
        ) : (
          events.map((event) => {
            const color = TYPE_COLORS[event.type?.toLowerCase()] || TYPE_COLORS.other;
            const IconComponent = TYPE_ICONS[event.type?.toLowerCase()] || FileText;
            return (
              <Pressable
                key={event.id}
                style={({ hovered }: any) => [styles.eventCard, hovered && styles.eventCardHovered]}
                onPress={() => router.push({ pathname: '/schedule/edit', params: { eventId: event.id } })}
              >
                <View style={styles.eventTime}>
                  <Text style={styles.eventTimeText}>{event.time || '—'}</Text>
                </View>
                <View style={[styles.eventBar, { backgroundColor: color }]}>
                  <View style={styles.eventIconWrap}>
                    <IconComponent size={16} color="#3A3830" />
                  </View>
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    {event.assignee ? <Text style={styles.eventAssignee}>{event.assignee}</Text> : null}
                  </View>
                  <View style={styles.eventTypeBadge}>
                    <Text style={styles.eventTypeText}>{event.type || 'Other'}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      <View style={styles.nav}>
        <Pressable style={styles.navItem} onPress={() => router.push('/dashboard')}>
          <Home size={22} color="#9A9285" />
          <Text style={styles.navLbl}>Home</Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={() => router.push('/horses')}>
          <ChessKnight size={22} color="#9A9285" />
          <Text style={styles.navLbl}>Horses</Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={() => router.push('/schedule')}>
          <Calendar size={22} color="#2C4A35" />
          <Text style={[styles.navLbl, styles.navActive]}>Schedule</Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={() => router.push('/billing')}>
          <DollarSign size={22} color="#9A9285" />
          <Text style={styles.navLbl}>Billing</Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={() => router.push('/concierge')}>
          <MoreHorizontal size={22} color="#9A9285" />
          <Text style={styles.navLbl}>More</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F2' },
  header: { backgroundColor: '#2C4A35', padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 32, height: 32, backgroundColor: 'rgba(201,168,92,0.15)', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  headerIconText: { fontSize: 10, fontWeight: '700', color: '#C9A85C', textAlign: 'center', lineHeight: 11 },
  headerName: { fontSize: 15, fontWeight: '600', color: '#C9A85C' },
  headerBarn: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  todayBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6 },
  todayBtnHovered: { backgroundColor: 'rgba(255,255,255,0.2)' },
  todayBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500' },
  addBtn: { backgroundColor: 'rgba(201,168,92,0.15)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6 },
  addBtnText: { color: '#C9A85C', fontSize: 13, fontWeight: '600' },
  weekRow: { backgroundColor: '#2C4A35', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 12 },
  weekArrow: { paddingHorizontal: 6, paddingVertical: 6 },
  weekArrowText: { fontSize: 22, color: 'rgba(255,255,255,0.5)', lineHeight: 24 },
  dayBtn: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8 },
  dayBtnActive: { backgroundColor: '#C9A85C' },
  dayLabel: { fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 },
  dayLabelActive: { color: '#2C4A35' },
  dayNum: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  dayNumActive: { color: '#2C4A35' },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#C9A85C', marginTop: 2 },
  body: { flex: 1, padding: 12 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A14' },
  emptyText: { fontSize: 13, color: '#9A9285' },
  eventCard: { flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'stretch' },
  eventCardHovered: { opacity: 0.85 },
  eventTime: { width: 58, paddingTop: 12, alignItems: 'flex-end' },
  eventTimeText: { fontSize: 10, color: '#B08C4A', fontWeight: '600' },
  eventBar: { flex: 1, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventIconWrap: { width: 24, alignItems: 'center' },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 13, fontWeight: '600', color: '#1A1A14' },
  eventAssignee: { fontSize: 11, color: '#9A9285', marginTop: 2 },
  eventTypeBadge: { backgroundColor: 'rgba(255,255,255,0.6)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  eventTypeText: { fontSize: 10, color: '#3A3830', fontWeight: '500' },
  nav: { backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#E8E0CC', flexDirection: 'row', paddingBottom: 20, paddingTop: 8 },
  navItem: { flex: 1, alignItems: 'center', gap: 2 },
  navLbl: { fontSize: 9, color: '#9A9285' },
  navActive: { color: '#2C4A35', fontWeight: '600' },
});
