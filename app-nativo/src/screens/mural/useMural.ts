import { useCallback, useMemo, useRef } from 'react';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { api, ApiError, queryClient, sessionStore } from '../../api';
import { useSession } from '../../session';
import type { User } from '../../types';
import type { CommentItem, CommentLikeResult, NotificationsResponse, OkResult, PinResult, PollItem, PostItem, PostWrite, ReactionResult, ReactionType, VoteResult } from '../../types/mural';
import { useToast } from '../../ui/Toast';
import {
  appendComment, applyCommentLike, applyReaction, applyVote, applyVoteResult, buildFeed, flattenPosts, insertPost, mapCommentList,
  mapPolls, mapPosts, mergePost, MURAL_PAGE_SIZE, muralKeys, normalizeNotifications, normalizePoll, normalizePost, normalizePostWrite,
  removePost, replaceComment, setCommentLiked, setReactionActive, withPoll, withoutComment, withoutPoll, type PostsData,
} from './cache';

function sameSession(generation: number) {
  return generation === sessionStore.getGeneration() && sessionStore.getSnapshot().status === 'authenticated';
}

export function useMural() {
  const { user } = useSession();
  const toast = useToast();
  const pending = useRef(new Set<string>());
  const enabled = Boolean(user);
  const postsQuery = useInfiniteQuery<PostItem[], Error, PostsData, typeof muralKeys.posts, number | null>({
    queryKey: muralKeys.posts,
    enabled,
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: String(MURAL_PAGE_SIZE) });
      if (pageParam !== null) params.set('before', String(pageParam));
      const rows = await api<PostItem[]>(`/api/posts?${params.toString()}`, { signal });
      if (!Array.isArray(rows)) throw new ApiError('O mural veio em um formato inesperado.', 502);
      return rows.map(row => normalizePost(row));
    },
    // O cursor é o id do post não fixado mais antigo. Fixados só vêm na primeira página.
    getNextPageParam: (lastPage, _pages, lastPageParam) => {
      if (lastPage.length < MURAL_PAGE_SIZE) return undefined;
      const unpinned = lastPage.filter(post => !post.pinned);
      const oldest = unpinned[unpinned.length - 1] ?? lastPage[lastPage.length - 1];
      if (!oldest || oldest.id === lastPageParam) return undefined;
      return oldest.id;
    },
  });
  const pollsQuery = useQuery({
    queryKey: muralKeys.polls,
    enabled,
    queryFn: async ({ signal }) => {
      const rows = await api<PollItem[]>('/api/polls', { signal });
      if (!Array.isArray(rows)) throw new ApiError('As enquetes vieram em um formato inesperado.', 502);
      return rows.map(row => normalizePoll(row));
    },
  });
  const notificationsQuery = useQuery({
    queryKey: muralKeys.notifications,
    enabled,
    queryFn: async ({ signal }) => normalizeNotifications(await api<NotificationsResponse>('/api/notifications', { signal })),
  });
  const posts = useMemo(() => flattenPosts(postsQuery.data), [postsQuery.data]);
  const feed = useMemo(() => buildFeed(posts, pollsQuery.data ?? []), [posts, pollsQuery.data]);

  const reactionMutation = useMutation({
    mutationFn: async ({ postId, type, generation }: { postId: number; type: ReactionType; generation: number }) => {
      if (!sameSession(generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return api<ReactionResult>(`/api/posts/${postId}/reactions`, { method: 'POST', json: { type } });
    },
    onMutate: async ({ postId, type, generation }) => {
      await queryClient.cancelQueries({ queryKey: muralKeys.posts });
      const previous = queryClient.getQueryData<PostsData>(muralKeys.posts);
      if (previous && sameSession(generation)) queryClient.setQueryData<PostsData>(muralKeys.posts, mapPosts(previous, postId, post => applyReaction(post, type)));
      return { previous, generation };
    },
    onError: (error, _vars, context) => {
      if (context?.previous && sameSession(context.generation)) queryClient.setQueryData(muralKeys.posts, context.previous);
      toast(error.message, 'error');
    },
    onSuccess: (result, { postId, type, generation }) => {
      if (!sameSession(generation) || result.type !== type) return;
      queryClient.setQueryData<PostsData>(muralKeys.posts, current => mapPosts(current, postId, post => setReactionActive(post, type, result.active)));
    },
    onSettled: (_data, _error, vars) => { pending.current.delete(`react:${vars.postId}:${vars.type}`); },
  });

  const likeMutation = useMutation({
    mutationFn: async ({ commentId, generation }: { postId: number; commentId: number; generation: number }) => {
      if (!sameSession(generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return api<CommentLikeResult>(`/api/comments/${commentId}/like`, { method: 'POST' });
    },
    onMutate: async ({ postId, commentId, generation }) => {
      await queryClient.cancelQueries({ queryKey: muralKeys.posts });
      await queryClient.cancelQueries({ queryKey: muralKeys.comments(postId) });
      const previousPosts = queryClient.getQueryData<PostsData>(muralKeys.posts);
      const previousComments = queryClient.getQueryData<CommentItem[]>(muralKeys.comments(postId));
      if (sameSession(generation)) {
        queryClient.setQueryData<PostsData>(muralKeys.posts, mapPosts(previousPosts, postId, post => ({ ...post, comments: post.comments.map(comment => comment.id === commentId ? applyCommentLike(comment) : comment) })));
        queryClient.setQueryData<CommentItem[]>(muralKeys.comments(postId), mapCommentList(previousComments, commentId, applyCommentLike));
      }
      return { previousPosts, previousComments, generation, postId };
    },
    onError: (error, _vars, context) => {
      if (context && sameSession(context.generation)) {
        queryClient.setQueryData(muralKeys.posts, context.previousPosts);
        queryClient.setQueryData(muralKeys.comments(context.postId), context.previousComments);
      }
      toast(error.message, 'error');
    },
    onSuccess: (result, { postId, commentId, generation }) => {
      if (!sameSession(generation)) return;
      const fix = (comment: CommentItem) => setCommentLiked(comment, result.liked);
      queryClient.setQueryData<PostsData>(muralKeys.posts, current => mapPosts(current, postId, post => ({ ...post, comments: post.comments.map(comment => comment.id === commentId ? fix(comment) : comment) })));
      queryClient.setQueryData<CommentItem[]>(muralKeys.comments(postId), current => current?.map(comment => comment.id === commentId ? fix(comment) : comment));
    },
    onSettled: (_data, _error, vars) => { pending.current.delete(`like:${vars.commentId}`); },
  });

  const addMutation = useMutation({
    mutationFn: async ({ postId, content, generation }: { postId: number; content: string; tempId: number; user: User; generation: number }) => {
      if (!sameSession(generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return normalizeCommentSafe(await api<CommentItem>(`/api/posts/${postId}/comments`, { method: 'POST', json: { content } }));
    },
    onMutate: async ({ postId, content, tempId, user: actor, generation }) => {
      await queryClient.cancelQueries({ queryKey: muralKeys.posts });
      await queryClient.cancelQueries({ queryKey: muralKeys.comments(postId) });
      const optimistic: CommentItem = { id: tempId, user_id: actor.id, user_name: actor.name, avatar_url: actor.avatar_url, content, created_at: new Date().toISOString(), likes: 0, liked_by_me: false };
      const previousPosts = queryClient.getQueryData<PostsData>(muralKeys.posts);
      const previousComments = queryClient.getQueryData<CommentItem[]>(muralKeys.comments(postId));
      if (sameSession(generation)) {
        queryClient.setQueryData<PostsData>(muralKeys.posts, mapPosts(previousPosts, postId, post => appendComment(post, optimistic)));
        queryClient.setQueryData<CommentItem[]>(muralKeys.comments(postId), current => current ? [...current, optimistic] : current);
      }
      return { previousPosts, previousComments, generation, postId };
    },
    onError: (_error, _vars, context) => {
      if (context && sameSession(context.generation)) {
        queryClient.setQueryData(muralKeys.posts, context.previousPosts);
        queryClient.setQueryData(muralKeys.comments(context.postId), context.previousComments);
      }
    },
    onSuccess: (saved, { postId, tempId, generation }) => {
      if (!sameSession(generation)) return;
      queryClient.setQueryData<PostsData>(muralKeys.posts, current => mapPosts(current, postId, post => replaceComment(post, tempId, saved)));
      queryClient.setQueryData<CommentItem[]>(muralKeys.comments(postId), current => current?.map(comment => comment.id === tempId ? saved : comment));
    },
    onSettled: (_data, _error, vars) => { pending.current.delete(`comment:${vars.postId}`); },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async ({ commentId, generation }: { postId: number; commentId: number; generation: number }) => {
      if (!sameSession(generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return api<OkResult>(`/api/comments/${commentId}`, { method: 'DELETE' });
    },
    onMutate: async ({ postId, commentId, generation }) => {
      await queryClient.cancelQueries({ queryKey: muralKeys.posts });
      await queryClient.cancelQueries({ queryKey: muralKeys.comments(postId) });
      const previousPosts = queryClient.getQueryData<PostsData>(muralKeys.posts);
      const previousComments = queryClient.getQueryData<CommentItem[]>(muralKeys.comments(postId));
      if (sameSession(generation)) {
        queryClient.setQueryData<PostsData>(muralKeys.posts, mapPosts(previousPosts, postId, post => withoutComment(post, commentId)));
        queryClient.setQueryData<CommentItem[]>(muralKeys.comments(postId), current => current?.filter(comment => comment.id !== commentId));
      }
      return { previousPosts, previousComments, generation, postId };
    },
    onError: (error, _vars, context) => {
      if (context && sameSession(context.generation)) {
        queryClient.setQueryData(muralKeys.posts, context.previousPosts);
        queryClient.setQueryData(muralKeys.comments(context.postId), context.previousComments);
      }
      toast(error.message, 'error');
    },
    onSettled: (_data, _error, vars) => { pending.current.delete(`delete-comment:${vars.commentId}`); },
  });

  const deletePostMutation = useMutation({
    mutationFn: async ({ postId, generation }: { postId: number; generation: number }) => {
      if (!sameSession(generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return api<OkResult>(`/api/posts/${postId}`, { method: 'DELETE' });
    },
    onMutate: async ({ postId, generation }) => {
      await queryClient.cancelQueries({ queryKey: muralKeys.posts });
      const previous = queryClient.getQueryData<PostsData>(muralKeys.posts);
      if (sameSession(generation)) queryClient.setQueryData<PostsData>(muralKeys.posts, removePost(previous, postId));
      return { previous, generation };
    },
    onError: (error, _vars, context) => {
      if (context?.previous && sameSession(context.generation)) queryClient.setQueryData(muralKeys.posts, context.previous);
      toast(error.message, 'error');
    },
    onSuccess: (_data, { generation }) => { if (sameSession(generation)) toast('Publicação apagada.'); },
    onSettled: (_data, _error, { generation }) => {
      pending.current.delete('delete-post');
      if (sameSession(generation)) void queryClient.invalidateQueries({ queryKey: muralKeys.posts });
    },
  });

  const pinMutation = useMutation({
    mutationFn: async ({ postId, generation }: { postId: number; generation: number }) => {
      if (!sameSession(generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return api<PinResult>(`/api/posts/${postId}/pin`, { method: 'POST' });
    },
    onMutate: async ({ postId, generation }) => {
      await queryClient.cancelQueries({ queryKey: muralKeys.posts });
      const previous = queryClient.getQueryData<PostsData>(muralKeys.posts);
      if (sameSession(generation)) queryClient.setQueryData<PostsData>(muralKeys.posts, mapPosts(previous, postId, post => ({ ...post, pinned: !post.pinned })));
      return { previous, generation };
    },
    onError: (error, _vars, context) => {
      if (context?.previous && sameSession(context.generation)) queryClient.setQueryData(muralKeys.posts, context.previous);
      toast(error.message, 'error');
    },
    onSuccess: (result, { postId, generation }) => {
      if (!sameSession(generation)) return;
      queryClient.setQueryData<PostsData>(muralKeys.posts, mapPosts(queryClient.getQueryData(muralKeys.posts), postId, post => ({ ...post, pinned: result.pinned })));
      toast(result.pinned ? 'Fixado no topo do mural.' : 'Publicação desafixada.');
    },
    onSettled: (_data, _error, { generation, postId }) => {
      pending.current.delete(`pin:${postId}`);
      if (sameSession(generation)) void queryClient.invalidateQueries({ queryKey: muralKeys.posts });
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ content, images, generation }: { content: string; images: string[]; generation: number }) => {
      if (!sameSession(generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return normalizePost(await api<PostItem>('/api/posts', { method: 'POST', json: { content, images } }));
    },
    onSuccess: (post, { generation }) => {
      if (!sameSession(generation)) return;
      queryClient.setQueryData<PostsData>(muralKeys.posts, current => insertPost(current, post));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast('Publicado no mural.');
    },
    onSettled: (_data, _error, { generation }) => { if (sameSession(generation)) void queryClient.invalidateQueries({ queryKey: muralKeys.posts }); },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, content, images, generation }: { id: number; content: string; images: string[]; generation: number }) => {
      if (!sameSession(generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return normalizePostWrite(await api<PostWrite>(`/api/posts/${id}`, { method: 'PUT', json: { content, images } }));
    },
    onSuccess: (saved, { generation }) => {
      if (!sameSession(generation)) return;
      queryClient.setQueryData<PostsData>(muralKeys.posts, current => mapPosts(current, saved.id, post => mergePost(post, saved)));
      toast('Publicação atualizada.');
    },
    onSettled: (_data, _error, { generation }) => { if (sameSession(generation)) void queryClient.invalidateQueries({ queryKey: muralKeys.posts }); },
  });

  const createPollMutation = useMutation({
    mutationFn: async ({ question, options, generation }: { question: string; options: string[]; generation: number }) => {
      if (!sameSession(generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return normalizePoll(await api<PollItem>('/api/polls', { method: 'POST', json: { question, options } }));
    },
    onSuccess: (poll, { generation }) => {
      if (!sameSession(generation)) return;
      queryClient.setQueryData<PollItem[]>(muralKeys.polls, current => withPoll(current, poll));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast('Enquete publicada.');
    },
    onSettled: (_data, _error, { generation }) => { if (sameSession(generation)) void queryClient.invalidateQueries({ queryKey: muralKeys.polls }); },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ pollId, optionIndex, generation }: { pollId: number; optionIndex: number; generation: number }) => {
      if (!sameSession(generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return api<VoteResult>(`/api/polls/${pollId}/vote`, { method: 'POST', json: { option_index: optionIndex } });
    },
    onMutate: async ({ pollId, optionIndex, generation }) => {
      await queryClient.cancelQueries({ queryKey: muralKeys.polls });
      const previous = queryClient.getQueryData<PollItem[]>(muralKeys.polls);
      if (sameSession(generation)) queryClient.setQueryData<PollItem[]>(muralKeys.polls, mapPolls(previous, pollId, poll => applyVote(poll, optionIndex)));
      return { previous, generation };
    },
    onError: (error, _vars, context) => {
      if (context?.previous && sameSession(context.generation)) queryClient.setQueryData(muralKeys.polls, context.previous);
      toast(error.message, 'error');
    },
    onSuccess: (result, { pollId, generation }) => {
      if (!sameSession(generation)) return;
      queryClient.setQueryData<PollItem[]>(muralKeys.polls, current => mapPolls(current, pollId, poll => applyVoteResult(poll, result)));
    },
    onSettled: (_data, _error, { pollId, generation }) => {
      pending.current.delete(`vote:${pollId}`);
      if (sameSession(generation)) void queryClient.invalidateQueries({ queryKey: muralKeys.polls });
    },
  });

  const deletePollMutation = useMutation({
    mutationFn: async ({ pollId, generation }: { pollId: number; generation: number }) => {
      if (!sameSession(generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return api<OkResult>(`/api/polls/${pollId}`, { method: 'DELETE' });
    },
    onMutate: async ({ pollId, generation }) => {
      await queryClient.cancelQueries({ queryKey: muralKeys.polls });
      const previous = queryClient.getQueryData<PollItem[]>(muralKeys.polls);
      if (sameSession(generation)) queryClient.setQueryData<PollItem[]>(muralKeys.polls, withoutPoll(previous, pollId));
      return { previous, generation };
    },
    onError: (error, _vars, context) => {
      if (context?.previous && sameSession(context.generation)) queryClient.setQueryData(muralKeys.polls, context.previous);
      toast(error.message, 'error');
    },
    onSuccess: (_data, { generation }) => { if (sameSession(generation)) toast('Enquete apagada.'); },
    onSettled: (_data, _error, { generation }) => {
      pending.current.delete('delete-poll');
      if (sameSession(generation)) void queryClient.invalidateQueries({ queryKey: muralKeys.polls });
    },
  });

  const readMutation = useMutation({
    mutationFn: async (generation: number) => {
      if (!sameSession(generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return api<OkResult>('/api/notifications/read', { method: 'POST' });
    },
    onMutate: async generation => {
      await queryClient.cancelQueries({ queryKey: muralKeys.notifications });
      const previous = queryClient.getQueryData<NotificationsResponse>(muralKeys.notifications);
      if (previous && sameSession(generation)) queryClient.setQueryData<NotificationsResponse>(muralKeys.notifications, { unread: 0, items: previous.items.map(item => ({ ...item, read: true })) });
      return { previous, generation };
    },
    onError: (error, _vars, context) => {
      if (context?.previous && sameSession(context.generation)) queryClient.setQueryData(muralKeys.notifications, context.previous);
      toast(error.message, 'error');
    },
    onSettled: (_data, _error, generation) => { if (sameSession(generation)) void queryClient.invalidateQueries({ queryKey: muralKeys.notifications }); },
  });

  const { mutate: reactMutate } = reactionMutation;
  const { mutate: likeMutate } = likeMutation;
  const { mutateAsync: addAsync } = addMutation;
  const { mutate: deleteCommentMutate } = deleteCommentMutation;
  const { mutate: deletePostMutate } = deletePostMutation;
  const { mutate: pinMutate } = pinMutation;
  const { mutateAsync: createAsync } = createMutation;
  const { mutateAsync: editAsync } = editMutation;
  const { mutateAsync: createPollAsync } = createPollMutation;
  const { mutate: voteMutate } = voteMutation;
  const { mutate: deletePollMutate } = deletePollMutation;
  const { mutate: readMutate } = readMutation;

  const reactTo = useCallback((postId: number, type: ReactionType) => {
    const key = `react:${postId}:${type}`;
    if (pending.current.has(key)) return;
    pending.current.add(key);
    reactMutate({ postId, type, generation: sessionStore.getGeneration() });
  }, [reactMutate]);

  const toggleCommentLike = useCallback((postId: number, commentId: number) => {
    if (commentId <= 0) return;
    const key = `like:${commentId}`;
    if (pending.current.has(key)) return;
    pending.current.add(key);
    likeMutate({ postId, commentId, generation: sessionStore.getGeneration() });
  }, [likeMutate]);

  const addComment = useCallback((postId: number, content: string) => {
    if (!user) return Promise.reject(new Error('Entre com seu usuário para continuar.'));
    const key = `comment:${postId}`;
    if (pending.current.has(key)) return Promise.reject(new Error('O comentário anterior ainda está a caminho.'));
    pending.current.add(key);
    return addAsync({ postId, content, tempId: -Date.now(), user, generation: sessionStore.getGeneration() });
  }, [addAsync, user]);

  const deleteComment = useCallback((postId: number, commentId: number) => {
    if (commentId <= 0) return;
    const key = `delete-comment:${commentId}`;
    if (pending.current.has(key)) return;
    pending.current.add(key);
    deleteCommentMutate({ postId, commentId, generation: sessionStore.getGeneration() });
  }, [deleteCommentMutate]);

  const deletePost = useCallback((postId: number) => {
    if (pending.current.has('delete-post')) return;
    pending.current.add('delete-post');
    deletePostMutate({ postId, generation: sessionStore.getGeneration() });
  }, [deletePostMutate]);

  const togglePin = useCallback((postId: number) => {
    const key = `pin:${postId}`;
    if (pending.current.has(key)) return;
    pending.current.add(key);
    pinMutate({ postId, generation: sessionStore.getGeneration() });
  }, [pinMutate]);

  const publishPost = useCallback((input: { content: string; images: string[] }, editingId: number | null) => {
    const generation = sessionStore.getGeneration();
    if (editingId === null) return createAsync({ ...input, generation });
    return editAsync({ id: editingId, ...input, generation });
  }, [createAsync, editAsync]);

  const publishPoll = useCallback((input: { question: string; options: string[] }) => {
    return createPollAsync({ ...input, generation: sessionStore.getGeneration() });
  }, [createPollAsync]);

  const vote = useCallback((pollId: number, optionIndex: number) => {
    const polls = queryClient.getQueryData<PollItem[]>(muralKeys.polls);
    const poll = polls?.find(item => item.id === pollId);
    if (!poll || poll.my_vote === optionIndex || optionIndex < 0 || optionIndex >= poll.options.length) return;
    const key = `vote:${pollId}`;
    if (pending.current.has(key)) return;
    pending.current.add(key);
    voteMutate({ pollId, optionIndex, generation: sessionStore.getGeneration() });
  }, [voteMutate]);

  const deletePoll = useCallback((pollId: number) => {
    if (pending.current.has('delete-poll')) return;
    pending.current.add('delete-poll');
    deletePollMutate({ pollId, generation: sessionStore.getGeneration() });
  }, [deletePollMutate]);

  const markNotificationsRead = useCallback(() => { readMutate(sessionStore.getGeneration()); }, [readMutate]);

  const refresh = useCallback(() => {
    void postsQuery.refetch();
    void pollsQuery.refetch();
    void notificationsQuery.refetch();
  }, [postsQuery, pollsQuery, notificationsQuery]);

  return {
    user, feed, postsQuery, pollsQuery, notificationsQuery, refresh,
    refreshing: (postsQuery.isRefetching && !postsQuery.isFetchingNextPage) || pollsQuery.isRefetching,
    reactTo, toggleCommentLike, addComment, deleteComment, deletePost, togglePin, publishPost, publishPoll, vote, deletePoll, markNotificationsRead,
  };
}

function normalizeCommentSafe(raw: CommentItem): CommentItem {
  return normalizePost({ comments: [raw] }).comments[0] ?? raw;
}
