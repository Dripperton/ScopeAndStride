import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Megaphone, MessageSquare, Camera, Image as ImageIcon, FileText, X } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../../lib/useProfile';
import { pickImage, pickCamera, pickDocument, uploadAttachment, Attachment } from '../../lib/useAttachments';
import { useLanguage } from '../../lib/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import HomeButton from '../../lib/HomeButton';

export default function AddPost() {
  const router = useRouter();
  const { profile, isOwner, isStaff } = useProfile();
  const { t } = useLanguage();
  const theme = useTheme(); const C = theme.colors; const F = theme.fonts;
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
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <HomeButton />
        <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{t('New Post')}</Text>
        <Pressable
          style={({ hovered }: any) => [styles.saveBtn, (!content.trim() && attachments.length === 0) && styles.saveBtnDisabled, hovered && (content.trim() || attachments.length > 0) && styles.saveBtnHovered]}
          onPress={handleSave}
          disabled={saving || (!content.trim() && attachments.length === 0)}
        >
          {saving
            ? <ActivityIndicator color="#1A1A14" size="small" />
            : <Text style={[styles.saveBtnText, { fontFamily: F.sansBold }]}>{t('Post')}</Text>
          }
        </Pressable>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {(isOwner || isStaff) && (
          <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>Post Type</Text>
            <View style={styles.typeRow}>
              <Pressable
                style={[styles.typeOption, { borderWidth: 1.5, borderColor: C.cardBorder }, type === 'post' && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                onPress={() => setType('post')}
              >
                <MessageSquare size={18} color={type === 'post' ? C.primary : C.textMuted} />
                <View>
                  <Text style={[styles.typeLabel, { color: C.textMuted, fontFamily: F.sansBold }, type === 'post' && { color: C.primary }]}>Community Post</Text>
                  <Text style={[styles.typeDesc, { color: C.textMuted, fontFamily: F.sans }]}>Visible to everyone in the barn</Text>
                </View>
              </Pressable>
              <Pressable
                style={[styles.typeOption, { borderWidth: 1.5, borderColor: C.cardBorder }, type === 'announcement' && { borderColor: C.secondary, backgroundColor: '#FFFDF7' }]}
                onPress={() => setType('announcement')}
              >
                <Megaphone size={18} color={type === 'announcement' ? '#B08C4A' : C.textMuted} />
                <View>
                  <Text style={[styles.typeLabel, { color: C.textMuted, fontFamily: F.sansBold }, type === 'announcement' && { color: C.text }]}>Announcement</Text>
                  <Text style={[styles.typeDesc, { color: C.textMuted, fontFamily: F.sans }]}>Highlighted for the whole barn</Text>
                </View>
              </Pressable>
            </View>
          </View>
        )}

        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <View style={styles.authorRow}>
            <View style={[styles.avatar, { backgroundColor: C.activeBg }]}>
              <Text style={[styles.avatarText, { color: C.primary, fontFamily: F.sansBold }]}>
                {(profile?.full_name || '?')[0].toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.authorName, { color: C.text, fontFamily: F.sansBold }]}>{profile?.full_name || 'You'}</Text>
          </View>
          <TextInput
            style={[styles.contentInput, { color: C.text, fontFamily: F.sans }]}
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
          <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>Attachments ({attachments.length})</Text>
            {attachments.map((att, index) => (
              <View key={index} style={styles.attachmentPreview}>
                {att.type === 'image' || att.type === 'gif' ? (
                  <Image source={{ uri: att.uri }} style={[styles.attachmentImage, { backgroundColor: C.cardSeparator }]} />
                ) : (
                  <View style={[styles.attachmentPdf, { backgroundColor: C.cardSeparator }]}>
                    <FileText size={24} color={C.primary} />
                    <Text style={[styles.attachmentFilename, { color: C.primary, fontFamily: F.sansMedium }]} numberOfLines={1}>{att.filename}</Text>
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
        <View style={[styles.section, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: C.textMuted, fontFamily: F.sansBold }]}>Add Attachment</Text>
          <View style={styles.attachmentBtns}>
            <Pressable
              style={({ hovered }: any) => [styles.attachBtn, { borderColor: C.cardBorder }, hovered && { borderColor: C.primary, backgroundColor: C.activeBg }]}
              onPress={handlePickImage}
            >
              <ImageIcon size={20} color={C.primary} />
              <Text style={[styles.attachBtnText, { color: C.primary, fontFamily: F.sansMedium }]}>Photo</Text>
            </Pressable>
            {Platform.OS !== 'web' && (
              <Pressable
                style={({ hovered }: any) => [styles.attachBtn, { borderColor: C.cardBorder }, hovered && { borderColor: C.primary, backgroundColor: C.activeBg }]}
                onPress={handlePickCamera}
              >
                <Camera size={20} color={C.primary} />
                <Text style={[styles.attachBtnText, { color: C.primary, fontFamily: F.sansMedium }]}>Camera</Text>
              </Pressable>
            )}
            <Pressable
              style={({ hovered }: any) => [styles.attachBtn, { borderColor: C.cardBorder }, hovered && { borderColor: C.primary, backgroundColor: C.activeBg }]}
              onPress={handlePickDocument}
            >
              <FileText size={20} color={C.primary} />
              <Text style={[styles.attachBtnText, { color: C.primary, fontFamily: F.sansMedium }]}>PDF</Text>
            </Pressable>
          </View>
          <Text style={[styles.attachNote, { fontFamily: F.sans }]}>GIFs are automatically detected from your photo library.</Text>
        </View>

        {uploadProgress ? (
          <View style={[styles.uploadProgress, { backgroundColor: C.activeBg }]}>
            <ActivityIndicator size="small" color={C.primary} />
            <Text style={[styles.uploadProgressText, { color: C.primary, fontFamily: F.sans }]}>{uploadProgress}</Text>
          </View>
        ) : null}

        {error ? <Text style={[styles.errorText, { color: C.error }]}>{error}</Text> : null}
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
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnHovered: {},
  saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  body: { flex: 1, padding: 16 },
  section: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  typeRow: { gap: 8 },
  typeOption: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 10, padding: 12 },
  typeLabel: { fontSize: 13, fontWeight: '600' },
  typeDesc: { fontSize: 11, marginTop: 1 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700' },
  authorName: { fontSize: 14, fontWeight: '600' },
  contentInput: { fontSize: 15, lineHeight: 22, minHeight: 100, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: '#C4BAA8', textAlign: 'right', marginTop: 8 },
  attachmentPreview: { position: 'relative', marginBottom: 10 },
  attachmentImage: { width: '100%', height: 200, borderRadius: 10 },
  attachmentPdf: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, padding: 14 },
  attachmentFilename: { fontSize: 13, fontWeight: '500', flex: 1 },
  removeAttachment: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  attachmentBtns: { flexDirection: 'row', gap: 10 },
  attachBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderRadius: 10, padding: 12 },
  attachBtnText: { fontSize: 13, fontWeight: '500' },
  attachNote: { fontSize: 11, color: '#C4BAA8', marginTop: 10, textAlign: 'center' },
  uploadProgress: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, marginBottom: 12 },
  uploadProgressText: { fontSize: 13 },
  errorText: { fontSize: 13, padding: 4 },

});
