import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChessKnight } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useProfile } from '../lib/useProfile';
import { useLanguage } from '../lib/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import HomeButton from '../lib/HomeButton';
import Brand from '../constants/brand';

export default function Horses() {
  const router = useRouter();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const { isHorseOwner, horseLinks } = useProfile();
  const [horses, setHorses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHorses();
  }, [isHorseOwner, horseLinks]);

  async function fetchHorses() {
    if (isHorseOwner) {
      const ids = horseLinks.map(l => l.horse_id);
      if (ids.length === 0) { setHorses([]); setLoading(false); return; }
      const { data } = await supabase.from('horses').select('*').in('id', ids);
      if (data) setHorses(data);
    } else {
      const { data } = await supabase.from('horses').select('*');
      if (data) setHorses(data);
    }
    setLoading(false);
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(t('Remove {name} from {barn}?', { name, barn: Brand.barnName }))) return;
    await supabase.from('horses').delete().eq('id', id);
    setHorses((prev: any) => prev.filter((h: any) => h.id !== id));
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <View style={styles.headerLeft}>
          <HomeButton />
          <View>
            <Text style={[styles.headerName, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Horses')}</Text>
            <Text style={styles.headerBarn}>{horses.length} {t('horses')} · {Brand.barnName}</Text>
          </View>
        </View>
        {!isHorseOwner && (
          <View style={styles.headerButtons}>
            <Pressable
              style={({ hovered }: any) => [styles.addBtn, { backgroundColor: C.secondaryAlpha15 }, hovered && { backgroundColor: C.secondaryAlpha30 }]}
              onPress={() => router.push('/import-horses')}
            >
              <Text style={[styles.addBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>⬆ Import</Text>
            </Pressable>
            <Pressable
              style={({ hovered }: any) => [styles.addBtn, { backgroundColor: C.secondaryAlpha15 }, hovered && { backgroundColor: C.secondaryAlpha30 }]}
              onPress={() => router.push('/add-horse')}
            >
              <Text style={[styles.addBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>+ Add</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={[styles.searchBar, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
        <Text style={[styles.searchText, { color: C.textMuted }]}>🔍  {t('Search horses, owners, stalls…')}</Text>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 40 }} />
        ) : horses.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🐴</Text>
            <Text style={[styles.emptyTitle, { color: C.text, fontFamily: F.sansBold }]}>{t('No horses yet.')}</Text>
            <Text style={[styles.emptyText, { color: C.textMuted }]}>{t('Add your first horse or import a CSV to get started.')}</Text>
          </View>
        ) : (
          horses.map((horse: any) => (
            <Pressable
              key={horse.id}
              style={({ hovered }: any) => [styles.horseCard, { backgroundColor: C.card, borderColor: C.cardBorder }, hovered && { backgroundColor: C.cardSeparator, borderColor: C.secondary }]}
              onPress={() => router.push(`/horse/${horse.id}`)}
            >
              {({ hovered }: any) => (
                <>
                  <View style={[styles.horseAvatar, { backgroundColor: horse.color }]}>
                    <Text style={styles.horseAvatarText}>🐴</Text>
                  </View>
                  <View style={styles.horseInfo}>
                    <View style={styles.horseNameRow}>
                      <Text style={[styles.horseName, { color: C.text, fontFamily: F.serif }]}>{horse.name}</Text>
                      {horse.alert && <View style={[styles.alertDot, { backgroundColor: C.error }]} />}
                    </View>
                    <Text style={[styles.horseMeta, { color: C.textMuted }]}>Stall {horse.stall} · {horse.owner}</Text>
                    <Text style={[styles.horseBreed, { color: C.textWarm }]}>{horse.breed}</Text>
                  </View>
                  {hovered && !isHorseOwner ? (
                    <Pressable
                      style={({ hovered: h }: any) => [styles.deleteBtn, { backgroundColor: C.errorBg }, h && { backgroundColor: C.error }]}
                      onPress={() => handleDelete(horse.id, horse.name)}
                    >
                      <Text style={[styles.deleteBtnText, { color: C.error }]}>{t('Remove')}</Text>
                    </Pressable>
                  ) : (
                    <View style={[styles.horseBadge, { backgroundColor: C.activeBg }]}>
                      <Text style={[styles.horseBadgeText, { color: C.primary, fontFamily: F.sansMedium }]}>{horse.board_type}</Text>
                    </View>
                  )}
                </>
              )}
            </Pressable>
          ))
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerName: { fontSize: 15, fontWeight: '600' },
  headerBarn: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  headerButtons: { flexDirection: 'row', gap: 8 },
  addBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6 },
  addBtnText: { fontSize: 13, fontWeight: '600' },
  searchBar: { margin: 12, borderRadius: 10, padding: 12, borderWidth: 1 },
  searchText: { fontSize: 13 },
  body: { flex: 1, paddingHorizontal: 12 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  emptyText: { fontSize: 13, textAlign: 'center' },
  horseCard: { borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 8, gap: 12 },
  horseAvatar: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  horseAvatarText: { fontSize: 22 },
  horseInfo: { flex: 1 },
  horseNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  horseName: { fontSize: 15, fontWeight: '600', fontStyle: 'italic' },
  alertDot: { width: 6, height: 6, borderRadius: 3 },
  horseMeta: { fontSize: 11, marginTop: 2 },
  horseBreed: { fontSize: 11, marginTop: 1 },
  horseBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  horseBadgeText: { fontSize: 10, fontWeight: '500' },
  deleteBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  deleteBtnText: { fontSize: 11, fontWeight: '600' },
});
