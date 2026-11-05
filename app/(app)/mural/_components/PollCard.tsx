'use client';

import Link from 'next/link';
import { Check, Trash2 } from 'lucide-react';
import Avatar from '@/app/ui/Avatar';
import { timeAgo } from '@/app/ui/client';
import type { PollItem } from '../types';

interface Props {
  poll: PollItem;
  canDelete: boolean;
  onVote: (pollId: number, optionIndex: number) => void;
  onDelete: (pollId: number) => void;
}

export default function PollCard({ poll, canDelete, onVote, onDelete }: Props) {
  const authorHref = poll.created_by ? `/familia/${poll.created_by}` : undefined;

  return (
    <article className="py-5">
      <div className="flex items-center justify-between gap-3 px-5">
        <div className="flex min-w-0 items-center gap-3">
          {authorHref ? (
            <Link href={authorHref} className="shrink-0">
              <Avatar name={poll.created_by_name} src={poll.created_by_avatar} size={40} />
            </Link>
          ) : (
            <Avatar name={poll.created_by_name} src={poll.created_by_avatar} size={40} />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {authorHref ? (
                <Link
                  href={authorHref}
                  className="truncate text-[0.95rem] font-semibold text-marfim hover:underline"
                >
                  {poll.created_by_name}
                </Link>
              ) : (
                <p className="truncate text-[0.95rem] font-semibold text-marfim">
                  {poll.created_by_name}
                </p>
              )}
              <span className="kicker text-[0.6rem]">Enquete</span>
            </div>
            <p className="text-xs text-marfim-3">{timeAgo(poll.created_at)}</p>
          </div>
        </div>

        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(poll.id)}
            aria-label="Apagar enquete"
            className="flex h-11 w-11 items-center justify-center rounded-full text-marfim-3 transition-colors hover:text-cereja"
          >
            <Trash2 size={17} strokeWidth={1.5} />
          </button>
        )}
      </div>

      <div className="mt-3 px-5">
        <h3 className="text-[1.02rem] font-medium leading-snug text-marfim">{poll.question}</h3>

        <div className="mt-3 space-y-2">
          {poll.options.map((opt, idx) => {
            const count = poll.votes[idx] ?? 0;
            const pct = poll.total > 0 ? Math.round((count / poll.total) * 100) : 0;
            const selected = poll.my_vote === idx;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => onVote(poll.id, idx)}
                className={`relative flex min-h-[44px] w-full items-center gap-3 overflow-hidden rounded-[14px] border px-3.5 py-2.5 text-left transition-colors ${
                  selected
                    ? 'border-champagne/70 bg-carvao-2'
                    : 'border-linha bg-carvao-2/60 hover:border-linha-forte'
                }`}
              >
                <span
                  aria-hidden
                  className={`pointer-events-none absolute inset-y-0 left-0 transition-all duration-500 ${
                    selected ? 'bg-cereja/25' : 'bg-marfim/8'
                  }`}
                  style={{ width: `${pct}%` }}
                />

                <span
                  className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    selected
                      ? 'border-cereja bg-cereja text-marfim'
                      : 'border-marfim-3/60 text-transparent'
                  }`}
                >
                  <Check size={12} strokeWidth={2.2} />
                </span>

                <span className="relative z-10 flex-1 text-sm font-medium text-marfim">{opt}</span>

                <span className="numeral relative z-10 shrink-0 text-sm text-marfim-2">
                  {pct}%
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-2.5 text-xs text-marfim-3">
          {poll.total === 0
            ? 'Toque em uma opção para abrir a votação'
            : poll.total === 1
              ? '1 voto registrado'
              : `${poll.total} votos registrados`}
        </p>
      </div>
    </article>
  );
}
