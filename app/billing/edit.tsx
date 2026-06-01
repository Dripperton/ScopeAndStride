import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import DateInput from '../../lib/DateInput';
import { useLanguage } from '../../lib/LanguageContext';
import { useTheme } from '../../context/ThemeContext';

const STATUSES = ['pending', 'paid', 'overdue'];
const LINE_ITEM_PRESETS = ['Full Board', 'Training Board', 'Pasture Board', 'Farrier', 'Vet Visit', 'Trailering', 'Supplies', 'Other'];

export default function EditInvoice() {
  const router = useRouter();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const { invoiceId } = useLocalSearchParams();
  const [ownerName, setOwnerName] = useState('');
  const [status, setStatus] = useState('pending');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<any[]>([{ description: '', amount: '' }]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchInvoice() {
      const { data } = await supabase
        .from('invoices')
        .select('*, invoice_line_items(*)')
        .eq('id', invoiceId)
        .single();
      if (data) {
        setOwnerName(data.owner_name || '');
        setStatus(data.status || 'pending');
        setDueDate(data.due_date || '');
        setNotes(data.notes || '');
        setLineItems(data.invoice_line_items?.length > 0
          ? data.invoice_line_items.map((item: any) => ({ id: item.id, description: item.description, amount: String(item.amount) }))
          : [{ description: '', amount: '' }]
        );
      }
      setLoading(false);
    }
    fetchInvoice();
  }, [invoiceId]);

  function addLineItem() {
    setLineItems(prev => [...prev, { description: '', amount: '' }]);
  }

  function removeLineItem(index: number) {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  }

  function updateLineItem(index: number, field: 'description' | 'amount', value: string) {
    setLineItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  function getTotal() {
    return lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  }

  async function handleSave() {
    const validItems = lineItems.filter(item => item.description.trim() && item.amount);
    if (validItems.length === 0) { setError('Add at least one line item.'); return; }
    setSaving(true);
    setError('');
    await supabase.from('invoices').update({
      owner_name: ownerName.trim(),
      status,
      due_date: dueDate || null,
      notes: notes.trim() || null,
    }).eq('id', invoiceId);
    await supabase.from('invoice_line_items').delete().eq('invoice_id', invoiceId);
    await supabase.from('invoice_line_items').insert(
      validItems.map(item => ({ invoice_id: invoiceId, description: item.description.trim(), amount: parseFloat(item.amount) }))
    );
    setSaving(false);
    router.back();
  }

  async function handleDelete() {
    if (Platform.OS === 'web') {
      if (!confirm('Delete this invoice?')) return;
    } else {
      await new Promise<void>((resolve, reject) => {
        Alert.alert('Delete Invoice', 'Are you sure? This cannot be undone.', [
          { text: 'Cancel', style: 'cancel', onPress: () => reject() },
          { text: 'Delete', style: 'destructive', onPress: () => resolve() },
        ]);
      }).catch(() => { setDeleting(false); return; });
    }
    setDeleting(true);
    await supabase.from('invoices').delete().eq('id', invoiceId);
    router.back();
  }

  if (loading) return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 80 }} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>{t('Cancel')}</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Edit Invoice')}</Text>
        <Pressable
          style={({ hovered }: any) => [styles.saveBtn, hovered && styles.saveBtnHovered]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#1A1A14" size="small" /> : <Text style={[styles.saveBtnText, { fontFamily: F.sansBold }]}>{t('Save')}</Text>}
        </Pressable>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Invoice Details')}</Text>

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Owner Name').toUpperCase()}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
            value={ownerName}
            onChangeText={setOwnerName}
            placeholder="e.g. Robert Henderson"
            placeholderTextColor={C.textMuted}
          />

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Status').toUpperCase()}</Text>
          <View style={styles.statusRow}>
            {STATUSES.map(s => (
              <Pressable
                key={s}
                style={[styles.statusOption, { borderWidth: 1.5, borderColor: C.cardBorder, backgroundColor: 'transparent' }, status === s && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                onPress={() => setStatus(s)}
              >
                <Text style={[styles.statusOptionText, { color: C.textMuted, fontFamily: F.sansMedium }, status === s && { color: C.primary, fontWeight: '700' }]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Due Date').toUpperCase()}</Text>
          <DateInput value={dueDate} onChange={setDueDate} placeholder="Select date" />

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Notes').toUpperCase()}</Text>
          <TextInput
            style={[styles.input, styles.notesInput, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional notes..."
            placeholderTextColor={C.textMuted}
            multiline
          />
        </View>

        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Line Items')}</Text>
            <Text style={[styles.totalText, { color: C.primary, fontFamily: F.sansBold }]}>{t('Total')}: ${getTotal().toFixed(2)}</Text>
          </View>

          {lineItems.map((item, index) => (
            <View key={index} style={[styles.lineItem, { borderBottomColor: C.cardSeparator }]}>
              <View style={styles.lineItemTop}>
                <TextInput
                  style={[styles.input, styles.lineItemDesc, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
                  value={item.description}
                  onChangeText={val => updateLineItem(index, 'description', val)}
                  placeholder="Description"
                  placeholderTextColor={C.textMuted}
                />
                <TextInput
                  style={[styles.input, styles.lineItemAmount, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
                  value={item.amount}
                  onChangeText={val => updateLineItem(index, 'amount', val)}
                  placeholder="0.00"
                  placeholderTextColor={C.textMuted}
                  keyboardType="numeric"
                />
                {lineItems.length > 1 && (
                  <Pressable onPress={() => removeLineItem(index)} style={styles.removeBtn}>
                    <Text style={[styles.removeBtnText, { color: C.error }]}>✕</Text>
                  </Pressable>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsRow}>
                {LINE_ITEM_PRESETS.map(preset => (
                  <Pressable
                    key={preset}
                    style={[styles.presetChip, { backgroundColor: C.cardSeparator }]}
                    onPress={() => updateLineItem(index, 'description', preset)}
                  >
                    <Text style={[styles.presetChipText, { color: C.primary, fontFamily: F.sansMedium }]}>{preset}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ))}

          <Pressable
            style={({ hovered }: any) => [styles.addLineBtn, { borderColor: C.primary }, hovered && { backgroundColor: C.activeBg }]}
            onPress={addLineItem}
          >
            <Text style={[styles.addLineBtnText, { color: C.primary, fontFamily: F.sansBold }]}>+ {t('Add Line Item')}</Text>
          </Pressable>
        </View>

        {error ? <Text style={[styles.errorText, { color: C.error, fontFamily: F.sans }]}>{error}</Text> : null}

        <Pressable
          style={({ hovered }: any) => [styles.deleteBtn, { backgroundColor: C.error }, hovered && styles.deleteBtnHovered]}
          onPress={handleDelete}
          disabled={deleting}
        >
          {deleting ? <ActivityIndicator color="white" size="small" /> : <Text style={[styles.deleteBtnText, { fontFamily: F.sansBold }]}>{t('Delete Invoice')}</Text>}
        </Pressable>

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
  saveBtn: { backgroundColor: 'transparent', paddingHorizontal: 4, paddingVertical: 4, borderRadius: 0, borderWidth: 0 },
  saveBtnHovered: {},
  saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  body: { flex: 1 },
  section: { margin: 16, marginBottom: 0, borderRadius: 14, borderWidth: 1, padding: 16 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  totalText: { fontSize: 14, fontWeight: '700' },
  fieldLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
  notesInput: { minHeight: 60, textAlignVertical: 'top' },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusOption: { flex: 1, borderRadius: 8, padding: 10, alignItems: 'center' },
  statusOptionText: { fontSize: 12, fontWeight: '500' },
  lineItem: { marginBottom: 12, borderBottomWidth: 1, paddingBottom: 12 },
  lineItemTop: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  lineItemDesc: { flex: 2 },
  lineItemAmount: { flex: 1 },
  removeBtn: { padding: 8 },
  removeBtnText: { fontSize: 14 },
  presetsRow: { marginTop: 8 },
  presetChip: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6 },
  presetChipText: { fontSize: 11, fontWeight: '500' },
  addLineBtn: { marginTop: 8, padding: 12, borderWidth: 1.5, borderRadius: 10, alignItems: 'center', borderStyle: 'dashed' },
  addLineBtnText: { fontSize: 13, fontWeight: '600' },
  errorText: { fontSize: 13, padding: 16 },
  deleteBtn: { margin: 16, borderRadius: 12, padding: 16, alignItems: 'center' },
  deleteBtnHovered: { backgroundColor: '#6B1E1E' },
  deleteBtnText: { color: 'white', fontSize: 14, fontWeight: '600' },
});
