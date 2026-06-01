import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { CheckSquare, Square } from 'lucide-react-native';
import { useLanguage } from '../../../lib/LanguageContext';
import { useTheme } from '../../../context/ThemeContext';
import HomeButton from '../../../lib/HomeButton';

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function isToday(dateStr: string) {
  return dateStr === new Date().toISOString().split('T')[0];
}

export default function DailyCareView() {
  const router = useRouter();
  const { horseId, horseName } = useLocalSearchParams();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    supabase
      .from('daily_care_logs')
      .select('*')
      .eq('horse_id', horseId)
      .order('date', { ascending: false })
      .limit(14)
      .then(({ data }) => {
        setLogs(data || []);
        setLoading(false);
      });
  }, [horseId]));

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <HomeButton />
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Daily Care')}</Text>
          {horseName ? <Text style={styles.headerSub}>{horseName}</Text> : null}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {loading && logs.length === 0 ? (
          <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 40 }} />
        ) : logs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: C.text, fontFamily: F.sansBold }]}>{t('No entries yet')}</Text>
            <Text style={[styles.emptyText, { color: C.textMuted, fontFamily: F.sans }]}>Your barn staff will log daily care here.</Text>
          </View>
        ) : (
          logs.map(log => (
            <View key={log.id} style={[styles.logCard, { backgroundColor: C.card, borderColor: C.cardBorder }, isToday(log.date) && { borderColor: C.primary, borderWidth: 1.5 }]}>
              <View style={styles.logHeader}>
                <Text style={[styles.logDate, { color: C.text, fontFamily: F.sansBold }]}>{formatDate(log.date)}</Text>
                {isToday(log.date) && <View style={[styles.todayBadge, { backgroundColor: C.activeBg }]}><Text style={[styles.todayBadgeText, { color: C.primary, fontFamily: F.sansBold }]}>{t('Today')}</Text></View>}
              </View>
              <View style={styles.checksRow}>
                <View style={styles.checkItem}>
                  {log.groomed ? <CheckSquare size={16} color={C.primary} /> : <Square size={16} color={C.cardBorder} />}
                  <Text style={[styles.checkText, { color: C.text, fontFamily: F.sans }, !log.groomed && { color: C.cardBorder }]}>{t('Groomed')}</Text>
                </View>
                <View style={styles.checkItem}>
                  {log.turned_out ? <CheckSquare size={16} color={C.primary} /> : <Square size={16} color={C.cardBorder} />}
                  <Text style={[styles.checkText, { color: C.text, fontFamily: F.sans }, !log.turned_out && { color: C.cardBorder }]}>
                    {t('Turned Out')}{log.turned_out && log.turnout_duration ? ` · ${log.turnout_duration}` : ''}
                  </Text>
                </View>
                <View style={styles.checkItem}>
                  {log.ridden ? <CheckSquare size={16} color={C.primary} /> : <Square size={16} color={C.cardBorder} />}
                  <Text style={[styles.checkText, { color: C.text, fontFamily: F.sans }, !log.ridden && { color: C.cardBorder }]}>{t('Ridden')}</Text>
                </View>
              </View>
              {log.notes ? <Text style={[styles.logNotes, { color: C.textMuted, borderTopColor: C.cardSeparator, fontFamily: F.sans }]}>{log.notes}</Text> : null}
            </View>
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
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1, fontStyle: 'italic' },
  body: { flex: 1, padding: 16 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptyText: { fontSize: 13, textAlign: 'center' },
  logCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  logHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  logDate: { fontSize: 14, fontWeight: '600' },
  todayBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  todayBadgeText: { fontSize: 11, fontWeight: '600' },
  checksRow: { gap: 6 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  checkText: { fontSize: 14 },
  logNotes: { fontSize: 13, marginTop: 10, lineHeight: 18, borderTopWidth: 1, paddingTop: 10 },
});
