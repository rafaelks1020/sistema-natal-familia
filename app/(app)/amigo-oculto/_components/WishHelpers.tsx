'use client';

import { Check, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { brl, thumb } from '@/app/ui/client';
import Stars from './Stars';
import type { WishItem as BaseWishItem } from './types';

export interface WishDetail extends BaseWishItem {
  price_min_cents?: number | null;
  price_max_cents?: number | null;
  image_url?: string | null;
  purchased_by_me?: boolean;
}

export interface WishParticipant {
  id: number;
  name: string;
  avatar_url: string | null;
  wish_count: number;
}

export interface WishDraft {
  id: number | null;
  item_name: string;
  item_description: string;
  item_url: string;
  priority: number;
  price_min_reais: string;
  price_max_reais: string;
  image_url: string | null;
}

export const EMPTY_DRAFT: WishDraft = {
  id: null,
  item_name: '',
  item_description: '',
  item_url: '',
  priority: 2,
  price_min_reais: '',
  price_max_reais: '',
  image_url: null,
};

export function externalLink(value: string | null | undefined): { href: string; domain: string } | null {
  if (!value || value.length > 500) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname) return null;
    return { href: url.toString(), domain: url.hostname.replace(/^www\./i, '') };
  } catch {
    return null;
  }
}

export function formatWishPrice(minCents?: number | null, maxCents?: number | null): string | null {
  const min = minCents != null && minCents > 0 ? minCents : null;
  const max = maxCents != null && maxCents > 0 ? maxCents : null;
  if (min != null && max != null) {
    if (min === max) return `Até ${brl(max / 100)}`;
    return `De ${brl(min / 100)} a ${brl(max / 100)}`;
  }
  if (max != null) return `Até ${brl(max / 100)}`;
  if (min != null) return `A partir de ${brl(min / 100)}`;
  return null;
}

export function reaisToCents(raw: string): number | null | 'invalido' {
  const clean = raw.trim().replace(/^R\$\s*/i, '');
  if (!clean) return null;
  const normalized = clean.includes(',')
    ? clean.replace(/\./g, '').replace(',', '.')
    : clean;
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) return 'invalido';
  const cents = Math.round(num * 100);
  if (cents === 0) return null;
  if (cents > 100_000_000) return 'invalido';
  return cents;
}

export function centsToReaisInput(cents?: number | null): string {
  if (cents == null || cents <= 0) return '';
  const reais = cents / 100;
  if (Number.isInteger(reais)) return String(reais);
  return reais.toFixed(2).replace('.', ',');
}

export function draftFromWish(item: WishDetail): WishDraft {
  return {
    id: item.id,
    item_name: item.item_name,
    item_description: item.item_description ?? '',
    item_url: item.item_url ?? '',
    priority: item.priority,
    price_min_reais: centsToReaisInput(item.price_min_cents),
    price_max_reais: centsToReaisInput(item.price_max_cents),
    image_url: item.image_url ?? null,
  };
}

export function WishItemRow({
  item,
  owner,
  confirmDelete,
  busy,
  onEdit,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
  onTogglePurchased,
}: {
  item: WishDetail;
  owner: boolean;
  confirmDelete?: boolean;
  busy?: boolean;
  onEdit?: () => void;
  onAskDelete?: () => void;
  onCancelDelete?: () => void;
  onConfirmDelete?: () => void;
  onTogglePurchased?: () => void;
}) {
  const link = externalLink(item.item_url);
  const priceLabel = formatWishPrice(item.price_min_cents, item.price_max_cents);
  const bought = !owner && item.purchased === true;
  const boughtByOther = bought && item.purchased_by_me === false;

  return (
    <li className={`flex items-start gap-3 border-t border-linha py-3.5 ${bought ? 'opacity-70' : ''}`}>
      {item.image_url ? (
        <a
          href={item.image_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Ver foto de ${item.item_name}`}
          className="mt-0.5 h-16 w-16 shrink-0 overflow-hidden rounded-[12px] border border-linha bg-carvao-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb(item.image_url, 256)}
            alt={item.item_name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </a>
      ) : (
        <span className="pt-1">
          <Stars n={item.priority} />
        </span>
      )}

      <div className="min-w-0 flex-1">
        {item.image_url && (
          <div className="mb-1">
            <Stars n={item.priority} />
          </div>
        )}
        <p className={`text-marfim ${bought ? 'line-through decoration-marfim-3' : ''}`}>{item.item_name}</p>
        {priceLabel && (
          <p className="mt-0.5 text-xs text-champagne">
            <span className="numeral">{priceLabel}</span>
          </p>
        )}
        {item.item_description && (
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-marfim-2">{item.item_description}</p>
        )}
        {link && (
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex min-h-11 max-w-full items-center gap-1.5 break-all text-sm text-marfim underline decoration-cereja underline-offset-4"
          >
            <ExternalLink size={14} strokeWidth={1.5} className="shrink-0" />
            <span>{link.domain}</span>
          </a>
        )}
      </div>

      {owner ? (
        confirmDelete ? (
          <div className="flex shrink-0 items-center">
            <button type="button" className="btn btn-quiet" disabled={busy} onClick={onCancelDelete}>
              Não
            </button>
            <button type="button" className="btn btn-quiet text-cereja" disabled={busy} onClick={onConfirmDelete}>
              Apagar
            </button>
          </div>
        ) : (
          <div className="flex shrink-0">
            <button
              type="button"
              aria-label={`Editar ${item.item_name}`}
              className="flex h-11 w-11 items-center justify-center text-marfim-2"
              onClick={onEdit}
            >
              <Pencil size={18} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              aria-label={`Apagar ${item.item_name}`}
              className="flex h-11 w-11 items-center justify-center text-marfim-3"
              onClick={onAskDelete}
            >
              <Trash2 size={18} strokeWidth={1.5} />
            </button>
          </div>
        )
      ) : (
        typeof item.purchased === 'boolean' && (
          <button
            type="button"
            onClick={onTogglePurchased}
            disabled={busy || boughtByOther}
            aria-pressed={bought}
            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[12px] border px-3 text-xs ${
              bought
                ? 'border-salvia/50 bg-salvia/10 text-salvia'
                : 'border-linha text-marfim-2 hover:border-champagne/60'
            }`}
          >
            {bought && <Check size={14} strokeWidth={1.75} className="text-salvia" />}
            {boughtByOther ? 'Já comprado' : bought ? 'Já comprei' : 'Já comprei'}
          </button>
        )
      )}
    </li>
  );
}
