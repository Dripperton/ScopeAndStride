import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useProfile } from '../lib/useProfile';

const ROLES = [
  { label: 'Barn Owner', value: 'owner', color: '#C9A85C', description: 'Full access to everything' },
  { label: 'Staff', value: 'staff', color: '#7BA68A', description: 'Can manage horses and schedule' },
  { label: 'Horse Owner', value: 'horse_owner', color: '#9A9285', description: 'Can view their horse and billing' },
];

export default function ManageUsers() {
  const router = useRouter();
  const { profile, loading: profileLoading, isOwner } = useProfile();
  const [users, setUsers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [horses, setHorses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('staff');
  const [inviteHorseId, setInviteHorseId] = useState('');
  const [showHorseDropdown, setShowHorseDropdown] = useState(false);
  const [sending, setSending] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    const [{ data: profilesData }, { data: invitesData }, { data: horsesData }] = await Promise.all([
      supabase.from('profiles').select('*, horses(name)').order('created_at'),
      supabase.from('invites').select('*, horses(name)').eq('accepted', false).order('created_at', { ascending: false }),
      supabase.from('horses').select('id, name, owner').order('name'),
    ]);
    if (profilesData) setUsers(profilesData);
    if (invitesData) setInvites(invitesData);
    if (horsesData) setHorses(horsesData);
    setLoading(false);
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setSending(true);
    const { error } = await supabase.from('invites').insert({
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      created_by: profile?.id,
      horse_id: inviteRole === 'horse_owner' && inviteHorseId ? inviteHorseId : null,
    });
    if (error) {
      alert('Failed: ' + error.message);
    } else {
      setSuccessMsg('Invite saved for ' + inviteEmail.trim());
      setInviteEmail('');
      setInviteRole('staff');
      setInviteHorseId('');
      setShowInviteForm(false);
      fetchData();
    }
    setSending(false);
  }

  async function handleRoleChange(userId: string, newRole: string) {
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
  }

  async function handleHorseChange(userId: string, newHorseId: string) {
    const horseIdVal = newHorseId || null;
    await supabase.from('profiles').update({ horse_id: horseIdVal }).eq('id', userId);
    const horse = horses.find(h => String(h.id) === newHorseId);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, horse_id: horseIdVal, horses: horse || null } : u));
  }

  async function handleRemoveInvite(inviteId: string) {
    await supabase.from('invites').delete().eq('id', inviteId);
    setInvites(prev => prev.filter(i => i.id !== inviteId));
  }

  function getRoleInfo(role: string) {
    return ROLES.find(r => r.value === role) || ROLES[1];
  }

  if (profileLoading) return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2C4A35" style={{ marginTop: 80 }} />
    </View>
  );

  const selectedInviteHorse = horses.find(h => String(h.id) === inviteHorseId);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Manage Users</Text>
        <Pressable
          style={styles.inviteBtn}
          onPress={() => setShowInviteForm(!showInviteForm)}
        >
          <Text style={styles.inviteBtnText}>Invite</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

        {showInviteForm && (
          <View style={styles.inviteForm}>
            <Text style={styles.inviteFormTitle}>Invite Someone</Text>
            <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
            <TextInput
              style={styles.input}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="jane@example.com"
              placeholderTextColor="#9A9285"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Text style={styles.fieldLabel}>ROLE</Text>
            <View style={styles.roleSelector}>
              {ROLES.map(r => (
                <Pressable
                  key={r.value}
                  style={[styles.roleOption, inviteRole === r.value && { borderColor: r.color, backgroundColor: r.color + '11' }]}
                  onPress={() => { setInviteRole(r.value); setInviteHorseId(''); }}
                >
                  <Text style={[styles.roleOptionLabel, inviteRole === r.value && { color: r.color }]}>{r.label}</Text>
                  <Text style={styles.roleOptionDesc}>{r.description}</Text>
                </Pressable>
              ))}
            </View>

            {/* Horse selector — only shown when horse_owner role is selected */}
            {inviteRole === 'horse_owner' && (
              <View>
                <Text style={styles.fieldLabel}>ASSIGN HORSE</Text>
                <Pressable
                  style={styles.dropdown}
                  onPress={() => setShowHorseDropdown(prev => !prev)}
                >
                  <Text style={[styles.dropdownText, !selectedInviteHorse && styles.dropdownPlaceholder]}>
                    {selectedInviteHorse ? `${selectedInviteHorse.name} — ${selectedInviteHorse.owner}` : 'Select a horse...'}
                  </Text>
                  <Text style={styles.dropdownChevron}>{showHorseDropdown ? '▲' : '▼'}</Text>
                </Pressable>
                {showHorseDropdown && (
                  <View style={styles.dropdownList}>
                    {horses.map(horse => (
                      <Pressable
                        key={horse.id}
                        style={[styles.dropdownItem, String(horse.id) === inviteHorseId && styles.dropdownItemSelected]}
                        onPress={() => { setInviteHorseId(String(horse.id)); setShowHorseDropdown(false); }}
                      >
                        <Text style={[styles.dropdownItemText, String(horse.id) === inviteHorseId && styles.dropdownItemTextSelected]}>
                          {horse.name} — {horse.owner}
                        </Text>
                        {String(horse.id) === inviteHorseId && <Text style={styles.dropdownCheck}>✓</Text>}
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}

            <View style={styles.inviteActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowInviteForm(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.sendBtn, !inviteEmail.trim() && styles.sendBtnDisabled]}
                onPress={handleInvite}
                disabled={sending || !inviteEmail.trim()}
              >
                {sending ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.sendBtnText}>Send Invite</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {successMsg ? (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>{successMsg}</Text>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator size="large" color="#2C4A35" style={{ marginTop: 40 }} />
        ) : (
          <View>
            <Text style={styles.sectionTitle}>Active Users</Text>
            {users.map(user => {
              const roleInfo = getRoleInfo(user.role);
              const isSelf = user.id === profile?.id;
              return (
                <View key={user.id} style={styles.userCard}>
                  <View style={[styles.userAvatar, { backgroundColor: roleInfo.color + '22' }]}>
                    <Text style={[styles.userAvatarText, { color: roleInfo.color }]}>
                      {(user.full_name || user.email || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <View style={styles.userNameRow}>
                      <Text style={styles.userName}>{user.full_name || user.email}</Text>
                      {isSelf ? <Text style={styles.youBadge}>you</Text> : null}
                    </View>
                    <Text style={styles.userEmail}>{user.email}</Text>
                    {/* Show linked horse for horse_owner users */}
                    {user.role === 'horse_owner' && (
                      <Text style={styles.userHorse}>
                        🐴 {user.horses?.name || 'No horse linked'}
                      </Text>
                    )}
                  </View>
                  {isSelf ? (
                    <View style={[styles.rolePill, { backgroundColor: roleInfo.color + '22', borderColor: roleInfo.color }]}>
                      <Text style={[styles.rolePillText, { color: roleInfo.color }]}>{roleInfo.label}</Text>
                    </View>
                  ) : (
                    <View style={styles.rolePickerWrap}>
                      {ROLES.map(r => (
                        <Pressable
                          key={r.value}
                          style={[styles.rolePickerOption, user.role === r.value && { backgroundColor: r.color + '22', borderColor: r.color }]}
                          onPress={() => handleRoleChange(user.id, r.value)}
                        >
                          <Text style={[styles.rolePickerText, user.role === r.value && { color: r.color, fontWeight: '600' }]}>{r.label}</Text>
                        </Pressable>
                      ))}
                      {/* Horse picker — only shown for horse_owner users */}
                      {user.role === 'horse_owner' && (
                        <View style={styles.horsePickerWrap}>
                          <Text style={styles.horsePickerLabel}>HORSE</Text>
                          <select
                            style={{ fontSize: 11, color: '#2C4A35', borderColor: '#E8E0CC', borderRadius: 6, padding: 4, backgroundColor: '#FAF7F2' }}
                            value={String(user.horse_id || '')}
                            onChange={e => handleHorseChange(user.id, e.target.value)}
                          >
                            <option value="">— unlinked —</option>
                            {horses.map(h => (
                              <option key={h.id} value={String(h.id)}>{h.name}</option>
                            ))}
                          </select>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            {invites.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <Text style={styles.sectionTitle}>Pending Invites</Text>
                {invites.map(invite => {
                  const roleInfo = getRoleInfo(invite.role);
                  return (
                    <View key={invite.id} style={[styles.userCard, { opacity: 0.8 }]}>
                      <View style={[styles.userAvatar, { backgroundColor: '#F5F1EA' }]}>
                        <Text style={{ fontSize: 18 }}>✉️</Text>
                      </View>
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{invite.email}</Text>
                        <Text style={styles.userEmail}>{roleInfo.label}</Text>
                        {invite.role === 'horse_owner' && (
                          <Text style={styles.userHorse}>🐴 {invite.horses?.name || 'No horse assigned'}</Text>
                        )}
                      </View>
                      <Pressable style={styles.revokeBtn} onPress={() => handleRemoveInvite(invite.id)}>
                        <Text style={styles.revokeBtnText}>Revoke</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={{ height: 40 }} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F2' },
  header: { backgroundColor: '#2C4A35', padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#C9A85C' },
  inviteBtn: { backgroundColor: 'rgba(201,168,92,0.15)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6 },
  inviteBtnText: { color: '#C9A85C', fontSize: 13, fontWeight: '600' },
  body: { flex: 1, padding: 16 },
  inviteForm: { backgroundColor: 'white', borderRadius: 14, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#E8E0CC' },
  inviteFormTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A14', marginBottom: 16 },
  fieldLabel: { fontSize: 10, fontWeight: '600', color: '#9A9285', letterSpacing: 1, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#FAF7F2', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 10, padding: 12, fontSize: 14, color: '#1A1A14' },
  roleSelector: { gap: 8 },
  roleOption: { borderWidth: 1.5, borderColor: '#E8E0CC', borderRadius: 10, padding: 12 },
  roleOptionLabel: { fontSize: 13, fontWeight: '600', color: '#3A3830' },
  roleOptionDesc: { fontSize: 11, color: '#9A9285', marginTop: 2 },
  dropdown: { backgroundColor: '#FAF7F2', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownText: { fontSize: 14, color: '#1A1A14', flex: 1 },
  dropdownPlaceholder: { color: '#9A9285' },
  dropdownChevron: { fontSize: 10, color: '#9A9285' },
  dropdownList: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F5F1EA' },
  dropdownItemSelected: { backgroundColor: '#EDF5EF' },
  dropdownItemText: { fontSize: 14, color: '#1A1A14' },
  dropdownItemTextSelected: { color: '#2C4A35', fontWeight: '600' },
  dropdownCheck: { fontSize: 13, color: '#2C4A35' },
  inviteActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E8E0CC', alignItems: 'center' },
  cancelBtnText: { fontSize: 14, color: '#9A9285', fontWeight: '500' },
  sendBtn: { flex: 2, padding: 14, borderRadius: 10, backgroundColor: '#2C4A35', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { fontSize: 14, color: '#C9A85C', fontWeight: '600' },
  successBanner: { backgroundColor: '#EDF5EF', borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#7BA68A' },
  successBannerText: { fontSize: 13, color: '#2C4A35', fontWeight: '500', textAlign: 'center' },
  sectionTitle: { fontSize: 11, fontWeight: '600', color: '#9A9285', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  userCard: { backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#E8E0CC', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  userAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { fontSize: 16, fontWeight: '700' },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: 14, fontWeight: '600', color: '#1A1A14' },
  youBadge: { fontSize: 10, color: '#9A9285', backgroundColor: '#F5F1EA', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  userEmail: { fontSize: 11, color: '#9A9285', marginTop: 2 },
  userHorse: { fontSize: 11, color: '#B08C4A', marginTop: 3 },
  rolePill: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  rolePillText: { fontSize: 11, fontWeight: '600' },
  rolePickerWrap: { gap: 4 },
  rolePickerOption: { borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center' },
  rolePickerText: { fontSize: 10, color: '#9A9285' },
  horsePickerWrap: { marginTop: 6, gap: 3 },
  horsePickerLabel: { fontSize: 9, fontWeight: '600', color: '#9A9285', letterSpacing: 0.8 },
  revokeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#E8E0CC' },
  revokeBtnText: { fontSize: 12, color: '#8B2E2E' },
});
