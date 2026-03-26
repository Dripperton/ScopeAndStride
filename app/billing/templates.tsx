import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';

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
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useFocusEffect(useCallback(() => {
    fetchTemplates();
  }, []));

  async function fetchTemplates() {
    setLoading(true);
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
      alert('No active templates to generate from.');
      return;
    }
    const confirmed = Platform.OS === 'web'
      ? confirm(`Generate ${activeTemplates.length} invoice${activeTemplates.length !== 1 ? 's' : ''} from active templates?`)
      : true;
    if (!confirmed) return;
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
    alert(`Generated ${successCount} invoice${successCount !== 1 ? 's' : ''} successfully!`);
    router.push('/billing');
  }

  async function toggleActive(template: any) {
    await supabase.from('recurring_templates').update({ active: !template.active }).eq('id', template.id);
    setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, active: !t.active } : t));
  }

  const activeCount = templates.filter(t => t.active).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Recurring Templates</Text>
        <Pressable
          style={({ hovered }: any) => [styles.addBtn, hovered && styles.addBtnHovered]}
          onPress={() => router.push('/billing/add-template')}
        >
          <Text style={styles.addBtnText}>+ New</Text>
        </Pressable>
      </View>

      {activeCount > 0 && (
        <Pressable
          style={({ hovered }: any) => [styles.generateBanner, hovered && styles.generateBannerHovered]}
          onPress={generateInvoices}
          disabled={generating}
        >
          {generating
            ? <ActivityIndicator color="white" size="small" />
            : <>
                <Text style={styles.generateBannerTitle}>Generate Invoices</Text>
                <Text style={styles.generateBannerSub}>{activeCount} active template{activeCount !== 1 ? 's' : ''} ready</Text>
              </>
          }
        </Pressable>
      )}

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color="#2C4A35" style={{ marginTop: 40 }} />
        ) : templates.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔄</Text>
            <Text style={styles.emptyTitle}>No templates yet</Text>
            <Text style={styles.emptyText}>Tap + New to create a recurring invoice template.</Text>
          </View>
        ) : (
          templates.map(template => (
            <Pressable
              key={template.id}
              style={({ hovered }: any) => [styles.templateCard, !template.active && styles.templateCardInactive, hovered && styles.templateCardHovered]}
              onPress={() => router.push({ pathname: '/billing/add-template', params: { templateId: template.id } })}
            >
              <View style={styles.templateLeft}>
                <View style={styles.templateNameRow}>
                  <Text style={styles.templateHorse}>{template.horses?.name || '—'}</Text>
                  <View style={[styles.intervalBadge, template.interval === 'weekly' && styles.intervalBadgeWeekly]}>
                    <Text style={styles.intervalBadgeText}>{template.interval}</Text>
                  </View>
                </View>
                <Text style={styles.templateOwner}>{template.owner_name || '—'}</Text>
                <Text style={styles.templateItems}>
                  {(template.recurring_template_line_items || []).length} line item{(template.recurring_template_line_items || []).length !== 1 ? 's' : ''} · Due day {template.due_day || 1}
                </Text>
              </View>
              <View style={styles.templateRight}>
                <Text style={styles.templateTotal}>${getTotal(template).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                <Pressable
                  style={[styles.toggleBtn, template.active && styles.toggleBtnActive]}
                  onPress={() => toggleActive(template)}
                >
                  <Text style={[styles.toggleBtnText, template.active && styles.toggleBtnTextActive]}>
                    {template.active ? 'Active' : 'Paused'}
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
  container: { flex: 1, backgroundColor: '#FAF7F2' },
  header: { backgroundColor: '#2C4A35', padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#C9A85C' },
  addBtn: { backgroundColor: 'rgba(201,168,92,0.15)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6 },
  addBtnHovered: { backgroundColor: 'rgba(201,168,92,0.3)' },
  addBtnText: { color: '#C9A85C', fontSize: 13, fontWeight: '600' },
  generateBanner: { backgroundColor: '#2C4A35', margin: 16, marginBottom: 0, borderRadius: 12, padding: 16, alignItems: 'center' },
  generateBannerHovered: { backgroundColor: '#1A3A25' },
  generateBannerTitle: { fontSize: 15, fontWeight: '700', color: '#C9A85C' },
  generateBannerSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  body: { flex: 1, padding: 16 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A14' },
  emptyText: { fontSize: 13, color: '#9A9285', textAlign: 'center' },
  templateCard: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  templateCardInactive: { opacity: 0.5 },
  templateCardHovered: { backgroundColor: '#F5F1EA', borderColor: '#C9A85C' },
  templateLeft: { flex: 1 },
  templateNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  templateHorse: { fontSize: 15, fontWeight: '700', color: '#1A1A14', fontStyle: 'italic' },
  intervalBadge: { backgroundColor: '#EDF5EF', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  intervalBadgeWeekly: { backgroundColor: '#EDE8F5' },
  intervalBadgeText: { fontSize: 10, color: '#2C4A35', fontWeight: '600', textTransform: 'capitalize' },
  templateOwner: { fontSize: 12, color: '#9A9285', marginBottom: 2 },
  templateItems: { fontSize: 11, color: '#B08C4A' },
  templateRight: { alignItems: 'flex-end', gap: 6 },
  templateTotal: { fontSize: 16, fontWeight: '700', color: '#1A1A14' },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#E8E0CC', backgroundColor: 'white' },
  toggleBtnActive: { borderColor: '#2C4A35', backgroundColor: '#EDF5EF' },
  toggleBtnText: { fontSize: 11, color: '#9A9285', fontWeight: '500' },
  toggleBtnTextActive: { color: '#2C4A35', fontWeight: '600' },
});
