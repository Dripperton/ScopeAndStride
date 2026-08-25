import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { useProfile } from '../../../lib/useProfile';
import DateInput from '../../../lib/DateInput';
import { useLanguage } from '../../../lib/LanguageContext';
import { useTheme } from '../../../context/ThemeContext';
import { Plus, Trash2, X } from 'lucide-react-native';

const STANDARD_TEMPLATES = [
  'Stays in',
  'Stall cleaned',
  'Do not ride',
  'Lame — monitor',
];

function today() {
  return new Date().toISOString().split('T')[0];
}

export default function AddDailyCare() {
  const router = useRouter();
  const { horseId, logId } = useLocalSearchParams();
  const { profile, canEdit } = useProfile();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const [loading, setLoading] = useState(!!logId);
  const [saving, setSaving] = useState(false);
  const [horseName, setHorseName] = useState('');

  const [date, setDate] = useState(today());
  const [groomed, setGroomed] = useState(!logId);
  const [turnedOut, setTurnedOut] = useState(false);
  const [turnoutDuration, setTurnoutDuration] = useState('');
  const [ridden, setRidden] = useState(false);
  const [notes, setNotes] = useState('');

  const [customTemplates, setCustomTemplates] = useState<{ id: string; text: string }[]>([]);
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [newTemplateText, setNewTemplateText] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [manageVisible, setManageVisible] = useState(false);

  useEffect(() => {
    async function fetchHorse() {
      const { data } = await supabase.from('horses').select('name').eq('id', horseId).single();
      if (data) setHorseName(data.name);
    }
    fetchHorse();

    if (logId) {
      supabase.from('daily_care_logs').select('*').eq('id', logId).single().then(({ data }) => {
        if (data) {
          setDate(data.date);
          setGroomed(data.groomed || false);
          setTurnedOut(data.turned_out || false);
          setTurnoutDuration(data.turnout_duration || '');
          setRidden(data.ridden || false);
          setNotes(data.notes || '');
        }
        setLoading(false);
      });
    }
  }, [horseId, logId]);

  useEffect(() => {
    supabase.from('note_templates').select('id, text').order('text').then(({ data }) => {
      if (data) setCustomTemplates(data);
    });
  }, []);

  function applyTemplate(text: string) {
    setNotes(prev => prev.trim() ? `${prev.trim()}\n${text}` : text);
  }

  async function saveTemplate() {
    const text = newTemplateText.trim();
    if (!text) return;
    setSavingTemplate(true);
    await supabase.from('note_templates').insert({ text, created_by: profile?.id });
    const { data } = await supabase.from('note_templates').select('id, text').order('text');
    if (data) setCustomTemplates(data);
    setNewTemplateText('');
    setAddingTemplate(false);
    setSavingTemplate(false);
  }

  async function deleteTemplate(id: string) {
    await supabase.from('note_templates').delete().eq('id', id);
    setCustomTemplates(prev => prev.filter(t => t.id !== id));
  }

  async function handleSave() {
    setSaving(true);
    await supabase.from('daily_care_logs').upsert({
      horse_id: horseId,
      date,
      groomed,
      turned_out: turnedOut,
      turnout_duration: turnedOut ? (turnoutDuration || null) : null,
      ridden,
      notes: notes.trim() || null,
      created_by: profile?.id,
    }, { onConflict: 'horse_id,date' });
    setSaving(false);
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
        <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{horseName || t('Daily Care')}</Text>
        <Pressable
          style={({ hovered }: any) => [styles.saveBtn, hovered && { opacity: 0.8 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={[styles.saveBtnText, { fontFamily: F.sansBold }]}>{t('Save')}</Text>}
        </Pressable>
      </View>

      {/* Manage Custom Templates Modal */}
      <Modal visible={manageVisible} transparent animationType="slide" onRequestClose={() => setManageVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setManageVisible(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: C.card }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: C.text, fontFamily: F.sansBold }]}>Custom Templates</Text>
            {customTemplates.length === 0 && (
              <Text style={[styles.emptyText, { color: C.textMuted, fontFamily: F.sans }]}>No custom templates yet.</Text>
            )}
            {customTemplates.map(tmpl => (
              <View key={tmpl.id} style={[styles.manageRow, { borderColor: C.cardBorder }]}>
                <Text style={[styles.manageRowText, { color: C.text, fontFamily: F.sans }]}>{tmpl.text}</Text>
                <Pressable onPress={() => deleteTemplate(tmpl.id)} style={styles.deleteBtn}>
                  <Trash2 size={14} color={C.error} />
                </Pressable>
              </View>
            ))}
            <Pressable onPress={() => setManageVisible(false)} style={styles.closeBtn}>
              <Text style={[styles.closeBtnText, { color: C.textMuted, fontFamily: F.sans }]}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Date')}</Text>
          <DateInput value={date} onChange={setDate} />
        </View>

        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Care Log')}</Text>

          <Pressable style={[styles.checkRow, { borderBottomColor: C.cardSeparator }]} onPress={() => setGroomed(!groomed)}>
            <View style={[styles.checkbox, { borderColor: C.cardBorder }, groomed && { backgroundColor: C.primary, borderColor: C.primary }]}>
              {groomed && <Text style={[styles.checkmark, { color: C.card }]}>✓</Text>}
            </View>
            <Text style={[styles.checkLabel, { color: C.text, fontFamily: F.sans }]}>{t('Groomed')}</Text>
          </Pressable>

          <Pressable style={[styles.checkRow, { borderBottomColor: C.cardSeparator }]} onPress={() => setTurnedOut(!turnedOut)}>
            <View style={[styles.checkbox, { borderColor: C.cardBorder }, turnedOut && { backgroundColor: C.primary, borderColor: C.primary }]}>
              {turnedOut && <Text style={[styles.checkmark, { color: C.card }]}>✓</Text>}
            </View>
            <Text style={[styles.checkLabel, { color: C.text, fontFamily: F.sans }]}>{t('Turned Out')}</Text>
          </Pressable>

          {turnedOut && (
            <TextInput
              style={[styles.input, styles.durationInput, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
              value={turnoutDuration}
              onChangeText={setTurnoutDuration}
              placeholder="Duration (e.g. 2 hours, all day)"
              placeholderTextColor={C.textMuted}
            />
          )}

          <Pressable style={[styles.checkRow, { borderBottomColor: C.cardSeparator }]} onPress={() => setRidden(!ridden)}>
            <View style={[styles.checkbox, { borderColor: C.cardBorder }, ridden && { backgroundColor: C.primary, borderColor: C.primary }]}>
              {ridden && <Text style={[styles.checkmark, { color: C.card }]}>✓</Text>}
            </View>
            <Text style={[styles.checkLabel, { color: C.text, fontFamily: F.sans }]}>{t('Ridden')}</Text>
          </Pressable>
        </View>

        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Notes')}</Text>

          {/* Template chips */}
          <View style={styles.chipsRow}>
            {STANDARD_TEMPLATES.map(text => (
              <Pressable
                key={text}
                style={({ hovered }: any) => [styles.chip, { backgroundColor: C.activeBg, borderColor: C.primary }, hovered && { opacity: 0.75 }]}
                onPress={() => applyTemplate(text)}
              >
                <Text style={[styles.chipText, { color: C.primary, fontFamily: F.sansMedium }]}>{text}</Text>
              </Pressable>
            ))}
            {customTemplates.map(tmpl => (
              <Pressable
                key={tmpl.id}
                style={({ hovered }: any) => [styles.chip, { backgroundColor: C.activeBg, borderColor: C.primary }, hovered && { opacity: 0.75 }]}
                onPress={() => applyTemplate(tmpl.text)}
              >
                <Text style={[styles.chipText, { color: C.primary, fontFamily: F.sansMedium }]}>{tmpl.text}</Text>
              </Pressable>
            ))}
            {canEdit && !addingTemplate && (
              <Pressable
                style={({ hovered }: any) => [styles.chip, styles.chipAdd, { borderColor: C.cardBorder }, hovered && { backgroundColor: C.activeBg }]}
                onPress={() => setAddingTemplate(true)}
              >
                <Plus size={12} color={C.textMuted} />
              </Pressable>
            )}
            {canEdit && customTemplates.length > 0 && !addingTemplate && (
              <Pressable onPress={() => setManageVisible(true)} style={styles.manageLink}>
                <Text style={[styles.manageLinkText, { color: C.textMuted, fontFamily: F.sans }]}>Manage</Text>
              </Pressable>
            )}
          </View>

          {/* Inline add custom template */}
          {addingTemplate && (
            <View style={[styles.inlineAddRow, { borderColor: C.cardBorder }]}>
              <TextInput
                style={[styles.inlineAddInput, { color: C.text, fontFamily: F.sans }]}
                value={newTemplateText}
                onChangeText={setNewTemplateText}
                placeholder="New template text..."
                placeholderTextColor={C.textMuted}
                autoFocus
              />
              <Pressable
                style={[styles.inlineAddSave, { backgroundColor: C.primary }, (!newTemplateText.trim() || savingTemplate) && { opacity: 0.4 }]}
                onPress={saveTemplate}
                disabled={!newTemplateText.trim() || savingTemplate}
              >
                <Text style={[styles.inlineAddSaveText, { color: C.card, fontFamily: F.sansBold }]}>Save</Text>
              </Pressable>
              <Pressable onPress={() => { setAddingTemplate(false); setNewTemplateText(''); }} style={styles.inlineAddCancel}>
                <X size={16} color={C.textMuted} />
              </Pressable>
            </View>
          )}

          <TextInput
            style={[styles.input, styles.notesInput, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any observations, incidents, or notes for the owner..."
            placeholderTextColor={C.textMuted}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '600', fontStyle: 'italic' },
  saveBtn: { backgroundColor: 'transparent', paddingHorizontal: 4, paddingVertical: 4, borderRadius: 0, borderWidth: 0 },
  saveBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  body: { flex: 1, padding: 16 },
  section: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkmark: { fontSize: 13, fontWeight: '700' },
  checkLabel: { fontSize: 15 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
  durationInput: { marginTop: 8, marginLeft: 34 },
  notesInput: { minHeight: 96, textAlignVertical: 'top' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipAdd: { paddingHorizontal: 8, paddingVertical: 6 },
  chipText: { fontSize: 13 },
  manageLink: { paddingHorizontal: 4 },
  manageLinkText: { fontSize: 12, textDecorationLine: 'underline' },
  inlineAddRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 },
  inlineAddInput: { flex: 1, fontSize: 14, paddingVertical: 4 },
  inlineAddSave: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  inlineAddSaveText: { fontSize: 13, fontWeight: '700' },
  inlineAddCancel: { padding: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, maxHeight: '80%' },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  manageRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 8 },
  manageRowText: { flex: 1, fontSize: 14 },
  emptyText: { fontSize: 13, fontStyle: 'italic', marginBottom: 12 },
  deleteBtn: { paddingLeft: 12 },
  closeBtn: { alignSelf: 'center', marginTop: 12, paddingVertical: 4 },
  closeBtnText: { fontSize: 13 },
});
