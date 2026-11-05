'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import LoopMedia from '@/app/ui/LoopMedia';
import Avatar from '@/app/ui/Avatar';
import { api, timeAgo, thumb } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import type { AlbumItem } from '@/app/api/album/route';

type FilterKind = 'tudo' | 'post' | 'compra';

interface AlbumResponse {
  items: AlbumItem[];
  nextCursor: string | null;
}

// Fallback do topo 16:9: mosaico das 3 primeiras fotos levemente inclinadas como polaroids sobre carvão.
function PolaroidMosaicFallback({ photos }: { photos: AlbumItem[] }) {
  const sample = photos.slice(0, 3);
  const poses = [
    '-rotate-6 -translate-x-16 translate-y-1 z-10',
    'rotate-2 translate-y-0 z-20 scale-105',
    'rotate-6 translate-x-16 translate-y-2 z-10',
  ];

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-carvao">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 35%, rgba(191,165,119,0.16), rgba(23,27,24,0.95) 72%)',
        }}
      />
      <div className="relative flex h-full w-full items-start justify-center pt-[9%]">
        {[0, 1, 2].map((idx) => {
          const item = sample[idx];
          return (
            <div
              key={item ? item.key : `placeholder-${idx}`}
              className={`absolute h-28 w-24 rounded-[10px] border border-linha-forte bg-carvao-2 p-1.5 pb-4 shadow-2xl transition-transform duration-700 ${poses[idx]}`}
            >
              <div className="h-full w-full overflow-hidden rounded-[6px] bg-carvao-3">
                {item ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb(item.url, 256)}
                    alt={item.caption || 'Memória de Natal'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-champagne/40">
                    <Sparkles size={16} strokeWidth={1.5} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Fallback do estado vazio: árvore de Natal minimalista desenhada em traço dourado.
function EmptyTreeFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-carvao-2/60">
      <svg
        viewBox="0 0 64 80"
        className="h-24 w-20 text-champagne"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      >
        <path d="M32 6 L34.5 13 L42 13 L36 17.5 L38.5 25 L32 20.5 L25.5 25 L28 17.5 L22 13 L29.5 13 Z" />
        <path
          d="M32 27 C 18 39, 46 42, 22 52 C 46 55, 44 65, 14 70 M32 27 C 46 37, 20 45, 42 52"
          strokeLinecap="round"
        />
        <line x1="32" y1="70" x2="32" y2="76" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function AlbumPhotoCard({
  item,
  index,
  onSelect,
}: {
  item: AlbumItem;
  index: number;
  onSelect: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  // Ritmo assimétrico suave para o esqueleto enquanto a foto carrega
  const minHeights = ['min-h-[168px]', 'min-h-[216px]', 'min-h-[188px]', 'min-h-[152px]'];
  const minH = minHeights[index % minHeights.length];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative mb-[6px] block w-full break-inside-avoid overflow-hidden rounded-[12px] bg-carvao-2 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-champagne ${
        !loaded ? `${minH} animate-pulse` : ''
      }`}
      aria-label={
        item.caption
          ? `Abrir foto: ${item.caption}`
          : `Abrir foto de ${item.author_name || 'Compras da ceia'}`
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumb(item.url, 640)}
        alt={item.caption || 'Foto do álbum da família'}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`block h-auto w-full object-cover transition-all duration-700 ease-out group-active:scale-[0.99] ${
          loaded ? 'fade-in opacity-100' : 'opacity-0'
        }`}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-carvao/80 via-carvao/20 to-transparent p-2.5 opacity-90">
        <p className="truncate text-[11px] font-medium text-marfim/90">
          {item.source === 'post' ? item.author_name || 'Mural' : 'Compras'}
        </p>
      </div>
    </button>
  );
}

function AlbumSkeletonGrid() {
  const heights = ['h-44', 'h-60', 'h-52', 'h-40', 'h-56', 'h-48'];
  return (
    <div className="columns-2 gap-[6px]" aria-label="Carregando fotos">
      {heights.map((h, i) => (
        <div
          key={i}
          className={`mb-[6px] w-full break-inside-avoid animate-pulse rounded-[12px] bg-carvao-2 ${h}`}
        />
      ))}
    </div>
  );
}

function formatFullDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function AlbumPage() {
  const toast = useToast();
  const [items, setItems] = useState<AlbumItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const pageRequestRef = useRef(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<FilterKind>('tudo');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Estado de gestos no visualizador em tela cheia
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchPage = useCallback(
    async (cursor?: string | null) => {
      if (pageRequestRef.current) return;
      pageRequestRef.current = true;
      setPageError(null);
      const isFirst = !cursor;
      if (isFirst) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      try {
        const qs = new URLSearchParams({ limit: '40' });
        if (cursor) qs.set('cursor', cursor);
        const data = await api<AlbumResponse>(`/api/album?${qs.toString()}`);
        setItems((prev) => {
          if (isFirst) return data.items;
          const seen = new Set(prev.map((i) => i.key));
          const fresh = data.items.filter((i) => !seen.has(i.key));
          return [...prev, ...fresh];
        });
        setNextCursor(data.nextCursor);
      } catch (err) {
        setPageError((err as Error).message || 'Não foi possível carregar o álbum.');
        toast((err as Error).message || 'Não foi possível carregar o álbum.', 'erro');
      } finally {
        pageRequestRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void fetchPage(null);
  }, [fetchPage]);

  // Carregamento infinito com IntersectionObserver
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !nextCursor || loading || loadingMore || pageError) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && nextCursor && !loadingMore) {
          observer.disconnect();
          void fetchPage(nextCursor);
        }
      },
      { rootMargin: '240px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [nextCursor, loading, loadingMore, pageError, fetchPage]);

  const filteredItems = useMemo(() => {
    if (filter === 'tudo') return items;
    return items.filter((item) => item.source === filter);
  }, [items, filter]);

  // Garante que o índice ativo permanece válido quando o filtro muda
  useEffect(() => {
    if (activeIndex !== null && activeIndex >= filteredItems.length) {
      setActiveIndex(filteredItems.length > 0 ? filteredItems.length - 1 : null);
    }
  }, [filteredItems.length, activeIndex]);

  const activeItem = activeIndex !== null ? filteredItems[activeIndex] ?? null : null;

  const closeViewer = useCallback(() => {
    setActiveIndex(null);
    setDragOffset({ x: 0, y: 0 });
  }, []);

  const showPrev = useCallback(() => {
    setActiveIndex((curr) => {
      if (curr === null || filteredItems.length === 0) return curr;
      return curr > 0 ? curr - 1 : filteredItems.length - 1;
    });
    setDragOffset({ x: 0, y: 0 });
  }, [filteredItems.length]);

  const showNext = useCallback(() => {
    setActiveIndex((curr) => {
      if (curr === null || filteredItems.length === 0) return curr;
      return curr < filteredItems.length - 1 ? curr + 1 : 0;
    });
    setDragOffset({ x: 0, y: 0 });
  }, [filteredItems.length]);

  // Navegação por teclado quando o visualizador está aberto
  useEffect(() => {
    if (activeIndex === null) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeViewer();
      if (e.key === 'ArrowLeft') showPrev();
      if (e.key === 'ArrowRight') showNext();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, closeViewer, showPrev, showNext]);

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    setDragOffset({ x: 0, y: 0 });
  }

  function handleTouchMove(e: React.TouchEvent) {
    const start = touchStartRef.current;
    const t = e.touches[0];
    if (!start || !t) return;
    setDragOffset({
      x: t.clientX - start.x,
      y: t.clientY - start.y,
    });
  }

  function handleTouchEnd() {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const { x: dx, y: dy } = dragOffset;
    setDragOffset({ x: 0, y: 0 });

    // Deslizar para baixo fecha
    if (dy > 75 && Math.abs(dy) > Math.abs(dx)) {
      closeViewer();
      return;
    }

    // Deslizar para os lados navega entre fotos
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) {
        showNext();
      } else {
        showPrev();
      }
    }
  }

  const pills: { id: FilterKind; label: string }[] = [
    { id: 'tudo', label: 'Tudo' },
    { id: 'post', label: 'Mural' },
    { id: 'compra', label: 'Compras' },
  ];

  return (
    <div className="min-h-dvh bg-carvao text-marfim">
      {/* Cabeçalho estilo galeria */}
      <header className="rise flex items-center justify-between gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+16px)]">
        <Link
          href="/"
          aria-label="Voltar para o início"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-marfim-2 transition-colors hover:text-marfim"
        >
          <ChevronLeft size={22} strokeWidth={1.5} />
        </Link>

        <div className="min-w-0 text-center">
          <h1 className="display pt-1 text-[1.85rem] leading-[1.18] text-marfim">Álbum da família</h1>
        </div>

        <Link
          href="/mural"
          aria-label="Publicar foto pelo mural"
          title="Publicar foto pelo mural"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cereja text-marfim shadow-lg transition-transform active:scale-95"
        >
          <Plus size={20} strokeWidth={1.75} />
        </Link>
      </header>

      {/* Topo estilo galeria de exposição em faixa 16:9 */}
      <section className="rise px-4 pb-4" style={{ animationDelay: '0.06s' }}>
        <div className="relative aspect-video w-full overflow-hidden rounded-[16px] border border-linha bg-carvao-2">
          <LoopMedia
            name="mn-album"
            className="h-full w-full opacity-80"
            fallback={<PolaroidMosaicFallback photos={items} />}
          />
          <div className="pointer-events-none absolute inset-0 z-[25] bg-gradient-to-t from-carvao via-carvao/35 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 z-30 flex items-end justify-between gap-4 p-4">
            <div>
              <p className="kicker mb-1">Exposição de memórias</p>
              <p className="text-xs text-marfim-2">
                Registros do mural e dos preparativos da ceia
              </p>
            </div>
            <div className="text-right">
              <span className="numeral block text-3xl leading-none text-marfim">
                {filteredItems.length}
              </span>
              <span className="text-[11px] uppercase tracking-wider text-champagne">
                {filteredItems.length === 1 ? 'foto' : 'fotos'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Filtro em pílulas finas */}
      <section
        className="rise flex items-center justify-between gap-2 px-4 pb-4"
        style={{ animationDelay: '0.12s' }}
      >
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto" role="tablist">
          {pills.map((pill) => {
            const active = filter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(pill.id)}
                className={`inline-flex min-h-[44px] items-center justify-center rounded-full px-4 text-xs font-semibold tracking-wide transition-all ${
                  active
                    ? 'border border-cereja bg-cereja text-marfim shadow-sm'
                    : 'border border-linha-forte bg-carvao-2/60 text-marfim-2 hover:border-champagne/60 hover:text-marfim'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        <Link
          href="/mural"
          className="inline-flex min-h-[44px] items-center gap-1.5 px-2 text-xs text-champagne hover:underline"
        >
          Postar no mural
        </Link>
      </section>

      {/* Conteúdo principal: esqueleto, estado vazio ou grade masonry 2 colunas */}
      <section className="px-4 pb-8">
        {loading ? (
          <AlbumSkeletonGrid />
        ) : filteredItems.length === 0 ? (
          <div className="surface rise flex flex-col items-center px-6 py-10 text-center">
            <div className="mb-4 h-36 w-36 overflow-hidden rounded-full border border-linha">
              <LoopMedia
                name="mn-vazio"
                className="h-full w-full"
                fallback={<EmptyTreeFallback />}
              />
            </div>
            <p className="kicker mb-2">Galeria silenciosa</p>
            <h2 className="display mb-2 text-2xl text-marfim">Nenhuma foto por aqui ainda</h2>
            <p className="mb-6 max-w-xs text-sm text-marfim-2">
              {filter === 'tudo'
                ? 'Publique a primeira lembrança no mural da família para inaugurar o álbum.'
                : 'Não encontramos fotos neste filtro. Experimente ver todas ou publique no mural.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {filter !== 'tudo' && (
                <button
                  type="button"
                  onClick={() => setFilter('tudo')}
                  className="btn btn-ghost text-sm"
                >
                  Ver todas
                </button>
              )}
              <Link href="/mural" className="btn btn-primary text-sm">
                <Plus size={18} strokeWidth={1.5} />
                Ir para o mural
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="columns-2 gap-[6px]">
              {filteredItems.map((item, idx) => (
                <AlbumPhotoCard
                  key={item.key}
                  item={item}
                  index={idx}
                  onSelect={() => setActiveIndex(idx)}
                />
              ))}
            </div>

            {loadingMore && (
              <div className="mt-[6px] columns-2 gap-[6px]">
                <div className="mb-[6px] h-44 w-full break-inside-avoid animate-pulse rounded-[12px] bg-carvao-2" />
                <div className="mb-[6px] h-52 w-full break-inside-avoid animate-pulse rounded-[12px] bg-carvao-2" />
              </div>
            )}

          </>
        )}
        {pageError && (
          <div className="py-4 text-center">
            <p className="mb-2 text-sm text-marfim-2">{pageError}</p>
            <button type="button" className="btn btn-ghost" disabled={loading || loadingMore}
              onClick={() => void fetchPage(nextCursor)}>Tentar de novo</button>
          </div>
        )}
        <div ref={sentinelRef} className="h-6 w-full" aria-hidden />
      </section>

      {/* Visualizador em tela cheia (fundo carvão 96%) */}
      {activeItem && activeIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Visualizador de foto em tela cheia"
          className="fade-in fixed inset-0 z-[80] flex flex-col justify-between bg-carvao/96 backdrop-blur-xs"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Topo do visualizador */}
          <div className="flex items-center justify-between gap-3 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar
                name={
                  activeItem.source === 'post'
                    ? activeItem.author_name || 'Família'
                    : 'Compras da ceia'
                }
                src={activeItem.author_avatar}
                size={36}
                ring
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-marfim">
                  {activeItem.source === 'post'
                    ? activeItem.author_name || 'Mural da família'
                    : 'Compras da ceia'}
                </p>
                <p className="text-xs text-marfim-3">
                  {timeAgo(activeItem.created_at)} · {formatFullDate(activeItem.created_at)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <span className="numeral px-2 text-xs text-champagne">
                {activeIndex + 1} / {filteredItems.length}
              </span>
              <button
                type="button"
                onClick={closeViewer}
                aria-label="Fechar visualizador"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-linha text-marfim hover:border-champagne"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Imagem central com suporte a deslizar e setas */}
          <div className="relative flex flex-1 items-center justify-center overflow-hidden px-3 py-2">
            {filteredItems.length > 1 && (
              <button
                type="button"
                onClick={showPrev}
                aria-label="Foto anterior"
                className="absolute left-3 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-linha bg-carvao-2/80 text-marfim transition-colors hover:border-champagne"
              >
                <ChevronLeft size={22} strokeWidth={1.5} />
              </button>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={activeItem.key}
              src={thumb(activeItem.url, 1280, 80)}
              alt={activeItem.caption || 'Foto em tela cheia'}
              style={{
                transform: `translate3d(${dragOffset.x * 0.35}px, ${Math.max(0, dragOffset.y * 0.45)}px, 0)`,
              }}
              className="fade-in max-h-[68dvh] max-w-full rounded-[12px] object-contain transition-transform duration-150 select-none"
            />

            {filteredItems.length > 1 && (
              <button
                type="button"
                onClick={showNext}
                aria-label="Próxima foto"
                className="absolute right-3 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-linha bg-carvao-2/80 text-marfim transition-colors hover:border-champagne"
              >
                <ChevronRight size={22} strokeWidth={1.5} />
              </button>
            )}
          </div>

          {/* Rodapé com legenda, botão baixar e link para o mural */}
          <div className="border-t border-linha bg-carvao-2/70 px-5 pt-3.5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
            {activeItem.caption ? (
              <p className="mb-3.5 line-clamp-3 text-sm leading-relaxed text-marfim">
                {activeItem.caption}
              </p>
            ) : (
              <p className="mb-3.5 text-xs italic text-marfim-3">
                {activeItem.source === 'post'
                  ? 'Registro publicado no mural da família'
                  : 'Registro de compra da vaquinha'}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <a
                href={activeItem.url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost min-h-[44px] px-4 text-xs"
              >
                <Download size={16} strokeWidth={1.5} />
                Baixar foto
              </a>

              {activeItem.source === 'post' && (
                <Link
                  href={activeItem.post_id ? `/mural#post-${activeItem.post_id}` : '/mural'}
                  onClick={closeViewer}
                  className="btn btn-primary min-h-[44px] px-4 text-xs"
                >
                  Ver no mural
                  <ArrowUpRight size={16} strokeWidth={1.5} />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
