import { ModerationActions } from '../moderacao/Actions';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View, type ListRenderItemInfo, type ListViewToken } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Bell from 'lucide-react-native/icons/bell';
import Camera from 'lucide-react-native/icons/camera';
import ChartColumn from 'lucide-react-native/icons/chart-column';
import Pencil from 'lucide-react-native/icons/pencil';
import Pin from 'lucide-react-native/icons/pin';
import Plus from 'lucide-react-native/icons/plus';
import Trash from 'lucide-react-native/icons/trash';
import { queryClient } from '../../api';
import type { NotificationsResponse, PostItem } from '../../types/mural';
import { theme } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { EmptyState } from '../../ui/EmptyState';
import { useReduceMotion } from '../../ui/motion';
import { Sheet } from '../../ui/Sheet';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { muralKeys, type FeedEntry } from './cache';
import { CommentsSheet } from './CommentsSheet';
import { ComposerSheet } from './ComposerSheet';
import { NotificationsSheet } from './NotificationsSheet';
import { PollCard } from './PollCard';
import { PostCard } from './PostCard';
import { useMural } from './useMural';

const viewabilityConfig = { itemVisiblePercentThreshold: 40 };

function Separator() {
  return <View style={styles.rule} />;
}

export function MuralScreen() {
  const mural = useMural();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<FeedEntry>>(null);
  const viewableRef = useRef(new Set<string>());
  const [viewTick, setViewTick] = useState(0);
  const [column, setColumn] = useState(0);
  const [composer, setComposer] = useState<{ mode: 'post' | 'poll'; editing: PostItem | null } | null>(null);
  const [menuPost, setMenuPost] = useState<PostItem | null>(null);
  const [commentsPostId, setCommentsPostId] = useState<number | null>(null);
  const [notifs, setNotifs] = useState(false);
  const [freshIds, setFreshIds] = useState<number[]>([]);
  const params = useLocalSearchParams<{ post?: string }>();
  const { user, feed, postsQuery, pollsQuery, notificationsQuery, deletePost, deleteComment, deletePoll, reactTo, toggleCommentLike, vote } = mural;
  const askDeletePost = useCallback((postId: number) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Alert.alert('Apagar publicação', 'A família deixa de ver este recado.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => deletePost(postId) },
    ]);
  }, [deletePost]);
  const askDeleteComment = useCallback((postId: number, commentId: number) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Alert.alert('Apagar comentário', 'O comentário sai do mural.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => deleteComment(postId, commentId) },
    ]);
  }, [deleteComment]);
  const askDeletePoll = useCallback((pollId: number) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Alert.alert('Apagar enquete', 'A família deixa de ver esta votação.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => deletePoll(pollId) },
    ]);
  }, [deletePoll]);
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    const next = new Set<string>();
    for (const token of viewableItems) if (token.isViewable && token.key != null) next.add(String(token.key));
    const previous = viewableRef.current;
    if (previous.size === next.size) {
      let same = true;
      for (const id of next) if (!previous.has(id)) { same = false; break; }
      if (same) return;
    }
    viewableRef.current = next;
    setViewTick(value => value + 1);
  }, []);
  useEffect(() => {
    if (postsQuery.isSuccess && pollsQuery.error) toast(pollsQuery.error.message, 'error');
  }, [pollsQuery.error, postsQuery.isSuccess, toast]);
  const { hasNextPage, isFetching, isFetchNextPageError, isSuccess, fetchNextPage } = postsQuery;
  useEffect(() => {
    if (feed.length === 0 && hasNextPage && !isFetching && !isFetchNextPageError && isSuccess) void fetchNextPage();
  }, [feed.length, hasNextPage, isFetching, isFetchNextPageError, isSuccess, fetchNextPage]);
  const openAuthor = useCallback((userId: number) => {
    if (!Number.isInteger(userId) || userId <= 0) return;
    router.push(`/familia/${userId}`);
  }, []);
  const renderItem = useCallback(({ item }: ListRenderItemInfo<FeedEntry>) => {
    if (!user) return null;
    const known = viewableRef.current.size > 0;
    const visible = !known || viewableRef.current.has(item.id);
    if (item.kind === 'post') return <PostCard post={item.post} width={column} visible={visible} meId={user.id} isAdmin={user.is_admin} onAuthor={openAuthor} onReact={reactTo} onOpenComments={setCommentsPostId} onOpenMenu={setMenuPost} onLikeComment={toggleCommentLike} onDeleteComment={askDeleteComment} />;
    return <PollCard poll={item.poll} canDelete={item.poll.created_by === user.id || user.is_admin} onAuthor={openAuthor} onVote={vote} onDelete={askDeletePoll} />;
  }, [user, column, openAuthor, reactTo, toggleCommentLike, vote, askDeleteComment, askDeletePoll]);
  function focusPost(postId: number) {
    const index = feed.findIndex(entry => entry.kind === 'post' && entry.post.id === postId);
    if (index < 0) { toast('Essa publicação não está nesta parte do mural.', 'error'); return; }
    setTimeout(() => { listRef.current?.scrollToIndex({ index, viewPosition: 0.08 }); }, 320);
  }
  // "Ver no mural" do álbum chega com ?post=<id>: busca páginas até achar o post e rola até ele.
  const alvoId = Number(params.post);
  useEffect(() => {
    if (!Number.isInteger(alvoId) || alvoId <= 0 || !isSuccess) return;
    const index = feed.findIndex(entry => entry.kind === 'post' && entry.post.id === alvoId);
    if (index >= 0) {
      router.setParams({ post: undefined });
      setTimeout(() => { listRef.current?.scrollToIndex({ index, viewPosition: 0.08 }); }, 320);
      return;
    }
    if (hasNextPage && !isFetching && !isFetchNextPageError) { void fetchNextPage(); return; }
    if (!hasNextPage || isFetchNextPageError) {
      router.setParams({ post: undefined });
      toast('Essa publicação não está nesta parte do mural.', 'error');
    }
  }, [alvoId, feed, isSuccess, hasNextPage, isFetching, isFetchNextPageError, fetchNextPage, toast]);
  function openNotifications() {
    const data = queryClient.getQueryData<NotificationsResponse>(muralKeys.notifications);
    setFreshIds((data?.items ?? []).filter(item => !item.read).map(item => item.id));
    setNotifs(true);
    if ((data?.unread ?? 0) > 0) mural.markNotificationsRead();
  }
  if (!user) return null;
  if (postsQuery.isPending) return <MuralSkeleton top={insets.top} />;
  if (!postsQuery.data) {
    const message = postsQuery.error instanceof Error ? postsQuery.error.message : 'Não conseguimos abrir o mural.';
    return <View style={styles.page}>
      <View style={styles.column} onLayout={event => setColumn(event.nativeEvent.layout.width)}>
        <Header top={insets.top} unread={notificationsQuery.data?.unread ?? 0} onBell={openNotifications} />
        <EmptyState title="Vamos tentar de novo?" message={message} action="Tentar de novo" onAction={() => { void postsQuery.refetch(); }} />
      </View>
    </View>;
  }
  const showEmpty = postsQuery.isSuccess && !pollsQuery.isPending && feed.length === 0;
  const unread = notificationsQuery.data?.unread ?? 0;
  return <View style={styles.page}>
    <View style={styles.column} onLayout={event => {
      const next = event.nativeEvent.layout.width;
      setColumn(current => Math.abs(current - next) < 1 ? current : next);
    }}>
      <Header top={insets.top} unread={unread} onBell={openNotifications} />
      <FlatList
        ref={listRef}
        data={feed}
        extraData={viewTick}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={Separator}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.list, feed.length === 0 && styles.listEmpty, { paddingBottom: insets.bottom + 96 }]}
        refreshControl={<RefreshControl refreshing={mural.refreshing} onRefresh={mural.refresh} tintColor={theme.colors.champagne} colors={[theme.colors.cherry]} progressBackgroundColor={theme.colors.surface} />}
        onEndReachedThreshold={0.45}
        onEndReached={() => {
          if (postsQuery.hasNextPage && !postsQuery.isFetchingNextPage && !postsQuery.isFetchNextPageError) void postsQuery.fetchNextPage();
        }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScrollToIndexFailed={info => {
          listRef.current?.scrollToOffset({ offset: Math.max(0, info.averageItemLength * info.index), animated: false });
          setTimeout(() => { listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.08 }); }, 180);
        }}
        initialNumToRender={2}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews={false}
        ListHeaderComponent={<Prompt name={user.name} avatar={user.avatar_url} onPost={() => setComposer({ mode: 'post', editing: null })} onPoll={() => setComposer({ mode: 'poll', editing: null })} />}
        ListEmptyComponent={showEmpty ? <EmptyState title="O mural está esperando" message="Publique uma foto, um recado ou abra uma enquete para a ceia." action="Fazer o primeiro post" onAction={() => setComposer({ mode: 'post', editing: null })} /> : undefined}
        ListFooterComponent={postsQuery.isFetchNextPageError ? <View style={styles.footer}>
          <Text variant="muted" style={styles.center}>{postsQuery.error instanceof Error ? postsQuery.error.message : 'Não deu para trazer o restante.'}</Text>
          <Pressable accessibilityRole="button" onPress={() => { void postsQuery.fetchNextPage(); }} style={styles.retry}><Text style={styles.retryLabel}>Tentar de novo</Text></Pressable>
        </View> : postsQuery.isFetchingNextPage ? <View style={styles.footer} accessibilityLabel="Trazendo mais publicações"><Skeleton style={{ height: 18, width: '46%' }} /><Skeleton style={{ height: 140 }} /></View> : undefined}
      />
      <PublishButton bottom={insets.bottom + 16} onPress={() => setComposer({ mode: 'post', editing: null })} />
      <ComposerSheet
        visible={composer !== null}
        initialMode={composer?.mode ?? 'post'}
        editing={composer?.editing ?? null}
        onClose={() => setComposer(null)}
        onSubmitPost={input => mural.publishPost(input, composer?.editing?.id ?? null)}
        onSubmitPoll={mural.publishPoll}
      />
      <CommentsSheet postId={commentsPostId} onClose={() => setCommentsPostId(null)} onSubmit={mural.addComment} onLike={mural.toggleCommentLike} onDelete={askDeleteComment} onAuthor={openAuthor} />
      <NotificationsSheet
        visible={notifs}
        items={notificationsQuery.data?.items ?? []}
        freshIds={freshIds}
        loading={notificationsQuery.isPending}
        error={notificationsQuery.isError ? notificationsQuery.error.message : null}
        onClose={() => setNotifs(false)}
        onRetry={() => { void notificationsQuery.refetch(); }}
        onSelect={focusPost}
      />
      <Sheet visible={menuPost !== null} onClose={() => setMenuPost(null)} title="Opções">
        {menuPost && user.is_admin ? <MenuRow label={menuPost.pinned ? 'Desafixar do topo' : 'Fixar no topo'} icon={<Pin size={18} color={theme.colors.champagne} strokeWidth={1.6} />} onPress={() => { const postId = menuPost.id; setMenuPost(null); mural.togglePin(postId); }} /> : null}
        {menuPost && menuPost.user_id === user.id ? <MenuRow label="Editar publicação" icon={<Pencil size={18} color={theme.colors.secondary} strokeWidth={1.6} />} onPress={() => { setComposer({ mode: 'post', editing: menuPost }); setMenuPost(null); }} /> : null}
        {menuPost && (menuPost.user_id === user.id || user.is_admin) ? <MenuRow label="Apagar" color={theme.colors.error} icon={<Trash size={18} color={theme.colors.error} strokeWidth={1.6} />} onPress={() => { const postId = menuPost.id; setMenuPost(null); askDeletePost(postId); }} /> : null}
        {menuPost && menuPost.user_id !== user.id ? <ModerationActions userId={menuPost.user_id} name={menuPost.user_name} postId={menuPost.id} onDone={() => setMenuPost(null)} /> : null}
      </Sheet>
    </View>
  </View>;
}

