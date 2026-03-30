import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import DateInput from '../../lib/DateInput';

const STATUSES = ['pending', 'paid', 'overdue'];
const LINE_ITEM_PRESETS = ['Full Board', 'Training Board', 'Pasture Board', 'Farrier', 'Vet Visit', 'Trailering', 'Supplies', 'Other'];

export default function EditInvoice() {
  const router = useRouter();
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
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2C4A35" style={{ marginTop: 80 }} />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={({ hovered }: any) => [styles.homeBtn, hovered && styles.homeBtnHovered]} onPress={() => router.push('/dashboard')}><Home size={18} color="#C9A85C" /></Pressable>
        <Text style={styles.headerTitle}>Edit Invoice</Text>
        <Pressable
          style={({ hovered }: any) => [styles.saveBtn, hovered && styles.saveBtnHovered]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#1A1A14" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </Pressable>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invoice Details</Text>

          <Text style={styles.fieldLabel}>OWNER NAME</Text>
          <TextInput
            style={styles.input}
            value={ownerName}
            onChangeText={setOwnerName}
            placeholder="e.g. Robert Henderson"
            placeholderTextColor="#9A9285"
          />

          <Text style={styles.fieldLabel}>STATUS</Text>
          <View style={styles.statusRow}>
            {STATUSES.map(s => (
              <Pressable
                key={s}
                style={[styles.statusOption, status === s && styles.statusOptionSelected]}
                onPress={() => setStatus(s)}
              >
                <Text style={[styles.statusOptionText, status === s && styles.statusOptionTextSelected]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>DUE DATE</Text>
          <DateInput value={dueDate} onChange={setDueDate} placeholder="Select date" />

          <Text style={styles.fieldLabel}>NOTES</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional notes..."
            placeholderTextColor="#9A9285"
            multiline
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Line Items</Text>
            <Text style={styles.totalText}>Total: ${getTotal().toFixed(2)}</Text>
          </View>

          {lineItems.map((item, index) => (
            <View key={index} style={styles.lineItem}>
              <View style={styles.lineItemTop}>
                <TextInput
                  style={[styles.input, styles.lineItemDesc]}
                  value={item.description}
                  onChangeText={val => updateLineItem(index, 'description', val)}
                  placeholder="Description"
                  placeholderTextColor="#9A9285"
                />
                <TextInput
                  style={[styles.input, styles.lineItemAmount]}
                  value={item.amount}
                  onChangeText={val => updateLineItem(index, 'amount', val)}
                  placeholder="0.00"
                  placeholderTextColor="#9A9285"
                  keyboardType="numeric"
                />
                {lineItems.length > 1 && (
                  <Pressable onPress={() => removeLineItem(index)} style={styles.removeBtn}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </Pressable>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsRow}>
                {LINE_ITEM_PRESETS.map(preset => (
                  <Pressable
                    key={preset}
                    style={styles.presetChip}
                    onPress={() => updateLineItem(index, 'description', preset)}
                  >
                    <Text style={styles.presetChipText}>{preset}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ))}

          <Pressable
            style={({ hovered }: any) => [styles.addLineBtn, hovered && styles.addLineBtnHovered]}
            onPress={addLineItem}
          >
            <Text style={styles.addLineBtnText}>+ Add Line Item</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          style={({ hovered }: any) => [styles.deleteBtn, hovered && styles.deleteBtnHovered]}
          onPress={handleDelete}
          disabled={deleting}
        >
          {deleting ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.deleteBtnText}>Delete Invoice</Text>}
        </Pressable>

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
  saveBtn: { backgroundColor: '#C9A85C', paddingHorizontal: 16, paddingVertical: 7, borderRadius: 6 },
  saveBtnHovered: { backgroundColor: '#B08C4A' },
  saveBtnText: { color: '#1A1A14', fontSize: 13, fontWeight: '700' },
  body: { flex: 1 },
  section: { margin: 16, marginBottom: 0, backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#E8E0CC', padding: 16 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#9A9285', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  totalText: { fontSize: 14, fontWeight: '700', color: '#2C4A35' },
  fieldLabel: { fontSize: 10, fontWeight: '600', color: '#9A9285', letterSpacing: 1, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#FAF7F2', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 10, padding: 12, fontSize: 14, color: '#1A1A14' },
  notesInput: { minHeight: 60, textAlignVertical: 'top' },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusOption: { flex: 1, borderWidth: 1.5, borderColor: '#E8E0CC', borderRadius: 8, padding: 10, alignItems: 'center' },
  statusOptionSelected: { borderColor: '#2C4A35', backgroundColor: '#EDF5EF' },
  statusOptionText: { fontSize: 12, color: '#9A9285', fontWeight: '500' },
  statusOptionTextSelected: { color: '#2C4A35', fontWeight: '700' },
  lineItem: { marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F5F1EA', paddingBottom: 12 },
  lineItemTop: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  lineItemDesc: { flex: 2 },
  lineItemAmount: { flex: 1 },
  removeBtn: { padding: 8 },
  removeBtnText: { fontSize: 14, color: '#8B2E2E' },
  presetsRow: { marginTop: 8 },
  presetChip: { backgroundColor: '#F5F1EA', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6 },
  presetChipText: { fontSize: 11, color: '#2C4A35', fontWeight: '500' },
  addLineBtn: { marginTop: 8, padding: 12, borderWidth: 1.5, borderColor: '#2C4A35', borderRadius: 10, alignItems: 'center', borderStyle: 'dashed' },
  addLineBtnHovered: { backgroundColor: '#EDF5EF' },
  addLineBtnText: { fontSize: 13, color: '#2C4A35', fontWeight: '600' },
  errorText: { color: '#8B2E2E', fontSize: 13, padding: 16 },
  deleteBtn: { margin: 16, backgroundColor: '#8B2E2E', borderRadius: 12, padding: 16, alignItems: 'center' },
  deleteBtnHovered: { backgroundColor: '#6B1E1E' },
  deleteBtnText: { color: 'white', fontSize: 14, fontWeight: '600' },
  homeBtn: { width: 32, height: 32, backgroundColor: 'rgba(201,168,92,0.15)', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  homeBtnHovered: { backgroundColor: 'rgba(201,168,92,0.3)' },
});
