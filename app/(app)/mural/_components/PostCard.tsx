'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Heart,
  Laugh,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Pin,
  Send,
  Star,
  Trash2,
  Wine,
} from 'lucide-react';
import Avatar from '@/app/ui/Avatar';
import LoopMedia from '@/app/ui/LoopMedia';
import { timeAgo } from '@/app/ui/client';
import type { PostItem, ReactionType } from '../types';

const REACTIONS: {
  type: ReactionType;
  label: string;
  icon: typeof Heart;
}[] = [
  { type: 'coracao', label: 'Coração', icon: Heart },
  { type: 'estrela', label: 'Estrela', icon: Star },
  { type: 'risada', label: 'Risada', icon: Laugh },
  { type: 'brinde', label: 'Brinde', icon: Wine },
];

interface Props {
  post: PostItem;
  meId: number;
  isAdmin: boolean;
  onReact: (postId: number, type: ReactionType) => void;
  onAddComment: (postId: number, content: string) => Promise<void>;
  onLoadComments: (postId: number) => Promise<boolean>;
  onDeleteComment: (postId: number, commentId: number) => void;
  onToggleCommentLike: (postId: number, commentId: number) => void;
  onEditPost: (post: PostItem) => void;
  onDeletePost: (postId: number) => void;
  onTogglePin: (postId: number) => void;
}