function Header({ top, unread, onBell }: { top: number; unread: number; onBell: () => void }) {
  const label = unread > 99 ? '99+' : String(unread);
  return <View style={[styles.header, { paddingTop: top + 12 }]}>
    <View style={styles.headerText}>
      <Text variant="kicker">Memórias e conversas</Text>
      <Text variant="display" accessibilityRole="header" style={styles.title}>Mural da família</Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={unread > 0 ? `Notificações, ${unread} ${unread === 1 ? 'não lida' : 'não lidas'}` : 'Notificações'} onPress={onBell} style={styles.bell}>
      <Bell size={20} color={theme.colors.ivory} strokeWidth={1.6} />
      {unread > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{label}</Text></View> : null}
    </Pressable>
  </View>;
}

function Prompt({ name, avatar, onPost, onPoll }: { name: string; avatar: string | null; onPost: () => void; onPoll: () => void }) {
  return <View style={styles.prompt}>
    <Avatar name={name} src={avatar} size={40} />
    <Pressable accessibilityRole="button" accessibilityLabel="Contar algo para a família" onPress={onPost} style={styles.promptField}>
      <Text variant="muted" numberOfLines={1}>Conte algo para a família</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Publicar foto" onPress={onPost} style={styles.promptIcon}><Camera size={18} color={theme.colors.champagne} strokeWidth={1.6} /></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Criar enquete" onPress={onPoll} style={styles.promptIcon}><ChartColumn size={18} color={theme.colors.secondary} strokeWidth={1.6} /></Pressable>
  </View>;
}

