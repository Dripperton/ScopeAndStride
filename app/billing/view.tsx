import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function ViewInvoice() {
  const router = useRouter();
  const { invoiceId } = useLocalSearchParams();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('invoices')
      .select('*, invoice_line_items(*)')
      .eq('id', invoiceId)
      .single()
      .then(({ data }) => {
        if (data) setInvoice(data);
        setLoading(false);
      });
  }, [invoiceId]);

  function getTotal() {
    return (invoice?.invoice_line_items || []).reduce((sum: number, item: any) => sum + Number(item.amount), 0);
  }

  if (loading) return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2C4A35" style={{ marginTop: 80 }} />
    </View>
  );

  if (!invoice) return (
    <View style={styles.container}>
      <Text style={{ padding: 40, color: '#9A9285', textAlign: 'center' }}>Invoice not found.</Text>
    </View>
  );

  const statusColor = invoice.status === 'paid' ? '#2C4A35' : invoice.status === 'overdue' ? '#8B2E2E' : '#C8922A';
  const statusBg = invoice.status === 'paid' ? '#EDF5EF' : invoice.status === 'overdue' ? '#FDECEA' : '#FEF6E4';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Invoice</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.invoiceTopRow}>
            <View>
              <Text style={styles.ownerName}>{invoice.owner_name || '—'}</Text>
              <Text style={styles.dueDate}>Due {invoice.due_date || '—'}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
              </Text>
            </View>
          </View>

          {invoice.notes ? (
            <Text style={styles.notes}>{invoice.notes}</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Line Items</Text>
          {(invoice.invoice_line_items || []).map((item: any) => (
            <View key={item.id} style={styles.lineItem}>
              <Text style={styles.lineItemDesc}>{item.description}</Text>
              <Text style={styles.lineItemAmount}>${Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>${getTotal().toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
          </View>
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
  body: { flex: 1, padding: 16 },
  section: { backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#E8E0CC', padding: 16, marginBottom: 12 },
  invoiceTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  ownerName: { fontSize: 18, fontWeight: '700', color: '#1A1A14', fontStyle: 'italic' },
  dueDate: { fontSize: 13, color: '#B08C4A', marginTop: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '600' },
  notes: { fontSize: 13, color: '#9A9285', marginTop: 12, lineHeight: 18 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#9A9285', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  lineItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F1EA' },
  lineItemDesc: { fontSize: 14, color: '#1A1A14', flex: 1 },
  lineItemAmount: { fontSize: 14, fontWeight: '600', color: '#1A1A14' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, marginTop: 4 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: '#2C4A35' },
  totalAmount: { fontSize: 18, fontWeight: '700', color: '#2C4A35' },
});