export default function PostCard({
  post,
  meId,
  isAdmin,
  onReact,
  onAddComment,
  onLoadComments,
  onDeleteComment,
  onToggleCommentLike,
  onEditPost,
  onDeletePost,
  onTogglePin,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentBursts, setCommentBursts] = useState<Set<number>>(() => new Set());
  const commentTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [heartBurst, setHeartBurst] = useState(false);

  const lastTapRef = useRef<number>(0);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const commentInputRef = useRef<HTMLInputElement | null>(null);

  const isOwner = post.user_id === meId;
  const canManage = isOwner || isAdmin;

  function triggerHeartEffect() {
    setHeartBurst(true);
    setTimeout(() => setHeartBurst(false), 750);
  }

  function handleHeartReaction() {
    triggerHeartEffect();
    onReact(post.id, 'coracao');
  }

  function handlePhotoTap() {
    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      triggerHeartEffect();
      if (!post.my_reactions.includes('coracao')) {
        onReact(post.id, 'coracao');
      }
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }

  function handleCarouselScroll() {
    const el = carouselRef.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== slideIndex) setSlideIndex(idx);
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    const text = commentText.trim();
    if (!text || sendingComment) return;
    setSendingComment(true);
    setCommentText('');
    try {
      await onAddComment(post.id, text);
    } finally {
      setSendingComment(false);
    }
  }

  useEffect(() => {
    const timers = commentTimers.current;
    return () => { timers.forEach(clearTimeout); };
  }, []);

  async function toggleComments() {
    if (loadingComments) return;
    if (showAllComments) {
      setShowAllComments(false);
      return;
    }
    setLoadingComments(true);
    try {
      if (await onLoadComments(post.id)) setShowAllComments(true);
    } finally {
      setLoadingComments(false);
    }
  }

  function toggleCommentLike(commentId: number, liked: boolean) {
    const previousTimer = commentTimers.current.get(commentId);
    if (previousTimer) clearTimeout(previousTimer);
    setCommentBursts((prev) => {
      const next = new Set(prev);
      if (liked) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
    if (!liked) {
      commentTimers.current.set(commentId, setTimeout(() => {
        setCommentBursts((prev) => {
          const next = new Set(prev);
          next.delete(commentId);
          return next;
        });
        commentTimers.current.delete(commentId);
      }, 1000));
    } else {
      commentTimers.current.delete(commentId);
    }
    onToggleCommentLike(post.id, commentId);
  }

  const totalComments = post.comments_count;
  const visibleComments = showAllComments ? post.comments : post.comments.slice(-3);

  return (
    <article id={`post-${post.id}`} className="py-5">
      {/* Cabeçalho do autor */}
      <div className="flex items-center justify-between gap-3 px-5">
        <Link href={`/familia/${post.user_id}`} className="flex min-w-0 items-center gap-3">
          <Avatar name={post.user_name} src={post.avatar_url} size={42} ring={post.pinned} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[0.95rem] font-semibold text-marfim hover:underline">
                {post.user_name}
              </span>
              {post.pinned && (
                <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-widest text-champagne">
                  <Pin size={11} strokeWidth={1.6} /> Fixado
                </span>
              )}
            </div>
            <p className="text-xs text-marfim-3">{timeAgo(post.created_at)}</p>
          </div>
        </Link>

        {canManage && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Opções da publicação"
              className="flex h-11 w-11 items-center justify-center rounded-full text-marfim-2 hover:text-marfim"
            >
              <MoreHorizontal size={20} strokeWidth={1.5} />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="surface absolute right-0 top-11 z-40 min-w-[175px] overflow-hidden py-1.5 shadow-2xl">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onTogglePin(post.id);
                      }}
                      className="flex min-h-[44px] w-full items-center gap-2.5 px-4 text-left text-sm text-marfim hover:bg-carvao-3"
                    >
                      <Pin size={16} strokeWidth={1.5} className="text-champagne" />
                      {post.pinned ? 'Desafixar do topo' : 'Fixar no topo'}
                    </button>
                  )}
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onEditPost(post);
                      }}
                      className="flex min-h-[44px] w-full items-center gap-2.5 px-4 text-left text-sm text-marfim hover:bg-carvao-3"
                    >
                      <Pencil size={16} strokeWidth={1.5} className="text-marfim-2" />
                      Editar publicação
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onDeletePost(post.id);
                    }}
                    className="flex min-h-[44px] w-full items-center gap-2.5 px-4 text-left text-sm text-[#ff8a8d] hover:bg-carvao-3"
                  >
                    <Trash2 size={16} strokeWidth={1.5} />
                    Apagar
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Texto */}
      {post.content && (
        <p className="mt-3 whitespace-pre-wrap px-5 text-[0.96rem] leading-relaxed text-marfim">
          {post.content}
        </p>
      )}

      {/* Fotos grandes sem moldura */}
      {post.images.length === 1 && (
        <div
          onClick={handlePhotoTap}
          className="relative mt-3.5 aspect-[4/5] w-full cursor-pointer select-none overflow-hidden bg-carvao-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.images[0]}
            alt={`Foto publicada por ${post.user_name}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {heartBurst && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <LoopMedia
                name="mn-coracao"
                once
                className="h-44 w-44 mix-blend-screen"
                fallback={
                  <Heart
                    size={76}
                    strokeWidth={1.2}
                    className="pop fill-cereja text-cereja drop-shadow-[0_4px_24px_rgba(197,41,45,0.85)]"
                  />
                }
              />
            </div>
          )}
        </div>
      )}

      {post.images.length > 1 && (
        <div className="relative mt-3.5">
          <div
            ref={carouselRef}
            onScroll={handleCarouselScroll}
            onClick={handlePhotoTap}
            className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
          >
            {post.images.map((url, idx) => (
              <div
                key={`${url}-${idx}`}
                className="relative aspect-[4/5] w-full shrink-0 snap-center overflow-hidden bg-carvao-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Foto ${idx + 1} de ${post.user_name}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>

          <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-carvao/75 px-2.5 py-1 text-xs font-medium text-marfim backdrop-blur-xs">
            <span className="numeral">
              {slideIndex + 1}/{post.images.length}
            </span>
          </div>

          <div className="mt-2.5 flex justify-center gap-1.5">
            {post.images.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === slideIndex ? 'w-4 bg-champagne' : 'w-1.5 bg-marfim-3/40'
                }`}
              />
            ))}
          </div>

          {heartBurst && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <LoopMedia
                name="mn-coracao"
                once
                className="h-44 w-44 mix-blend-screen"
                fallback={
                  <Heart
                    size={76}
                    strokeWidth={1.2}
                    className="pop fill-cereja text-cereja drop-shadow-[0_4px_24px_rgba(197,41,45,0.85)]"
                  />
                }
              />
            </div>
          )}
        </div>
      )}

      {/* Barra de reações */}
      <div className="mt-2 flex items-center justify-between px-3">
        <div className="flex items-center gap-1">
          {REACTIONS.map(({ type, label, icon: Icon }) => {
            const active = post.my_reactions.includes(type);
            const count = Number(post.reactions[type] ?? 0);
            const isHeart = type === 'coracao';

            return (
              <button
                key={type}
                type="button"
                onClick={() => (isHeart ? handleHeartReaction() : onReact(post.id, type))}
                aria-label={`${label}${count > 0 ? ` (${count})` : ''}`}
                aria-pressed={active}
                className={`relative flex min-h-[44px] items-center gap-1.5 rounded-full px-2.5 text-sm transition-colors ${
                  active
                    ? isHeart
                      ? 'text-cereja'
                      : 'text-champagne'
                    : 'text-marfim-2 hover:text-marfim'
                }`}
              >
                <span className="relative flex items-center justify-center">
                  <Icon
                    size={20}
                    strokeWidth={1.5}
                    className={`${active && isHeart ? 'fill-cereja text-cereja' : ''} ${
                      active && !isHeart ? 'fill-champagne/25 text-champagne' : ''
                    } ${isHeart && heartBurst ? 'pop' : ''}`}
                  />
                  {isHeart && heartBurst && (
                    <span className="pointer-events-none absolute -inset-2 flex items-center justify-center">
                      <LoopMedia
                        name="mn-curtida"
                        once
                        className="h-8 w-8 rounded-full opacity-90"
                        fallback={
                          <span className="h-6 w-6 rounded-full bg-cereja/30 blur-xs" />
                        }
                      />
                    </span>
                  )}
                </span>
                {count > 0 && <span className="numeral text-xs font-medium">{count}</span>}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => commentInputRef.current?.focus()}
          aria-label="Comentar"
          className="flex min-h-[44px] items-center gap-1.5 px-2.5 text-xs text-marfim-2 hover:text-marfim"
        >
          <MessageCircle size={18} strokeWidth={1.5} />
          {totalComments > 0 && <span className="numeral">{totalComments}</span>}
        </button>
      </div>

      {/* Comentários */}
      <div className="mt-1 px-5">
        {(totalComments > 3 || totalComments > post.comments.length || showAllComments) && (
          <button
            type="button"
            onClick={() => void toggleComments()}
            disabled={loadingComments}
            className="mb-2 text-xs font-medium text-marfim-3 hover:text-marfim-2"
          >
            {loadingComments ? 'Carregando comentários...' : showAllComments
              ? 'Mostrar menos comentários'
              : `Ver todos os ${totalComments} comentários`}
          </button>
        )}

        {visibleComments.length > 0 && (
          <div className="space-y-2.5 border-t border-linha pt-3">
            {visibleComments.map((c) => {
              const canDeleteComment = c.user_id === meId || isAdmin;
              return (
                <div key={c.id} className="flex items-start gap-2.5">
                  <Link href={`/familia/${c.user_id}`} className="mt-0.5 shrink-0">
                    <Avatar name={c.user_name} src={c.avatar_url} size={28} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-marfim">
                      <Link
                        href={`/familia/${c.user_id}`}
                        className="font-semibold hover:underline"
                      >
                        {c.user_name}
                      </Link>{' '}
                      <span className="text-marfim-2">{c.content}</span>
                    </p>
                    <div className="mt-0.5 flex items-center gap-3 text-[0.7rem] text-marfim-3">
                      <span>{timeAgo(c.created_at)}</span>
                      {canDeleteComment && (
                        <button
                          type="button"
                          onClick={() => onDeleteComment(post.id, c.id)}
                          className="text-marfim-3 hover:text-[#ff8a8d]"
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleCommentLike(c.id, c.liked_by_me)}
                    disabled={c.id < 0}
                    aria-pressed={c.liked_by_me}
                    aria-label="Curtir comentário"
                    className={`flex h-9 min-w-[36px] shrink-0 items-center justify-end gap-1 text-xs ${
                      c.liked_by_me ? 'text-cereja' : 'text-marfim-3 hover:text-marfim-2'
                    }`}
                  >
                    <span className="relative inline-flex items-center justify-center">
                      <Heart size={14} strokeWidth={1.5}
                        className={c.liked_by_me ? 'fill-cereja text-cereja' : ''} />
                      {commentBursts.has(c.id) && (
                        <span className="pointer-events-none absolute flex items-center justify-center" aria-hidden>
                          <LoopMedia name="mn-curtida-comentario" once
                            className="h-8 w-8 mix-blend-screen"
                            fallback={<Heart size={14} strokeWidth={1.5} className="pop fill-cereja text-cereja" />} />
                        </span>
                      )}
                    </span>
                    {c.likes > 0 && <span className="numeral">{c.likes}</span>}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Campo inline de comentário */}
        <form onSubmit={submitComment} className="mt-3 flex items-center gap-2">
          <input
            ref={commentInputRef}
            type="text"
            maxLength={600}
            placeholder="Escreva um comentário..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="h-11 flex-1 rounded-full border border-linha bg-carvao-2 px-4 text-sm text-marfim placeholder:text-marfim-3 focus:border-champagne focus:outline-none"
          />
          <button
            type="submit"
            disabled={!commentText.trim() || sendingComment}
            aria-label="Enviar comentário"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-linha bg-carvao-2 text-champagne transition-opacity disabled:opacity-40"
          >
            <Send size={16} strokeWidth={1.5} />
          </button>
        </form>
      </div>
    </article>
  );
}
