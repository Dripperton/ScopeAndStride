import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Home, ChessKnight, Calendar, DollarSign, MoreHorizontal, Receipt } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../../lib/useProfile';

export default function Billing() {
  const router = useRouter();
  const { isOwner, isHorseOwner, profile } = useProfile();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    fetchInvoices();
  }, []));

  async function fetchInvoices() {
    setLoading(true);
    let query = supabase
      .from('invoices')
      .select('*, invoice_line_items(*)')
      .order('created_at', { ascending: false });

    if (isHorseOwner && profile?.horse_id) {
      query = query.eq('horse_id', profile.horse_id);
    }

    const { data } = await query;
    setInvoices(data || []);
    setLoading(false);
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
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}><Text style={styles.headerIconText}>S{'\n'}S</Text></View>
          <View>
            <Text style={styles.headerName}>Billing</Text>
            <Text style={styles.headerBarn}>{new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}</Text>
          </View>
        </View>
        {isOwner && (
          <View style={styles.headerBtns}>
            <Pressable
              style={({ hovered }: any) => [styles.addBtn, hovered && styles.addBtnHovered]}
              onPress={() => router.push("/billing/templates")}
            >
              <Text style={styles.addBtnText}>Recurring</Text>
            </Pressable>
            <Pressable
              style={({ hovered }: any) => [styles.addBtn, hovered && styles.addBtnHovered]}
              onPress={() => router.push("/billing/add")}
            >
              <Text style={styles.addBtnText}>+ Invoice</Text>
            </Pressable>
          </View>
        )}
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {isOwner && (
          <View style={styles.summaryGrid}>
            <View style={[styles.summaryCard, styles.summaryMain]}>
              <Text style={styles.summaryLabel}>All-Time Billed</Text>
              <Text style={styles.summaryValLarge}>${totals.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            </View>
            <View style={styles.summarySmallCol}>
              <View style={[styles.summaryCard, styles.summarySmall]}>
                <Text style={styles.summaryLabel}>Outstanding</Text>
                <Text style={styles.summaryValSmall}>${totals.outstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
              </View>
              <View style={[styles.summaryCard, styles.summarySmall]}>
                <Text style={styles.summaryLabel}>Overdue</Text>
                <Text style={[styles.summaryValSmall, { color: '#8B2E2E' }]}>${totals.overdue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
              </View>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Invoices</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#2C4A35" style={{ marginTop: 40 }} />
        ) : invoices.length === 0 ? (
          <View style={styles.emptyState}>
            <Receipt size={40} color="#C4BAA8" />
            <Text style={styles.emptyTitle}>No invoices yet</Text>
            {isOwner && <Text style={styles.emptyText}>Tap + Invoice to create one.</Text>}
          </View>
        ) : (
          invoices.map(inv => {
            const total = getTotal(inv);
            return (
              <Pressable
                key={inv.id}
                style={({ hovered }: any) => [styles.invoiceCard, hovered && styles.invoiceCardHovered]}
                onPress={() => {
                  if (isOwner) router.push({ pathname: '/billing/edit', params: { invoiceId: inv.id } });
                  else if (isHorseOwner) router.push({ pathname: '/billing/view', params: { invoiceId: inv.id } });
                }}
              >
                <View style={styles.invoiceLeft}>
                  <Text style={styles.invoiceHorse}>{inv.owner_name || '—'}</Text>
                  <Text style={styles.invoiceDue}>Due {inv.due_date || '—'}</Text>
                  {inv.invoice_line_items?.length > 0 && (
                    <Text style={styles.invoiceItems}>{inv.invoice_line_items.length} line item{inv.invoice_line_items.length !== 1 ? 's' : ''}</Text>
                  )}
                </View>
                <View style={styles.invoiceRight}>
                  <Text style={styles.invoiceAmount}>${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                  <View style={[styles.statusBadge, {
                    backgroundColor: inv.status === 'paid' ? '#EDF5EF' : inv.status === 'overdue' ? '#FDECEA' : '#FEF6E4'
                  }]}>
                    <Text style={[styles.statusText, {
                      color: inv.status === 'paid' ? '#2C4A35' : inv.status === 'overdue' ? '#8B2E2E' : '#C8922A'
                    }]}>{inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <View style={styles.nav}>
        <Pressable style={styles.navItem} onPress={() => router.push('/dashboard')}>
          <Home size={22} color="#9A9285" />
          <Text style={styles.navLbl}>Home</Text>
        </Pressable>
        {isOwner && (
          <Pressable style={styles.navItem} onPress={() => router.push('/horses')}>
            <ChessKnight size={22} color="#9A9285" />
            <Text style={styles.navLbl}>Horses</Text>
          </Pressable>
        )}
        <Pressable style={styles.navItem} onPress={() => router.push('/schedule')}>
          <Calendar size={22} color="#9A9285" />
          <Text style={styles.navLbl}>Schedule</Text>
        </Pressable>
        <Pressable style={styles.navItem}>
          <DollarSign size={22} color="#2C4A35" />
          <Text style={[styles.navLbl, styles.navActive]}>Billing</Text>
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
  container: { flex: 1, backgroundColor: '#FAF7F2' },
  header: { backgroundColor: '#2C4A35', padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 32, height: 32, backgroundColor: 'rgba(201,168,92,0.15)', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  headerIconText: { fontSize: 10, fontWeight: '700', color: '#C9A85C', textAlign: 'center', lineHeight: 11 },
  headerName: { fontSize: 15, fontWeight: '600', color: '#C9A85C' },
  headerBarn: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  headerBtns: { flexDirection: 'row', gap: 8 },
  addBtn: { backgroundColor: 'rgba(201,168,92,0.15)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6 },
  addBtnHovered: { backgroundColor: 'rgba(201,168,92,0.3)' },
  addBtnText: { color: '#C9A85C', fontSize: 13, fontWeight: '600' },
  body: { flex: 1, padding: 12 },
  summaryGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryCard: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 10, padding: 14 },
  summaryMain: { flex: 1.4 },
  summarySmallCol: { flex: 1, gap: 8 },
  summarySmall: { flex: 1 },
  summaryLabel: { fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, color: '#9A9285', marginBottom: 4 },
  summaryValLarge: { fontSize: 24, fontWeight: '700', color: '#1A1A14' },
  summaryValSmall: { fontSize: 18, fontWeight: '700', color: '#1A1A14' },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#9A9285', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 4 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A14' },
  emptyText: { fontSize: 13, color: '#9A9285' },
  invoiceCard: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 10, flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8, gap: 12 },
  invoiceCardHovered: { backgroundColor: '#F5F1EA', borderColor: '#C9A85C' },
  invoiceLeft: { flex: 1 },
  invoiceHorse: { fontSize: 14, fontWeight: '600', color: '#1A1A14', fontStyle: 'italic' },
  invoiceDue: { fontSize: 11, color: '#B08C4A', marginTop: 2 },
  invoiceItems: { fontSize: 11, color: '#9A9285', marginTop: 2 },
  invoiceRight: { alignItems: 'flex-end', gap: 5 },
  invoiceAmount: { fontSize: 16, fontWeight: '700', color: '#1A1A14' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '600' },
  nav: { backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#E8E0CC', flexDirection: 'row', paddingBottom: 20, paddingTop: 8 },
  navItem: { flex: 1, alignItems: 'center', gap: 2 },
  navLbl: { fontSize: 9, color: '#9A9285' },
  navActive: { color: '#2C4A35', fontWeight: '600' },
});
