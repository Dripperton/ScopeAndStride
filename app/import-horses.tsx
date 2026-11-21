import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useProfile } from '../lib/useProfile';
import { useLanguage } from '../lib/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const COLORS = ['#D4E8D4', '#E8E8F0', '#F0E0D0', '#F0D8C8', '#F0F0E8', '#E8F0E8'];

// RFC 4180 parser — handles quoted fields that contain commas
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { fields.push(field.trim()); field = ''; }
      else { field += c; }
    }
  }
  fields.push(field.trim());
  return fields;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/\*/g, '').replace(/\s+/g, ' ').trim();
}

// Maps every Google Sheet column header variant to an internal key
const HEADER_MAP: Record<string, string> = {
  'horse name': 'name', 'name': 'name',
  'breed': 'breed',
  'stall': 'stall', 'stall / paddock number': 'stall',
  'stall/paddock number': 'stall', 'stall/paddock': 'stall',
  'owner': 'owner', 'owner name': 'owner',
  'owner first name': 'owner_first', 'owner last name': 'owner_last',
  'owner email': 'owner_email', 'owner phone': 'owner_phone',
  'board type': 'board_type', 'board package': 'board_type',
  'farrier name': 'farrier_name',
  'farrier cycle (weeks)': 'farrier_weeks', 'farrier cycle': 'farrier_weeks',
  'last farrier date': 'last_farrier_date',
  'vet name': 'vet_name', 'vet phone': 'vet_phone',
  'coggins expiry date': 'coggins_expiry', 'coggins expiry': 'coggins_expiry',
  'alert / special flag': 'flag', 'alert/special flag': 'flag',
  'notes': 'notes',
  'vaccine notes': 'notes',
};

type ParsedHorse = {
  // DB fields
  name: string;
  breed: string | null;
  stall: string | null;
  owner: string;
  board_type: string;
  color: string;
  alert: boolean;
  farrier_name: string | null;
  vet_name: string | null;
  vet_phone: string | null;
  quirks: string | null;
  // Not inserted — used for invite queue
  owner_email: string;
};

type InviteRow = {
  horse_id: number;
  horse_name: string;
  owner_name: string;
  owner_email: string;
  status: 'pending' | 'sending' | 'sent' | 'error';
};

function parseCSV(text: string): ParsedHorse[] {
  const lines = text.trim().split(/\r?\n/).filter(l => !l.trim().startsWith('#') && l.trim());
  if (lines.length < 2) return [];

  const rawHeaders = parseCSVLine(lines[0]);
  const headers = rawHeaders.map(h => HEADER_MAP[normalizeHeader(h)] ?? normalizeHeader(h));

  return lines.slice(1).map((line, i) => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

    const ownerName =
      row.owner_first && row.owner_last ? `${row.owner_first} ${row.owner_last}` :
      row.owner_first || row.owner_last || row.owner || '';

    const quirks = [row.flag, row.notes].filter(Boolean).join(' · ') || null;

    return {
      name: row.name || '',
      breed: row.breed || null,
      stall: row.stall || null,
      owner: ownerName,
      board_type: row.board_type || 'Full Board',
      color: COLORS[i % COLORS.length],
      alert: !!(row.flag),
      farrier_name: row.farrier_name || null,
      vet_name: row.vet_name || null,
      vet_phone: row.vet_phone || null,
      quirks,
      owner_email: row.owner_email || '',
    };
  }).filter(h => h.name);
}

