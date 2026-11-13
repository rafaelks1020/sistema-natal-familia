'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BarChart3, Camera, Sparkles } from 'lucide-react';
import Avatar from '@/app/ui/Avatar';
import LoopMedia from '@/app/ui/LoopMedia';
import PageHeader from '@/app/ui/PageHeader';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { useMe } from '@/app/ui/user';
import ComposerSheet from './_components/ComposerSheet';
import NotificationsSheet, { NotificationBellButton } from './_components/NotificationsSheet';
import PollCard from './_components/PollCard';
import PostCard from './_components/PostCard';
import type {
  CommentItem,
  NotificationItem,
  NotificationsResponse,
  PollItem,
  PostItem,
  ReactionType,
} from './types';

const PAGE_SIZE = 20;

function LoaderFallback() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-champagne/40 bg-carvao-2">
      <Sparkles size={22} strokeWidth={1.4} className="animate-pulse text-champagne" />
    </div>
  );
}

function EmptyTreeFallback() {
  return (
    <svg
      viewBox="0 0 64 80"
      className="mx-auto h-24 w-20 text-champagne"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <path d="M32 6 L34.5 13 L42 13 L36 17.5 L38.5 24.5 L32 20 L25.5 24.5 L28 17.5 L22 13 L29.5 13 Z" />
      <path
        d="M32 27 C 18 39, 46 42, 22 52 C 46 55, 44 65, 14 70 M32 27 C 46 37, 20 44, 42 52"
        strokeLinecap="round"
      />
    </svg>
  );
}

type FeedEntry =
  | { kind: 'post'; id: string; time: number; pinned: boolean; post: PostItem }
  | { kind: 'poll'; id: string; time: number; pinned: false; poll: PollItem };

