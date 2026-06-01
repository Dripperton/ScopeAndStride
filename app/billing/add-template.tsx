import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { useTheme } from '../../context/ThemeContext';

const INTERVALS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom' },
];

const LINE_ITEM_PRESETS = ['Full Board', 'Training Board', 'Pasture Board', 'Farrier', 'Vet Visit', 'Trailering', 'Supplies', 'Other'];

export default function AddTemplate() {
  const router = useRouter();
  const { templateId } = useLocalSearchParams();
  const isEditing = !!templateId;
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;

  const [horses, setHorses] = useState<any[]>([]);
  const [horseId, setHorseId] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [interval, setInterval] = useState('monthly');
  const [dueDay, setDueDay] = useState('1');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState([{ description: '', amount: '' }]);
  const [showHorseDropdown, setShowHorseDropdown] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('horses').select('id, name, owner').order('name').then(({ data }) => {
      if (data) setHorses(data);
    });
    if (isEditing) {
      supabase
        .from('recurring_templates')
        .select('*, recurring_template_line_items(*)')
        .eq('id', templateId)
        .single()
        .then(({ data }) => {
          if (data) {
            setHorseId(String(data.horse_id));
            setOwnerName(data.owner_name || '');
            setInterval(data.interval || 'monthly');
            setDueDay(String(data.due_day || 1));
            setNotes(data.notes || '');
            setLineItems(data.recurring_template_line_items?.length > 0
              ? data.recurring_template_line_items.map((item: any) => ({ description: item.description, amount: String(item.amount) }))
              : [{ description: '', amount: '' }]
            );
          }
          setLoading(false);
        });
    }
  }, [templateId]);

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
    if (isEditing) {
      await supabase.from('recurring_templates').update({
        horse_id: horseId, owner_name: ownerName.trim(),
        interval, due_day: parseInt(dueDay) || 1, notes: notes.trim() || null,
      }).eq('id', templateId);
      await supabase.from('recurring_template_line_items').delete().eq('template_id', templateId);
      await supabase.from('recurring_template_line_items').insert(
        validItems.map(item => ({ template_id: templateId, description: item.description.trim(), amount: parseFloat(item.amount) }))
      );
    } else {
      const { data: template, error: tErr } = await supabase.from('recurring_templates').insert({
        horse_id: horseId, owner_name: ownerName.trim(),
        interval, due_day: parseInt(dueDay) || 1, notes: notes.trim() || null, active: true,
      }).select().single();
      if (tErr || !template) { setError(tErr?.message || 'Failed to create template'); setSaving(false); return; }
      await supabase.from('recurring_template_line_items').insert(
        validItems.map(item => ({ template_id: template.id, description: item.description.trim(), amount: parseFloat(item.amount) }))
      );
    }
    setSaving(false);
    router.back();
  }

  async function handleDelete() {
    const confirmed = Platform.OS === 'web' ? confirm('Delete this template?') : true;
    if (!confirmed) return;
    setDeleting(true);
    await supabase.from('recurring_templates').delete().eq('id', templateId);
    router.back();
  }

  if (loading) return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 80 }} />
    </View>
  );

  const selectedHorse = horses.find(h => String(h.id) === horseId);

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>{t('Cancel')}</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{isEditing ? t('Edit Template') : t('New Template')}</Text>
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
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Template Details')}</Text>

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Horse').toUpperCase()}</Text>
          <Pressable style={[styles.dropdown, { backgroundColor: C.background, borderColor: C.cardBorder }]} onPress={() => setShowHorseDropdown(prev => !prev)}>
            <Text style={[styles.dropdownText, { color: C.text, fontFamily: F.sans }, !selectedHorse && { color: C.textMuted }]}>
              {selectedHorse ? `${selectedHorse.name} — ${selectedHorse.owner}` : 'Select a horse...'}
            </Text>
            <Text style={[styles.dropdownChevron, { color: C.textMuted }]}>{showHorseDropdown ? '▲' : '▼'}</Text>
          </Pressable>
          {showHorseDropdown && (
            <View style={[styles.dropdownList, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              {horses.map(horse => (
                <Pressable
                  key={horse.id}
                  style={({ hovered }: any) => [styles.dropdownItem, { borderBottomColor: C.cardSeparator }, String(horse.id) === horseId && { backgroundColor: C.activeBg }, hovered && { backgroundColor: C.background }]}
                  onPress={() => selectHorse(horse)}
                >
                  <Text style={[styles.dropdownItemText, { color: C.text, fontFamily: F.sans }, String(horse.id) === horseId && { color: C.primary, fontWeight: '600' }]}>
                    {horse.name} — {horse.owner}
                  </Text>
                  {String(horse.id) === horseId && <Text style={[styles.dropdownCheck, { color: C.primary }]}>✓</Text>}
                </Pressable>
              ))}
            </View>
          )}

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Interval').toUpperCase()}</Text>
          <View style={styles.intervalRow}>
            {INTERVALS.map(i => (
              <Pressable
                key={i.value}
                style={[styles.intervalOption, { borderWidth: 1.5, borderColor: C.cardBorder, backgroundColor: 'transparent' }, interval === i.value && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                onPress={() => setInterval(i.value)}
              >
                <Text style={[styles.intervalOptionText, { color: C.textMuted, fontFamily: F.sansMedium }, interval === i.value && { color: C.primary, fontWeight: '700' }]}>
                  {t(i.label)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>
            {interval === 'weekly' ? t('DAY OF WEEK (0=Sun, 1=Mon ... 6=Sat)') : t('DUE DAY OF MONTH')}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
            value={dueDay}
            onChangeText={setDueDay}
            placeholder="1"
            placeholderTextColor={C.textMuted}
            keyboardType="numeric"
          />

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('NOTES')}</Text>
          <TextInput
            style={[styles.input, styles.notesInput, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any notes for generated invoices..."
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
                  <Pressable key={preset} style={[styles.presetChip, { backgroundColor: C.cardSeparator }]} onPress={() => updateLineItem(index, 'description', preset)}>
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

        {isEditing && (
          <Pressable
            style={({ hovered }: any) => [styles.deleteBtn, { backgroundColor: C.error }, hovered && styles.deleteBtnHovered]}
            onPress={handleDelete}
            disabled={deleting}
          >
            {deleting ? <ActivityIndicator color="white" size="small" /> : <Text style={[styles.deleteBtnText, { fontFamily: F.sansBold }]}>{t('Delete Template')}</Text>}
          </Pressable>
        )}

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
  dropdown: { borderWidth: 1, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownText: { fontSize: 14, flex: 1 },
  dropdownChevron: { fontSize: 10 },
  dropdownList: { borderWidth: 1, borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  dropdownItemText: { fontSize: 14 },
  dropdownCheck: { fontSize: 13 },
  intervalRow: { flexDirection: 'row', gap: 8 },
  intervalOption: { flex: 1, borderRadius: 8, padding: 10, alignItems: 'center' },
  intervalOptionText: { fontSize: 12, fontWeight: '500' },
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
