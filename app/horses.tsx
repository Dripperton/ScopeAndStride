import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Home, ChessKnight } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

export default function Horses() {
  const router = useRouter();
  const [horses, setHorses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHorses();
  }, []);

  async function fetchHorses() {
    const { data } = await supabase.from('horses').select('*');
    if (data) setHorses(data);
    setLoading(false);
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Remove ${name} from Hollow Creek?`)) return;
    await supabase.from('horses').delete().eq('id', id);
    setHorses((prev: any) => prev.filter((h: any) => h.id !== id));
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable style={({ hovered }: any) => [styles.homeBtn, hovered && styles.homeBtnHovered]} onPress={() => router.push('/dashboard')}>
            <Home size={18} color="#C9A85C" />
          </Pressable>
          <View>
            <Text style={styles.headerName}>Horses</Text>
            <Text style={styles.headerBarn}>{horses.length} horses · Hollow Creek</Text>
          </View>
        </View>
        <View style={styles.headerButtons}>
          <Pressable
            style={({ hovered }: any) => [styles.addBtn, hovered && styles.addBtnHovered]}
            onPress={() => router.push('/import-horses')}
          >
            <Text style={styles.addBtnText}>⬆ Import</Text>
          </Pressable>
          <Pressable
            style={({ hovered }: any) => [styles.addBtn, hovered && styles.addBtnHovered]}
            onPress={() => router.push('/add-horse')}
          >
            <Text style={styles.addBtnText}>+ Add</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Text style={styles.searchText}>🔍  Search horses, owners, stalls…</Text>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color="#2C4A35" style={{ marginTop: 40 }} />
        ) : horses.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🐴</Text>
            <Text style={styles.emptyTitle}>No horses yet</Text>
            <Text style={styles.emptyText}>Add your first horse or import a CSV to get started.</Text>
          </View>
        ) : (
          horses.map((horse: any) => (
            <Pressable
              key={horse.id}
              style={({ hovered }: any) => [styles.horseCard, hovered && styles.horseCardHovered]}
              onPress={() => router.push(`/horse/${horse.id}`)}
            >
              {({ hovered }: any) => (
                <>
                  <View style={[styles.horseAvatar, { backgroundColor: horse.color }]}>
                    <Text style={styles.horseAvatarText}>🐴</Text>
                  </View>
                  <View style={styles.horseInfo}>
                    <View style={styles.horseNameRow}>
                      <Text style={styles.horseName}>{horse.name}</Text>
                      {horse.alert && <View style={styles.alertDot} />}
                    </View>
                    <Text style={styles.horseMeta}>Stall {horse.stall} · {horse.owner}</Text>
                    <Text style={styles.horseBreed}>{horse.breed}</Text>
                  </View>
                  {hovered ? (
                    <Pressable
                      style={({ hovered: h }: any) => [styles.deleteBtn, h && styles.deleteBtnHovered]}
                      onPress={() => handleDelete(horse.id, horse.name)}
                    >
                      <Text style={styles.deleteBtnText}>Remove</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.horseBadge}>
                      <Text style={styles.horseBadgeText}>{horse.board_type}</Text>
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
  container: { flex: 1, backgroundColor: '#FAF7F2' },
  header: { backgroundColor: '#2C4A35', padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 32, height: 32, backgroundColor: 'rgba(201,168,92,0.15)', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  headerIconText: { fontSize: 10, fontWeight: '700', color: '#C9A85C', textAlign: 'center', lineHeight: 11 },
  headerName: { fontSize: 15, fontWeight: '600', color: '#C9A85C' },
  headerBarn: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  headerButtons: { flexDirection: 'row', gap: 8 },
  addBtn: { backgroundColor: 'rgba(201,168,92,0.15)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6 },
  addBtnHovered: { backgroundColor: 'rgba(201,168,92,0.3)' },
  addBtnText: { color: '#C9A85C', fontSize: 13, fontWeight: '600' },
  searchBar: { backgroundColor: 'white', margin: 12, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E8E0CC' },
  searchText: { fontSize: 13, color: '#9A9285' },
  body: { flex: 1, paddingHorizontal: 12 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A14', marginBottom: 8 },
  emptyText: { fontSize: 13, color: '#9A9285', textAlign: 'center' },
  horseCard: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 10, flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 8, gap: 12 },
  horseCardHovered: { backgroundColor: '#F5F1EA', borderColor: '#C9A85C' },
  horseAvatar: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  horseAvatarText: { fontSize: 22 },
  horseInfo: { flex: 1 },
  horseNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  horseName: { fontSize: 15, fontWeight: '600', color: '#1A1A14', fontStyle: 'italic' },
  alertDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#8B2E2E' },
  horseMeta: { fontSize: 11, color: '#9A9285', marginTop: 2 },
  horseBreed: { fontSize: 11, color: '#B08C4A', marginTop: 1 },
  horseBadge: { backgroundColor: '#EDF5EF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  horseBadgeText: { fontSize: 10, color: '#2C4A35', fontWeight: '500' },
  deleteBtn: { backgroundColor: '#FDECEA', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  deleteBtnHovered: { backgroundColor: '#8B2E2E' },
  deleteBtnText: { fontSize: 11, fontWeight: '600', color: '#8B2E2E' },
  homeBtn: { width: 32, height: 32, backgroundColor: 'rgba(201,168,92,0.15)', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  homeBtnHovered: { backgroundColor: 'rgba(201,168,92,0.3)' },
});
