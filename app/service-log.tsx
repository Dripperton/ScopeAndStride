import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Wrench, Stethoscope, Syringe, Pill, Activity, FileText, ExternalLink, QrCode, CheckCircle, Circle, Trash2, ChevronDown, ChevronRight, Plus } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useProfile } from '../lib/useProfile';
import { useLanguage } from '../lib/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import HomeButton from '../lib/HomeButton';
import { useBarnData } from '../lib/BarnDataContext';

const SERVICE_META: any = {
  farrier:     { Icon: Wrench,      label: 'Farrier',     color: '#B08C4A' },
  vet:         { Icon: Stethoscope, label: 'Vet',         color: '#1A3A4A' },
  vaccination: { Icon: Syringe,     label: 'Vaccination', color: '#4A3B6B' },
  medication:  { Icon: Pill,        label: 'Medication',  color: '#6B4226' },
  bodywork:    { Icon: Activity,    label: 'Bodywork',    color: '#4A7C59' },
  dental:      { Icon: FileText,    label: 'Dental',      color: '#3A3830' },
  other:       { Icon: FileText,    label: 'Other',       color: '#9A9285' },
};

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'farrier', label: 'Farrier' },
  { value: 'vet', label: 'Vet' },
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'medication', label: 'Medication' },
  { value: 'bodywork', label: 'Bodywork' },
  { value: 'dental', label: 'Dental' },
  { value: 'other', label: 'Other' },
];


