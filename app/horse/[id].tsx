import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../../lib/useProfile';

const TYPE_META: any = {
  coggins:     { icon: '📋', label: 'Coggins',     color: '#4A7C59' },
  vaccination: { icon: '💉', label: 'Vaccination', color: '#1A3A4A' },
  vet_visit:   { icon: '🩺', label: 'Vet Visit',   color: '#6B4226' },
  medication:  { icon: '💊', label: 'Medication',  color: '#4A3B6B' },
  custom:      { icon: '📝', label: 'Note',        color: '#9A9285' },
};

function daysUntil(dateStr: string) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function HorseProfile() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { canEdit } = useProfile();
  const [horse, setHorse] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [farrierRecords, setFarrierRecords] = useState<any[]>([]);
  const [dietaryRecords, setDietaryRecords] = useState<any[]>([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    async function fetchAll() {
      const [{ data: horseData }, { data: medData }, { data: farrierData }, { data: dietData }, { data: invoiceData }] = await Promise.all([
        supabase.from('horses').select('*').eq('id', id).single(),
        supabase.from('medical_records').select('*').eq('horse_id', id).order('date', { ascending: false }),
        supabase.from('farrier_records').select('*').eq('horse_id', id).order('date', { ascending: false }),
        supabase.from('dietary_records').select('*').eq('horse_id', id).order('date', { ascending: false }),
        supabase.from('invoices').select('*, invoice_line_items(*)').eq('horse_id', id).in('status', ['pending', 'overdue']),
      ]);
      if (horseData) setHorse(horseData);
      if (medData) setRecords(medData);
      if (farrierData) setFarrierRecords(farrierData);
      if (dietData) setDietaryRecords(dietData);
      if (invoiceData) setUnpaidInvoices(invoiceData);
      setLoading(false);
    }
    fetchAll();
  }, [id]));

  async function deleteMedical(recordId: string) {
    const confirmed = Platform.OS === 'web' ? confirm('Delete this record?') : true;
    if (!confirmed) return;
    await supabase.from('medical_records').delete().eq('id', recordId);
    setRecords(prev => prev.filter(r => r.id !== recordId));
  }

  async function deleteFarrier(recordId: string) {
    const confirmed = Platform.OS === 'web' ? confirm('Delete this farrier record?') : true;
    if (!confirmed) return;
    await supabase.from('farrier_records').delete().eq('id', recordId);
    setFarrierRecords(prev => prev.filter(r => r.id !== recordId));
  }

  async function deleteDietary(recordId: string) {
    const confirmed = Platform.OS === 'web' ? confirm('Delete this dietary record?') : true;
    if (!confirmed) return;
    await supabase.from('dietary_records').delete().eq('id', recordId);
    setDietaryRecords(prev => prev.filter(r => r.id !== recordId));
  }

  if (loading) return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2C4A35" style={{ marginTop: 80 }} />
    </View>
  );

  if (!horse) return (
    <View style={styles.container}>
      <Text style={{ padding: 24, color: '#9A9285' }}>Horse not found.</Text>
    </View>
  );

  const coggins = records.find(r => r.type === 'coggins');
  const otherRecords = records.filter(r => r.type !== 'coggins');
  const latestFarrier = farrierRecords[0];
  const cogginsExpiry = coggins?.expiry_date ? daysUntil(coggins.expiry_date) : null;
  const cogginsWarning = cogginsExpiry !== null && cogginsExpiry <= 30;
  const farrierDue = latestFarrier?.next_due ? daysUntil(latestFarrier.next_due) : null;
  const farrierWarning = farrierDue !== null && farrierDue <= 14;

  const hasOverdue = unpaidInvoices.some(inv => inv.status === 'overdue');
  const totalUnpaid = unpaidInvoices.reduce((sum, inv) =>
    sum + (inv.invoice_line_items || []).reduce((s: number, item: any) => s + Number(item.amount), 0), 0
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Stall Card</Text>
        {canEdit ? (
          <Pressable
            style={({ hovered }: any) => [styles.editBtn, hovered && styles.editBtnHovered]}
            onPress={() => router.push(`/horse/edit/${id}`)}
          >
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        ) : (
          <View style={{ width: 48 }} />
        )}
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

        {/* Billing Banner */}
        {unpaidInvoices.length > 0 && (
          <Pressable
            style={({ hovered }: any) => [
              styles.billingBanner,
              hasOverdue ? styles.billingBannerOverdue : styles.billingBannerPending,
              hovered && styles.billingBannerHovered,
            ]}
            onPress={() => router.push('/billing')}
          >
            <Text style={styles.billingBannerIcon}>{hasOverdue ? '⚠️' : '💰'}</Text>
            <View style={styles.billingBannerInfo}>
              <Text style={styles.billingBannerTitle}>
                {hasOverdue ? 'Overdue Invoice' : 'Pending Invoice'}
              </Text>
              <Text style={styles.billingBannerSub}>
                {unpaidInvoices.length} invoice{unpaidInvoices.length !== 1 ? 's' : ''} · ${totalUnpaid.toLocaleString('en-US', { minimumFractionDigits: 2 })} outstanding
              </Text>
            </View>
            <Text style={styles.billingBannerChevron}>›</Text>
          </Pressable>
        )}

        <View style={[styles.heroCard, { backgroundColor: horse.color || '#2C4A35' }]}>
          {horse.photo_url ? (
            <Image source={{ uri: horse.photo_url }} style={styles.heroPhoto} />
          ) : (
            <Text style={styles.heroEmoji}>🐴</Text>
          )}
          <Text style={styles.heroName}>{horse.name}</Text>
          {horse.alert ? (
            <View style={styles.alertBadge}>
              <Text style={styles.alertBadgeText}>⚠ Alert</Text>
            </View>
          ) : null}
        </View>

        {/* Boarding Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Boarding Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Owner</Text>
            <Text style={styles.detailValue}>{horse.owner || '—'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Board Type</Text>
            <Text style={styles.detailValue}>{horse.board_type || '—'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Breed</Text>
            <Text style={styles.detailValue}>{horse.breed || '—'}</Text>
          </View>
          {(horse.custom_field_label && horse.custom_field_value) ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{horse.custom_field_label}</Text>
              <Text style={styles.detailValue}>{horse.custom_field_value}</Text>
            </View>
          ) : null}
        </View>

        {/* Coggins */}
        <View style={[styles.section, cogginsWarning && styles.sectionWarning]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Coggins</Text>
            {canEdit ? (
              <Pressable onPress={() => router.push({ pathname: '/horse/medical/add', params: { horseId: id, defaultType: 'coggins' } })}>
                <Text style={styles.addLink}>+ Add Entry</Text>
              </Pressable>
            ) : null}
          </View>
          {coggins ? (
            <View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Test Date</Text>
                <Text style={styles.detailValue}>{coggins.date}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Expires</Text>
                <Text style={[styles.detailValue, cogginsWarning && styles.warningText]}>
                  {coggins.expiry_date || '—'}
                  {cogginsExpiry !== null ? (cogginsExpiry <= 0 ? ' · EXPIRED' : cogginsExpiry <= 30 ? ' · ' + cogginsExpiry + ' days' : '') : ''}
                </Text>
              </View>
              {coggins.notes ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Notes</Text>
                  <Text style={styles.detailValue}>{coggins.notes}</Text>
                </View>
              ) : null}
              {canEdit ? (
                <View style={styles.entryActions}>
                  <Pressable
                    style={({ hovered }: any) => [styles.iconBtn, hovered && styles.iconBtnHovered]}
                    onPress={() => router.push({ pathname: '/horse/medical/edit', params: { recordId: coggins.id } })}
                  >
                    <Text style={styles.iconBtnText}>✏️ Edit</Text>
                  </Pressable>
                  <Pressable
                    style={({ hovered }: any) => [styles.iconBtnDanger, hovered && styles.iconBtnDangerHovered]}
                    onPress={() => deleteMedical(coggins.id)}
                  >
                    <Text style={styles.iconBtnDangerText}>🗑 Delete</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.emptyText}>No Coggins on file</Text>
          )}
        </View>

        {/* Medical History */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Medical History</Text>
            {canEdit ? (
              <Pressable onPress={() => router.push({ pathname: '/horse/medical/add', params: { horseId: id } })}>
                <Text style={styles.addLink}>+ Add Entry</Text>
              </Pressable>
            ) : null}
          </View>
          {otherRecords.length === 0 ? (
            <Text style={styles.emptyText}>No records yet</Text>
          ) : (
            otherRecords.map((record, index) => {
              const meta = TYPE_META[record.type] || TYPE_META.custom;
              const isLast = index === otherRecords.length - 1;
              return (
                <View key={record.id} style={[styles.timelineItem, isLast && styles.timelineItemLast]}>
                  <View style={[styles.timelineDot, { backgroundColor: meta.color }]}>
                    <Text style={styles.timelineDotIcon}>{meta.icon}</Text>
                  </View>
                  <View style={styles.timelineContent}>
                    <View style={styles.timelineHeaderRow}>
                      <Text style={styles.timelineTitle}>{record.title || meta.label}</Text>
                      <Text style={styles.timelineDate}>{record.date}</Text>
                    </View>
                    {record.expiry_date ? (
                      <Text style={styles.timelineSub}>Expires: {record.expiry_date}</Text>
                    ) : null}
                    {record.notes ? (
                      <Text style={styles.timelineNotes}>{record.notes}</Text>
                    ) : null}
                    {canEdit ? (
                      <View style={styles.entryActions}>
                        <Pressable
                          style={({ hovered }: any) => [styles.iconBtn, hovered && styles.iconBtnHovered]}
                          onPress={() => router.push({ pathname: '/horse/medical/edit', params: { recordId: record.id } })}
                        >
                          <Text style={styles.iconBtnText}>✏️ Edit</Text>
                        </Pressable>
                        <Pressable
                          style={({ hovered }: any) => [styles.iconBtnDanger, hovered && styles.iconBtnDangerHovered]}
                          onPress={() => deleteMedical(record.id)}
                        >
                          <Text style={styles.iconBtnDangerText}>🗑 Delete</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Farrier Cycle */}
        <View style={[styles.section, farrierWarning && styles.sectionWarning]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Farrier Cycle</Text>
            {canEdit ? (
              <Pressable onPress={() => router.push({ pathname: '/horse/farrier/add', params: { horseId: id, currentFarrier: horse.farrier_name || '', currentShoeType: horse.shoe_type || '' } })}>
                <Text style={styles.addLink}>+ Add Entry</Text>
              </Pressable>
            ) : null}
          </View>
          {horse.farrier_name ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Farrier</Text>
              <Text style={styles.detailValue}>{horse.farrier_name}</Text>
            </View>
          ) : null}
          {horse.shoe_type ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Shoe Type</Text>
              <Text style={styles.detailValue}>{horse.shoe_type}</Text>
            </View>
          ) : null}
          {latestFarrier ? (
            <View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Last Shod</Text>
                <Text style={styles.detailValue}>{latestFarrier.date}</Text>
              </View>
              {latestFarrier.next_due ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Next Due</Text>
                  <Text style={[styles.detailValue, farrierWarning && styles.warningText]}>
                    {latestFarrier.next_due}
                    {farrierDue !== null ? (farrierDue <= 0 ? ' · OVERDUE' : farrierDue <= 14 ? ' · ' + farrierDue + ' days' : '') : ''}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {!horse.farrier_name && !latestFarrier ? (
            <Text style={styles.emptyText}>No farrier records yet</Text>
          ) : null}
          {farrierRecords.length > 0 ? (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.historyLabel}>VISIT HISTORY</Text>
              {farrierRecords.map((rec, index) => {
                const isLast = index === farrierRecords.length - 1;
                return (
                  <View key={rec.id} style={[styles.timelineItem, isLast && styles.timelineItemLast]}>
                    <View style={[styles.timelineDot, { backgroundColor: '#B08C4A' }]}>
                      <Text style={styles.timelineDotIcon}>🐾</Text>
                    </View>
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineHeaderRow}>
                        <Text style={styles.timelineTitle}>{rec.shoe_type || 'Farrier Visit'}</Text>
                        <Text style={styles.timelineDate}>{rec.date}</Text>
                      </View>
                      {rec.notes ? <Text style={styles.timelineNotes}>{rec.notes}</Text> : null}
                      {canEdit ? (
                        <View style={styles.entryActions}>
                          <Pressable
                            style={({ hovered }: any) => [styles.iconBtn, hovered && styles.iconBtnHovered]}
                            onPress={() => router.push({ pathname: '/horse/farrier/edit', params: { recordId: rec.id, horseId: id } })}
                          >
                            <Text style={styles.iconBtnText}>✏️ Edit</Text>
                          </Pressable>
                          <Pressable
                            style={({ hovered }: any) => [styles.iconBtnDanger, hovered && styles.iconBtnDangerHovered]}
                            onPress={() => deleteFarrier(rec.id)}
                          >
                            <Text style={styles.iconBtnDangerText}>🗑 Delete</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>

        {/* Dietary */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Dietary</Text>
            {canEdit ? (
              <Pressable onPress={() => router.push({ pathname: '/horse/dietary/add', params: { horseId: id } })}>
                <Text style={styles.addLink}>+ Add Entry</Text>
              </Pressable>
            ) : null}
          </View>
          {dietaryRecords.length === 0 ? (
            <Text style={styles.emptyText}>No dietary records yet</Text>
          ) : (
            dietaryRecords.map((rec, index) => {
              const isLast = index === dietaryRecords.length - 1;
              return (
                <View key={rec.id} style={[styles.timelineItem, isLast && styles.timelineItemLast]}>
                  <View style={[styles.timelineDot, { backgroundColor: '#4A7C59' }]}>
                    <Text style={styles.timelineDotIcon}>🥕</Text>
                  </View>
                  <View style={styles.timelineContent}>
                    <View style={styles.timelineHeaderRow}>
                      <Text style={styles.timelineTitle}>{rec.title || 'Diet Update'}</Text>
                      <Text style={styles.timelineDate}>{rec.date}</Text>
                    </View>
                    {rec.notes ? <Text style={styles.timelineNotes}>{rec.notes}</Text> : null}
                    {canEdit ? (
                      <View style={styles.entryActions}>
                        <Pressable
                          style={({ hovered }: any) => [styles.iconBtn, hovered && styles.iconBtnHovered]}
                          onPress={() => router.push({ pathname: '/horse/dietary/edit', params: { recordId: rec.id } })}
                        >
                          <Text style={styles.iconBtnText}>✏️ Edit</Text>
                        </Pressable>
                        <Pressable
                          style={({ hovered }: any) => [styles.iconBtnDanger, hovered && styles.iconBtnDangerHovered]}
                          onPress={() => deleteDietary(rec.id)}
                        >
                          <Text style={styles.iconBtnDangerText}>🗑 Delete</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F2' },
  header: { backgroundColor: '#2C4A35', padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#C9A85C' },
  editBtn: { backgroundColor: 'rgba(201,168,92,0.15)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6 },
  editBtnHovered: { backgroundColor: 'rgba(201,168,92,0.3)' },
  editBtnText: { color: '#C9A85C', fontSize: 13, fontWeight: '600' },
  body: { flex: 1 },
  billingBanner: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 10, marginHorizontal: 16, marginTop: 16, borderRadius: 10, borderWidth: 1.5 },
  billingBannerOverdue: { backgroundColor: '#FDECEA', borderColor: '#C0392B' },
  billingBannerPending: { backgroundColor: '#FEF6E4', borderColor: '#E67E22' },
  billingBannerHovered: { opacity: 0.85 },
  billingBannerIcon: { fontSize: 18 },
  billingBannerInfo: { flex: 1 },
  billingBannerTitle: { fontSize: 12, fontWeight: '700', color: '#1A1A14' },
  billingBannerSub: { fontSize: 11, color: '#9A9285', marginTop: 1 },
  billingBannerChevron: { fontSize: 20, color: '#C4BAA8' },
  heroCard: { padding: 32, alignItems: 'center', gap: 12 },
  heroPhoto: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  heroEmoji: { fontSize: 64 },
  heroName: { fontSize: 24, fontWeight: '700', color: 'white', fontStyle: 'italic' },
  alertBadge: { backgroundColor: '#8B2E2E', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  alertBadgeText: { color: 'white', fontSize: 12, fontWeight: '600' },
  section: { margin: 16, marginBottom: 0, backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#E8E0CC', padding: 16 },
  sectionWarning: { borderColor: '#C9854A' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#9A9285', textTransform: 'uppercase', letterSpacing: 1 },
  addLink: { fontSize: 13, color: '#2C4A35', fontWeight: '600' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F1EA' },
  detailLabel: { fontSize: 13, color: '#9A9285' },
  detailValue: { fontSize: 13, fontWeight: '500', color: '#1A1A14' },
  warningText: { color: '#C9854A', fontWeight: '700' },
  emptyText: { fontSize: 13, color: '#C4BAA8', fontStyle: 'italic', paddingVertical: 8 },
  historyLabel: { fontSize: 10, fontWeight: '600', color: '#C4BAA8', letterSpacing: 1, marginBottom: 12 },
  timelineItem: { flexDirection: 'row', gap: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F5F1EA', marginBottom: 16 },
  timelineItemLast: { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0 },
  timelineDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  timelineDotIcon: { fontSize: 16 },
  timelineContent: { flex: 1 },
  timelineHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A14' },
  timelineDate: { fontSize: 12, color: '#9A9285' },
  timelineSub: { fontSize: 12, color: '#B08C4A', marginTop: 2 },
  timelineNotes: { fontSize: 13, color: '#3A3830', marginTop: 4, lineHeight: 18 },
  entryActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  iconBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#E8E0CC' },
  iconBtnHovered: { borderColor: '#2C4A35', backgroundColor: '#EDF5EF' },
  iconBtnText: { fontSize: 12, color: '#2C4A35', fontWeight: '500' },
  iconBtnDanger: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#E8E0CC' },
  iconBtnDangerHovered: { borderColor: '#8B2E2E', backgroundColor: '#FFF5F5' },
  iconBtnDangerText: { fontSize: 12, color: '#8B2E2E', fontWeight: '500' },
});
