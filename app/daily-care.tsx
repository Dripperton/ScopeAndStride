import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CheckSquare, ClipboardList } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../lib/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import HomeButton from '../lib/HomeButton';
import { useBarnData } from '../lib/BarnDataContext';

function today() {
  return new Date().toISOString().split('T')[0];
}

export default function DailyCareOverview() {
  const router = useRouter();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const { horses, horsesLoading } = useBarnData();
  const [loggedToday, setLoggedToday] = useState<Set<string>>(new Set());

  useFocusEffect(useCallback(() => {
    fetchData();
  }, []));

  async function fetchData() {
    const todayStr = today();
    const { data: logData } = await supabase.from('daily_care_logs').select('horse_id').eq('date', todayStr);
    setLoggedToday(new Set((logData || []).map((l: any) => l.horse_id)));
  }

  const logged = horses.filter(h => loggedToday.has(h.id));
  const notLogged = horses.filter(h => !loggedToday.has(h.id));

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <HomeButton />
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Daily Care')}</Text>
          <Text style={styles.headerSub}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {horsesLoading && horses.length === 0 ? (
          <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 40 }} />
        ) : horses.length === 0 ? (
          <View style={styles.emptyState}>
            <ClipboardList size={40} color={C.cardBorder} />
            <Text style={[styles.emptyTitle, { color: C.text, fontFamily: F.sansBold }]}>{t('No horses yet')}</Text>
          </View>
        ) : (
          <>
            <View style={[styles.progressCard, { backgroundColor: C.primary }]}>
              <Text style={styles.progressText}>
                <Text style={[styles.progressCount, { color: C.headerText, fontFamily: F.sansBold }]}>{logged.length}</Text>
                <Text style={styles.progressTotal}> / {horses.length}</Text>
                <Text style={styles.progressLabel}> {t('logged today')}</Text>
              </Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: horses.length > 0 ? `${(logged.length / horses.length) * 100}%` : '0%', backgroundColor: C.secondary }]} />
              </View>
            </View>

            {notLogged.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Not logged today').toUpperCase()}</Text>
                {notLogged.map(horse => (
                  <HorseRow
                    key={horse.id}
                    horse={horse}
                    logged={false}
                    onPress={() => router.push({ pathname: '/horse/daily-care/add', params: { horseId: horse.id } })}
                  />
                ))}
              </>
            )}

            {logged.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Logged today').toUpperCase()}</Text>
                {logged.map(horse => (
                  <HorseRow
                    key={horse.id}
                    horse={horse}
                    logged={true}
                    onPress={() => router.push({ pathname: '/horse/daily-care/add', params: { horseId: horse.id } })}
                  />
                ))}
              </>
            )}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function HorseRow({ horse, logged, onPress }: { horse: any; logged: boolean; onPress: () => void }) {
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  return (
    <Pressable
      style={({ hovered }: any) => [styles.horseRow, { backgroundColor: C.card, borderColor: C.cardBorder }, hovered && { backgroundColor: C.cardSeparator, borderColor: C.secondary }]}
      onPress={onPress}
    >
      <View style={[styles.horseAvatar, { backgroundColor: horse.color || C.primary }]}>
        {horse.photo_url
          ? <Image source={{ uri: horse.photo_url }} style={styles.horseAvatarImg} />
          : <Text style={styles.horseAvatarEmoji}>🐴</Text>}
      </View>
      <View style={styles.horseInfo}>
        <Text style={[styles.horseName, { color: C.text, fontFamily: F.sansBold }]}>{horse.name}</Text>
        {horse.owner ? <Text style={[styles.horseOwner, { color: C.textMuted, fontFamily: F.sans }]}>{horse.owner}</Text> : null}
      </View>
      {logged
        ? <CheckSquare size={20} color={C.primary} />
        : <Text style={[styles.logBtn, { color: C.primary, backgroundColor: C.activeBg, fontFamily: F.sansBold }]}>+ Log</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  body: { flex: 1, padding: 16 },
  progressCard: { borderRadius: 14, padding: 16, marginBottom: 20 },
  progressText: { marginBottom: 10 },
  progressCount: { fontSize: 28, fontWeight: '700' },
  progressTotal: { fontSize: 18, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  progressLabel: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  progressBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3 },
  progressFill: { height: 6, borderRadius: 3 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  horseRow: { borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 8, gap: 12 },
  horseAvatar: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  horseAvatarImg: { width: 44, height: 44 },
  horseAvatarEmoji: { fontSize: 22 },
  horseInfo: { flex: 1 },
  horseName: { fontSize: 15, fontWeight: '600', fontStyle: 'italic' },
  horseOwner: { fontSize: 12, marginTop: 1 },
  logBtn: { fontSize: 13, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
});
