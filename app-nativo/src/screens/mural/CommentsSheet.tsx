import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Send from 'lucide-react-native/icons/send';
import { api, ApiError, queryClient, sessionStore } from '../../api';
import { useSession } from '../../session';
import type { CommentItem } from '../../types/mural';
import { theme } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { MURAL_COMMENT_LIMIT, mapPosts, muralKeys, normalizeComment, type PostsData } from './cache';
import { CommentLine } from './CommentLine';

export function CommentsSheet({ postId, onClose, onSubmit, onLike, onDelete, onAuthor }: {
  postId: number | null;
  onClose: () => void;
  onSubmit: (postId: number, content: string) => Promise<unknown>;
  onLike: (postId: number, commentId: number) => void;
  onDelete: (postId: number, commentId: number) => void;
  onAuthor: (userId: number) => void;
}) {
  const { height } = useWindowDimensions();
  const { user } = useSession();
  const toast = useToast();
  const isAdmin = Boolean(user?.is_admin);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [scope, setScope] = useState(postId);
  if (scope !== postId) {
    setScope(postId);
    setDraft('');
    setSending(false);
  }
  const visible = postId !== null;
  const comments = useQuery({
    queryKey: muralKeys.comments(postId ?? 0),
    enabled: visible,
    queryFn: async ({ signal }) => {
      const rows = await api<CommentItem[]>(`/api/posts/${postId}/comments`, { signal });
      if (!Array.isArray(rows)) throw new ApiError('Os comentários vieram em um formato inesperado.', 502);
      return rows.map(row => normalizeComment(row));
    },
  });
  useEffect(() => {
    if (postId === null || !comments.data) return;
    if (sessionStore.getSnapshot().status !== 'authenticated') return;
    const loaded = comments.data;
    queryClient.setQueryData<PostsData>(muralKeys.posts, current => mapPosts(current, postId, post => {
      const pending = post.comments.filter(item => item.id < 0 && !loaded.some(comment => comment.id === item.id));
      return { ...post, comments: [...loaded, ...pending], comments_count: loaded.length + pending.length };
    }));
  }, [comments.data, postId]);
  async function send() {
    const content = draft.trim();
    if (!content || sending || postId === null || comments.isPending) return;
    setDraft('');
    setSending(true);
    try { await onSubmit(postId, content); }
    catch (error) { setDraft(content); toast(error instanceof Error ? error.message : 'Não foi possível comentar.', 'error'); }
    finally { setSending(false); }
  }
  const canSend = draft.trim().length > 0 && !sending && !comments.isPending;
  return <Sheet visible={visible} onClose={onClose} title="Comentários">
    <ScrollView style={{ maxHeight: height * 0.46 }} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}>
      {comments.isPending ? <View style={styles.loading} accessibilityLabel="Carregando comentários"><Skeleton style={{ height: 48 }} /><Skeleton style={{ height: 48 }} /></View>
        : comments.isError ? <View style={styles.error}>
          <Text variant="muted" style={styles.center}>{comments.error.message}</Text>
          <Button variant="ghost" onPress={() => { void comments.refetch(); }}>Tentar de novo</Button>
        </View>
        : comments.data.length === 0 ? <Text variant="muted" style={styles.center}>Nenhum comentário ainda. A primeira palavra é sua.</Text>
        : comments.data.map(comment => <CommentLine key={comment.id} comment={comment} canDelete={Boolean(user && (comment.user_id === user.id || isAdmin))} onAuthor={onAuthor} onLike={commentId => { if (postId !== null) onLike(postId, commentId); }} onDelete={commentId => { if (postId !== null) onDelete(postId, commentId); }} />)}
    </ScrollView>
    <View style={styles.composer}>
      {user ? <Avatar name={user.name} src={user.avatar_url} size={32} /> : null}
      <TextInput
        value={draft}
        onChangeText={setDraft}
        maxLength={MURAL_COMMENT_LIMIT}
        placeholder="Escreva um comentário"
        placeholderTextColor={theme.colors.muted}
        selectionColor={theme.colors.champagne}
        editable={!sending && !comments.isPending}
        returnKeyType="send"
        onSubmitEditing={() => { void send(); }}
        accessibilityLabel="Comentário"
        style={styles.input}
      />
      <Pressable accessibilityRole="button" accessibilityLabel="Enviar comentário" accessibilityState={{ disabled: !canSend, busy: sending }} disabled={!canSend} onPress={() => { void send(); }} style={[styles.send, !canSend && styles.sendOff]}>
        {sending ? <ActivityIndicator color={theme.colors.champagne} /> : <Send size={16} color={theme.colors.champagne} strokeWidth={1.7} />}
      </Pressable>
    </View>
  </Sheet>;
}

const styles = StyleSheet.create({
  list: { gap: 8, paddingBottom: 4 },
  loading: { gap: 10 },
  error: { gap: 12 },
  center: { textAlign: 'center', paddingVertical: 12 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: theme.colors.line, paddingTop: 12 },
  input: { flex: 1, minWidth: 0, minHeight: 48, maxHeight: 96, borderWidth: 1, borderColor: theme.colors.line, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, color: theme.colors.ivory, fontFamily: theme.fonts.body, fontSize: 16 },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.field },
  sendOff: { opacity: 0.4 },
});
