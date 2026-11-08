'use client';

import { Bell, Heart, Laugh, MessageCircle, Star, Trophy, Wine, X } from 'lucide-react';
import Avatar from '@/app/ui/Avatar';
import LoopMedia from '@/app/ui/LoopMedia';
import { timeAgo } from '@/app/ui/client';
import type { NotificationItem } from '../types';

interface BellButtonProps {
  unread: number;
  onClick: () => void;
}

export function NotificationBellButton({ unread, onClick }: BellButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={unread > 0 ? `Notificações (${unread} novas)` : 'Notificações'}
      className="relative flex h-11 w-11 items-center justify-center rounded-full border border-linha bg-carvao-2 text-marfim transition-colors hover:border-champagne/60"
    >
      <LoopMedia
        name="mn-sino"
        className="h-5 w-5"
        fallback={<Bell size={20} strokeWidth={1.5} className="text-marfim" />}
      />
      {unread > 0 && (
        <span
          aria-hidden
          className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-cereja ring-2 ring-carvao-2"
        />
      )}
    </button>
  );
}

function describeNotification(item: NotificationItem): string {
  if (item.type === 'conquista') {
    if (!item.reaction_type) return 'Você desbloqueou uma nova conquista!';
    if (item.reaction_type.startsWith('Você desbloqueou')) return item.reaction_type;
    return `Você desbloqueou a conquista "${item.reaction_type}"!`;
  }
  if (item.type === 'report') return 'enviou uma denúncia. Analise em Organizar.';
  if (item.type === 'post_comment') {
    return 'comentou na sua publicação.';
  }
  if (item.type === 'comment_reaction') {
    return 'curtiu seu comentário.';
  }
  if (item.type === 'post_reaction') {
    switch (item.reaction_type) {
      case 'estrela':
        return 'destacou sua publicação com estrela.';
      case 'risada':
        return 'riu da sua publicação.';
      case 'brinde':
        return 'fez um brinde na sua publicação.';
      default:
        return 'reagiu com coração na sua publicação.';
    }
  }
  return 'interagiu com você no mural.';
}

function NotificationTypeBadge({ item }: { item: NotificationItem }) {
  if (item.type === 'conquista') {
    return <Trophy size={13} strokeWidth={1.7} className="text-champagne" />;
  }
  if (item.type === 'post_comment') {
    return <MessageCircle size={13} strokeWidth={1.7} className="text-champagne" />;
  }
  if (item.reaction_type === 'estrela') {
    return <Star size={13} strokeWidth={1.7} className="text-champagne" />;
  }
  if (item.reaction_type === 'risada') {
    return <Laugh size={13} strokeWidth={1.7} className="text-champagne" />;
  }
  if (item.reaction_type === 'brinde') {
    return <Wine size={13} strokeWidth={1.7} className="text-champagne" />;
  }
  return <Heart size={13} strokeWidth={1.7} className="text-cereja" />;
}

interface SheetProps {
  open: boolean;
  items: NotificationItem[];
  onClose: () => void;
  onSelectPost?: (postId: number) => void;
}

export default function NotificationsSheet({
  open,
  items,
  onClose,
  onSelectPost,
}: SheetProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/70 backdrop-blur-xs fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Notificações do mural"
        className="rise safe-bottom max-h-[82dvh] w-full max-w-lg self-center overflow-hidden rounded-t-[22px] border-t border-linha-forte bg-carvao-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-linha-forte" />
        <div className="flex items-center justify-between border-b border-linha px-5 py-4">
          <div>
            <p className="kicker">Mural</p>
            <h2 className="display mt-0.5 text-2xl text-marfim">Notificações</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar notificações"
            className="flex h-11 w-11 items-center justify-center rounded-full text-marfim-2 hover:text-marfim"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        <div className="max-h-[65dvh] overflow-y-auto divide-y divide-linha px-5 py-2">
          {items.length === 0 ? (
            <div className="py-12 text-center">
              <Bell size={28} strokeWidth={1.3} className="mx-auto mb-3 text-champagne/70" />
              <p className="text-sm text-marfim-2">Tudo tranquilo por aqui.</p>
              <p className="mt-1 text-xs text-marfim-3">
                Quando alguém comentar ou reagir aos seus posts, aparece aqui.
              </p>
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.type === 'conquista') {
                    window.location.href = '/conquistas';
                  } else if (item.type === 'report') {
                    window.location.href = '/organizar';
                  } else if (item.post_id && onSelectPost) {
                    onSelectPost(item.post_id);
                  }
                  onClose();
                }}
                className="flex w-full items-start gap-3.5 py-3.5 text-left transition-colors hover:bg-carvao-3/40"
              >
                <div className="relative shrink-0">
                  <Avatar name={item.actor_name} src={item.actor_avatar} size={40} />
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-linha bg-carvao-2">
                    <NotificationTypeBadge item={item} />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-marfim">
                    {item.type === 'conquista' ? (
                      <span className="font-medium text-marfim">{describeNotification(item)}</span>
                    ) : (
                      <>
                        <span className="font-semibold">{item.actor_name}</span>{' '}
                        <span className="text-marfim-2">{describeNotification(item)}</span>
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-marfim-3">
                    {timeAgo(item.created_at)}
                    {item.type === 'conquista' ? ' · Ver em /conquistas' : ''}
                  </p>
                </div>
                {!item.read && (
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-cereja" />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
