import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Calendar, DollarSign, Receipt, AlertCircle } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../../lib/useProfile';
import { useLanguage } from '../../lib/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import HomeButton from '../../lib/HomeButton';
import { useBarnData } from '../../lib/BarnDataContext';


export default function Billing() {
  const router = useRouter();
  const { isOwner, isHorseOwner, profile, horseLinks } = useProfile();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const { invoices, pendingCharges, billingLoading, refreshBilling } = useBarnData();
  const [syncing, setSyncing] = useState(false);
  const [qbConnected, setQbConnected] = useState(false);

  useFocusEffect(useCallback(() => {
    refreshBilling();
    if (isOwner && profile?.id) checkQbConnected();
  }, [isOwner, profile?.id]));

  async function checkQbConnected() {
    const { data } = await supabase
      .from('barn_integrations')
      .select('id')
      .eq('user_id', profile!.id)
      .eq('provider', 'quickbooks')
      .single();
    setQbConnected(!!data);
  }

  async function handleQbSync() {
    if (!profile?.id) return;
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke('quickbooks-sync', {
      body: { userId: profile.id },
    });
    setSyncing(false);
    if (error) {
      alert(t('Sync failed. Please try again.'));
      return;
    }
    alert(t('Synced {count} invoices from QuickBooks.', { count: data.synced }))
    refreshBilling();
  }

  async function handleAddToInvoice(visit: any) {
    const horse = visit.horses;
    if (!horse) return;
    const serviceLabel = visit.service_type.charAt(0).toUpperCase() + visit.service_type.slice(1);
    const description = [serviceLabel, visit.title || visit.provider_name].filter(Boolean).join(' — ');

    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert({ horse_id: horse.id, owner_name: horse.owner || horse.name, status: 'pending' })
      .select()
      .single();
    if (invErr || !invoice) { alert('Failed to create invoice'); return; }

    await Promise.all([
      supabase.from('invoice_line_items').insert({ invoice_id: invoice.id, description, amount: visit.amount }),
      supabase.from('service_visits').update({ invoice_id: invoice.id }).eq('id', visit.id),
    ]);

    refreshBilling();
  }

  function getTotal(invoice: any) {
    return (invoice.invoice_line_items || []).reduce((sum: number, item: any) => sum + Number(item.amount), 0);
  }

  function getTotals() {
    const total = invoices.reduce((sum, inv) => sum + getTotal(inv), 0);
    const outstanding = invoices.filter(inv => inv.status !== 'paid').reduce((sum, inv) => sum + getTotal(inv), 0);
    const overdue = invoices.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + getTotal(inv), 0);
    return { total, outstanding, overdue };
  }

  const totals = getTotals();

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <View style={styles.headerLeft}>
          <HomeButton />
          <View>
            <Text style={[styles.headerName, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Billing')}</Text>
            <Text style={styles.headerBarn}>{new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}</Text>
          </View>
        </View>
        {isOwner && (
          <View style={styles.headerBtns}>
            {qbConnected && (
              <Pressable
                style={({ hovered }: any) => [styles.addBtn, { backgroundColor: C.secondaryAlpha15 }, hovered && { backgroundColor: C.secondaryAlpha30 }]}
                onPress={handleQbSync}
                disabled={syncing}
              >
                {syncing
                  ? <ActivityIndicator color={C.secondary} size="small" />
                  : <Text style={[styles.addBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>↓ QB</Text>}
              </Pressable>
            )}
            <Pressable
              style={({ hovered }: any) => [styles.addBtn, { backgroundColor: C.secondaryAlpha15 }, hovered && { backgroundColor: C.secondaryAlpha30 }]}
              onPress={() => router.push("/billing/templates")}
            >
              <Text style={[styles.addBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Recurring')}</Text>
            </Pressable>
            <Pressable
              style={({ hovered }: any) => [styles.addBtn, { backgroundColor: C.secondaryAlpha15 }, hovered && { backgroundColor: C.secondaryAlpha30 }]}
              onPress={() => router.push("/billing/add")}
            >
              <Text style={[styles.addBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>+ {t('Invoice')}</Text>
            </Pressable>
          </View>
        )}
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {isOwner && (
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, styles.summaryMain, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <Text style={[styles.summaryLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('All-Time Billed')}</Text>
              <Text style={[styles.summaryValLarge, { color: C.text, fontFamily: F.sansBold }]}>${totals.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            </View>
            <View style={styles.summarySmallCol}>
              <View style={[styles.summaryCard, styles.summarySmall, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                <Text style={[styles.summaryLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Outstanding')}</Text>
                <Text style={[styles.summaryValSmall, { color: C.text, fontFamily: F.sansBold }]}>${totals.outstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
              </View>
              <View style={[styles.summaryCard, styles.summarySmall, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                <Text style={[styles.summaryLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Overdue')}</Text>
                <Text style={[styles.summaryValSmall, { color: C.error, fontFamily: F.sansBold }]}>${totals.overdue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
              </View>
            </View>
          </View>
        )}

        {isOwner && pendingCharges.length > 0 && (
          <>
            <View style={styles.pendingHeader}>
              <AlertCircle size={13} color={C.warning} />
              <Text style={[styles.sectionTitle, { color: C.warning, fontFamily: F.sansBold, marginBottom: 0 }]}>{t('Pending Charges')}</Text>
            </View>
            {pendingCharges.map(visit => {
              const serviceLabel = visit.service_type.charAt(0).toUpperCase() + visit.service_type.slice(1);
              return (
                <View key={visit.id} style={[styles.pendingCard, { backgroundColor: C.card, borderColor: C.warningBg }]}>
                  <View style={styles.pendingLeft}>
                    <Text style={[styles.pendingHorse, { color: C.text, fontFamily: F.sansBold }]}>{visit.horses?.name || '—'}</Text>
                    <Text style={[styles.pendingMeta, { color: C.textMuted, fontFamily: F.sans }]}>
                      {serviceLabel}{visit.title ? ` — ${visit.title}` : ''}{visit.provider_name ? ` · ${visit.provider_name}` : ''}
                    </Text>
                    <Text style={[styles.pendingDate, { color: C.textMuted, fontFamily: F.sans }]}>{visit.date}</Text>
                  </View>
                  <View style={styles.pendingRight}>
                    <Text style={[styles.pendingAmount, { color: C.text, fontFamily: F.sansBold }]}>${Number(visit.amount).toFixed(2)}</Text>
                    <Pressable
                      style={({ hovered }: any) => [styles.addInvoiceBtn, { backgroundColor: C.primary }, hovered && { backgroundColor: C.primaryDark }]}
                      onPress={() => handleAddToInvoice(visit)}
                    >
                      <Text style={[styles.addInvoiceBtnText, { fontFamily: F.sansBold }]}>{t('Add to Invoice')}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </>
        )}

        <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Invoices')}</Text>

        {billingLoading ? (
          <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 40 }} />
        ) : invoices.length === 0 ? (
          <View style={styles.emptyState}>
            <Receipt size={40} color={C.cardBorder} />
            <Text style={[styles.emptyTitle, { color: C.text, fontFamily: F.sansBold }]}>{t('No invoices yet.')}</Text>
            {isOwner && <Text style={[styles.emptyText, { color: C.textMuted }]}>{t('Tap + Invoice to create one.')}</Text>}
          </View>
        ) : (
          invoices.map(inv => {
            const total = getTotal(inv);
            return (
              <Pressable
                key={inv.id}
                style={({ hovered }: any) => [styles.invoiceCard, { backgroundColor: C.card, borderColor: C.cardBorder }, hovered && { backgroundColor: C.cardSeparator, borderColor: C.secondary }]}
                onPress={() => {
                  if (isOwner) router.push({ pathname: '/billing/edit', params: { invoiceId: inv.id } });
                  else if (isHorseOwner) router.push({ pathname: '/billing/view', params: { invoiceId: inv.id } });
                }}
              >
                <View style={styles.invoiceLeft}>
                  <Text style={[styles.invoiceHorse, { color: C.text, fontFamily: F.serif }]}>{inv.owner_name || '—'}</Text>
                  <Text style={[styles.invoiceDue, { color: C.textWarm }]}>{t('Due')} {inv.due_date || '—'}</Text>
                  {inv.invoice_line_items?.length > 0 && (
                    <Text style={[styles.invoiceItems, { color: C.textMuted }]}>{inv.invoice_line_items.length} line item{inv.invoice_line_items.length !== 1 ? 's' : ''}</Text>
                  )}
                </View>
                <View style={styles.invoiceRight}>
                  <Text style={[styles.invoiceAmount, { color: C.text, fontFamily: F.sansBold }]}>${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                  <View style={[styles.statusBadge, {
                    backgroundColor: inv.status === 'paid' ? C.successBg : inv.status === 'overdue' ? C.errorBg : C.warningBg
                  }]}>
                    <Text style={[styles.statusText, {
                      color: inv.status === 'paid' ? C.success : inv.status === 'overdue' ? C.error : C.warning,
                      fontFamily: F.sansBold,
                    }]}>{inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerName: { fontSize: 15, fontWeight: '600' },
  headerBarn: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  headerBtns: { flexDirection: 'row', gap: 8 },
  addBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6 },
  addBtnText: { fontSize: 13, fontWeight: '600' },
  body: { flex: 1, padding: 12 },
  summaryGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryCard: { borderWidth: 1, borderRadius: 10, padding: 14 },
  summaryMain: { flex: 1.4 },
  summarySmallCol: { flex: 1, gap: 8 },
  summarySmall: { flex: 1 },
  summaryLabel: { fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  summaryValLarge: { fontSize: 24, fontWeight: '700' },
  summaryValSmall: { fontSize: 18, fontWeight: '700' },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 4 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptyText: { fontSize: 13 },
  invoiceCard: { borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8, gap: 12 },
  invoiceLeft: { flex: 1 },
  invoiceHorse: { fontSize: 14, fontWeight: '600', fontStyle: 'italic' },
  invoiceDue: { fontSize: 11, marginTop: 2 },
  invoiceItems: { fontSize: 11, marginTop: 2 },
  invoiceRight: { alignItems: 'flex-end', gap: 5 },
  invoiceAmount: { fontSize: 16, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '600' },
  pendingHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, marginTop: 4 },
  pendingCard: { borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8, gap: 12 },
  pendingLeft: { flex: 1 },
  pendingHorse: { fontSize: 14, fontWeight: '600' },
  pendingMeta: { fontSize: 12, marginTop: 2 },
  pendingDate: { fontSize: 11, marginTop: 2 },
  pendingRight: { alignItems: 'flex-end', gap: 6 },
  pendingAmount: { fontSize: 15, fontWeight: '700' },
  addInvoiceBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  addInvoiceBtnText: { color: 'white', fontSize: 12, fontWeight: '600' },
});
