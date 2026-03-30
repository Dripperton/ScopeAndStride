import { Home, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Megaphone, MessageSquare, Camera, Image as ImageIcon, FileText, X } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../../lib/useProfile';
import { pickImage, pickCamera, pickDocument, uploadAttachment, Attachment } from '../../lib/useAttachments';

export default function AddPost() {
  const router = useRouter();
  const { profile, isOwner, isStaff } = useProfile();
  const [content, setContent] = useState('');
  const [type, setType] = useState('post');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState('');

  async function handlePickImage() {
    const attachment = await pickImage();
    if (attachment) setAttachments(prev => [...prev, attachment]);
  }

  async function handlePickCamera() {
    const attachment = await pickCamera();
    if (attachment) setAttachments(prev => [...prev, attachment]);
  }

  async function handlePickDocument() {
    const attachment = await pickDocument();
    if (attachment) setAttachments(prev => [...prev, attachment]);
  }

  function removeAttachment(index: number) {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!content.trim() && attachments.length === 0) {
      setError('Please write something or add an attachment.');
      return;
    }
    if (!profile) return;
    setSaving(true);
    setError('');

    // Create the post first
    const { data: post, error: postErr } = await supabase.from('posts').insert({
      author_id: profile.id,
      content: content.trim(),
      type,
      pinned: false,
    }).select().single();

    if (postErr || !post) {
      setError(postErr?.message || 'Failed to create post');
      setSaving(false);
      return;
    }

    // Upload attachments
    if (attachments.length > 0) {
      for (let i = 0; i < attachments.length; i++) {
        setUploadProgress(`Uploading ${i + 1} of ${attachments.length}...`);
        const url = await uploadAttachment(attachments[i], post.id);
        if (url) {
          await supabase.from('post_attachments').insert({
            post_id: post.id,
            url,
            type: attachments[i].type,
            filename: attachments[i].filename,
          });
        } else {
          setError(`Failed to upload ${attachments[i].filename} — check console for details`);
          setSaving(false);
          setUploadProgress('');
          return;
        }
      }
    }

    setSaving(false);
    setUploadProgress('');
    router.back();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={({ hovered }: any) => [styles.homeBtn, hovered && styles.homeBtnHovered]} onPress={() => router.push('/dashboard')}><Home size={18} color="#C9A85C" /></Pressable>
        <Text style={styles.headerTitle}>New Post</Text>
        <Pressable
          style={({ hovered }: any) => [styles.saveBtn, (!content.trim() && attachments.length === 0) && styles.saveBtnDisabled, hovered && (content.trim() || attachments.length > 0) && styles.saveBtnHovered]}
          onPress={handleSave}
          disabled={saving || (!content.trim() && attachments.length === 0)}
        >
          {saving
            ? <ActivityIndicator color="#1A1A14" size="small" />
            : <Text style={styles.saveBtnText}>Post</Text>
          }
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

        {/* Attachment previews */}
        {attachments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Attachments ({attachments.length})</Text>
            {attachments.map((att, index) => (
              <View key={index} style={styles.attachmentPreview}>
                {att.type === 'image' || att.type === 'gif' ? (
                  <Image source={{ uri: att.uri }} style={styles.attachmentImage} />
                ) : (
                  <View style={styles.attachmentPdf}>
                    <FileText size={24} color="#2C4A35" />
                    <Text style={styles.attachmentFilename} numberOfLines={1}>{att.filename}</Text>
                  </View>
                )}
                <Pressable
                  style={styles.removeAttachment}
                  onPress={() => removeAttachment(index)}
                >
                  <X size={14} color="white" />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Attachment buttons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Attachment</Text>
          <View style={styles.attachmentBtns}>
            <Pressable
              style={({ hovered }: any) => [styles.attachBtn, hovered && styles.attachBtnHovered]}
              onPress={handlePickImage}
            >
              <ImageIcon size={20} color="#2C4A35" />
              <Text style={styles.attachBtnText}>Photo</Text>
            </Pressable>
            {Platform.OS !== 'web' && (
              <Pressable
                style={({ hovered }: any) => [styles.attachBtn, hovered && styles.attachBtnHovered]}
                onPress={handlePickCamera}
              >
                <Camera size={20} color="#2C4A35" />
                <Text style={styles.attachBtnText}>Camera</Text>
              </Pressable>
            )}
            <Pressable
              style={({ hovered }: any) => [styles.attachBtn, hovered && styles.attachBtnHovered]}
              onPress={handlePickDocument}
            >
              <FileText size={20} color="#2C4A35" />
              <Text style={styles.attachBtnText}>PDF</Text>
            </Pressable>
          </View>
          <Text style={styles.attachNote}>GIFs are automatically detected from your photo library.</Text>
        </View>

        {uploadProgress ? (
          <View style={styles.uploadProgress}>
            <ActivityIndicator size="small" color="#2C4A35" />
            <Text style={styles.uploadProgressText}>{uploadProgress}</Text>
          </View>
        ) : null}

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
  contentInput: { fontSize: 15, color: '#1A1A14', lineHeight: 22, minHeight: 100, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: '#C4BAA8', textAlign: 'right', marginTop: 8 },
  attachmentPreview: { position: 'relative', marginBottom: 10 },
  attachmentImage: { width: '100%', height: 200, borderRadius: 10, backgroundColor: '#F5F1EA' },
  attachmentPdf: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F5F1EA', borderRadius: 10, padding: 14 },
  attachmentFilename: { fontSize: 13, color: '#2C4A35', fontWeight: '500', flex: 1 },
  removeAttachment: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  attachmentBtns: { flexDirection: 'row', gap: 10 },
  attachBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: '#E8E0CC', borderRadius: 10, padding: 12 },
  attachBtnHovered: { borderColor: '#2C4A35', backgroundColor: '#EDF5EF' },
  attachBtnText: { fontSize: 13, color: '#2C4A35', fontWeight: '500' },
  attachNote: { fontSize: 11, color: '#C4BAA8', marginTop: 10, textAlign: 'center' },
  uploadProgress: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#EDF5EF', borderRadius: 10, marginBottom: 12 },
  uploadProgressText: { fontSize: 13, color: '#2C4A35' },
  errorText: { color: '#8B2E2E', fontSize: 13, padding: 4 },

  homeBtn: { width: 32, height: 32, backgroundColor: 'rgba(201,168,92,0.15)', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  homeBtnHovered: { backgroundColor: 'rgba(201,168,92,0.3)' },
});
