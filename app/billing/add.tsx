import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import DateInput from '../../lib/DateInput';

const STATUSES = ['pending', 'paid', 'overdue'];
const LINE_ITEM_PRESETS = ['Full Board', 'Training Board', 'Pasture Board', 'Farrier', 'Vet Visit', 'Trailering', 'Supplies', 'Other'];

export default function AddInvoice() {
  const router = useRouter();
  const [horses, setHorses] = useState<any[]>([]);
  const [horseId, setHorseId] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [status, setStatus] = useState('pending');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState([{ description: '', amount: '' }]);
  const [showHorseDropdown, setShowHorseDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('horses').select('id, name, owner').order('name').then(({ data }) => {
      if (data) setHorses(data);
    });
  }, []);

  function selectHorse(horse: any) {
    setHorseId(String(horse.id));
    setOwnerName(horse.owner || '');
    setShowHorseDropdown(false);
  }

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
    if (!horseId) { setError('Please select a horse.'); return; }
    const validItems = lineItems.filter(item => item.description.trim() && item.amount);
    if (validItems.length === 0) { setError('Add at least one line item.'); return; }
    setSaving(true);
    setError('');
    const { data: invoice, error: invErr } = await supabase.from('invoices').insert({
      horse_id: horseId,
      owner_name: ownerName.trim(),
      status,
      due_date: dueDate || null,
      notes: notes.trim() || null,
    }).select().single();
    if (invErr || !invoice) { setError(invErr?.message || 'Failed to create invoice'); setSaving(false); return; }
    const { error: itemsErr } = await supabase.from('invoice_line_items').insert(
      validItems.map(item => ({ invoice_id: invoice.id, description: item.description.trim(), amount: parseFloat(item.amount) }))
    );
    if (itemsErr) { setError(itemsErr.message); setSaving(false); return; }
    router.back();
  }

  const selectedHorse = horses.find(h => String(h.id) === horseId);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>New Invoice</Text>
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

          <Text style={styles.fieldLabel}>HORSE</Text>
          <Pressable style={styles.dropdown} onPress={() => setShowHorseDropdown(prev => !prev)}>
            <Text style={[styles.dropdownText, !selectedHorse && styles.dropdownPlaceholder]}>
              {selectedHorse ? `${selectedHorse.name} — ${selectedHorse.owner}` : 'Select a horse...'}
            </Text>
            <Text style={styles.dropdownChevron}>{showHorseDropdown ? '▲' : '▼'}</Text>
          </Pressable>
          {showHorseDropdown && (
            <View style={styles.dropdownList}>
              {horses.map(horse => (
                <Pressable
                  key={horse.id}
                  style={({ hovered }: any) => [styles.dropdownItem, String(horse.id) === horseId && styles.dropdownItemSelected, hovered && styles.dropdownItemHovered]}
                  onPress={() => selectHorse(horse)}
                >
                  <Text style={[styles.dropdownItemText, String(horse.id) === horseId && styles.dropdownItemTextSelected]}>
                    {horse.name} — {horse.owner}
                  </Text>
                  {String(horse.id) === horseId && <Text style={styles.dropdownCheck}>✓</Text>}
                </Pressable>
              ))}
            </View>
          )}

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
  dropdown: { backgroundColor: '#FAF7F2', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownText: { fontSize: 14, color: '#1A1A14', flex: 1 },
  dropdownPlaceholder: { color: '#9A9285' },
  dropdownChevron: { fontSize: 10, color: '#9A9285' },
  dropdownList: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F5F1EA' },
  dropdownItemSelected: { backgroundColor: '#EDF5EF' },
  dropdownItemHovered: { backgroundColor: '#FAF7F2' },
  dropdownItemText: { fontSize: 14, color: '#1A1A14' },
  dropdownItemTextSelected: { color: '#2C4A35', fontWeight: '600' },
  dropdownCheck: { fontSize: 13, color: '#2C4A35' },
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
});
