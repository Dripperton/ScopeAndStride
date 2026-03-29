import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pin, Trash2, FileText } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../../lib/useProfile';

export default function PostDetail() {
  const router = useRouter();
  const { postId } = useLocalSearchParams();
  const { profile, isOwner, isStaff } = useProfile();
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
      supabase.from('post_comments').select('*, profiles(full_name, role)').eq('post_id', postId).order('created_at', { ascending: true }),
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

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function getRoleLabel(role: string) {
    if (role === 'owner') return 'Barn Manager';
    if (role === 'staff') return 'Staff';
    return 'Horse Owner';
  }

  const canDeletePost = isOwner || isStaff || post?.author_id === profile?.id;
  const canPin = isOwner || isStaff;

  if (loading) return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2C4A35" style={{ marginTop: 80 }} />
    </View>
  );

  if (!post) return (
    <View style={styles.container}>
      <Text style={{ padding: 40, color: '#9A9285', textAlign: 'center' }}>Post not found.</Text>
    </View>
  );

  const isAnnouncement = post.type === 'announcement';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{isAnnouncement ? 'Announcement' : 'Post'}</Text>
        <View style={styles.headerActions}>
          {canPin && (
            <Pressable
              style={({ hovered }: any) => [styles.headerIconBtn, hovered && styles.headerIconBtnHovered]}
              onPress={handlePin}
            >
              <Pin size={16} color={post.pinned ? '#C9A85C' : 'rgba(255,255,255,0.5)'} fill={post.pinned ? '#C9A85C' : 'none'} />
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
        <View style={[styles.postCard, isAnnouncement && styles.postCardAnnouncement]}>
          <View style={styles.postHeader}>
            <View style={[styles.avatar, isAnnouncement && styles.avatarAnnouncement]}>
              <Text style={[styles.avatarText, isAnnouncement && styles.avatarTextAnnouncement]}>
                {(post.profiles?.full_name || '?')[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.postMeta}>
              <View style={styles.postMetaTop}>
                <Text style={styles.postAuthor}>{post.profiles?.full_name || 'Unknown'}</Text>
                {isAnnouncement && (
                  <View style={styles.announcementBadge}>
                    <Text style={styles.announcementBadgeText}>Announcement</Text>
                  </View>
                )}
                {post.pinned && (
                  <View style={styles.pinnedBadge}>
                    <Pin size={10} color="#B08C4A" fill="#B08C4A" />
                    <Text style={styles.pinnedBadgeText}>Pinned</Text>
                  </View>
                )}
              </View>
              <Text style={styles.postMetaSub}>
                {getRoleLabel(post.profiles?.role)} · {formatDate(post.created_at)}
              </Text>
            </View>
          </View>
          <Text style={styles.postContent}>{post.content}</Text>
          {/* Attachments */}
          {(post.post_attachments || []).length > 0 && (
            <View style={styles.detailAttachments}>
              {post.post_attachments.map((att: any) => (
                att.type === 'image' || att.type === 'gif' ? (
                  <Image key={att.id} source={{ uri: att.url }} style={styles.detailAttachImage} resizeMode="cover" />
                ) : (
                  <Pressable
                    key={att.id}
                    style={({ hovered }: any) => [styles.detailAttachPdf, hovered && styles.detailAttachPdfHovered]}
                    onPress={() => Linking.openURL(att.url)}
                  >
                    <FileText size={20} color="#2C4A35" />
                    <Text style={styles.detailAttachPdfName} numberOfLines={2}>{att.filename || 'Document'}</Text>
                    <Text style={styles.detailAttachPdfOpen}>Open →</Text>
                  </Pressable>
                )
              ))}
            </View>
          )}

          <View style={styles.postActions}>
            <Pressable
              style={({ hovered }: any) => [styles.likeBtn, (post.post_reactions || []).some((r: any) => r.user_id === profile?.id) && styles.likeBtnActive, hovered && styles.likeBtnHovered]}
              onPress={handleLike}
            >
              <Text style={[(post.post_reactions || []).some((r: any) => r.user_id === profile?.id) ? styles.likeIconActive : styles.likeIcon]}>♥</Text>
              <Text style={[(post.post_reactions || []).some((r: any) => r.user_id === profile?.id) ? styles.likeCountActive : styles.likeCount]}>
                {post.post_reactions?.length > 0 ? `${post.post_reactions.length} like${post.post_reactions.length !== 1 ? 's' : ''}` : 'Like'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Comments */}
        {comments.length > 0 && (
          <View style={styles.commentsSection}>
            <Text style={styles.commentsLabel}>{comments.length} Comment{comments.length !== 1 ? 's' : ''}</Text>
            {comments.map((c, index) => {
              const isCommentAuthor = c.author_id === profile?.id;
              const canDelete = isOwner || isStaff || isCommentAuthor;
              const isLast = index === comments.length - 1;
              return (
                <View key={c.id} style={[styles.commentRow, isLast && styles.commentRowLast]}>
                  <View style={styles.commentAvatar}>
                    <Text style={styles.commentAvatarText}>
                      {(c.profiles?.full_name || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.commentContent}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentAuthor}>{c.profiles?.full_name || 'Unknown'}</Text>
                      <Text style={styles.commentTime}>{formatDate(c.created_at)}</Text>
                    </View>
                    <Text style={styles.commentText}>{c.content}</Text>
                  </View>
                  {canDelete && (
                    <Pressable
                      style={({ hovered }: any) => [styles.deleteCommentBtn, hovered && styles.deleteCommentBtnHovered]}
                      onPress={() => handleDeleteComment(c.id)}
                    >
                      <Trash2 size={13} color="#C4BAA8" />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Comment input */}
      <View style={styles.commentInputWrap}>
        <View style={styles.commentInputAvatar}>
          <Text style={styles.commentInputAvatarText}>
            {(profile?.full_name || '?')[0].toUpperCase()}
          </Text>
        </View>
        <TextInput
          style={styles.commentInput}
          value={comment}
          onChangeText={setComment}
          placeholder="Write a comment..."
          placeholderTextColor="#C4BAA8"
          multiline
          maxLength={500}
        />
        <Pressable
          style={({ hovered }: any) => [styles.sendBtn, !comment.trim() && styles.sendBtnDisabled, hovered && comment.trim() && styles.sendBtnHovered]}
          onPress={handleComment}
          disabled={posting || !comment.trim()}
        >
          {posting ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.sendBtnText}>Post</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F2' },
  header: { backgroundColor: '#2C4A35', padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#C9A85C' },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerIconBtn: { padding: 8, borderRadius: 6 },
  headerIconBtnHovered: { backgroundColor: 'rgba(255,255,255,0.1)' },
  body: { flex: 1 },
  postCard: { margin: 16, marginBottom: 0, backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#E8E0CC', padding: 16 },
  postCardAnnouncement: { borderColor: '#C9A85C', backgroundColor: '#FFFDF7' },
  postHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EDF5EF', alignItems: 'center', justifyContent: 'center' },
  avatarAnnouncement: { backgroundColor: 'rgba(201,168,92,0.15)' },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#2C4A35' },
  avatarTextAnnouncement: { color: '#C9A85C' },
  postMeta: { flex: 1 },
  postMetaTop: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  postAuthor: { fontSize: 14, fontWeight: '600', color: '#1A1A14' },
  announcementBadge: { backgroundColor: 'rgba(201,168,92,0.15)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  announcementBadgeText: { fontSize: 10, color: '#B08C4A', fontWeight: '600' },
  pinnedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FEF6E4', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  pinnedBadgeText: { fontSize: 10, color: '#B08C4A', fontWeight: '600' },
  postMetaSub: { fontSize: 11, color: '#9A9285', marginTop: 2 },
  postContent: { fontSize: 15, color: '#1A1A14', lineHeight: 23 },
  commentsSection: { margin: 16, marginTop: 12, backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#E8E0CC', padding: 16 },
  commentsLabel: { fontSize: 11, fontWeight: '700', color: '#9A9285', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 },
  commentRow: { flexDirection: 'row', gap: 10, paddingBottom: 14, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F5F1EA' },
  commentRowLast: { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0 },
  commentAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F5F1EA', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  commentAvatarText: { fontSize: 12, fontWeight: '700', color: '#9A9285' },
  commentContent: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  commentAuthor: { fontSize: 13, fontWeight: '600', color: '#1A1A14' },
  commentTime: { fontSize: 11, color: '#C4BAA8' },
  commentText: { fontSize: 13, color: '#3A3830', lineHeight: 19 },
  deleteCommentBtn: { padding: 4, borderRadius: 4 },
  deleteCommentBtnHovered: { backgroundColor: '#FFF5F5' },
  detailAttachments: { gap: 10, marginTop: 14 },
  detailAttachImage: { width: '100%', height: 240, borderRadius: 10, backgroundColor: '#F5F1EA' },
  detailAttachPdf: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F5F1EA', borderRadius: 10, padding: 14 },
  detailAttachPdfHovered: { backgroundColor: '#EDF5EF' },
  detailAttachPdfName: { flex: 1, fontSize: 13, color: '#2C4A35', fontWeight: '500' },
  detailAttachPdfOpen: { fontSize: 12, color: '#9A9285' },
  postActions: { flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F5F1EA' },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  likeBtnActive: { backgroundColor: '#FEF0F0' },
  likeBtnHovered: { backgroundColor: '#F5F1EA' },
  likeIcon: { fontSize: 15, color: '#C4BAA8' },
  likeIconActive: { fontSize: 15, color: '#C0392B' },
  likeCount: { fontSize: 13, color: '#9A9285', fontWeight: '500' },
  likeCountActive: { fontSize: 13, color: '#C0392B', fontWeight: '600' },
  commentInputWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, paddingBottom: 28, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#E8E0CC' },
  commentInputAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EDF5EF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  commentInputAvatarText: { fontSize: 12, fontWeight: '700', color: '#2C4A35' },
  commentInput: { flex: 1, backgroundColor: '#FAF7F2', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1A1A14', maxHeight: 100 },
  sendBtn: { backgroundColor: '#2C4A35', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnHovered: { backgroundColor: '#1A3A25' },
  sendBtnText: { color: '#C9A85C', fontSize: 13, fontWeight: '600' },
});
