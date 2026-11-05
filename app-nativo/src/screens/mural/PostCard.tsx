import { memo, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Pin from 'lucide-react-native/icons/pin';
import { timeAgo } from '../../format';
import type { PostItem, ReactionType } from '../../types/mural';
import { theme } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { LoopVideo } from '../../ui/LoopVideo';
import { Text } from '../../ui/Text';
import { MURAL_PREVIEW_COMMENTS } from './cache';
import { CommentLine } from './CommentLine';
import { PhotoStrip } from './PhotoStrip';
import { REACTIONS } from './reactions';

function PostCardComponent({ post, width, visible, meId, isAdmin, onAuthor, onReact, onOpenComments, onOpenMenu, onLikeComment, onDeleteComment }: {
  post: PostItem;
  width: number;
  visible: boolean;
  meId: number;
  isAdmin: boolean;
  onAuthor: (userId: number) => void;
  onReact: (postId: number, type: ReactionType) => void;
  onOpenComments: (postId: number) => void;
  onOpenMenu: (post: PostItem) => void;
  onLikeComment: (postId: number, commentId: number) => void;
  onDeleteComment: (postId: number, commentId: number) => void;
}) {
  const [burst, setBurst] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const mine = post.user_id === meId;
  const canManage = mine || isAdmin;
  const preview = post.comments.slice(-MURAL_PREVIEW_COMMENTS);
  const hidden = post.comments_count > preview.length;
  function playHeart() {
    setBurst(value => value + 1);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setBurst(0), 1100);
  }
  function doubleTap() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    playHeart();
    if (!post.my_reactions.includes('coracao')) onReact(post.id, 'coracao');
  }
  function react(type: ReactionType) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (type === 'coracao') playHeart();
    onReact(post.id, type);
  }
  return <View style={styles.card}>
    <View style={styles.authorRow}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Perfil de ${post.user_name}`} onPress={() => onAuthor(post.user_id)} style={styles.author}>
        <Avatar name={post.user_name} src={post.avatar_url} size={42} />
        <View style={styles.authorText}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.name}>{post.user_name}</Text>
            {post.pinned ? <View style={styles.pin}><Pin size={11} color={theme.colors.champagne} strokeWidth={1.7} /><Text style={styles.pinLabel}>Fixado</Text></View> : null}
          </View>
          <Text variant="muted" style={styles.time}>{timeAgo(post.created_at)}</Text>
        </View>
      </Pressable>
      {canManage ? <Pressable accessibilityRole="button" accessibilityLabel="Opções da publicação" onPress={() => onOpenMenu(post)} style={styles.iconHit}>
        <Ellipsis size={20} color={theme.colors.secondary} strokeWidth={1.6} />
      </Pressable> : null}
    </View>
    {post.content ? <Text style={styles.body}>{post.content}</Text> : null}
    {post.images.length > 0 ? <PhotoStrip images={post.images} width={width} author={post.user_name} onDoubleTap={doubleTap}>
      {burst > 0 ? <View pointerEvents="none" style={styles.heartLayer}>
        <LoopVideo key={burst} name="mn-coracao" once visible={visible} onEnded={() => setBurst(0)} style={styles.heartVideo} />
      </View> : null}
    </PhotoStrip> : null}
    <View style={styles.bar}>
      <View style={styles.reactions}>
        {REACTIONS.map(({ type, label, Icon }) => {
          const active = post.my_reactions.includes(type);
          const count = Number(post.reactions[type] ?? 0);
          const heart = type === 'coracao';
          const color = active ? (heart ? theme.colors.cherry : theme.colors.champagne) : theme.colors.secondary;
          return <Pressable key={type} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={count > 0 ? `${label}, ${count}` : label} onPress={() => react(type)} style={styles.reaction}>
            <View>
              <Icon size={22} strokeWidth={1.6} color={color} fill={active ? (heart ? theme.colors.cherry : 'rgba(191,165,119,0.28)') : 'transparent'} />
              {heart && burst > 0 ? <LoopVideo key={`like-${burst}`} name="mn-curtida" once visible={visible} style={styles.likeVideo} /> : null}
            </View>
            {count > 0 ? <Text style={[styles.count, { color }]}>{count}</Text> : null}
          </Pressable>;
        })}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={post.comments_count > 0 ? `Comentar, ${post.comments_count}` : 'Comentar'} onPress={() => onOpenComments(post.id)} style={styles.reaction}>
        <MessageCircle size={20} color={theme.colors.secondary} strokeWidth={1.6} />
        {post.comments_count > 0 ? <Text style={styles.count}>{post.comments_count}</Text> : null}
      </Pressable>
    </View>
    <View style={styles.comments}>
      {hidden ? <Pressable accessibilityRole="button" onPress={() => onOpenComments(post.id)} style={styles.more}>
        <Text style={styles.moreLabel}>{post.comments_count === 1 ? 'Ver o comentário' : `Ver todos os ${post.comments_count} comentários`}</Text>
      </Pressable> : null}
      {preview.map(comment => <CommentLine key={comment.id} comment={comment} visible={visible} canDelete={comment.user_id === meId || isAdmin} onAuthor={onAuthor} onLike={commentId => onLikeComment(post.id, commentId)} onDelete={commentId => onDeleteComment(post.id, commentId)} />)}
    </View>
  </View>;
}

export const PostCard = memo(PostCardComponent);

const styles = StyleSheet.create({
  card: { paddingTop: 18, paddingBottom: 8 },
  authorRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 4 },
  author: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 },
  authorText: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, fontFamily: theme.fonts.semibold, fontSize: 15, lineHeight: 20 },
  pin: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  pinLabel: { color: theme.colors.champagne, fontFamily: theme.fonts.semibold, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  time: { fontSize: 12, lineHeight: 16 },
  iconHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 12, fontSize: 16, lineHeight: 24 },
  heartLayer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  heartVideo: { width: 188, height: 188, backgroundColor: 'transparent', mixBlendMode: 'screen' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginTop: 4 },
  reactions: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  reaction: { minWidth: 44, minHeight: 44, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  count: { fontSize: 13, lineHeight: 18, color: theme.colors.secondary, fontVariant: ['tabular-nums'], fontFamily: theme.fonts.medium },
  likeVideo: { position: 'absolute', width: 36, height: 36, top: -7, left: -7, backgroundColor: 'transparent', mixBlendMode: 'screen' },
  comments: { paddingHorizontal: 16, gap: 2 },
  more: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 4 },
  moreLabel: { color: theme.colors.muted, fontSize: 12, fontFamily: theme.fonts.medium },
});