export default function ServiceLog() {
  const router = useRouter();
  const { canEdit, isOwner, isStaff } = useProfile();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const { serviceVisits: visits, barnQrToken, serviceVisitsLoading, refreshServiceVisits } = useBarnData();
  const [filter, setFilter] = useState('all');
  const [qrVisible, setQrVisible] = useState(false);
  const [qrCopied, setQrCopied] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<'time' | 'horse'>('time');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useFocusEffect(useCallback(() => {
    refreshServiceVisits();
  }, []));

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSection(key: string) {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function switchViewMode(mode: 'time' | 'horse') {
    setViewMode(mode);
    setExpandedSections(new Set());
  }

  function switchFilter(value: string) {
    setFilter(value);
    setExpandedSections(new Set());
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return;
    const confirmed = Platform.OS === 'web' ? confirm(`Delete ${selectedIds.size} record${selectedIds.size !== 1 ? 's' : ''}?`) : true;
    if (!confirmed) return;
    setDeleting(true);
    await supabase.from('service_visits').delete().in('id', Array.from(selectedIds));
    await refreshServiceVisits();
    setSelectedIds(new Set());
    setSelectMode(false);
    setDeleting(false);
  }

  if (!isOwner && !isStaff) {
    return (
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[styles.header, { backgroundColor: C.primary }]}>
          <HomeButton />
          <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Service Log')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 16, color: C.textMuted, textAlign: 'center', padding: 40, fontFamily: F.sans }}>{t("You don't have permission to view the service log.")}</Text>
        </View>
      </View>
    );
  }

  const filtered = filter === 'all' ? visits : visits.filter(v => v.service_type === filter);

  function groupByTime(items: any[]) {
    const now = new Date();
    const startOf = (d: Date) => { d.setHours(0, 0, 0, 0); return d; };
    const today = startOf(new Date(now));
    const weekStart = startOf(new Date(now));
    // Monday-based week start
    const dayOfWeek = weekStart.getDay(); // 0=Sun
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    weekStart.setDate(weekStart.getDate() + diffToMon);
    const lastWeekStart = startOf(new Date(weekStart)); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const monthStart = startOf(new Date(now)); monthStart.setDate(1);
    const currentYear = now.getFullYear();
    const yearStart = new Date(currentYear, 0, 1);

    // Fixed buckets
    const todayBucket:     { key: string; label: string; items: any[] } = { key: 'today',     label: 'Today',     items: [] };
    const weekBucket:      { key: string; label: string; items: any[] } = { key: 'week',      label: 'This Week', items: [] };
    const lastWeekBucket:  { key: string; label: string; items: any[] } = { key: 'last-week', label: 'Last Week', items: [] };
    const monthBucket:     { key: string; label: string; items: any[] } = { key: 'month',     label: 'This Month', items: [] };
    const olderBucket:     { key: string; label: string; items: any[] } = { key: 'older',     label: 'Older',     items: [] };
    // Monthly buckets for earlier months this year, keyed as 'month-YYYY-M'
    const monthlyMap = new Map<string, { key: string; label: string; items: any[] }>();

    for (const v of items) {
      const d = new Date(v.date + 'T12:00:00');
      if (d >= today) {
        todayBucket.items.push(v);
      } else if (d >= weekStart) {
        weekBucket.items.push(v);
      } else if (d >= lastWeekStart) {
        lastWeekBucket.items.push(v);
      } else if (d >= monthStart) {
        monthBucket.items.push(v);
      } else if (d >= yearStart) {
        // Earlier month this year — build a per-month bucket
        const y = d.getFullYear();
        const m = d.getMonth();
        const key = `month-${y}-${m}`;
        if (!monthlyMap.has(key)) {
          const label = new Date(y, m).toLocaleString('en-US', { month: 'long', year: 'numeric' });
          monthlyMap.set(key, { key, label, items: [] });
        }
        monthlyMap.get(key)!.items.push(v);
      } else {
        olderBucket.items.push(v);
      }
    }

    // Sort monthly buckets most-recent-first
    const monthlySorted = Array.from(monthlyMap.values()).sort((a, b) => {
      // key format: 'month-YYYY-M'
      const [, ay, am] = a.key.split('-').map(Number);
      const [, by, bm] = b.key.split('-').map(Number);
      return (by * 12 + bm) - (ay * 12 + am);
    });

    const all = [todayBucket, weekBucket, lastWeekBucket, monthBucket, ...monthlySorted, olderBucket];
    return all.filter(b => b.items.length > 0);
  }

  function groupByHorse(items: any[]): { key: string; label: string; color: string | null; items: any[] }[] {
    const map = new Map<string, { label: string; color: string | null; items: any[] }>();
    for (const v of items) {
      const name = v.horses?.name || 'Unknown';
      if (!map.has(name)) {
        map.set(name, { label: name, color: v.horses?.color || null, items: [] });
      }
      map.get(name)!.items.push(v);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({ key, ...val }));
  }

  function renderVisitRow(visit: any, isLast: boolean) {
    const meta = SERVICE_META[visit.service_type] || SERVICE_META.other;
    return (
      <Pressable key={visit.id} style={[styles.row, { borderBottomColor: C.cardSeparator }, isLast && styles.rowLast]} onPress={() => selectMode && toggleSelect(visit.id)}>
        {selectMode && (
          <View style={styles.checkbox}>
            {selectedIds.has(visit.id)
              ? <CheckCircle size={22} color={C.primary} />
              : <Circle size={22} color={C.cardBorder} />}
          </View>
        )}
        <View style={[styles.iconBg, { backgroundColor: meta.color }]}>
          <meta.Icon size={16} color="white" />
        </View>
        <View style={styles.rowContent}>
          <View style={styles.rowTop}>
            <Text style={[styles.rowTitle, { color: C.text, fontFamily: F.sansBold }]} numberOfLines={1}>{visit.title || t(meta.label)}</Text>
            <Text style={[styles.rowDate, { color: C.textMuted, fontFamily: F.sans }]}>{visit.date}</Text>
          </View>
          <View style={styles.rowMeta}>
            <View style={[styles.horsePill, { backgroundColor: (visit.horses?.color || C.primary) + '22' }]}>
              <Text style={[styles.horsePillText, { color: visit.horses?.color || C.primary, fontFamily: F.sansBold }]} numberOfLines={1}>
                {visit.horses?.name || 'Unknown'}
              </Text>
            </View>
            {visit.provider_name ? <Text style={[styles.providerText, { color: C.textMuted, fontFamily: F.sans }]}>{visit.provider_name}</Text> : null}
          </View>
          {visit.next_appointment_date ? (
            <Text style={[styles.subText, { color: C.textWarm, fontFamily: F.sans }]}>{t('Next appt')}: {visit.next_appointment_date}</Text>
          ) : null}
          {visit.expiry_date ? (
            <Text style={[styles.subText, { color: C.textWarm, fontFamily: F.sans }]}>{t('Expires')}: {visit.expiry_date}</Text>
          ) : null}
          {visit.notes ? <Text style={[styles.notesText, { color: C.text, fontFamily: F.sans }]} numberOfLines={2}>{visit.notes}</Text> : null}
          {visit.external_invoice_url ? (
            <Pressable onPress={() => Linking.openURL(visit.external_invoice_url)} style={styles.invoiceLink}>
              <ExternalLink size={11} color={C.primary} />
              <Text style={[styles.invoiceLinkText, { color: C.primary, fontFamily: F.sans }]}>{t('View Invoice')}</Text>
            </Pressable>
          ) : null}
          {visit.amount ? (
            <Text style={[styles.amountText, { color: C.textMuted, fontFamily: F.sans }]}>
              ${Number(visit.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              {visit.barn_invoiced ? ` · ${t('Adding to invoice')}` : ''}
            </Text>
          ) : null}
        </View>
        {canEdit && !selectMode ? (
          <Pressable
            style={({ hovered }: any) => [styles.editBtn, { borderColor: C.cardBorder }, hovered && { borderColor: C.primary, backgroundColor: C.activeBg }]}
            onPress={() => router.push({ pathname: '/horse/service/edit', params: { visitId: visit.id } })}
          >
            <Text style={[styles.editBtnText, { color: C.primary, fontFamily: F.sansMedium }]}>{t('Edit')}</Text>
          </Pressable>
        ) : null}
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <HomeButton />
        <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Service Log')}</Text>
        <View style={styles.headerRight}>
          {canEdit && !selectMode && (
            <Pressable
              style={({ hovered }: any) => [styles.qrBtn, { backgroundColor: C.secondaryAlpha15 }, hovered && { backgroundColor: C.secondaryAlpha30 }]}
              onPress={() => router.push('/horse/service/add')}
            >
              <Plus size={18} color={C.secondary} />
            </Pressable>
          )}
          {canEdit && (
            <Pressable
              style={({ hovered }: any) => [styles.selectBtn, { borderColor: C.secondaryAlpha30 }, selectMode && { borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)' }, hovered && { backgroundColor: 'rgba(255,255,255,0.1)' }]}
              onPress={() => { setSelectMode(p => !p); setSelectedIds(new Set()); }}
            >
              <Text style={[styles.selectBtnText, { color: C.secondary, fontFamily: F.sansBold }, selectMode && { color: 'rgba(255,255,255,0.7)' }]}>{selectMode ? t('Cancel') : t('Select')}</Text>
            </Pressable>
          )}
          {!selectMode && barnQrToken ? (
            <Pressable style={({ hovered }: any) => [styles.qrBtn, { backgroundColor: C.secondaryAlpha15 }, hovered && { backgroundColor: C.secondaryAlpha30 }]} onPress={() => setQrVisible(true)}>
              <QrCode size={18} color={C.secondary} />
            </Pressable>
          ) : !selectMode ? (
            <View style={{ width: 40 }} />
          ) : null}
        </View>
      </View>

      {/* Barn QR Modal */}
      {barnQrToken ? (() => {
        const origin = Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.origin
          : (process.env.EXPO_PUBLIC_APP_URL || 'https://your-app.com');
        const qrUrl = `${origin}/barn-entry/${barnQrToken}`;
        const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrUrl)}&size=240x240&margin=12`;
        return (
          <Modal visible={qrVisible} transparent animationType="fade" onRequestClose={() => setQrVisible(false)}>
            <Pressable style={styles.qrOverlay} onPress={() => setQrVisible(false)}>
              <Pressable style={[styles.qrModal, { backgroundColor: C.card }]} onPress={() => {}}>
                <Text style={[styles.qrModalTitle, { color: C.text, fontFamily: F.sansBold }]}>{t('Barn Provider QR')}</Text>
                <Text style={[styles.qrModalSubtitle, { color: C.textMuted, fontFamily: F.sans }]}>{t('Providers scan this to log visits for multiple horses at once')}</Text>
                <Image source={{ uri: qrImageUrl }} style={styles.qrImage} resizeMode="contain" />
                <Text style={[styles.qrUrlText, { color: C.textMuted, fontFamily: F.sans }]} numberOfLines={2} selectable>{qrUrl}</Text>
                <Pressable
                  style={({ hovered }: any) => [styles.qrCopyBtn, { backgroundColor: C.primary }, hovered && { backgroundColor: C.primaryDark }]}
                  onPress={() => {
                    if (Platform.OS === 'web') {
                      (navigator as any).clipboard?.writeText(qrUrl);
                      setQrCopied(true);
                      setTimeout(() => setQrCopied(false), 2000);
                    } else {
                      Share.share({ message: qrUrl, url: qrUrl });
                    }
                  }}
                >
                  <Text style={[styles.qrCopyBtnText, { color: C.card, fontFamily: F.sansBold }]}>{qrCopied ? t('Copied!') : Platform.OS === 'web' ? t('Copy Link') : t('Share Link')}</Text>
                </Pressable>
                <Pressable onPress={() => setQrVisible(false)} style={styles.qrCloseBtn}>
                  <Text style={[styles.qrCloseBtnText, { color: C.textMuted, fontFamily: F.sans }]}>{t('Close')}</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>
        );
      })() : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.filterBar, { backgroundColor: C.card, borderBottomColor: C.cardBorder }]} contentContainerStyle={styles.filterBarContent}>
        {FILTERS.map(f => (
          <Pressable
            key={f.value}
            style={[styles.filterChip, { borderColor: C.cardBorder, backgroundColor: C.card }, filter === f.value && { backgroundColor: C.primary, borderColor: C.primary }]}
            onPress={() => switchFilter(f.value)}
          >
            <Text style={[styles.filterChipText, { color: C.textMuted, fontFamily: F.sansMedium }, filter === f.value && { color: 'white', fontFamily: F.sansBold }]}>{t(f.label)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[styles.viewToggleRow, { backgroundColor: C.card, borderBottomColor: C.cardBorder }]}>
        <Pressable
          style={[styles.viewToggleTab, viewMode === 'time' && { borderBottomColor: C.primary, borderBottomWidth: 2 }]}
          onPress={() => switchViewMode('time')}
        >
          <Text style={[styles.viewToggleTabText, { color: viewMode === 'time' ? C.primary : C.textMuted, fontFamily: viewMode === 'time' ? F.sansBold : F.sans }]}>{t('By Date')}</Text>
        </Pressable>
        <Pressable
          style={[styles.viewToggleTab, viewMode === 'horse' && { borderBottomColor: C.primary, borderBottomWidth: 2 }]}
          onPress={() => switchViewMode('horse')}
        >
          <Text style={[styles.viewToggleTabText, { color: viewMode === 'horse' ? C.primary : C.textMuted, fontFamily: viewMode === 'horse' ? F.sansBold : F.sans }]}>{t('By Horse')}</Text>
        </Pressable>
      </View>

      {serviceVisitsLoading ? (
        <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 60 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: C.textMuted, fontFamily: F.sans }]}>{t('No service records yet.')}</Text>
        </View>
      ) : (
        <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">
          {viewMode === 'time'
            ? groupByTime(filtered).map(bucket => {
                const isOpen = expandedSections.has(bucket.key);
                return (
                  <View key={bucket.key}>
                    <Pressable style={styles.sectionHeader} onPress={() => toggleSection(bucket.key)}>
                      <View style={styles.sectionHeaderLeft}>
                        <Text style={[styles.timeBucketLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{bucket.label}</Text>
                      </View>
                      <View style={styles.sectionHeaderRight}>
                        <Text style={[styles.sectionCount, { color: C.textMuted }]}>{bucket.items.length}</Text>
                        {isOpen
                          ? <ChevronDown size={16} color={C.textMuted} />
                          : <ChevronRight size={16} color={C.textMuted} />}
                      </View>
                    </Pressable>
                    {isOpen && (
                      <View style={[styles.list, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                        {bucket.items.map((visit, index) => renderVisitRow(visit, index === bucket.items.length - 1))}
                      </View>
                    )}
                  </View>
                );
              })
            : groupByHorse(filtered).map(group => {
                const isOpen = expandedSections.has(group.key);
                const horseColor = group.color || C.primary;
                return (
                  <View key={group.key}>
                    <Pressable style={styles.sectionHeader} onPress={() => toggleSection(group.key)}>
                      <View style={styles.sectionHeaderLeft}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: horseColor }} />
                          <Text style={[styles.timeBucketLabel, { color: C.text, fontFamily: F.sansBold }]}>{group.label}</Text>
                        </View>
                      </View>
                      <View style={styles.sectionHeaderRight}>
                        <Text style={[styles.sectionCount, { color: C.textMuted }]}>{group.items.length}</Text>
                        {isOpen
                          ? <ChevronDown size={16} color={C.textMuted} />
                          : <ChevronRight size={16} color={C.textMuted} />}
                      </View>
                    </Pressable>
                    {isOpen && (
                      <View style={[styles.list, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                        {group.items.map((visit, index) => renderVisitRow(visit, index === group.items.length - 1))}
                      </View>
                    )}
                  </View>
                );
              })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {selectMode && (
        <View style={[styles.deleteBar, { backgroundColor: C.card, borderTopColor: C.cardBorder }]}>
          <Text style={[styles.deleteBarCount, { color: C.textMuted, fontFamily: F.sansMedium }]}>{selectedIds.size} selected</Text>
          <Pressable
            style={({ hovered }: any) => [styles.deleteBarBtn, { backgroundColor: C.error }, selectedIds.size === 0 && styles.deleteBarBtnDisabled, hovered && selectedIds.size > 0 && { backgroundColor: '#6B1E1E' }]}
            onPress={deleteSelected}
            disabled={selectedIds.size === 0 || deleting}
          >
            {deleting
              ? <ActivityIndicator color="white" size="small" />
              : <>
                  <Trash2 size={15} color="white" />
                  <Text style={[styles.deleteBarBtnText, { fontFamily: F.sansBold }]}>{t('Delete Selected')}</Text>
                </>}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  filterBar: { borderBottomWidth: 1, flexGrow: 0 },
  filterBarContent: { flexDirection: 'row', padding: 10, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  filterChipText: { fontSize: 12, fontWeight: '500' },
  body: { flex: 1 },
  list: { margin: 16, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12, borderBottomWidth: 1 },
  rowLast: { borderBottomWidth: 0 },
  iconBg: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  rowContent: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  rowDate: { fontSize: 12, flexShrink: 0 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' },
  horsePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  horsePillText: { fontSize: 11, fontWeight: '600' },
  providerText: { fontSize: 12 },
  subText: { fontSize: 12, marginTop: 3 },
  notesText: { fontSize: 12, marginTop: 4, lineHeight: 17, fontStyle: 'italic' },
  invoiceLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  invoiceLinkText: { fontSize: 11, textDecorationLine: 'underline' },
  amountText: { fontSize: 12, marginTop: 3 },
  editBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, alignSelf: 'flex-start' },
  editBtnText: { fontSize: 12, fontWeight: '500' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, fontStyle: 'italic' },
  qrBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  qrOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  qrModal: { borderRadius: 20, padding: 28, alignItems: 'center', width: 300, maxWidth: '90%' },
  qrModalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  qrModalSubtitle: { fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 18 },
  qrImage: { width: 200, height: 200, marginBottom: 12 },
  qrUrlText: { fontSize: 11, textAlign: 'center', marginBottom: 16, lineHeight: 16 },
  qrCopyBtn: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24, marginBottom: 10 },
  qrCopyBtnText: { fontSize: 14, fontWeight: '600' },
  qrCloseBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  qrCloseBtnText: { fontSize: 14 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  selectBtnText: { fontSize: 13, fontWeight: '600' },
  checkbox: { justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  deleteBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, padding: 14, paddingBottom: 28 },
  deleteBarCount: { fontSize: 14, fontWeight: '500' },
  deleteBarBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  deleteBarBtnDisabled: { opacity: 0.4 },
  deleteBarBtnText: { fontSize: 14, color: 'white', fontWeight: '600' },
  timeBucketLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  sectionHeaderLeft: { flex: 1 },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionCount: { fontSize: 11 },
  chevron: { fontSize: 16 },
  viewToggle: { flexDirection: 'row', gap: 6 },
  viewToggleBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  viewToggleBtnText: { fontSize: 12, fontWeight: '600' },
  viewToggleRow: { flexDirection: 'row', borderBottomWidth: 1 },
  viewToggleTab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  viewToggleTabText: { fontSize: 13 },
});
