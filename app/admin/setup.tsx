import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Trash2, Check, X, RefreshCw } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../../lib/useProfile';
import { useTheme } from '../../context/ThemeContext';

const BOARD_TYPES = ['Full Board', 'Training Board', 'Partial Board', 'Pasture Board', 'Self Care'];
const HORSE_COLORS = ['#2C4A35', '#4A7C59', '#8B6914', '#6B4226', '#1A3A4A', '#4A3B6B', '#8B2E2E', '#3A3830'];

type RowStatus = 'pending' | 'saving' | 'done' | 'error';

type HorseRow = {
  key: string;
  name: string;
  stall: string;
  ownerName: string;
  ownerEmail: string;
  boardType: string;
  status: RowStatus;
  errorMsg: string;
};

type PendingInvite = {
  id: string;
  email: string;
  horse_id: number | null;
  horseName: string;
  accepted: boolean;
  resending: boolean;
};

type Tab = 'import' | 'invites' | 'settings';

function makeRow(): HorseRow {
  return {
    key: Math.random().toString(36).slice(2),
    name: '',
    stall: '',
    ownerName: '',
    ownerEmail: '',
    boardType: 'Full Board',
    status: 'pending',
    errorMsg: '',
  };
}

export default function AdminSetup() {
  const router = useRouter();
  const { isOwner, loading: profileLoading, profile } = useProfile();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;

  const [tab, setTab] = useState<Tab>('import');

  // Import tab
  const [rows, setRows] = useState<HorseRow[]>([makeRow(), makeRow(), makeRow()]);
  const [importing, setImporting] = useState(false);
  const [barnName, setBarnName] = useState('');

  // Invites tab
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);

  // Settings tab
  const [cogginsDays, setCogginsDays] = useState('30');
  const [farrierDays, setFarrierDays] = useState('14');
  const [alertSettingsId, setAlertSettingsId] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    if (profileLoading) return;
    if (!isOwner) { router.replace('/dashboard'); return; }
    loadInitialData();
  }, [profileLoading, isOwner]);

  useEffect(() => {
    if (tab === 'invites') loadPendingInvites();
  }, [tab]);

  async function loadInitialData() {
    const [settingsRes, barnRes] = await Promise.all([
      supabase.from('alert_settings').select('*').eq('barn_id', 'default').single(),
      supabase.from('barn_settings').select('barn_name').single(),
    ]);
    if (settingsRes.data) {
      setCogginsDays(String(settingsRes.data.coggins_days ?? 30));
      setFarrierDays(String(settingsRes.data.farrier_days ?? 14));
      setAlertSettingsId(settingsRes.data.id);
    }
    if (barnRes.data) setBarnName(barnRes.data.barn_name ?? '');
  }

  async function loadPendingInvites() {
    setInvitesLoading(true);
    const { data: invites } = await supabase
      .from('invites')
      .select('id, email, horse_id, accepted')
      .eq('role', 'horse_owner')
      .order('accepted', { ascending: true });

    if (!invites) { setInvitesLoading(false); return; }

    const horseIds = invites.map(i => i.horse_id).filter(Boolean) as number[];
    let horseMap: Record<number, string> = {};
    if (horseIds.length) {
      const { data: horses } = await supabase.from('horses').select('id, name').in('id', horseIds);
      horses?.forEach(h => { horseMap[h.id] = h.name; });
    }

    setPendingInvites(invites.map(i => ({
      id: i.id,
      email: i.email,
      horse_id: i.horse_id,
      horseName: i.horse_id ? (horseMap[i.horse_id] ?? 'Unknown horse') : '—',
      accepted: i.accepted,
      resending: false,
    })));
    setInvitesLoading(false);
  }

  function updateRow(key: string, field: keyof HorseRow, value: string) {
    setRows(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r));
  }

  function cycleBoardType(key: string, current: string) {
    const idx = BOARD_TYPES.indexOf(current);
    updateRow(key, 'boardType', BOARD_TYPES[(idx + 1) % BOARD_TYPES.length]);
  }

  function deleteRow(key: string) {
    setRows(prev => prev.filter(r => r.key !== key));
  }

  async function handleImport() {
    const validRows = rows.filter(r => r.name.trim());
    if (!validRows.length) {
      Alert.alert('Nothing to import', 'Enter at least one horse name.');
      return;
    }
    setImporting(true);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.name.trim()) continue;

      setRows(prev => prev.map(r => r.key === row.key ? { ...r, status: 'saving' } : r));

      try {
        const color = HORSE_COLORS[i % HORSE_COLORS.length];
        const { data: horse, error: horseError } = await supabase
          .from('horses')
          .insert({
            name: row.name.trim(),
            breed: 'Unknown',
            stall: row.stall.trim() || '—',
            owner: row.ownerName.trim() || (row.ownerEmail.trim() || 'Unknown'),
            board_type: row.boardType,
            color,
            alert: false,
          })
          .select('id')
          .single();

        if (horseError) throw horseError;

        // Send invite if email provided
        if (row.ownerEmail.trim()) {
          const email = row.ownerEmail.trim().toLowerCase();
          await supabase.from('invites').insert({
            email,
            role: 'horse_owner',
            horse_id: horse.id,
            relationship: 'owner',
            billing_contact: true,
            created_by: profile?.id,
          });
          await supabase.functions.invoke('send-invite', {
            body: { email, role: 'horse_owner', barnName },
          });
        }

        setRows(prev => prev.map(r => r.key === row.key ? { ...r, status: 'done' } : r));
      } catch (e: any) {
        setRows(prev => prev.map(r => r.key === row.key ? { ...r, status: 'error', errorMsg: e.message } : r));
      }
    }

    setImporting(false);
  }

  async function resendInvite(invite: PendingInvite) {
    setPendingInvites(prev => prev.map(i => i.id === invite.id ? { ...i, resending: true } : i));
    await supabase.functions.invoke('send-invite', {
      body: { email: invite.email, role: 'horse_owner', barnName },
    });
    setPendingInvites(prev => prev.map(i => i.id === invite.id ? { ...i, resending: false } : i));
    Alert.alert('Invite resent', `Resent to ${invite.email}`);
  }

  async function saveSettings() {
    const coggins = parseInt(cogginsDays, 10);
    const farrier = parseInt(farrierDays, 10);
    if (isNaN(coggins) || isNaN(farrier) || coggins < 1 || farrier < 1) {
      Alert.alert('Invalid', 'Enter a whole number greater than 0 for each threshold.');
      return;
    }
    setSavingSettings(true);
    if (alertSettingsId) {
      await supabase.from('alert_settings')
        .update({ coggins_days: coggins, farrier_days: farrier })
        .eq('id', alertSettingsId);
    }
    setSavingSettings(false);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  }

  if (profileLoading) {
    return <ActivityIndicator style={{ flex: 1, marginTop: 100 }} />;
  }

  const doneCount = rows.filter(r => r.status === 'done').length;

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: C.headerText, fontFamily: F.sans }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>Barn Setup</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: C.card, borderBottomColor: C.cardBorder }]}>
        {([
          { key: 'import', label: 'Import Horses' },
          { key: 'invites', label: 'Invites' },
          { key: 'settings', label: 'Settings' },
        ] as { key: Tab; label: string }[]).map(t => (
          <Pressable
            key={t.key}
            style={[styles.tabBtn, tab === t.key && [styles.tabBtnActive, { borderBottomColor: C.secondary }]]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[
              styles.tabLabel,
              { fontFamily: tab === t.key ? F.sansBold : F.sans, color: tab === t.key ? C.secondary : C.textMuted },
            ]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Import Horses tab */}
      {tab === 'import' && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
          <Text style={[styles.note, { fontFamily: F.sans, color: C.textMuted }]}>
            Enter one row per horse. If an owner email is provided, an invite will be sent automatically.
          </Text>

          {rows.map((row, idx) => (
            <View key={row.key} style={[styles.horseCard, { backgroundColor: C.card, borderColor: row.status === 'error' ? C.error : row.status === 'done' ? C.success : C.cardBorder }]}>
              {/* Row header */}
              <View style={styles.rowHeader}>
                <View style={[styles.rowNum, { backgroundColor: C.primary }]}>
                  <Text style={[styles.rowNumText, { fontFamily: F.sansBold, color: C.headerText }]}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={[styles.nameInput, { fontFamily: F.sansBold, color: C.text }]}
                    value={row.name}
                    onChangeText={v => updateRow(row.key, 'name', v)}
                    placeholder="Horse name *"
                    placeholderTextColor={C.textMuted}
                    editable={row.status === 'pending'}
                  />
                </View>
                {row.status === 'pending' && (
                  <Pressable onPress={() => deleteRow(row.key)} style={styles.deleteBtn}>
                    <X size={16} color={C.textMuted} />
                  </Pressable>
                )}
                {row.status === 'saving' && <ActivityIndicator size="small" color={C.secondary} style={{ marginLeft: 8 }} />}
                {row.status === 'done' && <Check size={18} color={C.success} style={{ marginLeft: 8 }} />}
                {row.status === 'error' && <X size={18} color={C.error} style={{ marginLeft: 8 }} />}
              </View>

              {row.status === 'error' && (
                <Text style={[styles.errorMsg, { color: C.error, fontFamily: F.sans }]}>{row.errorMsg}</Text>
              )}

              {row.status === 'pending' && (
                <View style={styles.rowFields}>
                  <View style={styles.fieldRow}>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>STALL</Text>
                      <TextInput
                        style={[styles.fieldInput, { color: C.text, fontFamily: F.sans, borderColor: C.cardBorder, backgroundColor: C.background }]}
                        value={row.stall}
                        onChangeText={v => updateRow(row.key, 'stall', v)}
                        placeholder="12"
                        placeholderTextColor={C.textMuted}
                        keyboardType="default"
                      />
                    </View>
                    <View style={[styles.fieldGroup, { flex: 2 }]}>
                      <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>BOARD TYPE</Text>
                      <Pressable
                        style={[styles.fieldInput, styles.boardTypeBtn, { borderColor: C.secondary, backgroundColor: C.background }]}
                        onPress={() => cycleBoardType(row.key, row.boardType)}
                      >
                        <Text style={[styles.boardTypeText, { color: C.secondary, fontFamily: F.sans }]}>{row.boardType} ↻</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>OWNER NAME</Text>
                    <TextInput
                      style={[styles.fieldInput, { color: C.text, fontFamily: F.sans, borderColor: C.cardBorder, backgroundColor: C.background }]}
                      value={row.ownerName}
                      onChangeText={v => updateRow(row.key, 'ownerName', v)}
                      placeholder="Jane Smith"
                      placeholderTextColor={C.textMuted}
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>OWNER EMAIL — invite sent automatically</Text>
                    <TextInput
                      style={[styles.fieldInput, { color: C.text, fontFamily: F.sans, borderColor: C.cardBorder, backgroundColor: C.background }]}
                      value={row.ownerEmail}
                      onChangeText={v => updateRow(row.key, 'ownerEmail', v)}
                      placeholder="jane@example.com"
                      placeholderTextColor={C.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>
              )}
            </View>
          ))}

          {/* Add row */}
          <Pressable style={[styles.addRowBtn, { borderColor: C.cardBorder }]} onPress={() => setRows(prev => [...prev, makeRow()])}>
            <Plus size={14} color={C.textMuted} />
            <Text style={[styles.addRowText, { color: C.textMuted, fontFamily: F.sans }]}>Add horse</Text>
          </Pressable>

          {/* Import button */}
          {doneCount === 0 ? (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: C.primary }, importing && { opacity: 0.6 }]}
              onPress={handleImport}
              disabled={importing}
            >
              {importing
                ? <ActivityIndicator color="#fff" />
                : <Text style={[styles.actionBtnText, { fontFamily: F.sansBold }]}>
                    Import {rows.filter(r => r.name.trim()).length} Horse{rows.filter(r => r.name.trim()).length !== 1 ? 's' : ''} & Send Invites
                  </Text>
              }
            </Pressable>
          ) : (
            <View style={[styles.doneCard, { backgroundColor: C.successBg, borderColor: C.success }]}>
              <Check size={20} color={C.success} />
              <Text style={[styles.doneText, { color: C.success, fontFamily: F.sansBold }]}>
                {doneCount} horse{doneCount !== 1 ? 's' : ''} imported. Go to Invites tab to check status.
              </Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── Invites tab */}
      {tab === 'invites' && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <View style={styles.invitesHeader}>
            <Text style={[styles.note, { fontFamily: F.sans, color: C.textMuted, flex: 1 }]}>
              All horse owner invites. Resend to anyone who hasn't accepted.
            </Text>
            <Pressable onPress={loadPendingInvites} style={styles.refreshBtn}>
              <RefreshCw size={14} color={C.textMuted} />
            </Pressable>
          </View>

          {invitesLoading && <ActivityIndicator style={{ marginTop: 40 }} color={C.primary} />}

          {!invitesLoading && pendingInvites.length === 0 && (
            <Text style={[styles.emptyText, { color: C.textMuted, fontFamily: F.sans }]}>No invites found. Import horses first.</Text>
          )}

          {pendingInvites.map(invite => (
            <View key={invite.id} style={[styles.inviteCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <View style={[styles.inviteStatus, { backgroundColor: invite.accepted ? C.successBg : C.warningBg }]}>
                <Text style={[styles.inviteStatusText, { color: invite.accepted ? C.success : C.warning, fontFamily: F.sansBold }]}>
                  {invite.accepted ? 'ACCEPTED' : 'PENDING'}
                </Text>
              </View>
              <View style={styles.inviteInfo}>
                <Text style={[styles.inviteEmail, { color: C.text, fontFamily: F.sansBold }]}>{invite.email}</Text>
                <Text style={[styles.inviteHorse, { color: C.textMuted, fontFamily: F.sans }]}>{invite.horseName}</Text>
              </View>
              {!invite.accepted && (
                <Pressable
                  style={[styles.resendBtn, { borderColor: C.secondary }]}
                  onPress={() => resendInvite(invite)}
                  disabled={invite.resending}
                >
                  {invite.resending
                    ? <ActivityIndicator size="small" color={C.secondary} />
                    : <Text style={[styles.resendBtnText, { color: C.secondary, fontFamily: F.sansBold }]}>Resend</Text>
                  }
                </Pressable>
              )}
            </View>
          ))}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── Settings tab */}
      {tab === 'settings' && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <Text style={[styles.cardTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>ALERT THRESHOLDS</Text>
            <Text style={[styles.cardDesc, { color: C.textMuted, fontFamily: F.sans }]}>
              How many days before a due date should alerts fire on the dashboard?
            </Text>

            <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold, marginTop: 20 }]}>COGGINS — days before expiry</Text>
            <TextInput
              style={[styles.settingInput, { color: C.text, fontFamily: F.sans, borderColor: C.cardBorder, backgroundColor: C.background }]}
              value={cogginsDays}
              onChangeText={setCogginsDays}
              keyboardType="number-pad"
              placeholder="30"
              placeholderTextColor={C.textMuted}
            />
            <Text style={[styles.fieldHint, { color: C.textMuted, fontFamily: F.sans }]}>Default: 30 days</Text>

            <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold, marginTop: 16 }]}>FARRIER — days before next appointment</Text>
            <TextInput
              style={[styles.settingInput, { color: C.text, fontFamily: F.sans, borderColor: C.cardBorder, backgroundColor: C.background }]}
              value={farrierDays}
              onChangeText={setFarrierDays}
              keyboardType="number-pad"
              placeholder="14"
              placeholderTextColor={C.textMuted}
            />
            <Text style={[styles.fieldHint, { color: C.textMuted, fontFamily: F.sans }]}>Default: 14 days</Text>

            <Pressable
              style={[styles.actionBtn, { backgroundColor: C.primary, marginTop: 24 }, savingSettings && { opacity: 0.6 }]}
              onPress={saveSettings}
              disabled={savingSettings}
            >
              {savingSettings
                ? <ActivityIndicator color="#fff" />
                : <Text style={[styles.actionBtnText, { fontFamily: F.sansBold }]}>
                    {settingsSaved ? '✓ Saved' : 'Save Settings'}
                  </Text>
              }
            </Pressable>
          </View>

          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.cardBorder, marginTop: 16 }]}>
            <Text style={[styles.cardTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>CSV BULK IMPORT</Text>
            <Text style={[styles.cardDesc, { color: C.textMuted, fontFamily: F.sans }]}>
              Have a spreadsheet already? Use the CSV importer to bulk-create horses.
            </Text>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: C.primary, marginTop: 16 }]}
              onPress={() => router.push('/import-horses')}
            >
              <Text style={[styles.actionBtnText, { fontFamily: F.sansBold }]}>Open CSV Importer</Text>
            </Pressable>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { width: 60 },
  backText: { fontSize: 15 },
  headerTitle: { fontSize: 16 },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {},
  tabLabel: { fontSize: 12 },

  body: { flex: 1 },
  bodyContent: { padding: 16 },

  note: { fontSize: 13, lineHeight: 20, marginBottom: 16 },

  // Horse cards
  horseCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowNumText: { fontSize: 12 },
  nameInput: { fontSize: 15, paddingVertical: 2 },
  deleteBtn: { padding: 4 },
  errorMsg: { fontSize: 11, marginTop: 6, marginLeft: 36 },

  rowFields: { marginTop: 12, gap: 10 },
  fieldRow: { flexDirection: 'row', gap: 10 },
  fieldGroup: { gap: 4 },
  fieldLabel: { fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase' },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
  },
  boardTypeBtn: { justifyContent: 'center' },
  boardTypeText: { fontSize: 13 },

  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 12,
    justifyContent: 'center',
    marginBottom: 20,
  },
  addRowText: { fontSize: 13 },

  actionBtn: {
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontSize: 15 },

  doneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
  },
  doneText: { fontSize: 14, flex: 1 },

  // Invites tab
  invitesHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  refreshBtn: { padding: 6, marginTop: -2 },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 14 },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  inviteStatus: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  inviteStatusText: { fontSize: 9, letterSpacing: 0.5 },
  inviteInfo: { flex: 1 },
  inviteEmail: { fontSize: 13 },
  inviteHorse: { fontSize: 11, marginTop: 2 },
  resendBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  resendBtnText: { fontSize: 12 },

  // Settings tab
  card: { borderRadius: 14, borderWidth: 1, padding: 16 },
  cardTitle: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  cardDesc: { fontSize: 13, lineHeight: 19 },
  settingInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    marginTop: 6,
  },
  fieldHint: { fontSize: 11, marginTop: 4 },
});
