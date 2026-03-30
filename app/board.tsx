import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Home, ChessKnight, Calendar, DollarSign, MoreHorizontal, MessageSquare, Pin, FileText } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useProfile } from '../lib/useProfile';

export default function Board() {
  const router = useRouter();
  const { profile, isOwner, isStaff } = useProfile();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    fetchPosts();
  }, []));

  async function fetchPosts() {
    setLoading(true);
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

  const pinnedPosts = posts.filter(p => p.pinned);
  const regularPosts = posts.filter(p => !p.pinned);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>S{'\n'}S</Text>
          </View>
          <View>
            <Text style={styles.headerName}>Board</Text>
            <Text style={styles.headerSub}>Barn community</Text>
          </View>
        </View>
        <Pressable
          style={({ hovered }: any) => [styles.addBtn, hovered && styles.addBtnHovered]}
          onPress={() => router.push('/board/add-post')}
        >
          <Text style={styles.addBtnText}>+ Post</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2C4A35" style={{ marginTop: 60 }} />
      ) : posts.length === 0 ? (
        <View style={styles.emptyState}>
          <MessageSquare size={44} color="#C4BAA8" />
          <Text style={styles.emptyTitle}>Nothing posted yet</Text>
          <Text style={styles.emptyText}>Be the first to share something with the barn.</Text>
          <Pressable
            style={({ hovered }: any) => [styles.emptyBtn, hovered && styles.emptyBtnHovered]}
            onPress={() => router.push('/board/add-post')}
          >
            <Text style={styles.emptyBtnText}>Create a post</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          {pinnedPosts.length > 0 && (
            <View>
              <Text style={styles.sectionLabel}>Pinned</Text>
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
              {pinnedPosts.length > 0 && <Text style={styles.sectionLabel}>Recent</Text>}
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

      <View style={styles.nav}>
        <Pressable style={styles.navItem} onPress={() => router.push('/dashboard')}>
          <Home size={22} color="#9A9285" />
          <Text style={styles.navLbl}>Home</Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={() => router.push('/horses')}>
          <ChessKnight size={22} color="#9A9285" />
          <Text style={styles.navLbl}>Horses</Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={() => router.push('/schedule')}>
          <Calendar size={22} color="#9A9285" />
          <Text style={styles.navLbl}>Schedule</Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={() => router.push('/billing')}>
          <DollarSign size={22} color="#9A9285" />
          <Text style={styles.navLbl}>Billing</Text>
        </Pressable>
        <Pressable style={styles.navItem}>
          <MessageSquare size={22} color="#2C4A35" />
          <Text style={[styles.navLbl, styles.navActive]}>Board</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AutoHeightImage({ uri }: { uri: string }) {
  return (
    <Image
      source={{ uri }}
      style={{ width: '100%', aspectRatio: 4/3 }}
      resizeMode="contain"
    />
  );
}

function PostCard({ post, isOwner, isStaff, currentUserId, onPin, onPress, onLike, formatDate, getRoleLabel }: any) {
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
        isAnnouncement && styles.postCardAnnouncement,
        hovered && styles.postCardHovered,
      ]}
      onPress={onPress}
    >
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
          </View>
          <Text style={styles.postMetaSub}>
            {getRoleLabel(authorRole)} · {formatDate(post.created_at)}
          </Text>
        </View>
        {canPin && (
          <Pressable
            style={({ hovered }: any) => [styles.pinBtn, hovered && styles.pinBtnHovered]}
            onPress={onPin}
          >
            <Pin size={14} color={post.pinned ? '#C9A85C' : '#C4BAA8'} fill={post.pinned ? '#C9A85C' : 'none'} />
          </Pressable>
        )}
      </View>

      <Text style={styles.postContent}>{post.content}</Text>

      {/* Attachments preview */}
      {(post.post_attachments || []).length > 0 && (
        <View style={styles.attachmentsWrap}>
          {post.post_attachments.length === 1 && post.post_attachments[0].type === 'pdf' ? (
            <View style={styles.attachPdfChip}>
              <FileText size={13} color="#2C4A35" />
              <Text style={styles.attachPdfName} numberOfLines={1}>{post.post_attachments[0].filename || 'Document'}</Text>
            </View>
          ) : post.post_attachments.length === 1 ? (
            <AutoHeightImage uri={post.post_attachments[0].url} />
          ) : (
            <>
              {post.post_attachments.slice(0, 3).map((att: any) => (
                att.type === 'image' || att.type === 'gif' ? (
                  <Image key={att.id} source={{ uri: att.url }} style={styles.attachThumb} resizeMode="cover" />
                ) : (
                  <View key={att.id} style={styles.attachPdfChip}>
                    <FileText size={13} color="#2C4A35" />
                    <Text style={styles.attachPdfName} numberOfLines={1}>{att.filename || 'Document'}</Text>
                  </View>
                )
              ))}
              {post.post_attachments.length > 3 && (
                <View style={styles.attachMore}>
                  <Text style={styles.attachMoreText}>+{post.post_attachments.length - 3}</Text>
                </View>
              )}
            </>
          )}
        </View>
      )}
      <View style={styles.postFooter}>
        <Pressable
          style={({ hovered }: any) => [styles.likeBtn, hasLiked && styles.likeBtnActive, hovered && styles.likeBtnHovered]}
          onPress={onLike}
        >
          <Text style={[styles.likeIcon, hasLiked && styles.likeIconActive]}>♥</Text>
          {likeCount > 0 && <Text style={[styles.likeCount, hasLiked && styles.likeCountActive]}>{likeCount}</Text>}
        </Pressable>
        {commentCount > 0 && (
          <View style={styles.commentCount}>
            <MessageSquare size={13} color="#9A9285" />
            <Text style={styles.postCommentCount}>{commentCount} comment{commentCount !== 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F2' },
  header: { backgroundColor: '#2C4A35', padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 32, height: 32, backgroundColor: 'rgba(201,168,92,0.15)', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  headerIconText: { fontSize: 10, fontWeight: '700', color: '#C9A85C', textAlign: 'center', lineHeight: 11 },
  headerName: { fontSize: 15, fontWeight: '600', color: '#C9A85C' },
  headerSub: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  addBtn: { backgroundColor: 'rgba(201,168,92,0.15)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6 },
  addBtnHovered: { backgroundColor: 'rgba(201,168,92,0.3)' },
  addBtnText: { color: '#C9A85C', fontSize: 13, fontWeight: '600' },
  body: { flex: 1, padding: 12 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#2C4A35' },
  emptyText: { fontSize: 14, color: '#9A9285', textAlign: 'center' },
  emptyBtn: { marginTop: 8, backgroundColor: '#2C4A35', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  emptyBtnHovered: { backgroundColor: '#1A3A25' },
  emptyBtnText: { color: '#C9A85C', fontSize: 14, fontWeight: '600' },
  sectionLabel: { fontSize: 10, fontWeight: '600', color: '#9A9285', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  postCard: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 14, padding: 16, marginBottom: 10 },
  postCardAnnouncement: { borderColor: '#C9A85C', backgroundColor: '#FFFDF7' },
  postCardHovered: { backgroundColor: '#F5F1EA' },
  postHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EDF5EF', alignItems: 'center', justifyContent: 'center' },
  avatarAnnouncement: { backgroundColor: 'rgba(201,168,92,0.15)' },
  avatarText: { fontSize: 15, fontWeight: '700', color: '#2C4A35' },
  avatarTextAnnouncement: { color: '#C9A85C' },
  postMeta: { flex: 1 },
  postMetaTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  postAuthor: { fontSize: 14, fontWeight: '600', color: '#1A1A14' },
  announcementBadge: { backgroundColor: 'rgba(201,168,92,0.15)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  announcementBadgeText: { fontSize: 10, color: '#B08C4A', fontWeight: '600' },
  postMetaSub: { fontSize: 11, color: '#9A9285', marginTop: 2 },
  pinBtn: { padding: 6, borderRadius: 6 },
  pinBtnHovered: { backgroundColor: '#F5F1EA' },
  postContent: { fontSize: 14, color: '#1A1A14', lineHeight: 21 },
  attachmentsWrap: { marginBottom: 12, marginHorizontal: -16, marginTop: 12 },
  attachThumb: { width: 100, height: 100, borderRadius: 8, backgroundColor: '#F5F1EA' },
  attachThumbFull: { width: '100%', height: 280 }, // fallback only
  attachPdfChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F5F1EA', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  attachPdfName: { fontSize: 12, color: '#2C4A35', fontWeight: '500', maxWidth: 160 },
  attachMore: { width: 100, height: 100, borderRadius: 8, backgroundColor: '#E8E0CC', alignItems: 'center', justifyContent: 'center' },
  attachMoreText: { fontSize: 18, fontWeight: '700', color: '#9A9285' },
  postFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F5F1EA' },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  likeBtnActive: { backgroundColor: '#FEF0F0' },
  likeBtnHovered: { backgroundColor: '#F5F1EA' },
  likeIcon: { fontSize: 14, color: '#C4BAA8' },
  likeIconActive: { color: '#C0392B' },
  likeCount: { fontSize: 12, color: '#9A9285', fontWeight: '500' },
  likeCountActive: { color: '#C0392B' },
  commentCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postCommentCount: { fontSize: 12, color: '#9A9285' },
  nav: { backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#E8E0CC', flexDirection: 'row', paddingBottom: 20, paddingTop: 8 },
  navItem: { flex: 1, alignItems: 'center', gap: 2 },
  navLbl: { fontSize: 9, color: '#9A9285' },
  navActive: { color: '#2C4A35', fontWeight: '600' },
});
