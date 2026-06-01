import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CheckSquare, Square } from 'lucide-react-native';
import DateInput from '../../lib/DateInput';
import { useTheme } from '../../context/ThemeContext';

const SUPABASE_FN = 'https://kzpdukjkttkaaligxsmb.supabase.co/functions/v1/service-entry';

const SERVICE_TYPES = [
  { value: 'farrier',     label: 'Farrier' },
  { value: 'vet',         label: 'Vet' },
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'medication',  label: 'Medication' },
  { value: 'bodywork',    label: 'Bodywork' },
  { value: 'dental',      label: 'Dental' },
  { value: 'other',       label: 'Other' },
];

const SHOWS_NEXT_APPT = ['farrier', 'vet', 'bodywork', 'dental'];
const SHOWS_EXPIRY    = ['vaccination'];

const WEEK_OPTIONS = [4, 5, 6, 8, 10, 12];

function addWeeks(weeks: number): string {
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split('T')[0];
}

function buildPaymentUrl(handle: string, amount: string, note: string): string {
  const h = handle.trim();
  const amt = parseFloat(amount) || 0;
  const encodedNote = encodeURIComponent(note);
  if (h.startsWith('$')) return `https://cash.app/${h}/${amt}`;
  if (h.startsWith('http')) return h;
  const username = h.startsWith('@') ? h.slice(1) : h;
  return `https://venmo.com/${username}?txn=pay&amount=${amt}&note=${encodedNote}`;
}

const FARRIER_GROUPS = [
  { label: 'Base Service', items: ['Full Trim', 'Shoe FR/Trim BK', 'Full Shoes'] },
  { label: 'Material',     items: ['Steel', 'Aluminum'] },
  { label: 'Modifications', items: ['Pads', 'Packing', 'Clips', 'Rocker Toe', 'Rolled Toe', 'Square Toe', 'Trailers', 'Egg Bar', 'Straight Bar', 'Hoof Repair'] },
];

interface Horse { id: number; name: string; color: string; }
interface HorseDetail { title: string; presets: string[]; notes: string; nextAppt: string; expiryDate: string; amount: string; }

const emptyDetail = (): HorseDetail => ({ title: '', presets: [], notes: '', nextAppt: '', expiryDate: '', amount: '' });

