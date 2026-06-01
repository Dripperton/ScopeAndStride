import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronRight, ClipboardList, Stethoscope, Syringe, Pill, FileText, Wrench, Leaf, Target, AlertTriangle, DollarSign, Pencil, Trash2, CalendarCheck, CheckSquare, Square, Activity, ExternalLink, Link } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../../lib/useProfile';
import { useLanguage } from '../../lib/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { daysUntil } from '../../lib/dateUtils';

const SERVICE_META: any = {
  farrier:     { Icon: Wrench,      label: 'Farrier',     color: '#B08C4A' },
  vet:         { Icon: Stethoscope, label: 'Vet',         color: '#1A3A4A' },
  vaccination: { Icon: Syringe,     label: 'Vaccination', color: '#4A3B6B' },
  medication:  { Icon: Pill,        label: 'Medication',  color: '#6B4226' },
  bodywork:    { Icon: Activity,    label: 'Bodywork',    color: '#4A7C59' },
  dental:      { Icon: FileText,    label: 'Dental',      color: '#3A3830' },
  other:       { Icon: FileText,    label: 'Other',       color: '#9A9285' },
};

export default function HorseProfile() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { canEdit } = useProfile();
  const { t } = useLanguage();
  const theme = useTheme(); const C = theme.colors; const F = theme.fonts;
  const [horse, setHorse] = useState<any>(null);
  const [serviceVisits, setServiceVisits] = useState<any[]>([]);
  const [dietaryRecords, setDietaryRecords] = useState<any[]>([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState<any[]>([]);
  const [dailyCareLogs, setDailyCareLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [qrVisible, setQrVisible] = useState(false);
  const [qrCopied, setQrCopied] = useState(false);
  function toggle(key: string) { setExpanded(prev => ({ ...prev, [key]: !prev[key] })); }

  useFocusEffect(useCallback(() => {
    async function fetchAll() {
      const [{ data: horseData }, { data: visitData }, { data: dietData }, { data: invoiceData }, { data: careData }] = await Promise.all([
        supabase.from('horses').select('*').eq('id', id).single(),
        supabase.from('service_visits').select('*').eq('horse_id', id).order('date', { ascending: false }),
        supabase.from('dietary_records').select('*').eq('horse_id', id).order('date', { ascending: false }),
        supabase.from('invoices').select('*, invoice_line_items(*)').eq('horse_id', id).in('status', ['pending', 'overdue']),
        supabase.from('daily_care_logs').select('*').eq('horse_id', id).order('date', { ascending: false }).limit(7),
      ]);
      if (horseData) setHorse(horseData);
      if (visitData) setServiceVisits(visitData);
      if (dietData) setDietaryRecords(dietData);
      if (invoiceData) setUnpaidInvoices(invoiceData);
      if (careData) setDailyCareLogs(careData);
      setLoading(false);
    }
    fetchAll();
  }, [id]));

  async function deleteServiceVisit(visitId: string) {
    if (Platform.OS === 'web') {
      if (!confirm('Delete this service record?')) return;
    } else {
      try {
        await new Promise<void>((resolve, reject) => {
          Alert.alert('Delete Record', 'Are you sure? This cannot be undone.', [
            { text: 'Cancel', style: 'cancel', onPress: () => reject() },
            { text: 'Delete', style: 'destructive', onPress: () => resolve() },
          ]);
        });
      } catch { return; }
    }
    await supabase.from('service_visits').delete().eq('id', visitId);
    setServiceVisits(prev => prev.filter(v => v.id !== visitId));
  }

  async function deleteDietary(recordId: string) {
    if (Platform.OS === 'web') {
      if (!confirm('Delete this dietary record?')) return;
    } else {
      try {
        await new Promise<void>((resolve, reject) => {
          Alert.alert('Delete Record', 'Are you sure? This cannot be undone.', [
            { text: 'Cancel', style: 'cancel', onPress: () => reject() },
            { text: 'Delete', style: 'destructive', onPress: () => resolve() },
          ]);
        });
      } catch { return; }
    }
    await supabase.from('dietary_records').delete().eq('id', recordId);
    setDietaryRecords(prev => prev.filter(r => r.id !== recordId));
  }

  if (loading && !horse) return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 80 }} />
    </View>
  );

  if (!horse) return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <Text style={{ padding: 24, color: C.textMuted }}>Horse not found.</Text>
    </View>
  );

  const cogginsExpiry = horse?.coggins_expiry_date ? daysUntil(horse.coggins_expiry_date) : null;
  const cogginsWarning = cogginsExpiry !== null && cogginsExpiry <= 30;
  const latestFarrierVisit = serviceVisits.find(v => v.service_type === 'farrier' && v.next_appointment_date);
  const farrierDue = latestFarrierVisit ? daysUntil(latestFarrierVisit.next_appointment_date) : null;
  const farrierWarning = farrierDue !== null && farrierDue <= 14;

  const hasOverdue = unpaidInvoices.some(inv => inv.status === 'overdue');
  const totalUnpaid = unpaidInvoices.reduce((sum, inv) =>
    sum + (inv.invoice_line_items || []).reduce((s: number, item: any) => s + Number(item.amount), 0), 0
  );

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backText, { fontFamily: F.sans }]}>← {t('Horses')}</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Stall Card')}</Text>
        <View style={styles.headerActions}>
          {canEdit && horse?.qr_token ? (
            <Pressable
              style={({ hovered }: any) => [styles.qrBtn, { backgroundColor: C.secondaryAlpha15 }, hovered && { backgroundColor: C.secondaryAlpha30 }]}
              onPress={() => setQrVisible(true)}
            >
              <Text style={[styles.qrBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>QR</Text>
            </Pressable>
          ) : null}
          {canEdit ? (
            <Pressable
              style={({ hovered }: any) => [styles.editBtn, { backgroundColor: C.secondaryAlpha15 }, hovered && { backgroundColor: C.secondaryAlpha30 }]}
              onPress={() => router.push(`/horse/edit/${id}`)}
            >
              <Text style={[styles.editBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Edit')}</Text>
            </Pressable>
          ) : (
            <View style={{ width: 48 }} />
          )}
        </View>
      </View>

      {/* QR Code Modal */}
      {horse?.qr_token ? (() => {
        const origin = Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.origin
          : (process.env.EXPO_PUBLIC_APP_URL || 'https://your-app.com');
        const qrUrl = `${origin}/service-entry/${horse.qr_token}`;
        const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrUrl)}&size=240x240&margin=12`;
        return (
          <Modal visible={qrVisible} transparent animationType="fade" onRequestClose={() => setQrVisible(false)}>
            <Pressable style={styles.qrOverlay} onPress={() => setQrVisible(false)}>
              <Pressable style={[styles.qrModal, { backgroundColor: C.card }]} onPress={() => {}}>
                <Text style={[styles.qrModalTitle, { color: C.primary, fontFamily: F.serif }]}>{horse.name}</Text>
                <Text style={[styles.qrModalSubtitle, { color: C.textMuted, fontFamily: F.sans }]}>{t('Providers scan this to log a visit')}</Text>
                <Image source={{ uri: qrImageUrl }} style={styles.qrImage} resizeMode="contain" />
                <Text style={[styles.qrUrlText, { color: C.textMuted, backgroundColor: C.background }]} numberOfLines={2} selectable>{qrUrl}</Text>
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
            <View style={styles.billingBannerIcon}>
              {hasOverdue ? <AlertTriangle size={18} color="#C0392B" /> : <DollarSign size={18} color="#E67E22" />}
            </View>
            <View style={styles.billingBannerInfo}>
              <Text style={[styles.billingBannerTitle, { color: C.text, fontFamily: F.sansBold }]}>
                {hasOverdue ? t('Overdue Invoice') : t('Pending Invoice')}
              </Text>
              <Text style={[styles.billingBannerSub, { color: C.textMuted, fontFamily: F.sans }]}>
                {unpaidInvoices.length} invoice{unpaidInvoices.length !== 1 ? 's' : ''} · ${totalUnpaid.toLocaleString('en-US', { minimumFractionDigits: 2 })} outstanding
              </Text>
            </View>
            <Text style={styles.billingBannerChevron}>›</Text>
          </Pressable>
        )}

        <View style={[styles.heroCard, { backgroundColor: horse.color || C.primary }]}>
          {horse.photo_url ? (
            <Image source={{ uri: horse.photo_url }} style={styles.heroPhoto} />
          ) : (
            <Text style={styles.heroEmoji}>🐴</Text>
          )}
          <Text style={[styles.heroName, { fontFamily: F.serif }]}>{horse.name}</Text>
          {horse.alert ? (
            <View style={styles.alertBadge}>
              <AlertTriangle size={12} color="white" />
              <Text style={styles.alertBadgeText}>Alert</Text>
            </View>
          ) : null}
        </View>

        {/* Boarding Details */}
        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Boarding Details')}</Text>
          <View style={[styles.detailRow, { borderBottomColor: C.cardSeparator }]}>
            <Text style={[styles.detailLabel, { color: C.textMuted, fontFamily: F.sans }]}>{t('Owner')}</Text>
            <Text style={[styles.detailValue, { color: C.text, fontFamily: F.sansMedium }]}>{horse.owner || '—'}</Text>
          </View>
          <View style={[styles.detailRow, { borderBottomColor: C.cardSeparator }]}>
            <Text style={[styles.detailLabel, { color: C.textMuted, fontFamily: F.sans }]}>{t('Board Type')}</Text>
            <Text style={[styles.detailValue, { color: C.text, fontFamily: F.sansMedium }]}>{horse.board_type || '—'}</Text>
          </View>
          <View style={[styles.detailRow, { borderBottomColor: C.cardSeparator }]}>
            <Text style={[styles.detailLabel, { color: C.textMuted, fontFamily: F.sans }]}>{t('Breed')}</Text>
            <Text style={[styles.detailValue, { color: C.text, fontFamily: F.sansMedium }]}>{horse.breed || '—'}</Text>
          </View>
          {(horse.custom_field_label && horse.custom_field_value) ? (
            <View style={[styles.detailRow, { borderBottomColor: C.cardSeparator }]}>
              <Text style={[styles.detailLabel, { color: C.textMuted, fontFamily: F.sans }]}>{horse.custom_field_label}</Text>
              <Text style={[styles.detailValue, { color: C.text, fontFamily: F.sansMedium }]}>{horse.custom_field_value}</Text>
            </View>
          ) : null}

          {(horse.vet_name || horse.emergency_clinic || horse.emergency_auth || horse.emergency_contact) ? (
            <View style={styles.emergencyDivider}>
              <Text style={[styles.emergencyDividerLabel, { fontFamily: F.sansBold }]}>{t('Emergency Care')}</Text>
            </View>
          ) : null}
          {horse.vet_name ? (
            <View style={[styles.detailRow, { borderBottomColor: C.cardSeparator }]}>
              <Text style={[styles.detailLabel, { color: C.textMuted, fontFamily: F.sans }]}>{t('Vet')}</Text>
              <Text style={[styles.detailValue, { color: C.text, fontFamily: F.sansMedium }]}>{horse.vet_name}{horse.vet_phone ? ` · ${horse.vet_phone}` : ''}</Text>
            </View>
          ) : null}
          {horse.emergency_clinic ? (
            <View style={[styles.detailRow, { borderBottomColor: C.cardSeparator }]}>
              <Text style={[styles.detailLabel, { color: C.textMuted, fontFamily: F.sans }]}>{t('Emergency Clinic')}</Text>
              <Text style={[styles.detailValue, { color: C.text, fontFamily: F.sansMedium }]}>{horse.emergency_clinic}</Text>
            </View>
          ) : null}
          {horse.emergency_auth ? (
            <View style={[styles.detailRow, { borderBottomColor: C.cardSeparator }]}>
              <Text style={[styles.detailLabel, { color: C.textMuted, fontFamily: F.sans }]}>{t('Auth Limit')}</Text>
              <Text style={[styles.detailValue, { color: C.text, fontFamily: F.sansMedium }]}>{horse.emergency_auth}</Text>
            </View>
          ) : null}
          {horse.emergency_contact ? (
            <View style={[styles.detailRow, { borderBottomColor: C.cardSeparator }]}>
              <Text style={[styles.detailLabel, { color: C.textMuted, fontFamily: F.sans }]}>{t('Backup Contact')}</Text>
              <Text style={[styles.detailValue, { color: C.text, fontFamily: F.sansMedium }]}>{horse.emergency_contact}{horse.emergency_contact_phone ? ` · ${horse.emergency_contact_phone}` : ''}</Text>
            </View>
          ) : null}

          {(horse.coggins_expiry_date || horse.coggins_image_url) ? (
            <View style={styles.emergencyDivider}>
              <Text style={[styles.emergencyDividerLabel, { fontFamily: F.sansBold }, cogginsWarning && { color: '#C9854A' }]}>Coggins</Text>
            </View>
          ) : null}
          {horse.coggins_expiry_date ? (
            <View style={[styles.detailRow, { borderBottomColor: C.cardSeparator }]}>
              <Text style={[styles.detailLabel, { color: C.textMuted, fontFamily: F.sans }]}>{t('Expires')}</Text>
              <Text style={[styles.detailValue, { color: C.text, fontFamily: F.sansMedium }, cogginsWarning && styles.warningText]}>
                {horse.coggins_expiry_date}
                {cogginsExpiry !== null ? (cogginsExpiry <= 0 ? ' · EXPIRED' : cogginsExpiry <= 30 ? ` · ${cogginsExpiry} days` : '') : ''}
              </Text>
            </View>
          ) : null}
          {horse.coggins_image_url ? (
            <Pressable style={[styles.detailRow, { borderBottomColor: C.cardSeparator }]} onPress={() => Linking.openURL(horse.coggins_image_url)}>
              <Text style={[styles.detailLabel, { color: C.textMuted, fontFamily: F.sans }]}>Document</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <ExternalLink size={12} color={C.primary} />
                <Text style={[styles.detailValue, { color: C.primary, textDecorationLine: 'underline' }]}>{t('View Coggins')}</Text>
              </View>
            </Pressable>
          ) : null}
        </View>

        {/* Quirks */}
        {horse.quirks ? (
          <View style={styles.quirksSection}>
            <Text style={[styles.quirksSectionTitle, { fontFamily: F.sansBold }]}>⚠ {t('Handling Notes')}</Text>
            <Text style={[styles.quirksText, { color: C.text, fontFamily: F.sans }]}>{horse.quirks}</Text>
          </View>
        ) : null}

        {/* Goals -- collapsible tile */}
        <View style={[styles.tile, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Pressable style={styles.tileHeader} onPress={() => toggle('goals')}>
            <View style={[styles.tileIconBg, { backgroundColor: C.primary }]}>
              <Target size={16} color="white" />
            </View>
            <Text style={[styles.tileName, { color: C.text, fontFamily: F.sansBold }]}>{t('Goals')}</Text>
            <Text style={[styles.tileStatus, { color: C.textMuted, fontFamily: F.sans }]} numberOfLines={1}>
              {horse.goals ? horse.goals : t('No goals set')}
            </Text>
            {expanded.goals
              ? <ChevronDown size={15} color={C.textMuted} />
              : <ChevronRight size={15} color={C.textMuted} />}
          </Pressable>
          {expanded.goals && (
            <View style={[styles.tileBody, { borderTopColor: C.cardSeparator }]}>
              {canEdit && (
                <Pressable style={styles.tileAddBtn} onPress={() => router.push(`/horse/edit/${id}`)}>
                  <Text style={[styles.addLink, { color: C.primary, fontFamily: F.sansBold }]}>+ {t('Add Entry')}</Text>
                </Pressable>
              )}
              {horse.goals
                ? <Text style={[styles.goalsText, { color: C.text, fontFamily: F.sans }]}>{horse.goals}</Text>
                : <Text style={styles.emptyText}>{t('No goals set yet')}</Text>}
            </View>
          )}
        </View>

        {/* Services -- collapsible tile */}
        <View style={[styles.tile, { backgroundColor: C.card, borderColor: C.cardBorder }, farrierWarning && styles.sectionWarning]}>
          <Pressable style={styles.tileHeader} onPress={() => toggle('services')}>
            <View style={[styles.tileIconBg, { backgroundColor: C.primary }]}>
              <ClipboardList size={16} color="white" />
            </View>
            <Text style={[styles.tileName, { color: C.text, fontFamily: F.sansBold }]}>{t('Services')}</Text>
            <Text style={[styles.tileStatus, { color: C.textMuted, fontFamily: F.sans }, farrierWarning && [styles.tileStatusWarning, { color: C.warning }]]} numberOfLines={1}>
              {farrierWarning && latestFarrierVisit
                ? farrierDue !== null && farrierDue <= 0
                  ? 'Farrier overdue'
                  : `Farrier in ${farrierDue}d`
                : serviceVisits.length > 0
                  ? `${serviceVisits.length} visit${serviceVisits.length !== 1 ? 's' : ''}`
                  : 'No records'}
            </Text>
            {expanded.services ? <ChevronDown size={15} color={C.textMuted} /> : <ChevronRight size={15} color={C.textMuted} />}
          </Pressable>
          {expanded.services && (
            <View style={[styles.tileBody, { borderTopColor: C.cardSeparator }]}>
              {canEdit ? (
                <Pressable style={styles.tileAddBtn} onPress={() => router.push({ pathname: '/horse/service/add', params: { horseId: id } })}>
                  <Text style={[styles.addLink, { color: C.primary, fontFamily: F.sansBold }]}>+ {t('Add Entry')}</Text>
                </Pressable>
              ) : null}
              {serviceVisits.length === 0 ? (
                <Text style={styles.emptyText}>{t('No service records yet.')}</Text>
              ) : (
                serviceVisits.map((visit, index) => {
                  const meta = SERVICE_META[visit.service_type] || SERVICE_META.other;
                  const isLast = index === serviceVisits.length - 1;
                  return (
                    <View key={visit.id} style={[styles.timelineItem, { borderBottomColor: C.cardSeparator }, isLast && styles.timelineItemLast]}>
                      <View style={[styles.timelineDot, { backgroundColor: meta.color }]}>
                        <meta.Icon size={16} color="white" />
                      </View>
                      <View style={styles.timelineContent}>
                        <View style={styles.timelineHeaderRow}>
                          <Text style={[styles.timelineTitle, { color: C.text, fontFamily: F.sansBold }]}>{visit.title || meta.label}</Text>
                          <Text style={[styles.timelineDate, { color: C.textMuted, fontFamily: F.sans }]}>{visit.date}</Text>
                        </View>
                        {visit.provider_name ? <Text style={[styles.timelineSub, { color: C.secondary, fontFamily: F.sans }]}>{visit.provider_name}</Text> : null}
                        {visit.next_appointment_date ? <Text style={[styles.timelineSub, { color: C.secondary, fontFamily: F.sans }]}>{t('Next appt')}: {visit.next_appointment_date}</Text> : null}
                        {visit.expiry_date ? <Text style={[styles.timelineSub, { color: C.secondary, fontFamily: F.sans }]}>{t('Expires')}: {visit.expiry_date}</Text> : null}
                        {visit.notes ? <Text style={[styles.timelineNotes, { color: C.text, fontFamily: F.sans }]}>{visit.notes}</Text> : null}
                        {visit.external_invoice_url ? (
                          <Pressable onPress={() => Linking.openURL(visit.external_invoice_url)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <ExternalLink size={11} color={C.primary} />
                            <Text style={{ fontSize: 11, color: C.primary, textDecorationLine: 'underline' }}>{t('View Invoice')}</Text>
                          </Pressable>
                        ) : null}
                        {canEdit ? (
                          <View style={styles.entryActions}>
                            <Pressable
                              style={({ hovered }: any) => [styles.iconBtn, { borderColor: C.cardBorder }, hovered && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                              onPress={() => router.push({ pathname: '/horse/service/edit', params: { visitId: visit.id } })}
                            >
                              <Pencil size={11} color={C.primary} /><Text style={[styles.iconBtnText, { color: C.primary, fontFamily: F.sansMedium }]}> {t('Edit')}</Text>
                            </Pressable>
                            <Pressable
                              style={({ hovered }: any) => [styles.iconBtnDanger, { borderColor: C.cardBorder }, hovered && styles.iconBtnDangerHovered]}
                              onPress={() => deleteServiceVisit(visit.id)}
                            >
                              <Trash2 size={11} color={C.error} /><Text style={styles.iconBtnDangerText}> {t('Delete')}</Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </View>

        {/* Dietary -- collapsible tile */}
        <View style={[styles.tile, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Pressable style={styles.tileHeader} onPress={() => toggle('dietary')}>
            <View style={[styles.tileIconBg, { backgroundColor: '#4A7C59' }]}>
              <Leaf size={16} color="white" />
            </View>
            <Text style={[styles.tileName, { color: C.text, fontFamily: F.sansBold }]}>{t('Dietary')}</Text>
            <Text style={[styles.tileStatus, { color: C.textMuted, fontFamily: F.sans }]} numberOfLines={1}>
              {dietaryRecords.length > 0 ? `${dietaryRecords.length} record${dietaryRecords.length !== 1 ? 's' : ''}` : 'No records'}
            </Text>
            {expanded.dietary
              ? <ChevronDown size={15} color={C.textMuted} />
              : <ChevronRight size={15} color={C.textMuted} />}
          </Pressable>
          {expanded.dietary && (
            <View style={[styles.tileBody, { borderTopColor: C.cardSeparator }]}>
              {canEdit ? (
                <Pressable style={styles.tileAddBtn} onPress={() => router.push({ pathname: '/horse/dietary/add', params: { horseId: id } })}>
                  <Text style={[styles.addLink, { color: C.primary, fontFamily: F.sansBold }]}>+ {t('Add Entry')}</Text>
                </Pressable>
              ) : null}
              {dietaryRecords.length === 0 ? (
                <Text style={styles.emptyText}>{t('No dietary records yet.')}</Text>
              ) : (
                dietaryRecords.map((rec, index) => {
                  const isLast = index === dietaryRecords.length - 1;
                  return (
                    <View key={rec.id} style={[styles.timelineItem, { borderBottomColor: C.cardSeparator }, isLast && styles.timelineItemLast]}>
                      <View style={[styles.timelineDot, { backgroundColor: '#4A7C59' }]}>
                        <Leaf size={16} color="white" />
                      </View>
                      <View style={styles.timelineContent}>
                        <View style={styles.timelineHeaderRow}>
                          <Text style={[styles.timelineTitle, { color: C.text, fontFamily: F.sansBold }]}>{rec.title || 'Diet Update'}</Text>
                          <Text style={[styles.timelineDate, { color: C.textMuted, fontFamily: F.sans }]}>{rec.date}</Text>
                        </View>
                        {rec.notes ? <Text style={[styles.timelineNotes, { color: C.text, fontFamily: F.sans }]}>{rec.notes}</Text> : null}
                        {canEdit ? (
                          <View style={styles.entryActions}>
                            <Pressable
                              style={({ hovered }: any) => [styles.iconBtn, { borderColor: C.cardBorder }, hovered && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                              onPress={() => router.push({ pathname: '/horse/dietary/edit', params: { recordId: rec.id } })}
                            >
                              <Pencil size={11} color={C.primary} /><Text style={[styles.iconBtnText, { color: C.primary, fontFamily: F.sansMedium }]}> {t('Edit')}</Text>
                            </Pressable>
                            <Pressable
                              style={({ hovered }: any) => [styles.iconBtnDanger, { borderColor: C.cardBorder }, hovered && styles.iconBtnDangerHovered]}
                              onPress={() => deleteDietary(rec.id)}
                            >
                              <Trash2 size={11} color={C.error} /><Text style={styles.iconBtnDangerText}> {t('Delete')}</Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </View>

        {/* Daily Care — collapsible tile */}
        {(() => {
          const todayStr = new Date().toISOString().split('T')[0];
          const todayLog = dailyCareLogs.find(l => l.date === todayStr);
          const statusText = todayLog ? 'Logged today' : dailyCareLogs.length > 0 ? 'Not logged today' : 'No entries yet';
          const notLoggedToday = !todayLog;
          return (
            <View style={[styles.tile, { backgroundColor: C.card, borderColor: C.cardBorder }, notLoggedToday && dailyCareLogs.length > 0 && styles.sectionWarning]}>
              <Pressable style={styles.tileHeader} onPress={() => toggle('dailyCare')}>
                <View style={[styles.tileIconBg, { backgroundColor: C.primary }]}>
                  <CalendarCheck size={16} color="white" />
                </View>
                <Text style={[styles.tileName, { color: C.text, fontFamily: F.sansBold }]}>{t('Daily Care')}</Text>
                <Text style={[styles.tileStatus, { color: C.textMuted, fontFamily: F.sans }, notLoggedToday && dailyCareLogs.length > 0 && [styles.tileStatusWarning, { color: C.warning }]]} numberOfLines={1}>
                  {statusText}
                </Text>
                {expanded.dailyCare ? <ChevronDown size={15} color={C.textMuted} /> : <ChevronRight size={15} color={C.textMuted} />}
              </Pressable>
              {expanded.dailyCare && (
                <View style={[styles.tileBody, { borderTopColor: C.cardSeparator }]}>
                  {canEdit && (
                    <Pressable style={styles.tileAddBtn} onPress={() => router.push({ pathname: '/horse/daily-care/add', params: { horseId: id } })}>
                      <Text style={[styles.addLink, { color: C.primary, fontFamily: F.sansBold }]}>+ {t('Log Today')}</Text>
                    </Pressable>
                  )}
                  {dailyCareLogs.length === 0 ? (
                    <Text style={styles.emptyText}>{t('No care entries yet')}</Text>
                  ) : (
                    dailyCareLogs.map((log, index) => {
                      const isLast = index === dailyCareLogs.length - 1;
                      const logDate = new Date(log.date + 'T00:00:00');
                      const dateLabel = log.date === todayStr ? t('Today') : logDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                      return (
                        <View key={log.id} style={[styles.careRow, { borderBottomColor: C.cardSeparator }, isLast && styles.careRowLast]}>
                          <View style={styles.careRowLeft}>
                            <Text style={[styles.careDate, { color: C.textMuted, fontFamily: F.sansBold }]}>{dateLabel}</Text>
                            <View style={styles.careChecks}>
                              {log.groomed && <View style={[styles.careChip, { backgroundColor: C.activeBg }]}><CheckSquare size={11} color={C.primary} /><Text style={[styles.careChipText, { color: C.primary, fontFamily: F.sansMedium }]}>{t('Groomed')}</Text></View>}
                              {log.turned_out && <View style={[styles.careChip, { backgroundColor: C.activeBg }]}><CheckSquare size={11} color={C.primary} /><Text style={[styles.careChipText, { color: C.primary, fontFamily: F.sansMedium }]}>{t('Out')}{log.turnout_duration ? ` · ${log.turnout_duration}` : ''}</Text></View>}
                              {log.ridden && <View style={[styles.careChip, { backgroundColor: C.activeBg }]}><CheckSquare size={11} color={C.primary} /><Text style={[styles.careChipText, { color: C.primary, fontFamily: F.sansMedium }]}>{t('Ridden')}</Text></View>}
                              {!log.groomed && !log.turned_out && !log.ridden && <Text style={styles.emptyText}>---</Text>}
                            </View>
                            {log.notes ? <Text style={[styles.careNotes, { color: C.textMuted, fontFamily: F.sans }]}>{log.notes}</Text> : null}
                          </View>
                          {canEdit && (
                            <Pressable onPress={() => router.push({ pathname: '/horse/daily-care/add', params: { horseId: id, logId: log.id } })}>
                              <Pencil size={13} color={C.textMuted} />
                            </Pressable>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </View>
          );
        })()}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qrBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6 },
  qrBtnText: { fontSize: 13, fontWeight: '600' },
  editBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6 },
  editBtnText: { fontSize: 13, fontWeight: '600' },
  qrOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  qrModal: { borderRadius: 20, padding: 28, alignItems: 'center', width: '100%', maxWidth: 340, gap: 12 },
  qrModalTitle: { fontSize: 20, fontWeight: '700', fontStyle: 'italic' },
  qrModalSubtitle: { fontSize: 13, textAlign: 'center' },
  qrImage: { width: 220, height: 220 },
  qrUrlText: { fontSize: 11, textAlign: 'center', borderRadius: 8, padding: 8, width: '100%' },
  qrCopyBtn: { borderRadius: 10, paddingHorizontal: 24, paddingVertical: 11, width: '100%', alignItems: 'center' },
  qrCopyBtnText: { fontWeight: '700', fontSize: 14 },
  qrCloseBtn: { paddingVertical: 4 },
  qrCloseBtnText: { fontSize: 13 },
  body: { flex: 1 },
  billingBanner: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 10, marginHorizontal: 16, marginTop: 16, borderRadius: 10, borderWidth: 1.5 },
  billingBannerOverdue: { backgroundColor: '#FDECEA', borderColor: '#C0392B' },
  billingBannerPending: { backgroundColor: '#FEF6E4', borderColor: '#E67E22' },
  billingBannerHovered: { opacity: 0.85 },
  billingBannerIcon: { fontSize: 18 },
  billingBannerInfo: { flex: 1 },
  billingBannerTitle: { fontSize: 12, fontWeight: '700' },
  billingBannerSub: { fontSize: 11, marginTop: 1 },
  billingBannerChevron: { fontSize: 20, color: '#C4BAA8' },
  heroCard: { padding: 32, alignItems: 'center', gap: 12 },
  heroPhoto: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  heroEmoji: { fontSize: 64 },
  heroName: { fontSize: 24, fontWeight: '700', color: 'white', fontStyle: 'italic' },
  alertBadge: { backgroundColor: '#8B2E2E', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 },
  alertBadgeText: { color: 'white', fontSize: 12, fontWeight: '600' },
  quirksSection: { margin: 16, marginBottom: 0, backgroundColor: '#FEF6E4', borderRadius: 14, borderWidth: 1.5, borderColor: '#C8922A', padding: 16 },
  quirksSectionTitle: { fontSize: 11, fontWeight: '700', color: '#C8922A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  quirksText: { fontSize: 14, lineHeight: 20 },
  section: { margin: 16, marginBottom: 0, borderRadius: 14, borderWidth: 1, padding: 16 },
  tile: { margin: 16, marginBottom: 0, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  tileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  tileIconBg: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tileName: { flex: 1, fontSize: 14, fontWeight: '600' },
  tileStatus: { fontSize: 12, maxWidth: 120, textAlign: 'right' },
  tileStatusWarning: { fontWeight: '600' },
  tileBody: { borderTopWidth: 1, padding: 14 },
  tileAddBtn: { alignSelf: 'flex-end', marginBottom: 10 },
  goalsText: { fontSize: 14, lineHeight: 20 },
  careRow: { paddingVertical: 10, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  careRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  careRowLeft: { flex: 1 },
  careDate: { fontSize: 12, fontWeight: '600', marginBottom: 5 },
  careChecks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  careChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  careChipText: { fontSize: 11, fontWeight: '500' },
  careNotes: { fontSize: 12, marginTop: 5, fontStyle: 'italic' },
  sectionWarning: { borderColor: '#C9854A' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  addLink: { fontSize: 13, fontWeight: '600' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  emergencyDivider: { paddingTop: 14, paddingBottom: 4 },
  emergencyDividerLabel: { fontSize: 10, fontWeight: '700', color: '#C8922A', textTransform: 'uppercase', letterSpacing: 1 },
  detailLabel: { fontSize: 13 },
  detailValue: { fontSize: 13, fontWeight: '500' },
  warningText: { color: '#C9854A', fontWeight: '700' },
  emptyText: { fontSize: 13, color: '#C4BAA8', fontStyle: 'italic', paddingVertical: 8 },
  historyLabel: { fontSize: 10, fontWeight: '600', color: '#C4BAA8', letterSpacing: 1, marginBottom: 12 },
  timelineItem: { flexDirection: 'row', gap: 12, paddingBottom: 16, borderBottomWidth: 1, marginBottom: 16 },
  timelineItemLast: { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0 },
  timelineDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  timelineContent: { flex: 1 },
  timelineHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineTitle: { fontSize: 14, fontWeight: '600' },
  timelineDate: { fontSize: 12 },
  timelineSub: { fontSize: 12, marginTop: 2 },
  timelineNotes: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  entryActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  iconBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1 },
  iconBtnHovered: {},
  iconBtnText: { fontSize: 12, fontWeight: '500' },
  iconBtnDanger: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1 },
  iconBtnDangerHovered: { borderColor: '#8B2E2E', backgroundColor: '#FFF5F5' },
  iconBtnDangerText: { fontSize: 12, color: '#8B2E2E', fontWeight: '500' },
});