export default function MuralClient({ initial }: { initial: PostItem[] }) {
  const me = useMe();
  const toast = useToast();
  const searchParams = useSearchParams();
  const targetPost = searchParams.get('post');
  const handledPostRef = useRef<string | null>(null);

  useEffect(() => {
    if (!targetPost) {
      handledPostRef.current = null;
      return;
    }
    if (handledPostRef.current === targetPost || !/^[1-9]\d*$/.test(targetPost)) return;
    handledPostRef.current = targetPost;
    const el = document.getElementById(`post-${targetPost}`);
    if (el) {
      el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    } else {
      toast('Esse post é mais antigo, role para ver');
    }
  }, [targetPost, toast]);

  const [posts, setPosts] = useState<PostItem[]>(initial);
  const [polls, setPolls] = useState<PollItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loading = false;
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const pageRequestRef = useRef(false);
  const [hasMore, setHasMore] = useState(initial.length >= PAGE_SIZE);

  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<'post' | 'poll'>('post');
  const [editingPost, setEditingPost] = useState<PostItem | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    async function loadInitial() {
      try {
        const [pollsData, notifData] = await Promise.all([
          api<PollItem[]>('/api/polls'),
          api<NotificationsResponse>('/api/notifications'),
        ]);
        if (!active) return;
        setPolls(pollsData);
        setNotifications(notifData.items);
        setUnreadCount(notifData.unread);
      } catch (err) {
        if (active) toast((err as Error).message, 'erro');
      }
    }
    loadInitial();
    return () => {
      active = false;
    };
  }, [toast]);

  const loadMorePosts = useCallback(async () => {
    if (loading || loadingMore || pageRequestRef.current || !hasMore) return;
    const unpinned = posts.filter((p) => !p.pinned);
    const oldest = unpinned.length > 0 ? unpinned[unpinned.length - 1] : posts[posts.length - 1];
    if (!oldest) {
      setHasMore(false);
      return;
    }

    pageRequestRef.current = true;
    setPageError(null);
    setLoadingMore(true);
    try {
      const nextBatch = await api<PostItem[]>(
        `/api/posts?limit=${PAGE_SIZE}&before=${oldest.id}`,
      );
      setPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const unique = nextBatch.filter((p) => !existingIds.has(p.id));
        return [...prev, ...unique];
      });
      if (nextBatch.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } catch (err) {
      setPageError((err as Error).message);
      toast((err as Error).message, 'erro');
    } finally {
      pageRequestRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, loading, loadingMore, posts, toast]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading || loadingMore || pageError) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          observer.disconnect();
          void loadMorePosts();
        }
      },
      { rootMargin: '280px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, pageError, loadMorePosts]);

  async function openNotifications() {
    setNotifOpen(true);
    if (unreadCount > 0) {
      const prevUnread = unreadCount;
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      try {
        await api('/api/notifications/read', { method: 'POST' });
      } catch {
        setUnreadCount(prevUnread);
      }
    }
  }

  function handleScrollToPost(postId: number) {
    const el = document.getElementById(`post-${postId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function handlePostSaved(saved: PostItem, isEdit: boolean) {
    if (isEdit) {
      setPosts((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
    } else {
      setPosts((prev) => {
        const pinned = prev.filter((p) => p.pinned);
        const unpinned = prev.filter((p) => !p.pinned);
        return [...pinned, saved, ...unpinned];
      });
    }
    setEditingPost(null);
  }

  function handlePollCreated(created: PollItem) {
    setPolls((prev) => [created, ...prev]);
  }

  async function handleReact(postId: number, type: ReactionType) {
    const previousPosts = posts;
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const already = p.my_reactions.includes(type);
        const currentCount = Number(p.reactions[type] ?? 0);
        const nextCount = already ? Math.max(0, currentCount - 1) : currentCount + 1;
        const nextReactions = { ...p.reactions, [type]: nextCount };
        const nextMy = already
          ? p.my_reactions.filter((t) => t !== type)
          : [...p.my_reactions, type];
        return { ...p, reactions: nextReactions, my_reactions: nextMy };
      }),
    );

    try {
      await api(`/api/posts/${postId}/reactions`, {
        method: 'POST',
        json: { type },
      });
    } catch (err) {
      setPosts(previousPosts);
      toast((err as Error).message, 'erro');
    }
  }

  async function handleLoadComments(postId: number) {
    try {
      const comments = await api<CommentItem[]>(`/api/posts/${postId}/comments`);
      setPosts((prev) => prev.map((p) => p.id === postId
        ? { ...p, comments, comments_count: comments.length } : p));
      return true;
    } catch (err) {
      toast((err as Error).message, 'erro');
      return false;
    }
  }

  async function handleAddComment(postId: number, content: string): Promise<boolean> {
    const tempId = -Date.now();
    const optimisticComment: CommentItem = {
      id: tempId,
      user_id: me.id,
      user_name: me.name,
      avatar_url: me.avatar_url,
      content,
      created_at: new Date().toISOString(),
      likes: 0,
      liked_by_me: false,
    };

    const previousPosts = posts;
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments: [...p.comments, optimisticComment], comments_count: p.comments_count + 1 } : p)),
    );

    try {
      const saved = await api<CommentItem>(`/api/posts/${postId}/comments`, {
        method: 'POST',
        json: { content },
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, comments: p.comments.map((c) => (c.id === tempId ? saved : c)) }
            : p,
        ),
      );
      return true;
    } catch (err) {
      setPosts(previousPosts);
      toast((err as Error).message, 'erro');
      return false;
    }
  }

  async function handleDeleteComment(postId: number, commentId: number) {
    const previousPosts = posts;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comments: p.comments.filter((c) => c.id !== commentId), comments_count: Math.max(0, p.comments_count - 1) } : p,
      ),
    );

    try {
      await api(`/api/comments/${commentId}`, { method: 'DELETE' });
    } catch (err) {
      setPosts(previousPosts);
      toast((err as Error).message, 'erro');
    }
  }

  async function handleToggleCommentLike(postId: number, commentId: number) {
    const previousPosts = posts;
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          comments: p.comments.map((c) => {
            if (c.id !== commentId) return c;
            const nextLiked = !c.liked_by_me;
            const nextLikes = nextLiked ? c.likes + 1 : Math.max(0, c.likes - 1);
            return { ...c, liked_by_me: nextLiked, likes: nextLikes };
          }),
        };
      }),
    );

    try {
      await api(`/api/comments/${commentId}/like`, { method: 'POST' });
    } catch (err) {
      setPosts(previousPosts);
      toast((err as Error).message, 'erro');
    }
  }

  async function handleDeletePost(postId: number) {
    const previousPosts = posts;
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    try {
      await api(`/api/posts/${postId}`, { method: 'DELETE' });
      toast('Publicação apagada');
    } catch (err) {
      setPosts(previousPosts);
      toast((err as Error).message, 'erro');
    }
  }

  async function handleTogglePin(postId: number) {
    const previousPosts = posts;
    setPosts((prev) => {
      const updated = prev.map((p) => (p.id === postId ? { ...p, pinned: !p.pinned } : p));
      return [...updated].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.id - a.id;
      });
    });

    try {
      const res = await api<{ id: number; pinned: boolean }>(`/api/posts/${postId}/pin`, {
        method: 'POST',
      });
      toast(res.pinned ? 'Fixado no topo do mural' : 'Publicação desafixada');
    } catch (err) {
      setPosts(previousPosts);
      toast((err as Error).message, 'erro');
    }
  }

  async function handleVotePoll(pollId: number, optionIndex: number) {
    const previousPolls = polls;
    setPolls((prev) =>
      prev.map((poll) => {
        if (poll.id !== pollId) return poll;
        if (poll.my_vote === optionIndex) return poll;
        const nextVotes = [...poll.votes];
        if (poll.my_vote !== null && nextVotes[poll.my_vote] !== undefined) {
          nextVotes[poll.my_vote] = Math.max(0, nextVotes[poll.my_vote] - 1);
        }
        nextVotes[optionIndex] = (nextVotes[optionIndex] ?? 0) + 1;
        const nextTotal = nextVotes.reduce((acc, n) => acc + n, 0);
        return {
          ...poll,
          votes: nextVotes,
          my_vote: optionIndex,
          total: nextTotal,
        };
      }),
    );

    try {
      const updated = await api<{ id: number; votes: number[]; my_vote: number; total: number }>(
        `/api/polls/${pollId}/vote`,
        { method: 'POST', json: { option_index: optionIndex } },
      );
      setPolls((prev) =>
        prev.map((p) =>
          p.id === pollId
            ? { ...p, votes: updated.votes, my_vote: updated.my_vote, total: updated.total }
            : p,
        ),
      );
    } catch (err) {
      setPolls(previousPolls);
      toast((err as Error).message, 'erro');
    }
  }

  async function handleDeletePoll(pollId: number) {
    const previousPolls = polls;
    setPolls((prev) => prev.filter((p) => p.id !== pollId));
    try {
      await api(`/api/polls/${pollId}`, { method: 'DELETE' });
      toast('Enquete apagada');
    } catch (err) {
      setPolls(previousPolls);
      toast((err as Error).message, 'erro');
    }
  }

  const feedEntries = useMemo<FeedEntry[]>(() => {
    const pinnedEntries: FeedEntry[] = [];
    const regularEntries: FeedEntry[] = [];

    for (const post of posts) {
      const time = new Date(post.created_at).getTime() || 0;
      if (post.pinned) {
        pinnedEntries.push({ kind: 'post', id: `post-${post.id}`, time, pinned: true, post });
      } else {
        regularEntries.push({ kind: 'post', id: `post-${post.id}`, time, pinned: false, post });
      }
    }

    for (const poll of polls) {
      const time = new Date(poll.created_at).getTime() || 0;
      regularEntries.push({ kind: 'poll', id: `poll-${poll.id}`, time, pinned: false, poll });
    }

    regularEntries.sort((a, b) => b.time - a.time);
    return [...pinnedEntries, ...regularEntries];
  }, [posts, polls]);

  return (
    <div className="min-h-dvh">
      <PageHeader
        kicker="Memórias e conversas"
        title="Mural da família"
        back="/familia"
        action={<NotificationBellButton unread={unreadCount} onClick={openNotifications} />}
      />

      {/* Compositor no topo */}
      <section className="rise px-5 pb-4">
        <div className="surface flex items-center gap-3 p-3">
          <Avatar name={me.name} src={me.avatar_url} size={40} ring />
          <button
            type="button"
            onClick={() => {
              setEditingPost(null);
              setComposerMode('post');
              setComposerOpen(true);
            }}
            className="flex min-h-[44px] flex-1 items-center rounded-full border border-linha bg-carvao-3/70 px-4 text-left text-sm text-marfim-2 transition-colors hover:border-champagne/60 hover:text-marfim"
          >
            Conte algo para a família
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingPost(null);
              setComposerMode('post');
              setComposerOpen(true);
            }}
            aria-label="Publicar foto"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-linha text-champagne hover:border-champagne/60"
          >
            <Camera size={18} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingPost(null);
              setComposerMode('poll');
              setComposerOpen(true);
            }}
            aria-label="Criar enquete"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-linha text-marfim-2 hover:border-champagne/60 hover:text-champagne"
          >
            <BarChart3 size={18} strokeWidth={1.5} />
          </button>
        </div>
      </section>

      <div className="rule" />

      {/* Estado de carregamento */}
      {loading ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <LoopMedia
            name="mn-loader"
            className="h-14 w-14 rounded-full"
            fallback={<LoaderFallback />}
          />
          <p className="mt-4 text-sm text-marfim-2">Abrindo o álbum de conversas da família...</p>
        </div>
      ) : feedEntries.length === 0 ? (
        /* Estado vazio */
        <div className="rise px-6 py-16 text-center">
          <div className="mx-auto mb-5 flex h-28 w-28 items-center justify-center rounded-full border border-linha bg-carvao-2/60">
            <LoopMedia
              name="mn-vazio"
              className="h-24 w-24 rounded-full"
              fallback={<EmptyTreeFallback />}
            />
          </div>
          <p className="kicker mb-2">Noite silenciosa</p>
          <h2 className="display text-2xl text-marfim">O mural está esperando a primeira lembrança</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-marfim-2">
            Publique uma foto dos preparativos, uma receita de família ou abra uma enquete para a ceia.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingPost(null);
              setComposerMode('post');
              setComposerOpen(true);
            }}
            className="btn btn-primary mt-6"
          >
            Fazer o primeiro post
          </button>
        </div>
      ) : (
        /* Feed editorial */
        <div className="stagger">
          {feedEntries.map((entry, idx) => (
            <div key={entry.id}>
              {idx > 0 && <div className="rule" />}
              {entry.kind === 'post' ? (
                <PostCard
                  post={entry.post}
                  meId={me.id}
                  isAdmin={me.is_admin}
                  onReact={handleReact}
                  onAddComment={handleAddComment}
                  onLoadComments={handleLoadComments}
                  onDeleteComment={handleDeleteComment}
                  onToggleCommentLike={handleToggleCommentLike}
                  onEditPost={(p) => {
                    setEditingPost(p);
                    setComposerMode('post');
                    setComposerOpen(true);
                  }}
                  onDeletePost={handleDeletePost}
                  onTogglePin={handleTogglePin}
                />
              ) : (
                <PollCard
                  poll={entry.poll}
                  canDelete={entry.poll.created_by === me.id || me.is_admin}
                  onVote={handleVotePoll}
                  onDelete={handleDeletePoll}
                />
              )}
            </div>
          ))}

          <div ref={sentinelRef} className="h-6" />
          {pageError && (
            <div className="px-5 pb-5 text-center">
              <p className="mb-2 text-sm text-marfim-2">{pageError}</p>
              <button type="button" className="btn btn-ghost" disabled={loadingMore}
                onClick={() => void loadMorePosts()}>Tentar de novo</button>
            </div>
          )}

          {loadingMore && (
            <div className="flex justify-center py-6">
              <LoaderFallback />
            </div>
          )}
        </div>
      )}

      <ComposerSheet
        open={composerOpen}
        initialMode={composerMode}
        editingPost={editingPost}
        onClose={() => {
          setComposerOpen(false);
          setEditingPost(null);
        }}
        onPostSaved={handlePostSaved}
        onPollCreated={handlePollCreated}
      />

      <NotificationsSheet
        open={notifOpen}
        items={notifications}
        onClose={() => setNotifOpen(false)}
        onSelectPost={handleScrollToPost}
      />
    </div>
  );
}
