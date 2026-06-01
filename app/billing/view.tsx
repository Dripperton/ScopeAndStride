import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable, Alert, Platform } from 'react-native';
import { StripeProvider } from '../../lib/stripe-provider';
import { useStripe } from '../../lib/stripe-hooks';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../../lib/useProfile';
import { useLanguage } from '../../lib/LanguageContext';
import { useTheme } from '../../context/ThemeContext';

function InvoiceContent() {
  const router = useRouter();
  const { invoiceId } = useLocalSearchParams();
  const { isHorseOwner } = useProfile();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);

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

  async function handlePayNow() {
    setPayLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: { invoiceId },
      });

      if (error || !data?.clientSecret) {
        Alert.alert(t('Error'), t('Could not initialize payment. Please try again.'));
        return;
      }

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: data.clientSecret,
        merchantDisplayName: 'Scope & Stride',
        style: 'automatic',
      });

      if (initError) {
        Alert.alert(t('Error'), initError.message);
        return;
      }

      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code !== 'Canceled') {
          Alert.alert(t('Payment failed'), presentError.message);
        }
        return;
      }

      // Payment succeeded — update local state immediately
      setInvoice((prev: any) => ({ ...prev, status: 'paid' }));
      Alert.alert(t('Payment successful'), t('Your invoice has been paid.'));
    } finally {
      setPayLoading(false);
    }
  }

  if (loading) return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 80 }} />
    </View>
  );

  if (!invoice) return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <Text style={{ padding: 40, color: C.textMuted, textAlign: 'center', fontFamily: F.sans }}>{t('Invoice not found.')}</Text>
    </View>
  );

  const statusColor = invoice.status === 'paid' ? C.success : invoice.status === 'overdue' ? C.error : C.warning;
  const statusBg = invoice.status === 'paid' ? C.successBg : invoice.status === 'overdue' ? C.errorBg : C.warningBg;
  const canPay = isHorseOwner && invoice.status !== 'paid' && Platform.OS !== 'web';

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>{t('Back')}</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Invoice')}</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <View style={styles.invoiceTopRow}>
            <View>
              <Text style={[styles.ownerName, { color: C.text, fontFamily: F.serif }]}>{invoice.owner_name || '—'}</Text>
              <Text style={[styles.dueDate, { color: C.secondary, fontFamily: F.sans }]}>{t('Due')} {invoice.due_date || '—'}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
              <Text style={[styles.statusText, { color: statusColor, fontFamily: F.sansBold }]}>
                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
              </Text>
            </View>
          </View>

          {invoice.notes ? (
            <Text style={[styles.notes, { color: C.textMuted, fontFamily: F.sans }]}>{invoice.notes}</Text>
          ) : null}
        </View>

        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Line Items')}</Text>
          {(invoice.invoice_line_items || []).map((item: any) => (
            <View key={item.id} style={[styles.lineItem, { borderBottomColor: C.cardSeparator }]}>
              <Text style={[styles.lineItemDesc, { color: C.text, fontFamily: F.sans }]}>{item.description}</Text>
              <Text style={[styles.lineItemAmount, { color: C.text, fontFamily: F.sansBold }]}>${Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: C.primary, fontFamily: F.sansBold }]}>{t('Total')}</Text>
            <Text style={[styles.totalAmount, { color: C.primary, fontFamily: F.sansBold }]}>${getTotal().toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
          </View>
        </View>

        {canPay && (
          <Pressable
            style={({ hovered }: any) => [styles.payBtn, { backgroundColor: C.primary }, hovered && { backgroundColor: C.primaryDark }, payLoading && styles.payBtnDisabled]}
            onPress={handlePayNow}
            disabled={payLoading}
          >
            {payLoading
              ? <ActivityIndicator color="white" size="small" />
              : <Text style={[styles.payBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>Pay ${getTotal().toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            }
          </Pressable>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

export default function ViewInvoice() {
  const key = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (key) {
    return (
      <StripeProvider publishableKey={key}>
        <InvoiceContent />
      </StripeProvider>
    );
  }
  return <InvoiceContent />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  body: { flex: 1, padding: 16 },
  section: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  invoiceTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  ownerName: { fontSize: 18, fontWeight: '700', fontStyle: 'italic' },
  dueDate: { fontSize: 13, marginTop: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '600' },
  notes: { fontSize: 13, marginTop: 12, lineHeight: 18 },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  lineItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1 },
  lineItemDesc: { fontSize: 14, flex: 1 },
  lineItemAmount: { fontSize: 14, fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, marginTop: 4 },
  totalLabel: { fontSize: 14, fontWeight: '700' },
  totalAmount: { fontSize: 18, fontWeight: '700' },
  payBtn: { borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 4 },
  payBtnDisabled: { opacity: 0.6 },
  payBtnText: { fontSize: 16, fontWeight: '700' },
});
