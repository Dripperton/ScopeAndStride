import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useProfile } from '../lib/useProfile';
import { useLanguage } from '../lib/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import HomeButton from '../lib/HomeButton';
import Brand from '../constants/brand';

// Used for invite form — includes 'rider' (stored in invites table, aliased to horse_owner in profiles)
const INVITE_ROLES = [
  { label: 'Barn Owner', value: 'owner', color: '#C9A85C', descriptionKey: 'Full access to everything' },
  { label: 'Staff', value: 'staff', color: '#7BA68A', descriptionKey: 'Can manage horses and schedule' },
  { label: 'Horse Owner', value: 'horse_owner', color: '#9A9285', descriptionKey: 'Can view their horse, billing, and schedule' },
  { label: 'Rider', value: 'rider', color: '#6B8CAE', descriptionKey: 'Access to schedule and horse care — no billing' },
];

// Used for existing-user role picker — must match profiles role DB constraint
const ROLES = [
  { label: 'Barn Owner', value: 'owner', color: '#C9A85C', descriptionKey: 'Full access to everything' },
  { label: 'Staff', value: 'staff', color: '#7BA68A', descriptionKey: 'Can manage horses and schedule' },
  { label: 'Horse Owner / Rider', value: 'horse_owner', color: '#9A9285', descriptionKey: 'Can view their horse, billing, and schedule' },
];

const RELATIONSHIPS = [
  { label: 'Owner', value: 'owner' },
  { label: 'Leasee / Rider', value: 'leasee' },
];

