import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

const COLORS = ['#D4E8D4', '#E8E8F0', '#F0E0D0', '#F0D8C8', '#F0F0E8', '#E8F0E8'];

function parseCSV(text: string) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map((line, i) => {
    const values = line.split(',').map(v => v.trim());
    const row: any = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    return {
      name: row['name'] || '',
      breed: row['breed'] || '',
      stall: row['stall'] || '',
      owner: row['owner'] || '',
      board_type: row['board_type'] || 'Full Board',
      color: COLORS[i % COLORS.length],
      alert: false,
    };
  }).filter(h => h.name);
}

function downloadTemplate() {
  const csv = [
    '# Scope & Stride — Horse Import Template',
    '# Board Type options: Full Board, Training Board, Partial Board, Pasture Board',
    '# Delete these comment lines before importing',
    'name,breed,stall,owner,board_type',
    'Sterling,Dutch Warmblood,4,Robert Henderson,Full Board',
    'Luna,Hanoverian,7,Diane Calloway,Training Board',
    'Maverick,Quarter Horse,2,Tom Pemberton,Full Board',
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ScopeAndStride-Horse-Import-Template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportHorses() {
  const router = useRouter();
  const [preview, setPreview] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  function handleFileChange(e: any) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const filtered = text.split('\n').filter(l => !l.trim().startsWith('#')).join('\n');
        const horses = parseCSV(filtered);
        if (horses.length === 0) {
          setError('No valid horses found. Check your CSV format.');
        } else {
          setPreview(horses);
          setError('');
        }
      } catch {
        setError('Could not parse CSV. Please check the format.');
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    setLoading(true);
    setError('');
    const { error } = await supabase.from('horses').insert(preview);
    if (error) {
      setError(error.message);
    } else {
      setDone(true);
    }
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ hovered }: any) => [styles.backBtn, hovered && styles.backBtnHovered]}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerName}>Import Horses</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {done ? (
          <View style={styles.successCard}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>{preview.length} horses imported!</Text>
            <Pressable
              style={({ hovered }: any) => [styles.saveBtn, hovered && styles.saveBtnHovered]}
              onPress={() => router.push('/horses')}
            >
              <Text style={styles.saveBtnText}>View Horses</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Template Download Card */}
            <View style={styles.templateCard}>
              <View style={styles.templateLeft}>
                <Text style={styles.templateIcon}>📋</Text>
                <View>
                  <Text style={styles.templateTitle}>Download Template</Text>
                  <Text style={styles.templateSub}>Pre-formatted CSV with example horses and instructions baked in</Text>
                </View>
              </View>
              <Pressable
                style={({ hovered }: any) => [styles.templateBtn, hovered && styles.templateBtnHovered]}
                onPress={downloadTemplate}
              >
                <Text style={styles.templateBtnText}>⬇ Download</Text>
              </Pressable>
            </View>

            {/* Format Reference */}
            <View style={styles.formatCard}>
              <Text style={styles.formatTitle}>CSV Format</Text>
              <View style={styles.formatCode}>
                <Text style={styles.formatCodeText}>name, breed, stall, owner, board_type</Text>
              </View>
              <Text style={styles.formatNote}>Board type options: Full Board · Training Board · Partial Board · Pasture Board</Text>
            </View>

            {/* File Upload */}
            <Text style={styles.label}>Select Your CSV File</Text>
            <View style={styles.uploadBox}>
              <Text style={styles.uploadIcon}>📂</Text>
              <Text style={styles.uploadText}>Choose a .csv file from your device</Text>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                style={{ marginTop: 12, color: '#2C4A35', fontSize: 13 }}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {preview.length > 0 && (
              <>
                <Text style={styles.label}>Preview — {preview.length} horses</Text>
                {preview.map((horse, i) => (
                  <View key={i} style={styles.previewCard}>
                    <View style={[styles.previewDot, { backgroundColor: horse.color }]} />
                    <View style={styles.previewInfo}>
                      <Text style={styles.previewName}>{horse.name}</Text>
                      <Text style={styles.previewMeta}>Stall {horse.stall} · {horse.owner}</Text>
                      <Text style={styles.previewBreed}>{horse.breed} · {horse.board_type}</Text>
                    </View>
                  </View>
                ))}
                <Pressable
                  style={({ hovered }: any) => [styles.saveBtn, hovered && styles.saveBtnHovered]}
                  onPress={handleImport}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#C9A85C" /> : <Text style={styles.saveBtnText}>Import {preview.length} Horses</Text>}
                </Pressable>
              </>
            )}

            <View style={{ height: 40 }} />
          </>
        )}
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
  templateCard: { backgroundColor: '#2C4A35', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  templateLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  templateIcon: { fontSize: 28 },
  templateTitle: { fontSize: 14, fontWeight: '600', color: '#C9A85C', marginBottom: 2 },
  templateSub: { fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 16 },
  templateBtn: { backgroundColor: '#C9A85C', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  templateBtnHovered: { backgroundColor: '#B08C4A' },
  templateBtnText: { color: '#2C4A35', fontSize: 13, fontWeight: '600' },
  formatCard: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 10, padding: 16, marginBottom: 8 },
  formatTitle: { fontSize: 13, fontWeight: '600', color: '#1A1A14', marginBottom: 8 },
  formatCode: { backgroundColor: '#F5F1EA', borderRadius: 6, padding: 10, marginBottom: 8 },
  formatCodeText: { fontSize: 12, color: '#2C4A35', fontFamily: 'monospace' },
  formatNote: { fontSize: 11, color: '#B08C4A' },
  label: { fontSize: 12, fontWeight: '600', color: '#9A9285', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  uploadBox: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 10, padding: 24, alignItems: 'center' },
  uploadIcon: { fontSize: 32, marginBottom: 8 },
  uploadText: { fontSize: 13, color: '#9A9285' },
  errorText: { color: '#8B2E2E', fontSize: 13, marginTop: 16 },
  previewCard: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 10, flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 8, gap: 12 },
  previewDot: { width: 36, height: 36, borderRadius: 8 },
  previewInfo: { flex: 1 },
  previewName: { fontSize: 14, fontWeight: '600', color: '#1A1A14', fontStyle: 'italic' },
  previewMeta: { fontSize: 11, color: '#9A9285', marginTop: 2 },
  previewBreed: { fontSize: 11, color: '#B08C4A', marginTop: 1 },
  saveBtn: { backgroundColor: '#2C4A35', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 24 },
  saveBtnHovered: { backgroundColor: '#3D6B4A' },
  saveBtnText: { color: '#C9A85C', fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },
  successCard: { alignItems: 'center', paddingTop: 60 },
  successIcon: { fontSize: 48, color: '#2C4A35', marginBottom: 16 },
  successTitle: { fontSize: 20, fontWeight: '600', color: '#2C4A35', marginBottom: 32 },
});
