import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../lib/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import HomeButton from '../../lib/HomeButton';

function getNextDueDate(interval: string, dueDay: number) {
  const today = new Date();
  const now = new Date();
  if (interval === 'monthly') {
    const due = new Date(now.getFullYear(), now.getMonth(), dueDay);
    if (due <= today) due.setMonth(due.getMonth() + 1);
    return due.toISOString().split('T')[0];
  }
  if (interval === 'weekly') {
    const due = new Date(today);
    due.setDate(today.getDate() + ((dueDay - today.getDay() + 7) % 7 || 7));
    return due.toISOString().split('T')[0];
  }
  return '';
}

export default function RecurringTemplates() {
  const router = useRouter();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState('');

  useFocusEffect(useCallback(() => {
    fetchTemplates();
  }, []));

  async function fetchTemplates() {
    if (templates.length === 0) setLoading(true);
    const { data } = await supabase
      .from('recurring_templates')
      .select('*, recurring_template_line_items(*), horses(name)')
      .order('created_at', { ascending: false });
    setTemplates(data || []);
    setLoading(false);
  }

  function getTotal(template: any) {
    return (template.recurring_template_line_items || []).reduce((sum: number, item: any) => sum + Number(item.amount), 0);
  }

  async function generateInvoices() {
    const activeTemplates = templates.filter(t => t.active);
    if (activeTemplates.length === 0) {
      setGenerateMsg('No active templates to generate from.');
      return;
    }
    const confirmed = Platform.OS === 'web'
      ? confirm(`Generate ${activeTemplates.length} invoice${activeTemplates.length !== 1 ? 's' : ''} from active templates?`)
      : true;
    if (!confirmed) return;
    setGenerateMsg('');
    setGenerating(true);
    let successCount = 0;
    for (const template of activeTemplates) {
      const dueDate = getNextDueDate(template.interval, template.due_day || 1);
      const { data: invoice, error: invErr } = await supabase
        .from('invoices')
        .insert({ horse_id: template.horse_id, owner_name: template.owner_name, status: 'pending', due_date: dueDate, notes: template.notes || null })
        .select().single();
      if (invErr || !invoice) continue;
      const lineItems = (template.recurring_template_line_items || []).map((item: any) => ({
        invoice_id: invoice.id, description: item.description, amount: item.amount,
      }));
      if (lineItems.length > 0) await supabase.from('invoice_line_items').insert(lineItems);
      successCount++;
    }
    setGenerating(false);
    setGenerateMsg(`Generated ${successCount} invoice${successCount !== 1 ? 's' : ''} successfully.`);
    setTimeout(() => router.push('/billing'), 1500);
  }

  async function toggleActive(template: any) {
    await supabase.from('recurring_templates').update({ active: !template.active }).eq('id', template.id);
    setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, active: !t.active } : t));
  }

  const activeCount = templates.filter(t => t.active).length;

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <HomeButton />
        <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Recurring Templates')}</Text>
        <Pressable
          style={({ hovered }: any) => [styles.addBtn, { backgroundColor: C.secondaryAlpha15 }, hovered && { backgroundColor: C.secondaryAlpha30 }]}
          onPress={() => router.push('/billing/add-template')}
        >
          <Text style={[styles.addBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>+ {t('New')}</Text>
        </Pressable>
      </View>

      {activeCount > 0 && (
        <Pressable
          style={({ hovered }: any) => [styles.generateBanner, { backgroundColor: C.primary }, hovered && { backgroundColor: C.primaryDark }]}
          onPress={generateInvoices}
          disabled={generating}
        >
          {generating
            ? <ActivityIndicator color="white" size="small" />
            : <>
                <Text style={[styles.generateBannerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Generate Invoices')}</Text>
                <Text style={[styles.generateBannerSub, { fontFamily: F.sans }]}>{activeCount} active template{activeCount !== 1 ? 's' : ''} ready</Text>
              </>
          }
        </Pressable>
      )}

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {loading && templates.length === 0 ? (
          <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 40 }} />
        ) : templates.length === 0 ? (
          <View style={styles.emptyState}>
            <RefreshCw size={40} color={C.cardBorder} />
            <Text style={[styles.emptyTitle, { color: C.text, fontFamily: F.sansBold }]}>{t('No templates yet')}</Text>
            <Text style={[styles.emptyText, { color: C.textMuted, fontFamily: F.sans }]}>{t('Tap + New to create a recurring invoice template.')}</Text>
          </View>
        ) : (
          templates.map(template => (
            <Pressable
              key={template.id}
              style={({ hovered }: any) => [styles.templateCard, { backgroundColor: C.card, borderColor: C.cardBorder }, !template.active && styles.templateCardInactive, hovered && { backgroundColor: C.cardSeparator, borderColor: C.secondary }]}
              onPress={() => router.push({ pathname: '/billing/add-template', params: { templateId: template.id } })}
            >
              <View style={styles.templateLeft}>
                <View style={styles.templateNameRow}>
                  <Text style={[styles.templateHorse, { color: C.text, fontFamily: F.serif }]}>{template.horses?.name || '—'}</Text>
                  <View style={[styles.intervalBadge, { backgroundColor: C.activeBg }, template.interval === 'weekly' && styles.intervalBadgeWeekly]}>
                    <Text style={[styles.intervalBadgeText, { color: C.primary, fontFamily: F.sansBold }]}>{template.interval}</Text>
                  </View>
                </View>
                <Text style={[styles.templateOwner, { color: C.textMuted, fontFamily: F.sans }]}>{template.owner_name || '—'}</Text>
                <Text style={[styles.templateItems, { color: C.secondary, fontFamily: F.sans }]}>
                  {(template.recurring_template_line_items || []).length} line item{(template.recurring_template_line_items || []).length !== 1 ? 's' : ''} · Due day {template.due_day || 1}
                </Text>
              </View>
              <View style={styles.templateRight}>
                <Text style={[styles.templateTotal, { color: C.text, fontFamily: F.sansBold }]}>${getTotal(template).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                <Pressable
                  style={[styles.toggleBtn, { borderColor: C.cardBorder, backgroundColor: C.card }, template.active && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                  onPress={() => toggleActive(template)}
                >
                  <Text style={[styles.toggleBtnText, { color: C.textMuted, fontFamily: F.sansMedium }, template.active && { color: C.primary, fontWeight: '600' }]}>
                    {template.active ? t('Active') : t('Paused')}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  addBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6 },
  addBtnText: { fontSize: 13, fontWeight: '600' },
  generateBanner: { margin: 16, marginBottom: 0, borderRadius: 12, padding: 16, alignItems: 'center' },
  generateBannerTitle: { fontSize: 15, fontWeight: '700' },
  generateBannerSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  body: { flex: 1, padding: 16 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptyText: { fontSize: 13, textAlign: 'center' },
  templateCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  templateCardInactive: { opacity: 0.5 },
  templateLeft: { flex: 1 },
  templateNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  templateHorse: { fontSize: 15, fontWeight: '700', fontStyle: 'italic' },
  intervalBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  intervalBadgeWeekly: { backgroundColor: '#EDE8F5' },
  intervalBadgeText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  templateOwner: { fontSize: 12, marginBottom: 2 },
  templateItems: { fontSize: 11 },
  templateRight: { alignItems: 'flex-end', gap: 6 },
  templateTotal: { fontSize: 16, fontWeight: '700' },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  toggleBtnText: { fontSize: 11, fontWeight: '500' },
});
