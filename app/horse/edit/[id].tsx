import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { useProfile } from '../../../lib/useProfile';

const BOARD_TYPES = ['Full Board', 'Partial Board', 'Training Board', 'Pasture Board', 'Self Care'];
const COLORS = ['#2C4A35', '#4A7C59', '#8B6914', '#6B4226', '#1A3A4A', '#4A3B6B', '#8B2E2E', '#3A3830'];

export default function EditHorse() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { canEdit, loading: profileLoading } = useProfile();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [owner, setOwner] = useState('');
  const [boardType, setBoardType] = useState('Full Board');
  const [color, setColor] = useState('#2C4A35');
  const [alert, setAlert] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customValue, setCustomValue] = useState('');

  useEffect(() => {
    if (profileLoading) return; if (canEdit === false) { router.replace("/horses"); return; }
    async function fetchHorse() {
      const { data } = await supabase.from('horses').select('*').eq('id', id).single();
      if (data) {
        setName(data.name || '');
        setBreed(data.breed || '');
        setOwner(data.owner || '');
        setBoardType(data.board_type || 'Full Board');
        setColor(data.color || '#2C4A35');
        setAlert(data.alert || false);
        setCustomLabel(data.custom_field_label || '');
        setCustomValue(data.custom_field_value || '');
        setPhotoUrl(data.photo_url || '');
      }
      setLoading(false);
    }
    fetchHorse();
  }, [id, canEdit]);

  async function handlePhotoUpload(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    const ext = file.name.split('.').pop();
    const fileName = `horse-${id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('horse-photos').upload(fileName, file, { upsert: true });
    if (error) {
      setUploadError('Photo upload failed: ' + error.message);
    } else {
      const { data: urlData } = supabase.storage.from('horse-photos').getPublicUrl(fileName);
      setPhotoUrl(urlData.publicUrl);
    }
    setUploading(false);
  }

  async function handleSave() {
    setSaving(true);
    await supabase.from('horses').update({
      name, breed, owner, board_type: boardType, color, alert,
      custom_field_label: customLabel, custom_field_value: customValue,
      photo_url: photoUrl,
    }).eq('id', id);
    setSaving(false);
    router.back();
  }

  if (loading) return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2C4A35" style={{ marginTop: 80 }} />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Edit Horse</Text>
        <Pressable
          style={({ hovered }: any) => [styles.saveBtn, hovered && styles.saveBtnHovered]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#1A1A14" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </Pressable>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: color }]}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.heroPhoto} />
          ) : (
            <Text style={styles.heroEmoji}>🐴</Text>
          )}
          <Text style={styles.heroName}>{name || 'Horse Name'}</Text>
        </View>

        {uploadError ? <Text style={styles.errorText}>{uploadError}</Text> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photo</Text>
          <View style={styles.photoRow}>
            <View style={[styles.photoThumb, { backgroundColor: color }]}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.photoThumbImg} />
              ) : (
                <Text style={{ fontSize: 24 }}>🐴</Text>
              )}
            </View>
            <View style={styles.photoInfo}>
              <Text style={styles.photoLabel}>Upload a photo of this horse</Text>
              {Platform.OS === 'web' ? (
                <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
              ) : (
                <Text style={styles.photoMobileNote}>Photo upload available on web</Text>
              )}
              {uploading ? <ActivityIndicator size="small" color="#2C4A35" style={{ marginTop: 8 }} /> : null}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Info</Text>
          <Text style={styles.fieldLabel}>NAME</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Horse name" placeholderTextColor="#9A9285" />
          <Text style={styles.fieldLabel}>BREED</Text>
          <TextInput style={styles.input} value={breed} onChangeText={setBreed} placeholder="Breed" placeholderTextColor="#9A9285" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ownership</Text>
          <Text style={styles.fieldLabel}>OWNER NAME</Text>
          <TextInput style={styles.input} value={owner} onChangeText={setOwner} placeholder="Owner name" placeholderTextColor="#9A9285" />
          <Text style={styles.fieldLabel}>BOARD TYPE</Text>
          <View style={styles.boardTypeGrid}>
            {BOARD_TYPES.map(bt => (
              <Pressable
                key={bt}
                style={[styles.boardTypeOption, boardType === bt && styles.boardTypeSelected]}
                onPress={() => setBoardType(bt)}
              >
                <Text style={[styles.boardTypeText, boardType === bt && styles.boardTypeTextSelected]}>{bt}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom Field</Text>
          <Text style={styles.fieldLabel}>FIELD LABEL</Text>
          <TextInput style={styles.input} value={customLabel} onChangeText={setCustomLabel} placeholder="e.g. Coggins Expiry" placeholderTextColor="#9A9285" />
          <Text style={styles.fieldLabel}>FIELD VALUE</Text>
          <TextInput style={styles.input} value={customValue} onChangeText={setCustomValue} placeholder="e.g. Jan 2026" placeholderTextColor="#9A9285" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Display</Text>
          <Text style={styles.fieldLabel}>CARD COLOR</Text>
          <View style={styles.colorGrid}>
            {COLORS.map(c => (
              <Pressable key={c} style={[styles.colorSwatch, { backgroundColor: c }, color === c && styles.colorSwatchSelected]} onPress={() => setColor(c)} />
            ))}
          </View>
          <Pressable style={styles.alertToggle} onPress={() => setAlert(!alert)}>
            <View style={[styles.toggleTrack, alert && styles.toggleTrackOn]}>
              <View style={[styles.toggleThumb, alert && styles.toggleThumbOn]} />
            </View>
            <Text style={styles.alertToggleText}>Mark as alert</Text>
          </Pressable>
        </View>

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
  saveBtn: { backgroundColor: '#C9A85C', paddingHorizontal: 16, paddingVertical: 7, borderRadius: 6 },
  saveBtnHovered: { backgroundColor: '#B08C4A' },
  saveBtnText: { color: '#1A1A14', fontSize: 13, fontWeight: '700' },
  body: { flex: 1 },
  heroCard: { padding: 32, alignItems: 'center', gap: 12 },
  heroPhoto: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  heroEmoji: { fontSize: 64 },
  heroName: { fontSize: 24, fontWeight: '700', color: 'white', fontStyle: 'italic' },
  errorText: { color: '#8B2E2E', fontSize: 13, padding: 16 },
  section: { margin: 16, marginBottom: 0, backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#E8E0CC', padding: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#9A9285', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  photoRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  photoThumb: { width: 56, height: 56, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoThumbImg: { width: 56, height: 56 },
  photoInfo: { flex: 1, gap: 8 },
  photoLabel: { fontSize: 13, color: '#9A9285' },
  photoMobileNote: { fontSize: 12, color: '#C4BAA8', fontStyle: 'italic' },
  fieldLabel: { fontSize: 10, fontWeight: '600', color: '#9A9285', letterSpacing: 1, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#FAF7F2', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 10, padding: 12, fontSize: 14, color: '#1A1A14' },
  boardTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  boardTypeOption: { borderWidth: 1.5, borderColor: '#E8E0CC', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  boardTypeSelected: { borderColor: '#2C4A35', backgroundColor: '#EDF5EF' },
  boardTypeText: { fontSize: 13, color: '#9A9285' },
  boardTypeTextSelected: { color: '#2C4A35', fontWeight: '600' },
  colorGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 4 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },
  colorSwatchSelected: { borderWidth: 3, borderColor: '#C9A85C' },
  alertToggle: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  toggleTrack: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#E8E0CC', justifyContent: 'center', paddingHorizontal: 2 },
  toggleTrackOn: { backgroundColor: '#2C4A35' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'white' },
  toggleThumbOn: { alignSelf: 'flex-end' },
  alertToggleText: { fontSize: 14, color: '#3A3830' },
});
