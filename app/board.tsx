import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ChessKnight, Calendar, DollarSign, MoreHorizontal, MessageSquare, Pin, FileText } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useProfile } from '../lib/useProfile';
import { useLanguage } from '../lib/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import HomeButton from '../lib/HomeButton';
import { formatRelativeDate, getRoleLabel as _getRoleLabel } from '../lib/dateUtils';

export default function Board() {
  const router = useRouter();
  const { profile, isOwner, isStaff } = useProfile();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    fetchPosts();
    if (profile?.id) {
      supabase.from('profiles').update({ last_seen_board: new Date().toISOString() }).eq('id', profile.id);
    }
  }, [profile?.id]));

  async function fetchPosts() {
    if (posts.length === 0) setLoading(true);
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(full_name, role), post_comments(id), post_reactions(id, user_id), post_attachments(id, url, type, filename)')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    setPosts(data || []);
    setLoading(false);
  }

  async function handlePin(post: any) {
    await supabase.from('posts').update({ pinned: !post.pinned }).eq('id', post.id);
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, pinned: !p.pinned } : p)
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
    );
  }

  async function handleLike(post: any) {
    if (!profile) return;
    const hasLiked = (post.post_reactions || []).some((r: any) => r.user_id === profile.id);
    if (hasLiked) {
      await supabase.from('post_reactions').delete().eq('post_id', post.id).eq('user_id', profile.id);
      setPosts(prev => prev.map(p => p.id === post.id
        ? { ...p, post_reactions: p.post_reactions.filter((r: any) => r.user_id !== profile.id) }
        : p
      ));
    } else {
      const { data } = await supabase.from('post_reactions').insert({ post_id: post.id, user_id: profile.id }).select().single();
      if (data) {
        setPosts(prev => prev.map(p => p.id === post.id
          ? { ...p, post_reactions: [...(p.post_reactions || []), data] }
          : p
        ));
      }
    }
  }

  const formatDate = (dateStr: string) => formatRelativeDate(dateStr, t);
  const getRoleLabel = (role: string) => _getRoleLabel(role, t);

  const pinnedPosts = posts.filter(p => p.pinned);
  const regularPosts = posts.filter(p => !p.pinned);

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <View style={styles.headerLeft}>
          <HomeButton />
          <View>
            <Text style={[styles.headerName, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Community Board')}</Text>
            <Text style={styles.headerSub}>{t('Barn community')}</Text>
          </View>
        </View>
        <Pressable
          style={({ hovered }: any) => [styles.addBtn, { backgroundColor: C.secondaryAlpha15 }, hovered && { backgroundColor: C.secondaryAlpha30 }]}
          onPress={() => router.push('/board/add-post')}
        >
          <Text style={[styles.addBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>+ {t('Post')}</Text>
        </Pressable>
      </View>

      {loading && posts.length === 0 ? (
        <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 60 }} />
      ) : posts.length === 0 ? (
        <View style={styles.emptyState}>
          <MessageSquare size={44} color={C.cardBorder} />
          <Text style={[styles.emptyTitle, { color: C.primary, fontFamily: F.sansBold }]}>{t('Nothing posted yet')}</Text>
          <Text style={[styles.emptyText, { color: C.textMuted }]}>{t('Be the first to share something with the barn.')}</Text>
          <Pressable
            style={({ hovered }: any) => [styles.emptyBtn, { backgroundColor: C.primary }, hovered && { backgroundColor: C.primaryDark }]}
            onPress={() => router.push('/board/add-post')}
          >
            <Text style={[styles.emptyBtnText, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Create a post')}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          {pinnedPosts.length > 0 && (
            <View>
              <Text style={[styles.sectionLabel, { color: C.textMuted }]}>{t('Pinned')}</Text>
              {pinnedPosts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  isOwner={isOwner}
                  isStaff={isStaff}
                  currentUserId={profile?.id}
                  onPin={() => handlePin(post)}
                  onPress={() => router.push({ pathname: '/board/[postId]', params: { postId: post.id } })}
                  onLike={() => handleLike(post)}
                  currentUserId={profile?.id}
                  formatDate={formatDate}
                  getRoleLabel={getRoleLabel}
                />
              ))}
            </View>
          )}

          {regularPosts.length > 0 && (
            <View>
              {pinnedPosts.length > 0 && <Text style={[styles.sectionLabel, { color: C.textMuted }]}>{t('Recent')}</Text>}
              {regularPosts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  isOwner={isOwner}
                  isStaff={isStaff}
                  currentUserId={profile?.id}
                  onPin={() => handlePin(post)}
                  onPress={() => router.push({ pathname: '/board/[postId]', params: { postId: post.id } })}
                  onLike={() => handleLike(post)}
                  currentUserId={profile?.id}
                  formatDate={formatDate}
                  getRoleLabel={getRoleLabel}
                />
              ))}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

function AutoHeightImage({ uri }: { uri: string }) {
  return (
    <Image
      source={{ uri }}
      style={{ width: '100%', aspectRatio: 4/3 }}
      resizeMode="cover"
    />
  );
}

function PostCard({ post, isOwner, isStaff, currentUserId, onPin, onPress, onLike, formatDate, getRoleLabel }: any) {
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;
  const isAuthor = post.author_id === currentUserId;
  const canPin = isOwner || isStaff;
  const isAnnouncement = post.type === 'announcement';
  const commentCount = post.post_comments?.length || 0;
  const likeCount = post.post_reactions?.length || 0;
  const hasLiked = (post.post_reactions || []).some((r: any) => r.user_id === currentUserId);
  const authorRole = post.profiles?.role || 'horse_owner';

  return (
    <Pressable
      style={({ hovered }: any) => [
        styles.postCard,
        { backgroundColor: C.card, borderColor: C.cardBorder },
        isAnnouncement && { borderColor: C.secondary, backgroundColor: '#FFFDF7' },
        hovered && { backgroundColor: C.cardSeparator },
      ]}
      onPress={onPress}
    >
      <View style={styles.postHeader}>
        <View style={[styles.avatar, { backgroundColor: C.activeBg }, isAnnouncement && { backgroundColor: C.secondaryAlpha15 }]}>
          <Text style={[styles.avatarText, { color: C.primary }, isAnnouncement && { color: C.headerText }]}>
            {(post.profiles?.full_name || '?')[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.postMeta}>
          <View style={styles.postMetaTop}>
            <Text style={[styles.postAuthor, { color: C.text, fontFamily: F.sansBold }]}>{post.profiles?.full_name || 'Unknown'}</Text>
            {isAnnouncement && (
              <View style={[styles.announcementBadge, { backgroundColor: C.secondaryAlpha15 }]}>
                <Text style={[styles.announcementBadgeText, { color: C.textWarm, fontFamily: F.sansBold }]}>{t('Announcement')}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.postMetaSub, { color: C.textMuted }]}>
            {getRoleLabel(authorRole)} · {formatDate(post.created_at)}
          </Text>
        </View>
        {canPin && (
          <Pressable
            style={({ hovered }: any) => [styles.pinBtn, hovered && { backgroundColor: C.cardSeparator }]}
            onPress={onPin}
          >
            <Pin size={14} color={post.pinned ? C.secondary : C.cardBorder} fill={post.pinned ? C.secondary : 'none'} />
          </Pressable>
        )}
      </View>

      <Text style={[styles.postContent, { color: C.text }]}>{post.content}</Text>

      {/* Attachments preview */}
      {(post.post_attachments || []).length > 0 && (
        <View style={styles.attachmentsWrap}>
          {post.post_attachments.length === 1 && post.post_attachments[0].type === 'pdf' ? (
            <View style={[styles.attachPdfChip, { backgroundColor: C.cardSeparator }]}>
              <FileText size={13} color={C.primary} />
              <Text style={[styles.attachPdfName, { color: C.primary, fontFamily: F.sansMedium }]} numberOfLines={1}>{post.post_attachments[0].filename || 'Document'}</Text>
            </View>
          ) : post.post_attachments.length === 1 ? (
            <AutoHeightImage uri={post.post_attachments[0].url} />
          ) : (
            <>
              {post.post_attachments.slice(0, 3).map((att: any) => (
                att.type === 'image' || att.type === 'gif' ? (
                  <Image key={att.id} source={{ uri: att.url }} style={[styles.attachThumb, { backgroundColor: C.cardSeparator }]} resizeMode="cover" />
                ) : (
                  <View key={att.id} style={[styles.attachPdfChip, { backgroundColor: C.cardSeparator }]}>
                    <FileText size={13} color={C.primary} />
                    <Text style={[styles.attachPdfName, { color: C.primary, fontFamily: F.sansMedium }]} numberOfLines={1}>{att.filename || 'Document'}</Text>
                  </View>
                )
              ))}
              {post.post_attachments.length > 3 && (
                <View style={[styles.attachMore, { backgroundColor: C.cardBorder }]}>
                  <Text style={[styles.attachMoreText, { color: C.textMuted, fontFamily: F.sansBold }]}>+{post.post_attachments.length - 3}</Text>
                </View>
              )}
            </>
          )}
        </View>
      )}
      <View style={[styles.postFooter, { borderTopColor: C.cardSeparator }]}>
        <Pressable
          style={({ hovered }: any) => [styles.likeBtn, hasLiked && styles.likeBtnActive, hovered && { backgroundColor: C.cardSeparator }]}
          onPress={onLike}
        >
          <Text style={[styles.likeIcon, hasLiked && styles.likeIconActive]}>{hasLiked ? '♥' : '♥'}</Text>
          {likeCount > 0 && <Text style={[styles.likeCount, { color: C.textMuted }, hasLiked && styles.likeCountActive]}>{likeCount}</Text>}
        </Pressable>
        {commentCount > 0 && (
          <View style={styles.commentCount}>
            <MessageSquare size={13} color={C.textMuted} />
            <Text style={[styles.postCommentCount, { color: C.textMuted }]}>{commentCount} comment{commentCount !== 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerName: { fontSize: 15, fontWeight: '600' },
  headerSub: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  addBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6 },
  addBtnText: { fontSize: 13, fontWeight: '600' },
  body: { flex: 1, padding: 12 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center' },
  emptyBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  emptyBtnText: { fontSize: 14, fontWeight: '600' },
  sectionLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  postCard: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 10 },
  postHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '700' },
  postMeta: { flex: 1 },
  postMetaTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  postAuthor: { fontSize: 14, fontWeight: '600' },
  announcementBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  announcementBadgeText: { fontSize: 10, fontWeight: '600' },
  postMetaSub: { fontSize: 11, marginTop: 2 },
  pinBtn: { padding: 6, borderRadius: 6 },
  postContent: { fontSize: 14, lineHeight: 21 },
  attachmentsWrap: { marginBottom: 12, marginHorizontal: -16, marginTop: 12 },
  attachThumb: { width: 100, height: 100, borderRadius: 8 },
  attachPdfChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  attachPdfName: { fontSize: 12, fontWeight: '500', maxWidth: 160 },
  attachMore: { width: 100, height: 100, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  attachMoreText: { fontSize: 18, fontWeight: '700' },
  postFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, paddingTop: 10, borderTopWidth: 1 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  likeBtnActive: { backgroundColor: '#FEF0F0' },
  likeIcon: { fontSize: 14, color: '#C4BAA8' },
  likeIconActive: { color: '#C0392B' },
  likeCount: { fontSize: 12, fontWeight: '500' },
  likeCountActive: { color: '#C0392B' },
  commentCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postCommentCount: { fontSize: 12 },
});
