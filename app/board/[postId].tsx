import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pin, Trash2, FileText } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../../lib/useProfile';
import { useLanguage } from '../../lib/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { formatRelativeDate, getRoleLabel as _getRoleLabel } from '../../lib/dateUtils';

export default function PostDetail() {
  const router = useRouter();
  const { postId } = useLocalSearchParams();
  const { profile, isOwner, isStaff } = useProfile();
  const { t } = useLanguage();
  const theme = useTheme(); const C = theme.colors; const F = theme.fonts;
  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    fetchPost();
  }, [postId]);

  async function fetchPost() {
    const [{ data: postData }, { data: commentsData }] = await Promise.all([
      supabase.from('posts').select('*, profiles(full_name, role), post_reactions(id, user_id), post_attachments(id, url, type, filename)').eq('id', postId).single(),
      supabase.from('post_comments').select('*, profiles(full_name, role), comment_reactions(id, user_id)').eq('post_id', postId).order('created_at', { ascending: true }),
    ]);
    if (postData) setPost(postData);
    if (commentsData) setComments(commentsData);
    setLoading(false);
  }

  async function handleComment() {
    if (!comment.trim() || !profile) return;
    setPosting(true);
    const { data, error } = await supabase.from('post_comments').insert({
      post_id: postId,
      author_id: profile.id,
      content: comment.trim(),
    }).select('*, profiles(full_name, role)').single();
    if (!error && data) {
      setComments(prev => [...prev, data]);
      setComment('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
    setPosting(false);
  }

  async function handleDeletePost() {
    if (Platform.OS === 'web') {
      if (!confirm('Delete this post and all its comments?')) return;
    } else {
      try {
        await new Promise<void>((resolve, reject) => {
          Alert.alert('Delete Post', 'This will also delete all comments. Are you sure?', [
            { text: 'Cancel', style: 'cancel', onPress: () => reject() },
            { text: 'Delete', style: 'destructive', onPress: () => resolve() },
          ]);
        });
      } catch { return; }
    }
    await supabase.from('posts').delete().eq('id', postId);
    router.back();
  }

  async function handleDeleteComment(commentId: string) {
    if (Platform.OS === 'web') {
      if (!confirm('Delete this comment?')) return;
    } else {
      try {
        await new Promise<void>((resolve, reject) => {
          Alert.alert('Delete Comment', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel', onPress: () => reject() },
            { text: 'Delete', style: 'destructive', onPress: () => resolve() },
          ]);
        });
      } catch { return; }
    }
    await supabase.from('post_comments').delete().eq('id', commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
  }

  async function handlePin() {
    await supabase.from('posts').update({ pinned: !post.pinned }).eq('id', postId);
    setPost((prev: any) => ({ ...prev, pinned: !prev.pinned }));
  }

  async function handleLike() {
    if (!profile) return;
    const hasLiked = (post.post_reactions || []).some((r: any) => r.user_id === profile.id);
    if (hasLiked) {
      await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', profile.id);
      setPost((prev: any) => ({ ...prev, post_reactions: prev.post_reactions.filter((r: any) => r.user_id !== profile.id) }));
    } else {
      const { data } = await supabase.from('post_reactions').insert({ post_id: postId, user_id: profile.id }).select().single();
      if (data) setPost((prev: any) => ({ ...prev, post_reactions: [...(prev.post_reactions || []), data] }));
    }
  }

  async function handleLikeComment(comment: any) {
    if (!profile) return;
    const hasLiked = (comment.comment_reactions || []).some((r: any) => r.user_id === profile.id);
    if (hasLiked) {
      await supabase.from('comment_reactions').delete().eq('comment_id', comment.id).eq('user_id', profile.id);
      setComments(prev => prev.map(c => c.id === comment.id
        ? { ...c, comment_reactions: c.comment_reactions.filter((r: any) => r.user_id !== profile.id) }
        : c
      ));
    } else {
      const { data } = await supabase.from('comment_reactions').insert({ comment_id: comment.id, user_id: profile.id }).select().single();
      if (data) {
        setComments(prev => prev.map(c => c.id === comment.id
          ? { ...c, comment_reactions: [...(c.comment_reactions || []), data] }
          : c
        ));
      }
    }
  }

  const formatDate = (dateStr: string) => formatRelativeDate(dateStr, t);
  const getRoleLabel = (role: string) => _getRoleLabel(role, t);

  const canDeletePost = isOwner || isStaff || post?.author_id === profile?.id;
  const canPin = isOwner || isStaff;

  if (loading) return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 80 }} />
    </View>
  );

  if (!post) return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <Text style={{ padding: 40, color: C.textMuted, textAlign: 'center', fontFamily: F.sans }}>Post not found.</Text>
    </View>
  );

  const isAnnouncement = post.type === 'announcement';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: C.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backText, { fontFamily: F.sans }]}>← {t('Board')}</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: C.headerText, fontFamily: F.sansBold }]}>{isAnnouncement ? t('Announcement') : t('Post')}</Text>
        <View style={styles.headerActions}>
          {canPin && (
            <Pressable
              style={({ hovered }: any) => [styles.headerIconBtn, hovered && styles.headerIconBtnHovered]}
              onPress={handlePin}
            >
              <Pin size={16} color={post.pinned ? C.secondary : 'rgba(255,255,255,0.5)'} fill={post.pinned ? C.secondary : 'none'} />
            </Pressable>
          )}
          {canDeletePost && (
            <Pressable
              style={({ hovered }: any) => [styles.headerIconBtn, hovered && styles.headerIconBtnHovered]}
              onPress={handleDeletePost}
            >
              <Trash2 size={16} color="rgba(255,255,255,0.5)" />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView ref={scrollRef} style={styles.body} showsVerticalScrollIndicator={false}>
        {/* Post */}
        <View style={[styles.postCard, { backgroundColor: C.card, borderColor: C.cardBorder }, isAnnouncement && { borderColor: C.secondary, backgroundColor: '#FFFDF7' }]}>
          <View style={styles.postHeader}>
            <View style={[styles.avatar, { backgroundColor: C.activeBg }, isAnnouncement && { backgroundColor: C.secondaryAlpha15 }]}>
              <Text style={[styles.avatarText, { color: C.primary, fontFamily: F.sansBold }, isAnnouncement && { color: C.headerText }]}>
                {(post.profiles?.full_name || '?')[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.postMeta}>
              <View style={styles.postMetaTop}>
                <Text style={[styles.postAuthor, { color: C.text, fontFamily: F.sansBold }]}>{post.profiles?.full_name || 'Unknown'}</Text>
                {isAnnouncement && (
                  <View style={[styles.announcementBadge, { backgroundColor: C.secondaryAlpha15 }]}>
                    <Text style={[styles.announcementBadgeText, { color: C.text, fontFamily: F.sansBold }]}>{t('Announcement')}</Text>
                  </View>
                )}
                {post.pinned && (
                  <View style={[styles.pinnedBadge, { backgroundColor: C.warningBg }]}>
                    <Pin size={10} color="#B08C4A" fill="#B08C4A" />
                    <Text style={[styles.pinnedBadgeText, { color: C.text, fontFamily: F.sansBold }]}>{t('Pinned')}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.postMetaSub, { color: C.textMuted, fontFamily: F.sans }]}>
                {getRoleLabel(post.profiles?.role)} · {formatDate(post.created_at)}
              </Text>
            </View>
          </View>
          <Text style={[styles.postContent, { color: C.text, fontFamily: F.sans }]}>{post.content}</Text>
          {/* Attachments */}
          {(post.post_attachments || []).length > 0 && (
            <View style={styles.detailAttachments}>
              {post.post_attachments.map((att: any) => (
                att.type === 'image' || att.type === 'gif' ? (
                  <Image key={att.id} source={{ uri: att.url }} style={[styles.detailAttachImage, { backgroundColor: C.cardSeparator }]} resizeMode="cover" />
                ) : (
                  <Pressable
                    key={att.id}
                    style={({ hovered }: any) => [styles.detailAttachPdf, { backgroundColor: C.cardSeparator }, hovered && { backgroundColor: C.activeBg }]}
                    onPress={() => Linking.openURL(att.url)}
                  >
                    <FileText size={20} color={C.primary} />
                    <Text style={[styles.detailAttachPdfName, { color: C.primary, fontFamily: F.sansMedium }]} numberOfLines={2}>{att.filename || 'Document'}</Text>
                    <Text style={[styles.detailAttachPdfOpen, { color: C.textMuted, fontFamily: F.sans }]}>Open →</Text>
                  </Pressable>
                )
              ))}
            </View>
          )}

          <View style={[styles.postActions, { borderTopColor: C.cardSeparator }]}>
            <Pressable
              style={({ hovered }: any) => [styles.likeBtn, (post.post_reactions || []).some((r: any) => r.user_id === profile?.id) && styles.likeBtnActive, hovered && { backgroundColor: C.cardSeparator }]}
              onPress={handleLike}
            >
              <Text style={[(post.post_reactions || []).some((r: any) => r.user_id === profile?.id) ? styles.likeIconActive : styles.likeIcon]}>♥</Text>
              <Text style={[(post.post_reactions || []).some((r: any) => r.user_id === profile?.id) ? styles.likeCountActive : [styles.likeCount, { color: C.textMuted }]]}>
                {post.post_reactions?.length > 0 ? `${post.post_reactions.length} like${post.post_reactions.length !== 1 ? 's' : ''}` : 'Like'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Comments */}
        {comments.length > 0 && (
          <View style={[styles.commentsSection, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <Text style={[styles.commentsLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>{comments.length} Comment{comments.length !== 1 ? 's' : ''}</Text>
            {comments.map((c, index) => {
              const isCommentAuthor = c.author_id === profile?.id;
              const canDelete = isOwner || isStaff || isCommentAuthor;
              const isLast = index === comments.length - 1;
              return (
                <View key={c.id} style={[styles.commentRow, { borderBottomColor: C.cardSeparator }, isLast && styles.commentRowLast]}>
                  <View style={[styles.commentAvatar, { backgroundColor: C.cardSeparator }]}>
                    <Text style={[styles.commentAvatarText, { color: C.textMuted, fontFamily: F.sansBold }]}>
                      {(c.profiles?.full_name || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.commentContent}>
                    <View style={styles.commentHeader}>
                      <Text style={[styles.commentAuthor, { color: C.text, fontFamily: F.sansBold }]}>{c.profiles?.full_name || 'Unknown'}</Text>
                      <Text style={styles.commentTime}>{formatDate(c.created_at)}</Text>
                    </View>
                    <Text style={[styles.commentText, { color: C.text, fontFamily: F.sans }]}>{c.content}</Text>
                  </View>
                  <View style={styles.commentActions}>
                    <Pressable
                      style={({ hovered }: any) => [styles.commentLikeBtn, (c.comment_reactions || []).some((r: any) => r.user_id === profile?.id) && styles.commentLikeBtnActive, hovered && { backgroundColor: C.cardSeparator }]}
                      onPress={() => handleLikeComment(c)}
                    >
                      <Text style={(c.comment_reactions || []).some((r: any) => r.user_id === profile?.id) ? styles.commentLikeIconActive : styles.commentLikeIcon}>♥</Text>
                      {(c.comment_reactions || []).length > 0 && (
                        <Text style={(c.comment_reactions || []).some((r: any) => r.user_id === profile?.id) ? styles.commentLikeCountActive : [styles.commentLikeCount, { color: C.textMuted }]}>
                          {c.comment_reactions.length}
                        </Text>
                      )}
                    </Pressable>
                    {canDelete && (
                      <Pressable
                        style={({ hovered }: any) => [styles.deleteCommentBtn, hovered && styles.deleteCommentBtnHovered]}
                        onPress={() => handleDeleteComment(c.id)}
                      >
                        <Trash2 size={13} color="#C4BAA8" />
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Comment input */}
      <View style={[styles.commentInputWrap, { backgroundColor: C.card, borderTopColor: C.cardBorder }]}>
        <View style={[styles.commentInputAvatar, { backgroundColor: C.activeBg }]}>
          <Text style={[styles.commentInputAvatarText, { color: C.primary, fontFamily: F.sansBold }]}>
            {(profile?.full_name || '?')[0].toUpperCase()}
          </Text>
        </View>
        <TextInput
          style={[styles.commentInput, { backgroundColor: C.background, borderColor: C.cardBorder, color: C.text, fontFamily: F.sans }]}
          value={comment}
          onChangeText={setComment}
          placeholder={t('Write a comment...')}
          placeholderTextColor="#C4BAA8"
          multiline
          maxLength={500}
        />
        <Pressable
          style={({ hovered }: any) => [styles.sendBtn, { backgroundColor: C.primary }, !comment.trim() && styles.sendBtnDisabled, hovered && comment.trim() && { backgroundColor: C.primaryDark }]}
          onPress={handleComment}
          disabled={posting || !comment.trim()}
        >
          {posting ? <ActivityIndicator size="small" color="white" /> : <Text style={[styles.sendBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Post')}</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerIconBtn: { padding: 8, borderRadius: 6 },
  headerIconBtnHovered: { backgroundColor: 'rgba(255,255,255,0.1)' },
  body: { flex: 1 },
  postCard: { margin: 16, marginBottom: 0, borderRadius: 14, borderWidth: 1, padding: 16 },
  postHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700' },
  postMeta: { flex: 1 },
  postMetaTop: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  postAuthor: { fontSize: 14, fontWeight: '600' },
  announcementBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  announcementBadgeText: { fontSize: 10, fontWeight: '600' },
  pinnedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  pinnedBadgeText: { fontSize: 10, fontWeight: '600' },
  postMetaSub: { fontSize: 11, marginTop: 2 },
  postContent: { fontSize: 15, lineHeight: 23 },
  commentsSection: { margin: 16, marginTop: 12, borderRadius: 14, borderWidth: 1, padding: 16 },
  commentsLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 },
  commentRow: { flexDirection: 'row', gap: 10, paddingBottom: 14, marginBottom: 14, borderBottomWidth: 1 },
  commentRowLast: { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0 },
  commentAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  commentAvatarText: { fontSize: 12, fontWeight: '700' },
  commentContent: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  commentAuthor: { fontSize: 13, fontWeight: '600' },
  commentTime: { fontSize: 11, color: '#C4BAA8' },
  commentText: { fontSize: 13, lineHeight: 19 },
  commentActions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  commentLikeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  commentLikeBtnActive: { backgroundColor: '#FEF0F0' },
  commentLikeIcon: { fontSize: 12, color: '#C4BAA8' },
  commentLikeIconActive: { fontSize: 12, color: '#C0392B' },
  commentLikeCount: { fontSize: 11 },
  commentLikeCountActive: { fontSize: 11, color: '#C0392B', fontWeight: '600' },
  deleteCommentBtn: { padding: 4, borderRadius: 4 },
  deleteCommentBtnHovered: { backgroundColor: '#FFF5F5' },
  detailAttachments: { gap: 10, marginTop: 14 },
  detailAttachImage: { width: '100%', aspectRatio: 4/3, borderRadius: 10 },
  detailAttachPdf: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, padding: 14 },
  detailAttachPdfName: { flex: 1, fontSize: 13, fontWeight: '500' },
  detailAttachPdfOpen: { fontSize: 12 },
  postActions: { flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: 1 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  likeBtnActive: { backgroundColor: '#FEF0F0' },
  likeIcon: { fontSize: 15, color: '#C4BAA8' },
  likeIconActive: { fontSize: 15, color: '#C0392B' },
  likeCount: { fontSize: 13, fontWeight: '500' },
  likeCountActive: { fontSize: 13, color: '#C0392B', fontWeight: '600' },
  commentInputWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, paddingBottom: 28, borderTopWidth: 1 },
  commentInputAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  commentInputAvatarText: { fontSize: 12, fontWeight: '700' },
  commentInput: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
  sendBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { fontSize: 13, fontWeight: '600' },

  homeBtn: { width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  homeBtnHovered: { backgroundColor: 'rgba(255,255,255,0.32)' },
});
