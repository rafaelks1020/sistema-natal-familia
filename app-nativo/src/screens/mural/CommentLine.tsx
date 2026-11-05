import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Heart from 'lucide-react-native/icons/heart';
import { timeAgo } from '../../format';
import type { CommentItem } from '../../types/mural';
import { theme } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { LoopVideo } from '../../ui/LoopVideo';
import { Text } from '../../ui/Text';

export function CommentLine({ comment, canDelete, visible = true, onAuthor, onLike, onDelete }: {
  comment: CommentItem;
  canDelete: boolean;
  visible?: boolean;
  onAuthor: (userId: number) => void;
  onLike: (commentId: number) => void;
  onDelete: (commentId: number) => void;
}) {
  const [burst, setBurst] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const pending = comment.id <= 0;
  function like() {
    if (pending) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!comment.liked_by_me) {
      setBurst(value => value + 1);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setBurst(0), 1100);
    }
    onLike(comment.id);
  }
  return <View style={styles.row}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Perfil de ${comment.user_name}`} onPress={() => onAuthor(comment.user_id)} hitSlop={6} style={styles.avatarHit}>
      <Avatar name={comment.user_name} src={comment.avatar_url} size={28} />
    </Pressable>
    <View style={styles.body}>
      <Text style={styles.copy}>
        <Text style={styles.name} onPress={() => onAuthor(comment.user_id)}>{comment.user_name}</Text>
        <Text style={styles.content}> {comment.content}</Text>
      </Text>
      <View style={styles.meta}>
        <Text variant="muted" style={styles.time}>{timeAgo(comment.created_at)}</Text>
        {canDelete && !pending ? <Pressable accessibilityRole="button" accessibilityLabel="Apagar comentário" onPress={() => onDelete(comment.id)} hitSlop={8} style={styles.delete}>
          <Text style={styles.deleteLabel}>Apagar</Text>
        </Pressable> : null}
      </View>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={comment.liked_by_me ? 'Desfazer curtida do comentário' : 'Curtir comentário'} accessibilityState={{ selected: comment.liked_by_me, disabled: pending }} disabled={pending} onPress={like} style={styles.like}>
      <View>
        <Heart size={15} strokeWidth={1.6} color={comment.liked_by_me ? theme.colors.cherry : theme.colors.muted} fill={comment.liked_by_me ? theme.colors.cherry : 'transparent'} />
        {burst > 0 ? <LoopVideo key={burst} name="mn-curtida-comentario" once visible={visible} onEnded={() => setBurst(0)} style={styles.burst} /> : null}
      </View>
      {comment.likes > 0 ? <Text style={[styles.count, comment.liked_by_me && styles.countOn]}>{comment.likes}</Text> : null}
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  avatarHit: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, paddingTop: 8 },
  copy: { fontSize: 14, lineHeight: 20 },
  name: { fontFamily: theme.fonts.semibold, fontSize: 14, lineHeight: 20 },
  content: { color: theme.colors.secondary, fontSize: 14, lineHeight: 20 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  time: { fontSize: 11, lineHeight: 16 },
  delete: { minHeight: 32, justifyContent: 'center' },
  deleteLabel: { color: theme.colors.error, fontSize: 11, fontFamily: theme.fonts.medium },
  like: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3 },
  count: { fontSize: 11, color: theme.colors.muted, fontVariant: ['tabular-nums'] },
  countOn: { color: theme.colors.cherry },
  burst: { position: 'absolute', width: 36, height: 36, top: -11, left: -11, backgroundColor: 'transparent', mixBlendMode: 'screen' },
});
