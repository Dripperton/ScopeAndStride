import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { useProfile } from '../../../lib/useProfile';
import DateInput from '../../../lib/DateInput';
import { useLanguage } from '../../../lib/LanguageContext';
import { useTheme } from '../../../context/ThemeContext';

const BOARD_TYPES = ['Full Board', 'Partial Board', 'Training Board', 'Pasture Board', 'Self Care'];
const COLORS = ['#2C4A35', '#4A7C59', '#8B6914', '#6B4226', '#1A3A4A', '#4A3B6B', '#8B2E2E', '#3A3830'];

export default function EditHorse() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { canEdit, loading: profileLoading } = useProfile();
  const { t } = useLanguage();
  const theme = useTheme(); const C = theme.colors; const F = theme.fonts;
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
  const [quirks, setQuirks] = useState('');
  const [goals, setGoals] = useState('');
  const [vetName, setVetName] = useState('');
  const [vetPhone, setVetPhone] = useState('');
  const [emergencyClinic, setEmergencyClinic] = useState('');
  const [emergencyAuth, setEmergencyAuth] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [cogginsExpiryDate, setCogginsExpiryDate] = useState('');
  const [cogginsImageUrl, setCogginsImageUrl] = useState('');
  const [insuranceCompany, setInsuranceCompany] = useState('');
  const [insurancePhone, setInsurancePhone] = useState('');
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('');

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
        setQuirks(data.quirks || '');
        setGoals(data.goals || '');
        setVetName(data.vet_name || '');
        setVetPhone(data.vet_phone || '');
        setEmergencyClinic(data.emergency_clinic || '');
        setEmergencyAuth(data.emergency_auth || '');
        setEmergencyContact(data.emergency_contact || '');
        setEmergencyContactPhone(data.emergency_contact_phone || '');
        setCogginsExpiryDate(data.coggins_expiry_date || '');
        setCogginsImageUrl(data.coggins_image_url || '');
        setInsuranceCompany(data.insurance_company || '');
        setInsurancePhone(data.insurance_phone || '');
        setInsurancePolicyNumber(data.insurance_policy_number || '');
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
      quirks,
      goals,
      vet_name: vetName,
      vet_phone: vetPhone,
      emergency_clinic: emergencyClinic,
      emergency_auth: emergencyAuth,
      emergency_contact: emergencyContact,
      emergency_contact_phone: emergencyContactPhone,
      coggins_expiry_date: cogginsExpiryDate || null,
      coggins_image_url: cogginsImageUrl.trim() || null,
      insurance_company: insuranceCompany.trim() || null,
      insurance_phone: insurancePhone.trim() || null,
      insurance_policy_number: insurancePolicyNumber.trim() || null,
      photo_url: photoUrl,
    }).eq('id', id);
    setSaving(false);
    router.back();
  }

  if (loading) return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 80 }} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backText, { fontFamily: F.sans }]}>{t('Back')}</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Edit Horse')}</Text>
        <Pressable
          style={({ hovered }: any) => [styles.saveBtn, hovered && styles.saveBtnHovered]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#1A1A14" size="small" /> : <Text style={[styles.saveBtnText, { fontFamily: F.sansBold }]}>{t('Save')}</Text>}
        </Pressable>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: color }]}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.heroPhoto} />
          ) : (
            <Text style={styles.heroEmoji}>🐴</Text>
          )}
          <Text style={[styles.heroName, { color: C.card, fontFamily: F.serif }]}>{name || 'Horse Name'}</Text>
        </View>

        {uploadError ? <Text style={[styles.errorText, { color: C.error }]}>{uploadError}</Text> : null}

        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Photo')}</Text>
          <View style={styles.photoRow}>
            <View style={[styles.photoThumb, { backgroundColor: color }]}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.photoThumbImg} />
              ) : (
                <Text style={{ fontSize: 24 }}>🐴</Text>
              )}
            </View>
            <View style={styles.photoInfo}>
              <Text style={[styles.photoLabel, { color: C.textMuted, fontFamily: F.sans }]}>Upload a photo of this horse</Text>
              {Platform.OS === 'web' ? (
                <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
              ) : (
                <Text style={[styles.photoMobileNote, { fontFamily: F.sans }]}>Photo upload available on web</Text>
              )}
              {uploading ? <ActivityIndicator size="small" color={C.primary} style={{ marginTop: 8 }} /> : null}
            </View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Basic Info')}</Text>
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Name').toUpperCase()}</Text>
          <TextInput style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={name} onChangeText={setName} placeholder="Horse name" placeholderTextColor={C.textMuted} />
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Breed').toUpperCase()}</Text>
          <TextInput style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={breed} onChangeText={setBreed} placeholder="Breed" placeholderTextColor={C.textMuted} />
        </View>

        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Ownership')}</Text>
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Owner Name').toUpperCase()}</Text>
          <TextInput style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={owner} onChangeText={setOwner} placeholder="Owner name" placeholderTextColor={C.textMuted} />
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Board Type').toUpperCase()}</Text>
          <View style={styles.boardTypeGrid}>
            {BOARD_TYPES.map(bt => (
              <Pressable
                key={bt}
                style={[styles.boardTypeOption, { borderColor: C.cardBorder }, boardType === bt && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                onPress={() => setBoardType(bt)}
              >
                <Text style={[styles.boardTypeText, { color: C.textMuted, fontFamily: F.sans }, boardType === bt && { color: C.primary, fontWeight: '600', fontFamily: F.sansBold }]}>{bt}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Custom Field')}</Text>
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Field Label').toUpperCase()}</Text>
          <TextInput style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={customLabel} onChangeText={setCustomLabel} placeholder="e.g. Coggins Expiry" placeholderTextColor={C.textMuted} />
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Field Value').toUpperCase()}</Text>
          <TextInput style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={customValue} onChangeText={setCustomValue} placeholder="e.g. Jan 2026" placeholderTextColor={C.textMuted} />
        </View>

        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Quirks')}</Text>
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Quirks & Handling Notes').toUpperCase()}</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
            value={quirks}
            onChangeText={setQuirks}
            placeholder="e.g. Hates the hose, spooks at the gate, ear shy, needs 20 min warmup"
            placeholderTextColor={C.textMuted}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Goals')}</Text>
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Training & Competition Goals').toUpperCase()}</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
            value={goals}
            onChangeText={setGoals}
            placeholder="e.g. Move up to 1.10m by summer, qualify for regionals"
            placeholderTextColor={C.textMuted}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Emergency Care')}</Text>
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Primary Vet').toUpperCase()}</Text>
          <TextInput style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={vetName} onChangeText={setVetName} placeholder="e.g. Dr. Sarah Jones" placeholderTextColor={C.textMuted} />
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Vet Phone').toUpperCase()}</Text>
          <TextInput style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={vetPhone} onChangeText={setVetPhone} placeholder="e.g. (919) 555-0100" placeholderTextColor={C.textMuted} keyboardType="phone-pad" />
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Emergency Clinic').toUpperCase()}</Text>
          <TextInput style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={emergencyClinic} onChangeText={setEmergencyClinic} placeholder="e.g. NC State Equine Hospital" placeholderTextColor={C.textMuted} />
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Auth Limit').toUpperCase()}</Text>
          <TextInput style={[styles.input, styles.inputMultiline, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={emergencyAuth} onChangeText={setEmergencyAuth} placeholder="e.g. Authorized up to $5,000 without contact" placeholderTextColor={C.textMuted} multiline numberOfLines={3} />
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Backup Contact').toUpperCase()}</Text>
          <TextInput style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={emergencyContact} onChangeText={setEmergencyContact} placeholder="Name" placeholderTextColor={C.textMuted} />
          <TextInput style={[styles.input, { marginTop: 8, backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={emergencyContactPhone} onChangeText={setEmergencyContactPhone} placeholder="Phone number" placeholderTextColor={C.textMuted} keyboardType="phone-pad" />
        </View>

        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Coggins')}</Text>
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Coggins Expiry').toUpperCase()}</Text>
          <DateInput value={cogginsExpiryDate} onChange={setCogginsExpiryDate} placeholder="Select expiry date" />
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Document Link').toUpperCase()}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
            value={cogginsImageUrl}
            onChangeText={setCogginsImageUrl}
            placeholder="Paste link to Coggins document or image"
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>

        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Insurance')}</Text>
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>COMPANY NAME</Text>
          <TextInput style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={insuranceCompany} onChangeText={setInsuranceCompany} placeholder="e.g. Markel Insurance" placeholderTextColor={C.textMuted} />
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>PHONE NUMBER</Text>
          <TextInput style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={insurancePhone} onChangeText={setInsurancePhone} placeholder="e.g. (800) 555-0100" placeholderTextColor={C.textMuted} keyboardType="phone-pad" />
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>POLICY NUMBER</Text>
          <TextInput style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]} value={insurancePolicyNumber} onChangeText={setInsurancePolicyNumber} placeholder="e.g. EQ-2024-00123" placeholderTextColor={C.textMuted} autoCapitalize="characters" />
        </View>

        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Display')}</Text>
          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Card Color').toUpperCase()}</Text>
          <View style={styles.colorGrid}>
            {COLORS.map(c => (
              <Pressable key={c} style={[styles.colorSwatch, { backgroundColor: c }, color === c && { borderWidth: 3, borderColor: C.secondary }]} onPress={() => setColor(c)} />
            ))}
          </View>
          <Pressable style={styles.alertToggle} onPress={() => setAlert(!alert)}>
            <View style={[styles.toggleTrack, { backgroundColor: C.cardBorder }, alert && { backgroundColor: C.primary }]}>
              <View style={[styles.toggleThumb, { backgroundColor: C.card }, alert && styles.toggleThumbOn]} />
            </View>
            <Text style={[styles.alertToggleText, { color: C.text, fontFamily: F.sans }]}>Mark as alert</Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  saveBtn: { backgroundColor: 'transparent', paddingHorizontal: 4, paddingVertical: 4, borderRadius: 0, borderWidth: 0 },
  saveBtnHovered: {},
  saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  body: { flex: 1 },
  heroCard: { padding: 32, alignItems: 'center', gap: 12 },
  heroPhoto: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  heroEmoji: { fontSize: 64 },
  heroName: { fontSize: 24, fontWeight: '700', fontStyle: 'italic' },
  errorText: { fontSize: 13, padding: 16 },
  section: { margin: 16, marginBottom: 0, borderRadius: 14, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  photoRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  photoThumb: { width: 56, height: 56, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoThumbImg: { width: 56, height: 56 },
  photoInfo: { flex: 1, gap: 8 },
  photoLabel: { fontSize: 13 },
  photoMobileNote: { fontSize: 12, color: '#C4BAA8', fontStyle: 'italic' },
  fieldLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  boardTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  boardTypeOption: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  boardTypeText: { fontSize: 13 },
  colorGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 4 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },
  alertToggle: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  toggleTrack: { width: 44, height: 24, borderRadius: 12, justifyContent: 'center', paddingHorizontal: 2 },
  toggleThumb: { width: 20, height: 20, borderRadius: 10 },
  toggleThumbOn: { alignSelf: 'flex-end' },
  alertToggleText: { fontSize: 14 },
});
