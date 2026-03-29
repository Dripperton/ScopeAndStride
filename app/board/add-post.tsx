import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Megaphone, MessageSquare } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../../lib/useProfile';

export default function AddPost() {
  const router = useRouter();
  const { profile, isOwner, isStaff } = useProfile();
  const [content, setContent] = useState('');
  const [type, setType] = useState('post');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!content.trim()) { setError('Please write something first.'); return; }
    if (!profile) return;
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('posts').insert({
      author_id: profile.id,
      content: content.trim(),
      type,
      pinned: false,
    });
    if (err) { setError(err.message); setSaving(false); return; }
    router.back();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>New Post</Text>
        <Pressable
          style={({ hovered }: any) => [styles.saveBtn, !content.trim() && styles.saveBtnDisabled, hovered && content.trim() && styles.saveBtnHovered]}
          onPress={handleSave}
          disabled={saving || !content.trim()}
        >
          {saving ? <ActivityIndicator color="#1A1A14" size="small" /> : <Text style={styles.saveBtnText}>Post</Text>}
        </Pressable>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {(isOwner || isStaff) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Post Type</Text>
            <View style={styles.typeRow}>
              <Pressable
                style={[styles.typeOption, type === 'post' && styles.typeOptionSelected]}
                onPress={() => setType('post')}
              >
                <MessageSquare size={18} color={type === 'post' ? '#2C4A35' : '#9A9285'} />
                <View>
                  <Text style={[styles.typeLabel, type === 'post' && styles.typeLabelSelected]}>Community Post</Text>
                  <Text style={styles.typeDesc}>Visible to everyone in the barn</Text>
                </View>
              </Pressable>
              <Pressable
                style={[styles.typeOption, type === 'announcement' && styles.typeOptionSelected, type === 'announcement' && styles.typeOptionAnnouncement]}
                onPress={() => setType('announcement')}
              >
                <Megaphone size={18} color={type === 'announcement' ? '#B08C4A' : '#9A9285'} />
                <View>
                  <Text style={[styles.typeLabel, type === 'announcement' && styles.typeLabelAnnouncement]}>Announcement</Text>
                  <Text style={styles.typeDesc}>Highlighted for the whole barn</Text>
                </View>
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(profile?.full_name || '?')[0].toUpperCase()}
              </Text>
            </View>
            <Text style={styles.authorName}>{profile?.full_name || 'You'}</Text>
          </View>
          <TextInput
            style={styles.contentInput}
            value={content}
            onChangeText={setContent}
            placeholder="Share something with the barn..."
            placeholderTextColor="#C4BAA8"
            multiline
            autoFocus
            maxLength={1000}
          />
          <Text style={styles.charCount}>{content.length}/1000</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnHovered: { backgroundColor: '#B08C4A' },
  saveBtnText: { color: '#1A1A14', fontSize: 13, fontWeight: '700' },
  body: { flex: 1, padding: 16 },
  section: { backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#E8E0CC', padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#9A9285', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  typeRow: { gap: 8 },
  typeOption: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: '#E8E0CC', borderRadius: 10, padding: 12 },
  typeOptionSelected: { borderColor: '#2C4A35', backgroundColor: '#EDF5EF' },
  typeOptionAnnouncement: { borderColor: '#C9A85C', backgroundColor: '#FFFDF7' },
  typeLabel: { fontSize: 13, fontWeight: '600', color: '#9A9285' },
  typeLabelSelected: { color: '#2C4A35' },
  typeLabelAnnouncement: { color: '#B08C4A' },
  typeDesc: { fontSize: 11, color: '#9A9285', marginTop: 1 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EDF5EF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#2C4A35' },
  authorName: { fontSize: 14, fontWeight: '600', color: '#1A1A14' },
  contentInput: { fontSize: 15, color: '#1A1A14', lineHeight: 22, minHeight: 120, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: '#C4BAA8', textAlign: 'right', marginTop: 8 },
  errorText: { color: '#8B2E2E', fontSize: 13, padding: 4 },
});
