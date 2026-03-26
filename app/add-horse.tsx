import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

const BOARD_TYPES = ['Full Board', 'Training Board', 'Partial Board', 'Pasture Board'];
const COLORS = ['#D4E8D4', '#E8E8F0', '#F0E0D0', '#F0D8C8', '#F0F0E8', '#E8F0E8'];

export default function AddHorse() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [stall, setStall] = useState('');
  const [owner, setOwner] = useState('');
  const [boardType, setBoardType] = useState('Full Board');
  const [color, setColor] = useState('#D4E8D4');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!name || !breed || !stall || !owner) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setError('');
    const { error } = await supabase.from('horses').insert([
      { name, breed, stall, owner, board_type: boardType, color, alert: false }
    ]);
    if (error) {
      setError(error.message);
    } else {
      router.push('/horses');
    }
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ hovered }: any) => [styles.backBtn, hovered && styles.backBtnHovered]}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerName}>Add Horse</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Horse Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Sterling" placeholderTextColor="#C4BAA8" />

        <Text style={styles.label}>Breed</Text>
        <TextInput style={styles.input} value={breed} onChangeText={setBreed} placeholder="e.g. Dutch Warmblood" placeholderTextColor="#C4BAA8" />

        <Text style={styles.label}>Stall Number</Text>
        <TextInput style={styles.input} value={stall} onChangeText={setStall} placeholder="e.g. 4" placeholderTextColor="#C4BAA8" keyboardType="numeric" />

        <Text style={styles.label}>Owner Name</Text>
        <TextInput style={styles.input} value={owner} onChangeText={setOwner} placeholder="e.g. Robert Henderson" placeholderTextColor="#C4BAA8" />

        <Text style={styles.label}>Board Type</Text>
        <View style={styles.optionRow}>
          {BOARD_TYPES.map((type) => (
            <Pressable
              key={type}
              style={({ hovered }: any) => [
                styles.optionBtn,
                boardType === type && styles.optionBtnActive,
                hovered && boardType !== type && styles.optionBtnHovered,
              ]}
              onPress={() => setBoardType(type)}
            >
              <Text style={[styles.optionText, boardType === type && styles.optionTextActive]}>{type}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Card Color</Text>
        <View style={styles.colorRow}>
          {COLORS.map((c) => (
            <Pressable
              key={c}
              style={({ hovered }: any) => [
                styles.colorSwatch,
                { backgroundColor: c },
                color === c && styles.colorSwatchActive,
                hovered && styles.colorSwatchHovered,
              ]}
              onPress={() => setColor(c)}
            />
          ))}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          style={({ hovered }: any) => [styles.saveBtn, hovered && styles.saveBtnHovered]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.saveBtnText}>Save Horse</Text>}
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F2' },
  header: { backgroundColor: '#2C4A35', padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 60, padding: 4, borderRadius: 6 },
  backBtnHovered: { backgroundColor: 'rgba(201,168,92,0.15)' },
  backText: { color: '#C9A85C', fontSize: 14 },
  headerName: { fontSize: 15, fontWeight: '600', color: '#C9A85C' },
  body: { flex: 1, padding: 20 },
  label: { fontSize: 12, fontWeight: '600', color: '#9A9285', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 8, padding: 12, fontSize: 15, color: '#1A1A14' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#E8E0CC', backgroundColor: 'white' },
  optionBtnActive: { backgroundColor: '#2C4A35', borderColor: '#2C4A35' },
  optionBtnHovered: { backgroundColor: '#EDF5EF', borderColor: '#2C4A35' },
  optionText: { fontSize: 13, color: '#3A3830' },
  optionTextActive: { color: 'white', fontWeight: '600' },
  colorRow: { flexDirection: 'row', gap: 12 },
  colorSwatch: { width: 36, height: 36, borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  colorSwatchActive: { borderColor: '#2C4A35' },
  colorSwatchHovered: { opacity: 0.75, borderColor: '#B08C4A' },
  errorText: { color: '#8B2E2E', fontSize: 13, marginTop: 16 },
  saveBtn: { backgroundColor: '#2C4A35', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 32 },
  saveBtnHovered: { backgroundColor: '#3D6B4A' },
  saveBtnText: { color: '#C9A85C', fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },
});
