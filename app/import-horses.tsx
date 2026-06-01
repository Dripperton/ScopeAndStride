import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../lib/LanguageContext';
import { useTheme } from '../context/ThemeContext';

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
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
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
          setError(t('No valid horses found. Check your CSV format.'));
        } else {
          setPreview(horses);
          setError('');
        }
      } catch {
        setError(t('Could not parse CSV. Please check the format.'));
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
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <Pressable onPress={() => router.back()} style={({ hovered }: any) => [styles.backBtn, hovered && { backgroundColor: C.secondaryAlpha15 }]}>
          <Text style={[styles.backText, { color: C.headerText, fontFamily: F.sans }]}>← {t('Back')}</Text>
        </Pressable>
        <Text style={[styles.headerName, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Import Horses')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {done ? (
          <View style={styles.successCard}>
            <Text style={[styles.successIcon, { color: C.primary }]}>✓</Text>
            <Text style={[styles.successTitle, { color: C.primary, fontFamily: F.sansBold }]}>{preview.length} {t('horses imported!')}</Text>
            <Pressable
              style={({ hovered }: any) => [styles.saveBtn, { backgroundColor: C.primary }, hovered && { backgroundColor: C.primaryDark }]}
              onPress={() => router.push('/horses')}
            >
              <Text style={[styles.saveBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>{t('View Horses')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Template Download Card */}
            <View style={[styles.templateCard, { backgroundColor: C.primary }]}>
              <View style={styles.templateLeft}>
                <Text style={styles.templateIcon}>📋</Text>
                <View>
                  <Text style={[styles.templateTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Download Template')}</Text>
                  <Text style={styles.templateSub}>{t('Pre-formatted CSV with example horses and instructions baked in')}</Text>
                </View>
              </View>
              <Pressable
                style={({ hovered }: any) => [styles.templateBtn, { backgroundColor: C.secondary }, hovered && { backgroundColor: C.secondaryDark }]}
                onPress={downloadTemplate}
              >
                <Text style={[styles.templateBtnText, { color: C.primary, fontFamily: F.sansBold }]}>⬇ {t('Download')}</Text>
              </Pressable>
            </View>

            {/* Format Reference */}
            <View style={[styles.formatCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <Text style={[styles.formatTitle, { color: C.text, fontFamily: F.sansBold }]}>{t('CSV Format')}</Text>
              <View style={[styles.formatCode, { backgroundColor: C.cardSeparator }]}>
                <Text style={[styles.formatCodeText, { color: C.primary }]}>name, breed, stall, owner, board_type</Text>
              </View>
              <Text style={[styles.formatNote, { color: C.textWarm, fontFamily: F.sans }]}>Board type options: Full Board · Training Board · Partial Board · Pasture Board</Text>
            </View>

            {/* File Upload */}
            <Text style={[styles.label, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Select Your CSV File')}</Text>
            <View style={[styles.uploadBox, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <Text style={styles.uploadIcon}>📂</Text>
              <Text style={[styles.uploadText, { color: C.textMuted, fontFamily: F.sans }]}>{t('Choose a .csv file from your device')}</Text>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                style={{ marginTop: 12, color: C.primary, fontSize: 13 }}
              />
            </View>

            {error ? <Text style={[styles.errorText, { color: C.error, fontFamily: F.sans }]}>{error}</Text> : null}

            {preview.length > 0 && (
              <>
                <Text style={[styles.label, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Preview — {count} horses', { count: preview.length })}</Text>
                {preview.map((horse, i) => (
                  <View key={i} style={[styles.previewCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                    <View style={[styles.previewDot, { backgroundColor: horse.color }]} />
                    <View style={styles.previewInfo}>
                      <Text style={[styles.previewName, { color: C.text, fontFamily: F.sansBold }]}>{horse.name}</Text>
                      <Text style={[styles.previewMeta, { color: C.textMuted, fontFamily: F.sans }]}>Stall {horse.stall} · {horse.owner}</Text>
                      <Text style={[styles.previewBreed, { color: C.textWarm, fontFamily: F.sans }]}>{horse.breed} · {horse.board_type}</Text>
                    </View>
                  </View>
                ))}
                <Pressable
                  style={({ hovered }: any) => [styles.saveBtn, { backgroundColor: C.primary }, hovered && { backgroundColor: C.primaryDark }]}
                  onPress={handleImport}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color={C.secondary} /> : <Text style={[styles.saveBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Import {count} Horses', { count: preview.length })}</Text>}
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
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 60, padding: 4, borderRadius: 6 },
  backText: { fontSize: 14 },
  headerName: { fontSize: 15, fontWeight: '600' },
  body: { flex: 1, padding: 20 },
  templateCard: { borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  templateLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  templateIcon: { fontSize: 28 },
  templateTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  templateSub: { fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 16 },
  templateBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  templateBtnText: { fontSize: 13, fontWeight: '600' },
  formatCard: { borderWidth: 1, borderRadius: 10, padding: 16, marginBottom: 8 },
  formatTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  formatCode: { borderRadius: 6, padding: 10, marginBottom: 8 },
  formatCodeText: { fontSize: 12, fontFamily: 'monospace' },
  formatNote: { fontSize: 11 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  uploadBox: { borderWidth: 1, borderRadius: 10, padding: 24, alignItems: 'center' },
  uploadIcon: { fontSize: 32, marginBottom: 8 },
  uploadText: { fontSize: 13 },
  errorText: { fontSize: 13, marginTop: 16 },
  previewCard: { borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 8, gap: 12 },
  previewDot: { width: 36, height: 36, borderRadius: 8 },
  previewInfo: { flex: 1 },
  previewName: { fontSize: 14, fontWeight: '600', fontStyle: 'italic' },
  previewMeta: { fontSize: 11, marginTop: 2 },
  previewBreed: { fontSize: 11, marginTop: 1 },
  saveBtn: { padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 24 },
  saveBtnText: { fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },
  successCard: { alignItems: 'center', paddingTop: 60 },
  successIcon: { fontSize: 48, marginBottom: 16 },
  successTitle: { fontSize: 20, fontWeight: '600', marginBottom: 32 },
});
