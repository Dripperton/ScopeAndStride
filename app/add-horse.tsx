import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../lib/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const BOARD_TYPES = ['Full Board', 'Training Board', 'Partial Board', 'Pasture Board'];
const COLORS = ['#D4E8D4', '#E8E8F0', '#F0E0D0', '#F0D8C8', '#F0F0E8', '#E8F0E8'];

export default function AddHorse() {
  const router = useRouter();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
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
      setError(t('Please fill in all fields.'));
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
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <Pressable onPress={() => router.back()} style={({ hovered }: any) => [styles.backBtn, hovered && { backgroundColor: C.secondaryAlpha15 }]}>
          <Text style={[styles.backText, { color: C.headerText, fontFamily: F.sans }]}>← {t('Back')}</Text>
        </Pressable>
        <Text style={[styles.headerName, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Add Horse')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={[styles.label, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Horse Name')}</Text>
        <TextInput style={[styles.input, { backgroundColor: C.card, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={name} onChangeText={setName} placeholder="e.g. Sterling" placeholderTextColor={C.cardBorder} />

        <Text style={[styles.label, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Breed')}</Text>
        <TextInput style={[styles.input, { backgroundColor: C.card, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={breed} onChangeText={setBreed} placeholder="e.g. Dutch Warmblood" placeholderTextColor={C.cardBorder} />

        <Text style={[styles.label, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Stall')}</Text>
        <TextInput style={[styles.input, { backgroundColor: C.card, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={stall} onChangeText={setStall} placeholder="e.g. 4" placeholderTextColor={C.cardBorder} keyboardType="numeric" />

        <Text style={[styles.label, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Owner Name')}</Text>
        <TextInput style={[styles.input, { backgroundColor: C.card, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={owner} onChangeText={setOwner} placeholder="e.g. Robert Henderson" placeholderTextColor={C.cardBorder} />

        <Text style={[styles.label, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Board Type')}</Text>
        <View style={styles.optionRow}>
          {BOARD_TYPES.map((type) => (
            <Pressable
              key={type}
              style={({ hovered }: any) => [
                styles.optionBtn,
                { borderColor: C.cardBorder, backgroundColor: C.card },
                boardType === type && { backgroundColor: C.primary, borderColor: C.primary },
                hovered && boardType !== type && { backgroundColor: C.activeBg, borderColor: C.primary },
              ]}
              onPress={() => setBoardType(type)}
            >
              <Text style={[styles.optionText, { color: C.text, fontFamily: F.sans }, boardType === type && { color: C.card, fontFamily: F.sansBold }]}>{type}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Card Color')}</Text>
        <View style={styles.colorRow}>
          {COLORS.map((c) => (
            <Pressable
              key={c}
              style={({ hovered }: any) => [
                styles.colorSwatch,
                { backgroundColor: c },
                color === c && { borderColor: C.primary },
                hovered && { opacity: 0.75, borderColor: C.secondaryDark },
              ]}
              onPress={() => setColor(c)}
            />
          ))}
        </View>

        {error ? <Text style={[styles.errorText, { color: C.error, fontFamily: F.sans }]}>{error}</Text> : null}

        <Pressable
          style={({ hovered }: any) => [styles.saveBtn, { backgroundColor: C.primary }, hovered && { backgroundColor: C.primaryDark }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="white" /> : <Text style={[styles.saveBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Save Horse')}</Text>}
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 60, padding: 4, borderRadius: 6 },
  backText: { fontSize: 14 },
  headerName: { fontSize: 15, fontWeight: '600' },
  body: { flex: 1, padding: 20 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, borderWidth: 1 },
  optionText: { fontSize: 13 },
  colorRow: { flexDirection: 'row', gap: 12 },
  colorSwatch: { width: 36, height: 36, borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  errorText: { fontSize: 13, marginTop: 16 },
  saveBtn: { padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 32 },
  saveBtnText: { fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },
});