export default function ManageUsers() {
  const router = useRouter();
  const { profile, loading: profileLoading, isOwner } = useProfile();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const [users, setUsers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [horses, setHorses] = useState<any[]>([]);
  const [horseLinks, setHorseLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('staff');
  const [inviteHorseId, setInviteHorseId] = useState('');
  const [inviteRelationship, setInviteRelationship] = useState<'owner' | 'leasee'>('owner');
  const [inviteBillingContact, setInviteBillingContact] = useState(true);
  const [showHorseDropdown, setShowHorseDropdown] = useState(false);
  const [sending, setSending] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const scrollRef = useRef<any>(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    const [{ data: profilesData }, { data: invitesData }, { data: horsesData }, { data: linksData }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, role, created_at').order('created_at'),
      supabase.from('invites').select('*, horses(name)').eq('accepted', false).order('created_at', { ascending: false }),
      supabase.from('horses').select('id, name, owner').order('name'),
      supabase.from('horse_users').select('id, horse_id, user_id, relationship, billing_contact, horses(id, name), profiles(id, full_name, email, role)'),
    ]);
    if (profilesData) setUsers(profilesData);
    if (invitesData) setInvites(invitesData);
    if (horsesData) setHorses(horsesData);
    if (linksData) setHorseLinks(linksData);
    setLoading(false);
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setSending(true);
    const needsHorse = inviteRole === 'horse_owner' || inviteRole === 'rider';
    const effectiveRelationship = inviteRole === 'rider' ? 'leasee' : inviteRelationship;
    const { error } = await supabase.from('invites').insert({
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      created_by: profile?.id,
      horse_id: needsHorse && inviteHorseId ? inviteHorseId : null,
      relationship: needsHorse ? effectiveRelationship : null,
      billing_contact: needsHorse && inviteRole !== 'rider' ? inviteBillingContact : false,
    });
    if (error) {
      alert(t('Failed') + ': ' + error.message);
    } else {
      const { data: barnData } = await supabase.from('barn_settings').select('barn_name').single();
      await supabase.functions.invoke('send-invite', {
        body: { email: inviteEmail.trim().toLowerCase(), role: inviteRole, barnName: barnData?.barn_name },
      });
      setSuccessMsg(t('Invite sent to') + ' ' + inviteEmail.trim());
      setInviteEmail('');
      setInviteRole('staff');
      setInviteHorseId('');
      setInviteRelationship('owner');
      setInviteBillingContact(true);
      setShowInviteForm(false);
      fetchData();
    }
    setSending(false);
  }

  async function handleRoleChange(userId: string, newRole: string) {
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
  }

  async function handleAddLink(horseId: number, userId: string, relationship: 'owner' | 'leasee') {
    const { error } = await supabase.from('horse_users').insert({ horse_id: horseId, user_id: userId, relationship, billing_contact: false });
    if (error) { alert(error.message); return; }
    fetchData();
  }

  async function handleRemoveLink(linkId: string) {
    await supabase.from('horse_users').delete().eq('id', linkId);
    setHorseLinks(prev => prev.filter(l => l.id !== linkId));
  }

  async function handleRelationshipChange(linkId: string, relationship: string) {
    await supabase.from('horse_users').update({ relationship }).eq('id', linkId);
    setHorseLinks(prev => prev.map(l => l.id === linkId ? { ...l, relationship } : l));
  }

  async function handleBillingContactChange(linkId: string, horseId: number) {
    // Only one billing contact per horse — clear others first
    await supabase.from('horse_users').update({ billing_contact: false }).eq('horse_id', horseId);
    await supabase.from('horse_users').update({ billing_contact: true }).eq('id', linkId);
    setHorseLinks(prev => prev.map(l => l.horse_id === horseId ? { ...l, billing_contact: l.id === linkId } : l));
  }

  async function handleRemoveInvite(inviteId: string) {
    await supabase.from('invites').delete().eq('id', inviteId);
    setInvites(prev => prev.filter(i => i.id !== inviteId));
  }

  async function handleRemoveUser(userId: string, displayName: string) {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`Remove ${displayName} from the barn? This cannot be undone.`)
      : await new Promise<boolean>(resolve =>
          Alert.alert(
            t('Remove User'),
            `${t('Remove')} ${displayName} ${t('from the barn? This cannot be undone.')}`,
            [
              { text: t('Cancel'), style: 'cancel', onPress: () => resolve(false) },
              { text: t('Remove'), style: 'destructive', onPress: () => resolve(true) },
            ]
          )
        );
    if (!confirmed) return;
    const userToRemove = users.find(u => u.id === userId);
    await supabase.from('horse_users').delete().eq('user_id', userId);
    if (userToRemove?.email) {
      await supabase.from('invites').delete().eq('email', userToRemove.email);
    }
    await supabase.from('profiles').delete().eq('id', userId);
    setUsers(prev => prev.filter(u => u.id !== userId));
    setHorseLinks(prev => prev.filter(l => l.user_id !== userId));
  }

  async function handleResendInvite(invite: any) {
    const { data: barnData } = await supabase.from('barn_settings').select('barn_name').single();
    const { error } = await supabase.functions.invoke('send-invite', {
      body: { email: invite.email, role: invite.role, barnName: barnData?.barn_name },
    });
    if (error) {
      alert(t('Failed to resend') + ': ' + error.message);
    } else {
      setSuccessMsg(t('Invite resent to') + ' ' + invite.email);
    }
  }

  function getRoleInfo(role: string) {
    return INVITE_ROLES.find(r => r.value === role) || ROLES[1];
  }

  if (profileLoading) return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 80 }} />
    </View>
  );

  if (!isOwner) {
    return (
      <View style={[styles.container, { backgroundColor: C.background, alignItems: 'center', justifyContent: 'center', padding: 40 }]}>
        <Text style={{ fontSize: 16, color: C.textMuted, textAlign: 'center' }}>
          {t("You don't have permission to access this page.")}
        </Text>
      </View>
    );
  }

  const selectedInviteHorse = horses.find(h => String(h.id) === inviteHorseId);
  const needsHorseForm = inviteRole === 'horse_owner' || inviteRole === 'rider';
  const horseOwnerUsers = users.filter(u => u.role === 'horse_owner');

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <HomeButton />
        <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Manage Users')}</Text>
        <Pressable style={[styles.inviteBtn, { backgroundColor: C.secondaryAlpha15 }]} onPress={() => { setShowInviteForm(v => { if (!v) scrollRef.current?.scrollTo({ y: 0, animated: true }); return !v; }); }}>
          <Text style={[styles.inviteBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Invite')}</Text>
        </Pressable>
      </View>

      <ScrollView ref={scrollRef} style={styles.body} showsVerticalScrollIndicator={false}>

        {showInviteForm && (
          <View style={[styles.inviteForm, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <Text style={[styles.inviteFormTitle, { color: C.text, fontFamily: F.sansBold }]}>{t('Invite Someone')}</Text>
            <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('EMAIL ADDRESS')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="jane@example.com"
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('ROLE')}</Text>
            <View style={styles.roleSelector}>
              {INVITE_ROLES.map(r => (
                <Pressable
                  key={r.value}
                  style={[styles.roleOption, { borderColor: C.cardBorder }, inviteRole === r.value && { borderColor: r.color, backgroundColor: r.color + '11' }]}
                  onPress={() => { setInviteRole(r.value); setInviteHorseId(''); setInviteRelationship('owner'); }}
                >
                  <Text style={[styles.roleOptionLabel, { color: C.text }, inviteRole === r.value && { color: r.color }]}>{t(r.label)}</Text>
                  <Text style={[styles.roleOptionDesc, { color: C.textMuted }]}>{t(r.descriptionKey)}</Text>
                </Pressable>
              ))}
            </View>

            {needsHorseForm && (
              <View>
                <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('ASSIGN HORSE')}</Text>
                <Pressable style={[styles.dropdown, { backgroundColor: C.background, borderColor: C.cardBorder }]} onPress={() => setShowHorseDropdown(prev => !prev)}>
                  <Text style={[styles.dropdownText, { color: C.text }, !selectedInviteHorse && { color: C.textMuted }]}>
                    {selectedInviteHorse ? `${selectedInviteHorse.name} — ${selectedInviteHorse.owner}` : t('Select a horse...')}
                  </Text>
                  <Text style={[styles.dropdownChevron, { color: C.textMuted }]}>{showHorseDropdown ? '▲' : '▼'}</Text>
                </Pressable>
                {showHorseDropdown && (
                  <View style={[styles.dropdownList, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                    {horses.map(horse => (
                      <Pressable
                        key={horse.id}
                        style={[styles.dropdownItem, { borderBottomColor: C.cardSeparator }, String(horse.id) === inviteHorseId && { backgroundColor: C.activeBg }]}
                        onPress={() => { setInviteHorseId(String(horse.id)); setShowHorseDropdown(false); }}
                      >
                        <Text style={[styles.dropdownItemText, { color: C.text }, String(horse.id) === inviteHorseId && { color: C.primary, fontWeight: '600' }]}>
                          {horse.name} — {horse.owner}
                        </Text>
                        {String(horse.id) === inviteHorseId && <Text style={[styles.dropdownCheck, { color: C.primary }]}>✓</Text>}
                      </Pressable>
                    ))}
                  </View>
                )}

                {inviteRole !== 'rider' && (
                  <>
                    <Text style={[styles.fieldLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('RELATIONSHIP')}</Text>
                    <View style={styles.segmentRow}>
                      {RELATIONSHIPS.map(r => (
                        <Pressable
                          key={r.value}
                          style={[styles.segmentOption, { borderColor: C.cardBorder }, inviteRelationship === r.value && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                          onPress={() => setInviteRelationship(r.value as 'owner' | 'leasee')}
                        >
                          <Text style={[styles.segmentText, { color: C.textMuted }, inviteRelationship === r.value && { color: C.primary, fontWeight: '700' }]}>{t(r.label)}</Text>
                        </Pressable>
                      ))}
                    </View>

                    <Pressable style={styles.checkRow} onPress={() => setInviteBillingContact(v => !v)}>
                      <View style={[styles.checkbox, { borderColor: C.cardBorder }, inviteBillingContact && { backgroundColor: C.primary, borderColor: C.primary }]}>
                        {inviteBillingContact ? <Text style={[styles.checkmark, { color: C.card }]}>✓</Text> : null}
                      </View>
                      <Text style={[styles.checkLabel, { color: C.text }]}>{t('Billing contact for this horse')}</Text>
                    </Pressable>
                  </>
                )}
              </View>
            )}

            <View style={styles.inviteActions}>
              <Pressable style={[styles.cancelBtn, { borderColor: C.cardBorder }]} onPress={() => setShowInviteForm(false)}>
                <Text style={[styles.cancelBtnText, { color: C.textMuted, fontFamily: F.sansMedium }]}>{t('Cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.sendBtn, { backgroundColor: C.primary }, !inviteEmail.trim() && styles.sendBtnDisabled]}
                onPress={handleInvite}
                disabled={sending || !inviteEmail.trim()}
              >
                {sending ? <ActivityIndicator color="white" size="small" /> : <Text style={[styles.sendBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Send Invite')}</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {successMsg ? (
          <View style={[styles.successBanner, { backgroundColor: C.activeBg, borderColor: '#7BA68A' }]}>
            <Text style={[styles.successBannerText, { color: C.primary, fontFamily: F.sansMedium }]}>{successMsg}</Text>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 40 }} />
        ) : (
          <View>
            {/* Horse → Users section */}
            <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Horses & Linked Users')}</Text>
            {horses.map(horse => {
              const links = horseLinks.filter(l => l.horse_id === horse.id);
              return (
                <View key={horse.id} style={[styles.horseCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                  <Text style={[styles.horseCardName, { color: C.text, fontFamily: F.sansBold }]}>{horse.name}</Text>
                  {links.length === 0 ? (
                    <Text style={[styles.noLinksText, { color: C.cardBorder }]}>{t('No users linked')}</Text>
                  ) : (
                    links.map(link => (
                      <View key={link.id} style={[styles.linkRow, { borderTopColor: C.cardSeparator }]}>
                        <View style={styles.linkInfo}>
                          <Text style={[styles.linkName, { color: C.text, fontFamily: F.sansBold }]}>{link.profiles?.full_name || link.profiles?.email || '—'}</Text>
                          <View style={styles.linkMeta}>
                            <View style={styles.segmentRowSmall}>
                              {RELATIONSHIPS.map(r => (
                                <Pressable
                                  key={r.value}
                                  style={[styles.segmentOptionSmall, { borderColor: C.cardBorder }, link.relationship === r.value && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                                  onPress={() => handleRelationshipChange(link.id, r.value)}
                                >
                                  <Text style={[styles.segmentTextSmall, { color: C.textMuted }, link.relationship === r.value && { color: C.primary, fontWeight: '600' }]}>{t(r.label)}</Text>
                                </Pressable>
                              ))}
                            </View>
                            <Pressable
                              style={[styles.billingChip, { borderColor: C.cardBorder }, link.billing_contact && { borderColor: C.secondaryDark, backgroundColor: '#FDF5E6' }]}
                              onPress={() => !link.billing_contact && handleBillingContactChange(link.id, horse.id)}
                            >
                              <Text style={[styles.billingChipText, { color: C.textMuted }, link.billing_contact && { color: C.textWarm, fontWeight: '600' }]}>
                                {link.billing_contact ? t('Billing contact ✓') : t('Set as billing contact')}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                        <Pressable style={[styles.revokeBtn, { borderColor: C.cardBorder }]} onPress={() => handleRemoveLink(link.id)}>
                          <Text style={[styles.revokeBtnText, { color: C.error }]}>{t('Remove')}</Text>
                        </Pressable>
                      </View>
                    ))
                  )}
                  {/* Add any horse_owner not already linked to this horse */}
                  {(() => {
                    const addable = horseOwnerUsers.filter(u => !horseLinks.some(l => l.user_id === u.id && l.horse_id === horse.id));
                    if (addable.length === 0) return null;
                    return (
                      <View style={[styles.addLinkRow, { borderTopColor: C.cardSeparator }]}>
                        <Text style={[styles.addLinkLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Add user:')}</Text>
                        {addable.map(u => (
                          <Pressable key={u.id} style={[styles.addLinkBtn, { borderColor: C.primary }]} onPress={() => handleAddLink(horse.id, u.id, 'owner')}>
                            <Text style={[styles.addLinkBtnText, { color: C.primary, fontFamily: F.sansMedium }]}>{u.full_name || u.email}</Text>
                          </Pressable>
                        ))}
                      </View>
                    );
                  })()}
                </View>
              );
            })}

            {/* All users section */}
            <Text style={[styles.sectionTitle, { marginTop: 24, color: C.textMuted, fontFamily: F.sansBold }]}>{t('All Users')}</Text>
            {users.map(user => {
              const roleInfo = getRoleInfo(user.role);
              const isSelf = user.id === profile?.id;
              const userLinks = horseLinks.filter(l => l.user_id === user.id);
              return (
                <View key={user.id} style={[styles.userCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                  <View style={[styles.userAvatar, { backgroundColor: roleInfo.color + '22' }]}>
                    <Text style={[styles.userAvatarText, { color: roleInfo.color }]}>
                      {(user.full_name || user.email || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <View style={styles.userNameRow}>
                      <Text style={[styles.userName, { color: C.text, fontFamily: F.sansBold }]}>{user.full_name || user.email}</Text>
                      {isSelf ? <Text style={[styles.youBadge, { color: C.textMuted, backgroundColor: C.cardSeparator }]}>{t('you')}</Text> : null}
                    </View>
                    <Text style={[styles.userEmail, { color: C.textMuted }]}>{user.email}</Text>
                    {userLinks.map(l => (
                      <Text key={l.id} style={[styles.userHorse, { color: C.textWarm }]}>
                        🐴 {l.horses?.name} · {l.relationship === 'leasee' ? 'Leasee / Rider' : 'Owner'}{l.billing_contact ? ' · Billing' : ''}
                      </Text>
                    ))}
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
                          style={[styles.rolePickerOption, { borderColor: C.cardBorder }, user.role === r.value && { backgroundColor: r.color + '22', borderColor: r.color }]}
                          onPress={() => handleRoleChange(user.id, r.value)}
                        >
                          <Text style={[styles.rolePickerText, { color: C.textMuted }, user.role === r.value && { color: r.color, fontWeight: '600' }]}>{t(r.label)}</Text>
                        </Pressable>
                      ))}
                      <Pressable
                        style={[styles.rolePickerOption, { borderColor: C.error + '55', marginTop: 4 }]}
                        onPress={() => handleRemoveUser(user.id, user.full_name || user.email)}
                      >
                        <Text style={[styles.rolePickerText, { color: C.error }]}>{t('Remove')}</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}

            {invites.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>{t('Pending Invites')}</Text>
                {invites.map(invite => {
                  const roleInfo = getRoleInfo(invite.role);
                  return (
                    <View key={invite.id} style={[styles.userCard, { backgroundColor: C.card, borderColor: C.cardBorder, opacity: 0.8 }]}>
                      <View style={[styles.userAvatar, { backgroundColor: C.background }]}>
                        <Text style={{ fontSize: 18 }}>✉️</Text>
                      </View>
                      <View style={styles.userInfo}>
                        <Text style={[styles.userName, { color: C.text, fontFamily: F.sansBold }]}>{invite.email}</Text>
                        <Text style={[styles.userEmail, { color: C.textMuted }]}>{roleInfo.label}</Text>
                        {invite.role === 'horse_owner' && invite.horses?.name && (
                          <Text style={[styles.userHorse, { color: C.textWarm }]}>🐴 {invite.horses.name} · {invite.relationship === 'leasee' ? 'Leasee / Rider' : 'Owner'}</Text>
                        )}
                      </View>
                      <View style={styles.inviteActions2}>
                        <Pressable style={[styles.revokeBtn, { borderColor: C.primary }]} onPress={() => handleResendInvite(invite)}>
                          <Text style={[styles.revokeBtnText, { color: C.primary }]}>{t('Resend')}</Text>
                        </Pressable>
                        <Pressable style={[styles.revokeBtn, { borderColor: C.cardBorder }]} onPress={() => handleRemoveInvite(invite.id)}>
                          <Text style={[styles.revokeBtnText, { color: C.error }]}>{t('Revoke')}</Text>
                        </Pressable>
                      </View>
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
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  inviteBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6 },
  inviteBtnText: { fontSize: 13, fontWeight: '600' },
  body: { flex: 1, padding: 16 },
  inviteForm: { borderRadius: 14, padding: 20, marginBottom: 20, borderWidth: 1 },
  inviteFormTitle: { fontSize: 15, fontWeight: '600', marginBottom: 16 },
  fieldLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
  roleSelector: { gap: 8 },
  roleOption: { borderWidth: 1.5, borderRadius: 10, padding: 12 },
  roleOptionLabel: { fontSize: 13, fontWeight: '600' },
  roleOptionDesc: { fontSize: 11, marginTop: 2 },
  dropdown: { borderWidth: 1, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownText: { fontSize: 14, flex: 1 },
  dropdownChevron: { fontSize: 10 },
  dropdownList: { borderWidth: 1, borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  dropdownItemText: { fontSize: 14 },
  dropdownCheck: { fontSize: 13 },
  segmentRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  segmentOption: { flex: 1, borderWidth: 1.5, borderRadius: 8, padding: 10, alignItems: 'center' },
  segmentText: { fontSize: 13, fontWeight: '500' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkmark: { fontSize: 12, fontWeight: '700' },
  checkLabel: { fontSize: 13 },
  inviteActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '500' },
  sendBtn: { flex: 2, padding: 14, borderRadius: 10, alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { fontSize: 14, fontWeight: '600' },
  successBanner: { borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1 },
  successBannerText: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  horseCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  horseCardName: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  noLinksText: { fontSize: 12, fontStyle: 'italic', marginBottom: 8 },
  linkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderTopWidth: 1 },
  linkInfo: { flex: 1 },
  linkName: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  linkMeta: { gap: 6 },
  segmentRowSmall: { flexDirection: 'row', gap: 6 },
  segmentOptionSmall: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  segmentTextSmall: { fontSize: 11, fontWeight: '500' },
  billingChip: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  billingChipText: { fontSize: 11 },
  addLinkRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
  addLinkLabel: { fontSize: 11, fontWeight: '600' },
  addLinkBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  addLinkBtnText: { fontSize: 12, fontWeight: '500' },
  userCard: { borderRadius: 12, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  userAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { fontSize: 16, fontWeight: '700' },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: 14, fontWeight: '600' },
  youBadge: { fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  userEmail: { fontSize: 11, marginTop: 2 },
  userHorse: { fontSize: 11, marginTop: 3 },
  rolePill: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  rolePillText: { fontSize: 11, fontWeight: '600' },
  rolePickerWrap: { gap: 4 },
  rolePickerOption: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center' },
  rolePickerText: { fontSize: 10 },
  revokeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  revokeBtnText: { fontSize: 12 },
  inviteActions2: { flexDirection: 'column', gap: 6 },
});