export default function BarnEntryForm() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const [horses, setHorses] = useState<Horse[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  // shared fields
  const [serviceType, setServiceType] = useState('farrier');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [providerName, setProviderName] = useState('');

  // payment
  const [paymentMethod, setPaymentMethod] = useState<'barn' | 'direct' | null>(null);
  const [paymentHandle, setPaymentHandle] = useState('');

  // per-horse
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [details, setDetails] = useState<Record<number, HorseDetail>>({});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${SUPABASE_FN}?barn=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setLoadError(data.error);
        else setHorses(data.horses || []);
        setLoading(false);
      })
      .catch(() => { setLoadError('Could not load horses.'); setLoading(false); });
  }, [token]);

  function toggleHorse(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        setDetails(d => ({ ...d, [id]: d[id] || emptyDetail() }));
      }
      return next;
    });
  }

  function updateDetail(id: number, field: keyof HorseDetail, value: string) {
    setDetails(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  function togglePreset(id: number, preset: string) {
    setDetails(prev => {
      const detail = prev[id] || emptyDetail();
      const presets = detail.presets.includes(preset)
        ? detail.presets.filter(p => p !== preset)
        : [...detail.presets, preset];
      return { ...prev, [id]: { ...detail, presets } };
    });
  }

  async function handleSubmit() {
    if (selected.size === 0) { setError('Select at least one horse.'); return; }
    if (!date) { setError('Date is required.'); return; }
    if (paymentMethod === 'direct' && !paymentHandle.trim()) { setError('Enter your Venmo, Cash App, or PayPal handle to collect directly.'); return; }
    setSaving(true);
    setError('');
    try {
      const horsesPayload = Array.from(selected).map(id => {
        const d = details[id] || emptyDetail();
        const resolvedTitle = serviceType === 'farrier'
          ? d.presets.join(', ') || null
          : d.title.trim() || null;
        const paymentUrl = paymentMethod === 'direct' && paymentHandle.trim() && d.amount
          ? buildPaymentUrl(paymentHandle, d.amount, `${serviceType} - ${resolvedTitle || 'visit'}`)
          : null;
        return {
          horse_id: id,
          title: resolvedTitle,
          notes: d.notes.trim() || null,
          next_appointment_date: d.nextAppt || null,
          expiry_date: d.expiryDate || null,
          amount: d.amount || null,
          barn_invoiced: paymentMethod === 'barn',
          external_invoice_url: paymentUrl,
        };
      });
      const res = await fetch(`${SUPABASE_FN}?barn=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_type: serviceType,
          date,
          provider_name: providerName.trim() || null,
          horses: horsesPayload,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setSuccess(true);
    } catch {
      setError('Network error. Please try again.');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: C.background }]}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.center, { backgroundColor: C.background }]}>
        <Text style={[styles.errorTitle, { color: C.error, fontFamily: F.sansBold }]}>Not found</Text>
        <Text style={[styles.errorSub, { color: C.textMuted, fontFamily: F.sans }]}>{loadError}</Text>
      </View>
    );
  }

  if (success) {
    return (
      <View style={[styles.center, { backgroundColor: C.background }]}>
        <Text style={styles.successCheck}>✓</Text>
        <Text style={[styles.successTitle, { color: C.primary, fontFamily: F.sansBold }]}>Visits Logged</Text>
        <Text style={[styles.successSub, { color: C.textMuted, fontFamily: F.sans }]}>
          {selected.size} visit{selected.size !== 1 ? 's' : ''} recorded successfully. The barn team will be notified.
        </Text>
      </View>
    );
  }

  const showNextAppt = SHOWS_NEXT_APPT.includes(serviceType);
  const showExpiry   = SHOWS_EXPIRY.includes(serviceType);

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <Text style={styles.barn}>Scope &amp; Stride</Text>
        <Text style={[styles.headerHorseName, { color: C.secondary, fontFamily: F.sansBold }]}>Log Service Visits</Text>
        <Text style={styles.subtitle}>Select the horses you worked on today</Text>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

        {/* Shared Details */}
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>Visit Details</Text>

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>SERVICE TYPE</Text>
          <View style={styles.typeGrid}>
            {SERVICE_TYPES.map(({ value, label }) => (
              <Pressable
                key={value}
                style={[
                  styles.typeOption, { borderColor: C.cardBorder },
                  serviceType === value && { borderColor: C.primary, backgroundColor: C.activeBg },
                  value === 'other' && styles.typeOptionFull,
                ]}
                onPress={() => setServiceType(value)}
              >
                <Text style={[styles.typeLabel, { color: C.textMuted, fontFamily: F.sansMedium }, serviceType === value && { color: C.primary, fontFamily: F.sansBold }]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>DATE <Text style={{ color: C.error }}>*</Text></Text>
          <DateInput value={date} onChange={setDate} placeholder="Select date" />

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>YOUR NAME / PRACTICE</Text>
          <TextInput
            style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
            value={providerName}
            onChangeText={setProviderName}
            placeholder={
              serviceType === 'farrier'     ? 'e.g. John Smith Farriery' :
              serviceType === 'vet'         ? 'e.g. Dr. Sarah Jones, Equine Vet' :
              serviceType === 'vaccination' ? 'e.g. Dr. Sarah Jones, Equine Vet' :
              serviceType === 'medication'  ? 'e.g. Dr. Sarah Jones, Equine Vet' :
              serviceType === 'bodywork'    ? 'e.g. Jane Smith, Equine Massage' :
              serviceType === 'dental'      ? 'e.g. Dr. Mike Lee, Equine Dentistry' :
              'e.g. Your name or practice'
            }
            placeholderTextColor={C.textMuted}
          />

          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>PAYMENT</Text>
          <View style={styles.paymentToggle}>
            <Pressable
              style={[styles.paymentOption, { borderColor: C.cardBorder }, paymentMethod === 'barn' && { borderColor: C.primary, backgroundColor: C.activeBg }]}
              onPress={() => setPaymentMethod(paymentMethod === 'barn' ? null : 'barn')}
            >
              <Text style={[styles.paymentOptionText, { color: C.textMuted, fontFamily: F.sansMedium }, paymentMethod === 'barn' && { color: C.primary, fontFamily: F.sansBold }]}>Bill through barn</Text>
            </Pressable>
            <Pressable
              style={[styles.paymentOption, { borderColor: C.cardBorder }, paymentMethod === 'direct' && { borderColor: C.primary, backgroundColor: C.activeBg }]}
              onPress={() => setPaymentMethod(paymentMethod === 'direct' ? null : 'direct')}
            >
              <Text style={[styles.paymentOptionText, { color: C.textMuted, fontFamily: F.sansMedium }, paymentMethod === 'direct' && { color: C.primary, fontFamily: F.sansBold }]}>Collect directly</Text>
            </Pressable>
          </View>
          {paymentMethod === 'direct' ? (
            <>
              <Text style={[styles.fieldLabel, { marginTop: 10, color: C.textMuted, fontFamily: F.sansBold }]}>YOUR HANDLE <Text style={{ color: C.error }}>*</Text></Text>
              <TextInput
                style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }, !paymentHandle.trim() && { borderColor: '#C0392B', borderWidth: 1.5 }]}
                value={paymentHandle}
                onChangeText={setPaymentHandle}
                placeholder="@venmo, $cashapp, or payment URL"
                placeholderTextColor={C.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </>
          ) : null}
        </View>

        {/* Horse list */}
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>Horses <Text style={{ color: C.primary, textTransform: 'none' }}>{selected.size > 0 ? `· ${selected.size} selected` : ''}</Text></Text>

          {horses.length === 0 ? (
            <Text style={[styles.emptyText, { color: C.cardBorder, fontFamily: F.sans }]}>No horses found.</Text>
          ) : (
            horses.map((horse, index) => {
              const isSelected = selected.has(horse.id);
              const detail = details[horse.id] || emptyDetail();
              const isLast = index === horses.length - 1;
              return (
                <View key={horse.id} style={[styles.horseRow, { borderBottomColor: C.cardSeparator }, isLast && !isSelected && styles.horseRowLast]}>
                  <Pressable style={styles.horseToggle} onPress={() => toggleHorse(horse.id)}>
                    {isSelected
                      ? <CheckSquare size={20} color={C.primary} />
                      : <Square size={20} color={C.cardBorder} />}
                    <View style={[styles.horseDot, { backgroundColor: horse.color || C.primary }]} />
                    <Text style={[styles.horseNameText, { color: C.textMuted, fontFamily: F.sansMedium }, isSelected && { color: C.text, fontFamily: F.sansBold }]}>{horse.name}</Text>
                  </Pressable>

                  {isSelected && (
                    <View style={[styles.horseDetails, { borderBottomColor: C.cardSeparator }, isLast && styles.horseDetailsLast]}>
                      <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>WHAT WAS DONE</Text>
                      {serviceType === 'farrier' ? (
                        <>
                          {FARRIER_GROUPS.map(group => (
                            <View key={group.label}>
                              <Text style={[styles.presetGroupLabel, { color: C.cardBorder, fontFamily: F.sansBold }]}>{group.label.toUpperCase()}</Text>
                              <View style={styles.presetGrid}>
                                {group.items.map(preset => {
                                  const isActive = detail.presets.includes(preset);
                                  return (
                                    <Pressable
                                      key={preset}
                                      style={[styles.presetChip, { borderColor: C.cardBorder }, isActive && { borderColor: '#B08C4A', backgroundColor: '#FDF5E6' }]}
                                      onPress={() => togglePreset(horse.id, preset)}
                                    >
                                      <Text style={[styles.presetChipText, { color: C.textMuted, fontFamily: F.sansMedium }, isActive && { color: '#B08C4A', fontFamily: F.sansBold }]}>{preset}</Text>
                                    </Pressable>
                                  );
                                })}
                              </View>
                            </View>
                          ))}
                        </>
                      ) : (
                        <TextInput
                          style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
                          value={detail.title}
                          onChangeText={v => updateDetail(horse.id, 'title', v)}
                          placeholder={
                            serviceType === 'vet'         ? 'e.g. Lameness exam, wound check' :
                            serviceType === 'vaccination' ? 'e.g. Flu/Rhino, West Nile' :
                            serviceType === 'medication'  ? 'e.g. Bute 2g, SMZs course' :
                            serviceType === 'bodywork'    ? 'e.g. Chiropractic adjustment, massage' :
                            serviceType === 'dental'      ? 'e.g. Float, wolf tooth extraction' :
                            'Describe the service'
                          }
                          placeholderTextColor={C.textMuted}
                        />
                      )}

                      <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>NOTES</Text>
                      <TextInput
                        style={[styles.input, styles.notesInput, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
                        value={detail.notes}
                        onChangeText={v => updateDetail(horse.id, 'notes', v)}
                        placeholder="Anything specific to this horse…"
                        placeholderTextColor={C.textMuted}
                        multiline
                      />

                      {showNextAppt ? (
                        <>
                          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>NEXT APPOINTMENT</Text>
                          <View style={styles.weekChips}>
                            {WEEK_OPTIONS.map(w => {
                              const val = addWeeks(w);
                              const isActive = detail.nextAppt === val;
                              return (
                                <Pressable
                                  key={w}
                                  style={[styles.weekChip, { borderColor: C.cardBorder }, isActive && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                                  onPress={() => updateDetail(horse.id, 'nextAppt', isActive ? '' : val)}
                                >
                                  <Text style={[styles.weekChipText, { color: C.textMuted, fontFamily: F.sansMedium }, isActive && { color: C.primary, fontFamily: F.sansBold }]}>{w}w</Text>
                                </Pressable>
                              );
                            })}
                          </View>
                          <DateInput value={detail.nextAppt} onChange={v => updateDetail(horse.id, 'nextAppt', v)} placeholder="Or pick a date" />
                        </>
                      ) : null}

                      {showExpiry ? (
                        <>
                          <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>EXPIRY DATE</Text>
                          <DateInput value={detail.expiryDate} onChange={v => updateDetail(horse.id, 'expiryDate', v)} placeholder="Select date" />
                        </>
                      ) : null}

                      <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>AMOUNT ($)</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
                        value={detail.amount}
                        onChangeText={v => updateDetail(horse.id, 'amount', v)}
                        placeholder="e.g. 150.00"
                        placeholderTextColor={C.textMuted}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {error ? <Text style={[styles.errorText, { color: C.error, fontFamily: F.sans }]}>{error}</Text> : null}

        <Pressable
          style={({ hovered }: any) => [
            styles.submitBtn, { backgroundColor: C.primary },
            hovered && { backgroundColor: C.primaryDark },
            (saving || selected.size === 0) && styles.submitBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={saving || selected.size === 0}
        >
          {saving
            ? <ActivityIndicator color="white" size="small" />
            : <Text style={[styles.submitBtnText, { fontFamily: F.sansBold }]}>
                {selected.size === 0 ? 'Select horses to continue' : `Submit ${selected.size} Visit${selected.size !== 1 ? 's' : ''}`}
              </Text>}
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  header: { padding: 20, paddingTop: Platform.OS === 'web' ? 20 : 52, paddingBottom: 24 },
  barn: { fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  headerHorseName: { fontSize: 22, fontWeight: '700', fontStyle: 'italic' },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 },
  body: { flex: 1 },
  card: { margin: 16, marginBottom: 0, borderRadius: 14, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  typeOption: { borderWidth: 1.5, borderRadius: 10, padding: 10, alignItems: 'center', minWidth: 80, flex: 1 },
  typeOptionFull: { flexBasis: '100%', flex: 0 },
  typeLabel: { fontSize: 13, fontWeight: '500' },
  fieldLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1, marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
  notesInput: { minHeight: 72, textAlignVertical: 'top' },
  horseRow: { borderBottomWidth: 1 },
  horseRowLast: { borderBottomWidth: 0 },
  horseToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  horseDot: { width: 10, height: 10, borderRadius: 5 },
  horseNameText: { fontSize: 14, fontWeight: '500', flex: 1 },
  horseDetails: { paddingBottom: 16, borderBottomWidth: 1 },
  horseDetailsLast: { borderBottomWidth: 0 },
  paymentToggle: { flexDirection: 'row', gap: 8 },
  paymentOption: { flex: 1, borderWidth: 1.5, borderRadius: 10, padding: 12, alignItems: 'center' },
  paymentOptionText: { fontSize: 13, fontWeight: '500' },
  weekChips: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  weekChip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  weekChipText: { fontSize: 13, fontWeight: '500' },
  presetGroupLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1, marginTop: 10, marginBottom: 6 },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetChip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  presetChipText: { fontSize: 13, fontWeight: '500' },
  emptyText: { fontSize: 13, fontStyle: 'italic', paddingVertical: 8 },
  errorText: { fontSize: 13, padding: 16 },
  submitBtn: { margin: 16, borderRadius: 12, padding: 16, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
  errorTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  errorSub: { fontSize: 14, textAlign: 'center' },
  successCheck: { fontSize: 56, marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  successSub: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
