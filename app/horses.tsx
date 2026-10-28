import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChessKnight } from 'lucide-react-native';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useProfile } from '../lib/useProfile';
import { useLanguage } from '../lib/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import HomeButton from '../lib/HomeButton';
import Brand from '../constants/brand';
import { useBarnData } from '../lib/BarnDataContext';

export default function Horses() {
  const router = useRouter();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const { isHorseOwner } = useProfile();
  const { horses, horsesLoading, refreshHorses } = useBarnData();
  const [editMode, setEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [reordering, setReordering] = useState(false);

  async function handleDelete(id: number, name: string) {
    Alert.alert(
      t('Remove Horse'),
      t('Remove {name} from {barn}?', { name, barn: Brand.barnName }),
      [
        { text: t('Cancel'), style: 'cancel' },
        { text: t('Remove'), style: 'destructive', onPress: async () => {
          await supabase.from('horses').delete().eq('id', id);
          await refreshHorses();
        }},
      ]
    );
  }

  async function handleMove(index: number, direction: 'up' | 'down') {
    setReordering(true);
    const sorted = [...horses].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sorted.length) { setReordering(false); return; }
    const a = sorted[index];
    const b = sorted[swapIndex];
    const aOrder = a.sort_order ?? index;
    const bOrder = b.sort_order ?? swapIndex;
    await Promise.all([
      supabase.from('horses').update({ sort_order: bOrder }).eq('id', a.id),
      supabase.from('horses').update({ sort_order: aOrder }).eq('id', b.id),
    ]);
    await refreshHorses();
    setReordering(false);
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
            {!editMode && (
              <>
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
              </>
            )}
            <Pressable
              style={[styles.addBtn, { backgroundColor: editMode ? C.secondary : C.secondaryAlpha15 }]}
              onPress={() => setEditMode(e => !e)}
            >
              <Text style={[styles.addBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>{editMode ? t('Done') : t('Edit')}</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={[styles.searchBar, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
        <TextInput
          style={[styles.searchText, { color: C.text }]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={`🔍  ${t('Search horses, owners, stalls…')}`}
          placeholderTextColor={C.textMuted}
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {horsesLoading ? (
          <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 40 }} />
        ) : horses.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🐴</Text>
            <Text style={[styles.emptyTitle, { color: C.text, fontFamily: F.sansBold }]}>{t('No horses yet.')}</Text>
            <Text style={[styles.emptyText, { color: C.textMuted }]}>{t('Add your first horse or import a CSV to get started.')}</Text>
          </View>
        ) : (
          (() => {
            const sorted = [...horses].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
            const filtered = sorted.filter(h => {
              const q = searchQuery.toLowerCase();
              return !q || (h.name || '').toLowerCase().includes(q) || (h.owner || '').toLowerCase().includes(q) || (h.stall || '').toLowerCase().includes(q);
            });
            return filtered;
          })().map((horse: any, index: number, arr: any[]) => (
            <Pressable
              key={horse.id}
              style={({ hovered }: any) => [styles.horseCard, { backgroundColor: C.card, borderColor: editMode ? C.secondary : C.cardBorder }, hovered && !editMode && { backgroundColor: C.cardSeparator, borderColor: C.secondary }]}
              onPress={() => !editMode && router.push(`/horse/${horse.id}`)}
            >
              {editMode ? (
                <>
                  <View style={styles.reorderBtns}>
                    <Pressable onPress={() => handleMove(index, 'up')} disabled={reordering} style={[styles.reorderBtn, { opacity: index === 0 || reordering ? 0.2 : 1 }]}>
                      <Text style={{ fontSize: 16, color: C.textMuted }}>↑</Text>
                    </Pressable>
                    <Pressable onPress={() => handleMove(index, 'down')} disabled={reordering} style={[styles.reorderBtn, { opacity: index === arr.length - 1 || reordering ? 0.2 : 1 }]}>
                      <Text style={{ fontSize: 16, color: C.textMuted }}>↓</Text>
                    </Pressable>
                  </View>
                  <View style={[styles.horseAvatar, { backgroundColor: horse.color }]}>
                    <Text style={styles.horseAvatarText}>🐴</Text>
                  </View>
                  <View style={styles.horseInfo}>
                    <Text style={[styles.horseName, { color: C.text, fontFamily: F.serif }]}>{horse.name}</Text>
                    <Text style={[styles.horseMeta, { color: C.textMuted }]}>Stall {horse.stall} · {horse.owner}</Text>
                  </View>
                  <Pressable
                    style={[styles.deleteBtn, { backgroundColor: C.errorBg }]}
                    onPress={() => handleDelete(horse.id, horse.name)}
                  >
                    <Text style={[styles.deleteBtnText, { color: C.error }]}>{t('Remove')}</Text>
                  </Pressable>
                </>
              ) : (
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
                  <View style={[styles.horseBadge, { backgroundColor: C.activeBg }]}>
                    <Text style={[styles.horseBadgeText, { color: C.primary, fontFamily: F.sansMedium }]}>{horse.board_type}</Text>
                  </View>
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
  headerButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 1 },
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
  reorderBtns: { flexDirection: 'column', gap: 2, marginRight: 4 },
  reorderBtn: { padding: 4 },
});
