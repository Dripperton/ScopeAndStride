import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Calendar, ChevronRight, Clock, CheckCircle, XCircle, AlertCircle, Trash2, Square, CheckSquare } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../../lib/useProfile';
import { useTheme } from '../../context/ThemeContext';
import HomeButton from '../../lib/HomeButton';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SchedulingHub() {
  const router = useRouter();
  const { isOwner, isStaff, horseLinks, profile } = useProfile();
  const theme = useTheme(); const C = theme.colors; const F = theme.fonts;
  const canManage = isOwner || isStaff;

  const [tab, setTab] = useState<'setup' | 'slots' | 'requests' | 'my_slots' | 'my_requests'>(canManage ? 'requests' : 'my_slots');
  const [loading, setLoading] = useState(true);

  // Manager state
  const [horses, setHorses] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [caps, setCaps] = useState<Record<number, number>>({ 30: 1, 60: 1 });
  const [acceptingRequests, setAcceptingRequests] = useState(true);
  const [autoCloseDay, setAutoCloseDay] = useState<number | null>(null);
  const [autoCloseTime, setAutoCloseTime] = useState('');

  // Slot select/delete state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string[] | null>(null);

  // Rider state
  const [openSlots, setOpenSlots] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [schedulingOpen, setSchedulingOpen] = useState(true);

  useFocusEffect(useCallback(() => {
    if (canManage) loadManagerData();
    else loadRiderData();
  }, [canManage]));

  async function loadManagerData() {
    setLoading(true);
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((dayOfWeek + 6) % 7)); // Monday of current week
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const future = new Date(now); future.setDate(now.getDate() + 28);
    const futureStr = future.toISOString().split('T')[0];

    const [{ data: horsesData }, { data: slotsData }, { data: requestsData }, { data: capsData }, { data: settingsData }] = await Promise.all([
      supabase.from('horses').select('id, name, color').order('name'),
      supabase.from('lesson_slots').select('*').gte('date', weekStartStr).lte('date', futureStr).order('date').order('time'),
      supabase.from('lesson_requests').select('*, lesson_slots(date, time, duration_minutes, max_riders), horses(name)').eq('status', 'pending').order('created_at'),
      supabase.from('scheduling_caps').select('*'),
      supabase.from('scheduling_settings').select('*').eq('id', 1).single(),
    ]);

    if (horsesData) setHorses(horsesData);
    if (slotsData) {
      const slotIds = slotsData.map((s: any) => s.id);
      const { data: approvedData } = await supabase.from('lesson_requests').select('slot_id').eq('status', 'approved').in('slot_id', slotIds);
      const approvedCounts: Record<string, number> = {};
      approvedData?.forEach((r: any) => { approvedCounts[r.slot_id] = (approvedCounts[r.slot_id] || 0) + 1; });
      setSlots(slotsData.map((s: any) => ({ ...s, approvedCount: approvedCounts[s.id] || 0 })));
    }
    if (requestsData) { setRequests(requestsData); setPendingCount(requestsData.length); }
    if (capsData?.length) {
      const capMap: Record<number, number> = { 30: 1, 60: 1 };
      capsData.forEach((c: any) => { capMap[c.duration_minutes] = c.max_riders; });
      setCaps(capMap);
    }
    if (settingsData) {
      setAcceptingRequests(settingsData.accepting_requests ?? true);
      setAutoCloseDay(settingsData.auto_close_day ?? null);
      setAutoCloseTime(settingsData.auto_close_time ?? '');
    }
    setLoading(false);
  }

  async function loadRiderData() {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const future = new Date(); future.setDate(future.getDate() + 28);
    const futureStr = future.toISOString().split('T')[0];
    const myHorseIds = horseLinks.map(l => l.horse_id);

    const [{ data: slotsData }, { data: myReqData }, { data: settingsData }] = await Promise.all([
      supabase.from('lesson_slots').select('*').eq('is_open', true).gte('date', today).lte('date', futureStr).order('date').order('time'),
      myHorseIds.length > 0
        ? supabase.from('lesson_requests').select('*, lesson_slots(date, time, duration_minutes), horses(name)').in('horse_id', myHorseIds).not('status', 'in', '("cancelled","declined")').order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      supabase.from('scheduling_settings').select('accepting_requests').eq('id', 1).single(),
    ]);

    setSchedulingOpen(settingsData?.accepting_requests ?? true);
    if (slotsData) {
      const slotIds = slotsData.map((s: any) => s.id);
      const { data: approvedData } = await supabase.from('lesson_requests').select('slot_id').eq('status', 'approved').in('slot_id', slotIds);
      const approvedCounts: Record<string, number> = {};
      approvedData?.forEach((r: any) => { approvedCounts[r.slot_id] = (approvedCounts[r.slot_id] || 0) + 1; });
      setOpenSlots(slotsData.map((s: any) => ({ ...s, spotsLeft: s.max_riders - (approvedCounts[s.id] || 0) })));
    }
    if (myReqData) setMyRequests(myReqData as any[]);
    setLoading(false);
  }

  async function approveRequest(requestId: string, slotId: string, horseId: number, date: string, time: string, horseName: string, slotMaxRiders: number) {
    await supabase.from('lesson_requests').update({ status: 'approved', reviewed_by: profile?.id, reviewed_at: new Date().toISOString() }).eq('id', requestId);
    await supabase.from('events').insert({ date, time, type: 'lesson', title: `Lesson — ${horseName}`, horse_id: horseId });
    const { count } = await supabase.from('lesson_requests').select('*', { count: 'exact', head: true }).eq('slot_id', slotId).eq('status', 'approved');
    if ((count || 0) >= slotMaxRiders) {
      await supabase.from('lesson_slots').update({ is_open: false }).eq('id', slotId);
    }
    // Decrement package lessons remaining if applicable
    const { data: horseSched } = await supabase.from('horse_scheduling').select('scheduling_type, package_remaining').eq('horse_id', horseId).single();
    if (horseSched?.scheduling_type === 'package' && horseSched.package_remaining != null) {
      await supabase.from('horse_scheduling').update({ package_remaining: Math.max(0, horseSched.package_remaining - 1) }).eq('horse_id', horseId);
    }
    setRequests(prev => prev.filter(r => r.id !== requestId));
    setPendingCount(prev => prev - 1);
  }

  async function declineRequest(requestId: string) {
    await supabase.from('lesson_requests').update({ status: 'declined', reviewed_by: profile?.id, reviewed_at: new Date().toISOString() }).eq('id', requestId);
    setRequests(prev => prev.filter(r => r.id !== requestId));
    setPendingCount(prev => prev - 1);
  }

  function confirmCloseSlot(slotId: string) {
    setDeleteConfirm([slotId]);
  }

  async function deleteSlots(ids: string[]) {
    const { error } = await supabase.from('lesson_slots').delete().in('id', ids);
    if (error) { alert(`Error: ${error.message}`); return; }
    setSlots(prev => prev.filter(s => !ids.includes(s.id)));
    setSelectedIds([]);
    setSelectMode(false);
    setDeleteConfirm(null);
  }

  function toggleSelectSlot(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }

  async function saveCap(durationMinutes: number, maxRiders: number) {
    setCaps(prev => ({ ...prev, [durationMinutes]: maxRiders }));
    await supabase.from('scheduling_caps').upsert({ duration_minutes: durationMinutes, max_riders: maxRiders }, { onConflict: 'duration_minutes' });
  }

  async function toggleAcceptingRequests(val: boolean) {
    setAcceptingRequests(val);
    await supabase.from('scheduling_settings').upsert({ id: 1, accepting_requests: val }, { onConflict: 'id' });
  }

  async function saveAutoClose(day: number | null, time: string) {
    setAutoCloseDay(day);
    setAutoCloseTime(time);
    await supabase.from('scheduling_settings').upsert({ id: 1, auto_close_day: day, auto_close_time: time || null }, { onConflict: 'id' });
  }

  function confirmCancelRequest(requestId: string, slotId: string, wasApproved: boolean) {
    cancelRequest(requestId, slotId, wasApproved);
  }

  async function cancelRequest(requestId: string, slotId: string, wasApproved: boolean) {
    await supabase.from('lesson_requests').update({ status: 'cancelled' }).eq('id', requestId);
    if (wasApproved && slotId) {
      await supabase.from('lesson_slots').update({ is_open: true }).eq('id', slotId);
    }
    setMyRequests(prev => prev.filter(r => r.id !== requestId));
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function formatDuration(minutes: number): string {
    if (minutes === 30) return '30 min';
    if (minutes === 60) return '1 hr';
    return `${minutes} min`;
  }

  function formatTimeRange(timeStr: string, durationMinutes?: number): string {
    if (!durationMinutes) return timeStr;
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return timeStr;
    let hours = parseInt(match[1]);
    const mins = parseInt(match[2]);
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && hours !== 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    const endTotal = hours * 60 + mins + durationMinutes;
    const endH24 = Math.floor(endTotal / 60) % 24;
    const endMins = endTotal % 60;
    const endAmpm = endH24 < 12 ? 'AM' : 'PM';
    const endH12 = endH24 === 0 ? 12 : endH24 > 12 ? endH24 - 12 : endH24;
    const endStr = `${endH12}:${String(endMins).padStart(2, '0')} ${endAmpm}`;
    // Omit AM/PM from start if same period
    const startStr = ampm === endAmpm ? `${match[1]}:${match[2]}` : timeStr;
    return `${startStr}-${endStr}`;
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <View style={styles.headerLeft}>
          <HomeButton />
          <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>Lessons</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { backgroundColor: C.primary }]}>
        {(canManage
          ? [{ key: 'requests', label: pendingCount > 0 ? `Requests (${pendingCount})` : 'Requests' }, { key: 'slots', label: 'Slots' }, { key: 'setup', label: 'Setup' }]
          : [{ key: 'my_slots', label: 'Available' }, { key: 'my_requests', label: 'My Requests' }]
        ).map(t => (
          <Pressable key={t.key} style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]} onPress={() => { setTab(t.key as any); setSelectMode(false); setSelectedIds([]); }}>
            <Text style={[styles.tabText, tab === t.key && { color: C.headerText }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

          {/* MANAGER: REQUESTS */}
          {tab === 'requests' && canManage && (
            <>
              {requests.length === 0 ? (
                <View style={styles.emptyState}>
                  <CheckCircle size={40} color={C.cardBorder} />
                  <Text style={[styles.emptyTitle, { color: C.text, fontFamily: F.sansBold }]}>No pending requests</Text>
                  <Text style={[styles.emptyText, { color: C.textMuted }]}>All caught up.</Text>
                </View>
              ) : (
                requests.map(req => (
                  <View key={req.id} style={[styles.requestCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                    <View style={styles.requestInfo}>
                      <Text style={[styles.requestHorse, { color: C.text, fontFamily: F.sansBold }]}>{req.horses?.name || 'Unknown horse'}</Text>
                      <Text style={[styles.requestSlot, { color: C.textMuted, fontFamily: F.sans }]}>
                        {req.lesson_slots
                          ? `${formatDate(req.lesson_slots.date)} · ${req.lesson_slots.time}${req.lesson_slots.duration_minutes ? ` · ${formatDuration(req.lesson_slots.duration_minutes)}` : ''}`
                          : 'Slot unavailable'}
                      </Text>
                      {req.note ? <Text style={[styles.requestNote, { color: C.textMuted, fontFamily: F.sans }]}>"{req.note}"</Text> : null}
                    </View>
                    <View style={styles.requestActions}>
                      <Pressable
                        style={[styles.approveBtn, { backgroundColor: C.primary }]}
                        onPress={() => approveRequest(req.id, req.slot_id, req.horse_id, req.lesson_slots?.date, req.lesson_slots?.time, req.horses?.name, req.lesson_slots?.max_riders ?? 1)}
                      >
                        <CheckCircle size={14} color="white" />
                        <Text style={[styles.approveBtnText, { color: 'white', fontFamily: F.sansBold }]}>Approve</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.declineBtn, { borderColor: C.cardBorder }]}
                        onPress={() => declineRequest(req.id)}
                      >
                        <XCircle size={14} color={C.error} />
                        <Text style={[styles.declineBtnText, { color: C.error, fontFamily: F.sansMedium }]}>Decline</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </>
          )}

          {/* MANAGER: SLOTS */}
          {tab === 'slots' && canManage && (
            <>
              <View style={styles.slotActions}>
                <Pressable
                  style={[styles.openSlotsBtn, { backgroundColor: C.primary, flex: 1 }]}
                  onPress={() => router.push('/scheduling/add-slots')}
                >
                  <Text style={[styles.openSlotsBtnText, { color: 'white', fontFamily: F.sansBold }]}>+ Open New Slots</Text>
                </Pressable>
                {slots.some(s => s.is_open) && (
                  <Pressable
                    style={[styles.selectBtn, { borderColor: C.cardBorder, backgroundColor: selectMode ? C.activeBg : C.card }]}
                    onPress={() => { setSelectMode(m => !m); setSelectedIds([]); }}
                  >
                    <Text style={[styles.selectBtnText, { color: selectMode ? C.primary : C.textMuted, fontFamily: F.sansBold }]}>
                      {selectMode ? 'Cancel' : 'Select'}
                    </Text>
                  </Pressable>
                )}
              </View>

              {selectMode && (
                <View style={styles.selectBar}>
                  <Pressable
                    style={styles.selectAllBtn}
                    onPress={() => {
                      const openIds = slots.filter(s => s.is_open).map(s => s.id);
                      const allSelected = openIds.every(id => selectedIds.includes(id));
                      setSelectedIds(allSelected ? [] : openIds);
                    }}
                  >
                    {(() => {
                      const openIds = slots.filter(s => s.is_open).map(s => s.id);
                      const allSelected = openIds.length > 0 && openIds.every(id => selectedIds.includes(id));
                      return allSelected
                        ? <CheckSquare size={16} color={C.primary} />
                        : <Square size={16} color={C.textMuted} />;
                    })()}
                    <Text style={[styles.selectAllText, { color: C.textMuted, fontFamily: F.sans }]}>Select all</Text>
                  </Pressable>
                  {selectedIds.length > 0 && (
                    <Pressable
                      style={[styles.deleteSelectedBtn, { backgroundColor: '#FDECEA' }]}
                      onPress={() => setDeleteConfirm(selectedIds)}
                    >
                      <Trash2 size={14} color="#8B2E2E" />
                      <Text style={[styles.deleteSelectedText, { color: '#8B2E2E', fontFamily: F.sansBold }]}>
                        Delete {selectedIds.length}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}

              {slots.length === 0 ? (
                <View style={styles.emptyState}>
                  <Clock size={40} color={C.cardBorder} />
                  <Text style={[styles.emptyTitle, { color: C.text, fontFamily: F.sansBold }]}>No slots open</Text>
                  <Text style={[styles.emptyText, { color: C.textMuted }]}>Tap the button above to open available times.</Text>
                </View>
              ) : (
                slots.map(slot => (
                  <Pressable
                    key={slot.id}
                    style={[styles.slotRow, { backgroundColor: C.card, borderColor: selectMode && selectedIds.includes(slot.id) ? C.primary : C.cardBorder }]}
                    onPress={() => selectMode && slot.is_open ? toggleSelectSlot(slot.id) : null}
                  >
                    <View style={styles.slotInfo}>
                      <Text style={[styles.slotDate, { color: C.text, fontFamily: F.sansBold }]}>{formatDate(slot.date)}</Text>
                      <Text style={[styles.slotMeta, { color: C.textMuted, fontFamily: F.sans }]}>
                        {formatTimeRange(slot.time, slot.duration_minutes)}
                      </Text>
                    </View>
                    <View style={styles.slotRight}>
                      <View style={[styles.slotBadge, { backgroundColor: slot.is_open ? '#EDF5EF' : '#FDECEA' }]}>
                        <Text style={[styles.slotBadgeText, { color: slot.is_open ? '#4A7C59' : '#8B2E2E', fontFamily: F.sansBold }]}>
                          {slot.approvedCount}/{slot.max_riders} riders
                        </Text>
                      </View>
                      {!selectMode && slot.is_open && (
                        <Pressable onPress={() => confirmCloseSlot(slot.id)} style={styles.closeSlotBtn}>
                          <Trash2 size={15} color={C.textMuted} />
                        </Pressable>
                      )}
                      {selectMode && slot.is_open && (
                        <View style={styles.checkbox}>
                          {selectedIds.includes(slot.id)
                            ? <CheckSquare size={18} color={C.primary} />
                            : <Square size={18} color={C.textMuted} />
                          }
                        </View>
                      )}
                    </View>
                  </Pressable>
                ))
              )}
            </>
          )}

          {/* MANAGER: SETUP */}
          {tab === 'setup' && canManage && (
            <>
              {/* Schedule open/closed toggle */}
              <View style={[styles.settingsCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>SIGN-UPS</Text>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={[styles.toggleLabel, { color: C.text, fontFamily: F.sansBold }]}>
                      {acceptingRequests ? 'Open for requests' : 'Closed for requests'}
                    </Text>
                    <Text style={[styles.toggleHint, { color: C.textMuted, fontFamily: F.sans }]}>
                      Riders {acceptingRequests ? 'can' : 'cannot'} currently submit lesson requests.
                    </Text>
                  </View>
                  <Switch
                    value={acceptingRequests}
                    onValueChange={toggleAcceptingRequests}
                    trackColor={{ false: C.cardBorder, true: C.primary }}
                    thumbColor="white"
                  />
                </View>

                <Text style={[styles.autoCloseLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>AUTO-CLOSE</Text>
                <Text style={[styles.toggleHint, { color: C.textMuted, fontFamily: F.sans, marginBottom: 8 }]}>
                  Stores your preference. Auto-close requires a scheduled backend job (coming soon).
                </Text>
                <View style={styles.dayChips}>
                  <Pressable
                    style={[styles.dayChip, { borderColor: C.cardBorder }, autoCloseDay === null && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                    onPress={() => saveAutoClose(null, autoCloseTime)}
                  >
                    <Text style={[styles.dayChipText, { color: C.textMuted, fontFamily: F.sans }, autoCloseDay === null && { color: C.primary, fontFamily: F.sansBold }]}>None</Text>
                  </Pressable>
                  {DAYS_OF_WEEK.map((day, i) => (
                    <Pressable
                      key={day}
                      style={[styles.dayChip, { borderColor: C.cardBorder }, autoCloseDay === i && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                      onPress={() => saveAutoClose(i, autoCloseTime)}
                    >
                      <Text style={[styles.dayChipText, { color: C.textMuted, fontFamily: F.sans }, autoCloseDay === i && { color: C.primary, fontFamily: F.sansBold }]}>{day}</Text>
                    </Pressable>
                  ))}
                </View>
                {autoCloseDay !== null && (
                  <TextInput
                    style={[styles.timeInput, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
                    value={autoCloseTime}
                    onChangeText={setAutoCloseTime}
                    onEndEditing={() => saveAutoClose(autoCloseDay, autoCloseTime)}
                    placeholder="Time (e.g. 10:00 PM)"
                    placeholderTextColor={C.textMuted}
                  />
                )}
              </View>

              {/* Rider caps */}
              <View style={[styles.settingsCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>RIDERS PER SLOT</Text>
                <Text style={[styles.toggleHint, { color: C.textMuted, fontFamily: F.sans, marginBottom: 12 }]}>
                  Max riders allowed per slot, by lesson length.
                </Text>
                {([30, 60] as const).map(dur => (
                  <View key={dur} style={styles.capRow}>
                    <Text style={[styles.capLabel, { color: C.text, fontFamily: F.sansBold }]}>
                      {dur === 30 ? 'Half Hour' : 'Hour'}
                    </Text>
                    <View style={styles.capChips}>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                        <Pressable
                          key={n}
                          style={[styles.capChip, { borderColor: C.cardBorder }, caps[dur] === n && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                          onPress={() => saveCap(dur, n)}
                        >
                          <Text style={[styles.capChipText, { color: C.textMuted, fontFamily: F.sans }, caps[dur] === n && { color: C.primary, fontFamily: F.sansBold }]}>
                            {n}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}
              </View>

              {/* Per-horse scheduling type */}
              <Text style={[styles.toggleHint, { color: C.textMuted, fontFamily: F.sans, marginBottom: 12 }]}>
                Set the scheduling type for each horse. This controls how their rider books lessons.
              </Text>
              {horses.map(horse => (
                <Pressable
                  key={horse.id}
                  style={[styles.horseSetupRow, { backgroundColor: C.card, borderColor: C.cardBorder }]}
                  onPress={() => router.push({ pathname: '/scheduling/configure', params: { horseId: horse.id, horseName: horse.name } })}
                >
                  <View style={[styles.horseColorDot, { backgroundColor: horse.color || C.primary }]} />
                  <Text style={[styles.horseSetupName, { color: C.text, fontFamily: F.sansBold }]}>{horse.name}</Text>
                  <ChevronRight size={16} color={C.textMuted} />
                </Pressable>
              ))}
            </>
          )}

          {/* RIDER: AVAILABLE SLOTS */}
          {tab === 'my_slots' && !canManage && (
            <>
              {!schedulingOpen ? (
                <View style={styles.emptyState}>
                  <Clock size={40} color={C.cardBorder} />
                  <Text style={[styles.emptyTitle, { color: C.text, fontFamily: F.sansBold }]}>Sign-ups are closed</Text>
                  <Text style={[styles.emptyText, { color: C.textMuted }]}>Check back soon when your barn reopens scheduling.</Text>
                </View>
              ) : openSlots.length === 0 ? (
                <View style={styles.emptyState}>
                  <Calendar size={40} color={C.cardBorder} />
                  <Text style={[styles.emptyTitle, { color: C.text, fontFamily: F.sansBold }]}>No open slots</Text>
                  <Text style={[styles.emptyText, { color: C.textMuted }]}>Check back when your barn opens scheduling.</Text>
                </View>
              ) : (
                openSlots.map(slot => (
                  <Pressable
                    key={slot.id}
                    style={[styles.slotRow, { backgroundColor: C.card, borderColor: C.cardBorder }]}
                    onPress={() => router.push({ pathname: '/scheduling/request', params: { slotId: slot.id, date: slot.date, time: slot.time, duration: slot.duration_minutes, spotsLeft: slot.spotsLeft } })}
                  >
                    <View style={styles.slotInfo}>
                      <Text style={[styles.slotDate, { color: C.text, fontFamily: F.sansBold }]}>{formatDate(slot.date)}</Text>
                      <Text style={[styles.slotMeta, { color: C.textMuted, fontFamily: F.sans }]}>
                        {formatTimeRange(slot.time, slot.duration_minutes)}
                        {slot.max_riders > 1 ? ` · ${slot.spotsLeft} spot${slot.spotsLeft !== 1 ? 's' : ''} left` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.requestLink, { color: C.primary, fontFamily: F.sansBold }]}>Request →</Text>
                  </Pressable>
                ))
              )}
            </>
          )}

          {/* RIDER: MY REQUESTS */}
          {tab === 'my_requests' && !canManage && (
            <>
              {myRequests.length === 0 ? (
                <View style={styles.emptyState}>
                  <AlertCircle size={40} color={C.cardBorder} />
                  <Text style={[styles.emptyTitle, { color: C.text, fontFamily: F.sansBold }]}>No requests yet</Text>
                  <Text style={[styles.emptyText, { color: C.textMuted }]}>Request a slot from the Available tab.</Text>
                </View>
              ) : (
                myRequests.map(req => (
                  <View key={req.id} style={[styles.requestCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                    <View style={styles.requestInfo}>
                      <Text style={[styles.requestHorse, { color: C.text, fontFamily: F.sansBold }]}>{req.horses?.name}</Text>
                      <Text style={[styles.requestSlot, { color: C.textMuted, fontFamily: F.sans }]}>
                        {req.lesson_slots
                          ? `${formatDate(req.lesson_slots.date)} · ${req.lesson_slots.time}${req.lesson_slots.duration_minutes ? ` · ${formatDuration(req.lesson_slots.duration_minutes)}` : ''}`
                          : '—'}
                      </Text>
                    </View>
                    <View style={styles.riderRequestRight}>
                      <View style={[styles.statusBadge, {
                        backgroundColor: req.status === 'approved' ? '#EDF5EF' : req.status === 'declined' ? '#FDECEA' : req.status === 'cancelled' ? C.cardBorder : C.activeBg
                      }]}>
                        <Text style={[styles.statusBadgeText, {
                          color: req.status === 'approved' ? '#4A7C59' : req.status === 'declined' ? '#8B2E2E' : req.status === 'cancelled' ? C.textMuted : C.primary,
                          fontFamily: F.sansBold
                        }]}>
                          {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                        </Text>
                      </View>
                      {(req.status === 'pending' || req.status === 'approved') && (
                        <Pressable onPress={() => confirmCancelRequest(req.id, req.slot_id, req.status === 'approved')} style={styles.cancelBtn}>
                          <Text style={[styles.cancelBtnText, { color: C.textMuted, fontFamily: F.sans }]}>Cancel</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))
              )}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Delete confirmation modal */}
      <Modal visible={deleteConfirm !== null} transparent animationType="fade" onRequestClose={() => setDeleteConfirm(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: C.card }]}>
            <Text style={[styles.modalTitle, { color: C.text, fontFamily: F.sansBold }]}>Delete Slot{deleteConfirm && deleteConfirm.length > 1 ? 's' : ''}?</Text>
            <Text style={[styles.modalBody, { color: C.textMuted, fontFamily: F.sans }]}>
              {deleteConfirm && deleteConfirm.length > 1
                ? `This will permanently remove ${deleteConfirm.length} slots. Any pending requests for these slots will remain in the system.`
                : 'This will permanently remove the slot. Any pending requests for this slot will remain in the system.'}
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalCancel, { borderColor: C.cardBorder }]} onPress={() => setDeleteConfirm(null)}>
                <Text style={[styles.modalCancelText, { color: C.textMuted, fontFamily: F.sansBold }]}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalDelete} onPress={() => deleteConfirm && deleteSlots(deleteConfirm)}>
                <Text style={[styles.modalDeleteText, { fontFamily: F.sansBold }]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)' },
  tabBtnActive: { backgroundColor: 'rgba(255,255,255,0.35)' },
  tabText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  body: { flex: 1, padding: 16 },
  slotActions: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  openSlotsBtn: { borderRadius: 10, padding: 14, alignItems: 'center' },
  openSlotsBtnText: { fontSize: 14, fontWeight: '600' },
  selectBtn: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  selectBtnText: { fontSize: 13 },
  selectBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginBottom: 8 },
  selectAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  selectAllText: { fontSize: 13 },
  deleteSelectedBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  deleteSelectedText: { fontSize: 13 },
  checkbox: { marginLeft: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  modalCard: { borderRadius: 18, padding: 24, width: '100%', gap: 12, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20 },
  modalTitle: { fontSize: 17 },
  modalBody: { fontSize: 14, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancel: { flex: 1, borderWidth: 1.5, borderRadius: 10, padding: 13, alignItems: 'center' },
  modalCancelText: { fontSize: 14 },
  modalDelete: { flex: 1, backgroundColor: '#8B2E2E', borderRadius: 10, padding: 13, alignItems: 'center' },
  modalDeleteText: { color: 'white', fontSize: 14 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptyText: { fontSize: 13 },
  slotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  slotInfo: { gap: 2, flex: 1 },
  slotDate: { fontSize: 14 },
  slotMeta: { fontSize: 12 },
  slotRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slotBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  slotBadgeText: { fontSize: 11 },
  closeSlotBtn: { padding: 4 },
  requestCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10, gap: 12 },
  requestInfo: { gap: 4 },
  requestHorse: { fontSize: 14 },
  requestSlot: { fontSize: 12 },
  requestNote: { fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  requestActions: { flexDirection: 'row', gap: 8 },
  approveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  approveBtnText: { fontSize: 13 },
  declineBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  declineBtnText: { fontSize: 13 },
  riderRequestRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 11 },
  cancelBtn: { paddingVertical: 4 },
  cancelBtnText: { fontSize: 12 },
  settingsCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  toggleInfo: { flex: 1, gap: 2 },
  toggleLabel: { fontSize: 14 },
  toggleHint: { fontSize: 12, lineHeight: 17 },
  autoCloseLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  dayChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  dayChip: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  dayChipText: { fontSize: 12 },
  timeInput: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 13 },
  capRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  capLabel: { fontSize: 13, width: 72 },
  capChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  capChip: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  capChipText: { fontSize: 13 },
  horseSetupRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  horseColorDot: { width: 12, height: 12, borderRadius: 6 },
  horseSetupName: { flex: 1, fontSize: 14 },
  requestLink: { fontSize: 13 },
});