function MenuRow({ label, icon, onPress, color }: { label: string; icon: ReactNode; onPress: () => void; color?: string }) {
  return <Pressable accessibilityRole="button" onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress(); }} style={styles.menuRow}>
    {icon}
    <Text style={[styles.menuLabel, color ? { color } : null]}>{label}</Text>
  </Pressable>;
}

function PublishButton({ bottom, onPress }: { bottom: number; onPress: () => void }) {
  const reduced = useReduceMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return <Animated.View style={[styles.fab, { bottom }, animated]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Nova publicação" onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); onPress(); }} onPressIn={() => { if (!reduced) scale.set(withTiming(0.96, { duration: 100 })); }} onPressOut={() => { scale.set(withTiming(1, { duration: reduced ? 0 : 220 })); }} style={styles.fabHit}>
      <Plus size={26} color={theme.colors.ivory} strokeWidth={1.7} />
    </Pressable>
  </Animated.View>;
}

function MuralSkeleton({ top }: { top: number }) {
  return <View accessibilityLabel="Abrindo o mural" style={[styles.page, styles.skeleton, { paddingTop: top + 28 }]}>
    <Skeleton style={{ height: 12, width: 160 }} />
    <Skeleton style={{ height: 40, width: '72%' }} />
    <Skeleton style={{ height: 72 }} />
    <Skeleton style={{ height: 280, borderRadius: 0 }} />
    <Skeleton style={{ height: 18, width: '58%' }} />
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  column: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingBottom: 8 },
  headerText: { flex: 1, minWidth: 0, gap: 6 },
  title: { fontSize: 36, lineHeight: 44 },
  bell: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.field, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: theme.colors.cherry, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: theme.colors.ivory, fontSize: 10, lineHeight: 12, fontFamily: theme.fonts.semibold, fontVariant: ['tabular-nums'] },
  list: { paddingTop: 8 },
  listEmpty: { flexGrow: 1 },
  rule: { height: 1, backgroundColor: theme.colors.line, marginHorizontal: 20 },
  prompt: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface },
  promptField: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.field, justifyContent: 'center', paddingHorizontal: 14 },
  promptIcon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: theme.colors.line, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: 24, gap: 12 },
  center: { textAlign: 'center' },
  retry: { minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  retryLabel: { fontFamily: theme.fonts.medium },
  fab: { position: 'absolute', right: 18 },
  fabHit: { width: 58, height: 58, borderRadius: 29, backgroundColor: theme.colors.cherry, alignItems: 'center', justifyContent: 'center' },
  menuRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuLabel: { fontFamily: theme.fonts.medium, fontSize: 16 },
  skeleton: { paddingHorizontal: 20, gap: 16 },
});