function downloadTemplate() {
  const csv = [
    '# Scope & Stride — Horse Import Template',
    '# Delete these comment lines before importing',
    'Horse Name *,Breed,Stall / Paddock Number,Owner First Name *,Owner Last Name *,Owner Email *,Owner Phone,Board Package *,Farrier Name,Farrier Cycle (weeks),Vet Name,Vet Phone,Coggins Expiry Date,Alert / Special Flag,Notes',
    'Sterling,Dutch Warmblood,4,Robert,Henderson,robert@example.com,555-0101,Full Board,Mike Farrier,6,Dr. Smith,555-0202,12/31/2025,,',
    'Luna,Hanoverian,7,Diane,Calloway,diane@example.com,555-0103,Training Board,,,,,,',
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
  const { profile } = useProfile();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const [preview, setPreview] = useState<ParsedHorse[]>([]);
  const [loading, setLoading] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [inviteQueue, setInviteQueue] = useState<InviteRow[]>([]);
  const [error, setError] = useState('');

  function handleFileChange(e: any) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const horses = parseCSV(evt.target?.result as string);
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

    // Strip owner_email before inserting — not a DB column
    const rows = preview.map(({ owner_email, ...h }) => h);
    const { data: inserted, error: insertError } = await supabase
      .from('horses')
      .insert(rows)
      .select('id, name, owner');

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setImportedCount(preview.length);

    // Build invite queue for horses that had an owner email
    const queue: InviteRow[] = [];
    inserted?.forEach((horse: any, i: number) => {
      const email = preview[i]?.owner_email;
      if (email) {
        queue.push({
          horse_id: horse.id,
          horse_name: horse.name,
          owner_name: horse.owner,
          owner_email: email,
          status: 'pending',
        });
      }
    });
    setInviteQueue(queue);
    setLoading(false);
  }

  async function sendInvite(idx: number) {
    const row = inviteQueue[idx];
    setInviteQueue(prev => prev.map((r, i) => i === idx ? { ...r, status: 'sending' } : r));

    const { error: inviteError } = await supabase.from('invites').insert({
      email: row.owner_email.toLowerCase(),
      role: 'horse_owner',
      created_by: profile?.id,
      barn_id: profile?.barn_id,
      horse_id: row.horse_id,
      relationship: 'owner',
      billing_contact: true,
    });

    if (inviteError) {
      setInviteQueue(prev => prev.map((r, i) => i === idx ? { ...r, status: 'error' } : r));
      return;
    }

    const { data: barnData } = await supabase.from('barn_settings').select('id, barn_name').single();
    await supabase.functions.invoke('send-invite', {
      body: { email: row.owner_email.toLowerCase(), role: 'horse_owner', barnName: barnData?.barn_name, barnId: barnData?.id },
    });

    setInviteQueue(prev => prev.map((r, i) => i === idx ? { ...r, status: 'sent' } : r));
  }

  async function sendAllInvites() {
    const pending = inviteQueue.map((r, i) => ({ ...r, idx: i })).filter(r => r.status === 'pending');
    for (const row of pending) {
      await sendInvite(row.idx);
    }
  }

  const done = importedCount > 0;
  const pendingInvites = inviteQueue.filter(r => r.status === 'pending').length;
  const allSent = inviteQueue.length > 0 && inviteQueue.every(r => r.status === 'sent');

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <Pressable onPress={() => router.back()} style={({ hovered }: any) => [styles.backBtn, hovered && { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
          <Text style={[styles.backText, { color: C.headerText, fontFamily: F.sans }]}>← {t('Back')}</Text>
        </Pressable>
        <Text style={[styles.headerName, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Import Horses')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardDismissMode="interactive">

        {!done ? (
          <>
            {/* Template Download */}
            <View style={[styles.templateCard, { backgroundColor: C.primary }]}>
              <View style={styles.templateLeft}>
                <Text style={styles.templateIcon}>📋</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.templateTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Download Template')}</Text>
                  <Text style={styles.templateSub}>{t('CSV matching the Google Sheet column layout')}</Text>
                </View>
              </View>
              <Pressable
                style={({ hovered }: any) => [styles.templateBtn, { backgroundColor: C.secondary }, hovered && { backgroundColor: C.secondaryDark }]}
                onPress={downloadTemplate}
              >
                <Text style={[styles.templateBtnText, { color: C.primary, fontFamily: F.sansBold }]}>⬇ {t('Download')}</Text>
              </Pressable>
            </View>

            {/* Format note */}
            <View style={[styles.formatCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <Text style={[styles.formatTitle, { color: C.text, fontFamily: F.sansBold }]}>{t('Accepted columns')}</Text>
              <Text style={[styles.formatNote, { color: C.textMuted, fontFamily: F.sans }]}>
                Horse Name · Breed · Stall · Owner First/Last Name · Owner Email · Board Package · Farrier Name · Farrier Cycle (weeks) · Vet Name · Vet Phone · Coggins Expiry Date · Alert / Special Flag · Notes
              </Text>
              <Text style={[styles.formatTip, { color: C.textWarm, fontFamily: F.sans }]}>
                Owners with an email address will appear in the invite queue after import.
              </Text>
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
                      <Text style={[styles.previewMeta, { color: C.textMuted, fontFamily: F.sans }]}>
                        {[horse.stall && `Stall ${horse.stall}`, horse.owner].filter(Boolean).join(' · ')}
                      </Text>
                      <Text style={[styles.previewBreed, { color: C.textWarm, fontFamily: F.sans }]}>
                        {[horse.breed, horse.board_type].filter(Boolean).join(' · ')}
                      </Text>
                      {(horse.vet_name || horse.farrier_name) ? (
                        <Text style={[styles.previewExtra, { color: C.textMuted, fontFamily: F.sans }]}>
                          {[horse.vet_name && `Vet: ${horse.vet_name}`, horse.farrier_name && `Farrier: ${horse.farrier_name}`].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                      {horse.owner_email ? (
                        <Text style={[styles.previewEmail, { color: C.primary, fontFamily: F.sans }]}>✉ {horse.owner_email}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}

                <Pressable
                  style={({ hovered }: any) => [styles.saveBtn, { backgroundColor: C.primary }, hovered && { backgroundColor: C.primaryDark }]}
                  onPress={handleImport}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color={C.secondary} />
                    : <Text style={[styles.saveBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Import {count} Horses', { count: preview.length })}</Text>}
                </Pressable>
              </>
            )}
          </>
        ) : (
          <>
            {/* Success */}
            <View style={[styles.successCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <Text style={[styles.successIcon, { color: C.primary }]}>✓</Text>
              <Text style={[styles.successTitle, { color: C.primary, fontFamily: F.sansBold }]}>{importedCount} {t('horses imported!')}</Text>
              <Pressable
                style={({ hovered }: any) => [styles.saveBtn, { backgroundColor: C.primary }, hovered && { backgroundColor: C.primaryDark }]}
                onPress={() => router.push('/horses')}
              >
                <Text style={[styles.saveBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>{t('View Horses')}</Text>
              </Pressable>
            </View>

            {/* Invite queue */}
            {inviteQueue.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <View style={styles.inviteHeader}>
                  <View>
                    <Text style={[styles.inviteSectionTitle, { color: C.text, fontFamily: F.sansBold }]}>
                      {allSent ? '✓ All invites sent' : `Send Owner Invites (${pendingInvites} pending)`}
                    </Text>
                    <Text style={[styles.inviteSectionSub, { color: C.textMuted, fontFamily: F.sans }]}>
                      Owners will receive a link to download the app and set their password.
                    </Text>
                  </View>
                  {pendingInvites > 1 && (
                    <Pressable
                      style={({ hovered }: any) => [styles.sendAllBtn, { backgroundColor: C.primary }, hovered && { backgroundColor: C.primaryDark }]}
                      onPress={sendAllInvites}
                    >
                      <Text style={[styles.sendAllBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>Send All</Text>
                    </Pressable>
                  )}
                </View>

                {inviteQueue.map((row, i) => (
                  <View key={i} style={[styles.inviteRow, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                    <View style={styles.inviteInfo}>
                      <Text style={[styles.inviteHorse, { color: C.text, fontFamily: F.sansBold }]}>{row.horse_name}</Text>
                      <Text style={[styles.inviteOwner, { color: C.textMuted, fontFamily: F.sans }]}>{row.owner_name}</Text>
                      <Text style={[styles.inviteEmail, { color: C.primary, fontFamily: F.sans }]}>{row.owner_email}</Text>
                    </View>
                    {row.status === 'sent' ? (
                      <Text style={[styles.sentBadge, { color: '#7BA68A', fontFamily: F.sansBold }]}>✓ Sent</Text>
                    ) : row.status === 'error' ? (
                      <Pressable style={[styles.inviteBtn, { borderColor: C.error }]} onPress={() => sendInvite(i)}>
                        <Text style={[styles.inviteBtnText, { color: C.error, fontFamily: F.sansBold }]}>Retry</Text>
                      </Pressable>
                    ) : row.status === 'sending' ? (
                      <ActivityIndicator size="small" color={C.primary} />
                    ) : (
                      <Pressable style={({ hovered }: any) => [styles.inviteBtn, { borderColor: C.primary }, hovered && { backgroundColor: C.activeBg }]} onPress={() => sendInvite(i)}>
                        <Text style={[styles.inviteBtnText, { color: C.primary, fontFamily: F.sansBold }]}>Send Invite</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        )}

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

  templateCard: { borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  templateLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  templateIcon: { fontSize: 28 },
  templateTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  templateSub: { fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 16 },
  templateBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  templateBtnText: { fontSize: 13, fontWeight: '600' },

  formatCard: { borderWidth: 1, borderRadius: 10, padding: 16, marginBottom: 8 },
  formatTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  formatNote: { fontSize: 12, lineHeight: 20 },
  formatTip: { fontSize: 11, marginTop: 8, fontStyle: 'italic' },

  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  uploadBox: { borderWidth: 1, borderRadius: 10, padding: 24, alignItems: 'center' },
  uploadIcon: { fontSize: 32, marginBottom: 8 },
  uploadText: { fontSize: 13 },
  errorText: { fontSize: 13, marginTop: 16 },

  previewCard: { borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'flex-start', padding: 12, marginBottom: 8, gap: 12 },
  previewDot: { width: 36, height: 36, borderRadius: 8, marginTop: 2 },
  previewInfo: { flex: 1, gap: 2 },
  previewName: { fontSize: 14, fontWeight: '600', fontStyle: 'italic' },
  previewMeta: { fontSize: 11 },
  previewBreed: { fontSize: 11 },
  previewExtra: { fontSize: 11, marginTop: 2 },
  previewEmail: { fontSize: 11, marginTop: 2 },

  saveBtn: { padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 24 },
  saveBtnText: { fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },

  successCard: { borderRadius: 14, borderWidth: 1, padding: 32, alignItems: 'center', gap: 8 },
  successIcon: { fontSize: 48 },
  successTitle: { fontSize: 20, fontWeight: '600' },

  inviteHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 12 },
  inviteSectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  inviteSectionSub: { fontSize: 12, lineHeight: 18 },
  sendAllBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  sendAllBtnText: { fontSize: 13, fontWeight: '600' },

  inviteRow: { borderWidth: 1, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  inviteInfo: { flex: 1, gap: 2 },
  inviteHorse: { fontSize: 14, fontStyle: 'italic' },
  inviteOwner: { fontSize: 12 },
  inviteEmail: { fontSize: 12 },
  sentBadge: { fontSize: 13 },
  inviteBtn: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  inviteBtnText: { fontSize: 13, fontWeight: '600' },
});
