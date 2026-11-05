'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Clock,
  Plus,
  Receipt,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import Avatar from '@/app/ui/Avatar';
import LoopMedia from '@/app/ui/LoopMedia';
import PageHeader from '@/app/ui/PageHeader';
import { api, brl } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { useMe } from '@/app/ui/user';
import type {
  VaquinhaParticipant,
  VaquinhaPurchase,
  VaquinhaTimelineEvent,
} from '@/app/api/vaquinha/_helpers';
import {
  AdminCreateSheet,
  ParticipantActionSheet,
  PurchaseDetailSheet,
} from './_components/Sheets';

interface VaquinhaData {
  contribution_value: number;
  arrecadado: number;
  gasto: number;
  saldo: number;
  participants: VaquinhaParticipant[];
  purchases: VaquinhaPurchase[];
  timeline: VaquinhaTimelineEvent[];
}

type TabKey = 'pagamentos' | 'gastos' | 'timeline';

function ConfettiFallback() {
  const pieces = [
    { left: '8%', top: '12%', w: 6, h: 12, color: '#bfa577', rot: -18, delay: '0s' },
    { left: '19%', top: '28%', w: 5, h: 10, color: '#c5292d', rot: 24, delay: '0.08s' },
    { left: '31%', top: '15%', w: 7, h: 7, color: '#bfa577', rot: 12, delay: '0.16s' },
    { left: '46%', top: '22%', w: 6, h: 13, color: '#f3ebdc', rot: -28, delay: '0.12s' },
    { left: '58%', top: '10%', w: 5, h: 11, color: '#c5292d', rot: 19, delay: '0.2s' },
    { left: '71%', top: '26%', w: 7, h: 9, color: '#bfa577', rot: -15, delay: '0.05s' },
    { left: '84%', top: '14%', w: 6, h: 12, color: '#c5292d', rot: 32, delay: '0.14s' },
    { left: '92%', top: '32%', w: 5, h: 8, color: '#bfa577', rot: -22, delay: '0.22s' },
    { left: '14%', top: '65%', w: 5, h: 9, color: '#bfa577', rot: 15, delay: '0.18s' },
    { left: '78%', top: '68%', w: 6, h: 10, color: '#c5292d', rot: -25, delay: '0.1s' },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="rise absolute rounded-[2px] opacity-60"
          style={{
            left: p.left,
            top: p.top,
            width: p.w,
            height: p.h,
            background: p.color,
            transform: `rotate(${p.rot}deg)`,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}

function EmptyTreeFallback() {
  return (
    <svg
      viewBox="0 0 48 64"
      className="mx-auto h-14 w-12 text-champagne/70"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <path d="M24 4 L26 10 L32 10 L27 14 L29 20 L24 16 L19 20 L21 14 L16 10 L22 10 Z" />
      <path
        d="M24 22 C 12 32, 36 34, 15 44 C 36 46, 34 54, 10 58"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LoaderStarFallback() {
  return (
    <svg
      viewBox="0 0 40 40"
      className="mx-auto h-10 w-10 animate-pulse text-champagne"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <path d="M20 4 L23 15 L34 15 L25 22 L28 33 L20 26 L12 33 L15 22 L6 15 L17 15 Z" />
    </svg>
  );
}

function formatShortDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() <= 0) return '';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

function formatDayHeading(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() <= 0) return 'Registros anteriores';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
  });
}

function dayKeyFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() <= 0) return '0000-00-00';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function VaquinhaPage() {
  const me = useMe();
  const toast = useToast();

  const [data, setData] = useState<VaquinhaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('pagamentos');

  const [selectedPurchase, setSelectedPurchase] = useState<VaquinhaPurchase | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<VaquinhaParticipant | null>(null);
  const [createSheet, setCreateSheet] = useState<{
    open: boolean;
    mode: 'purchase' | 'participant';
  }>({ open: false, mode: 'purchase' });

  const load = useCallback(async () => {
    try {
      const res = await api<VaquinhaData>('/api/vaquinha');
      setData(res);
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const participants = useMemo(() => data?.participants ?? [], [data]);
  const purchases = useMemo(() => data?.purchases ?? [], [data]);
  const timeline = useMemo(() => data?.timeline ?? [], [data]);

  const totalParticipants = participants.length;
  const paidParticipants = useMemo(
    () => participants.filter((p) => p.paid).length,
    [participants],
  );
  const allPaid = totalParticipants > 0 && paidParticipants === totalParticipants;
  const progressPct =
    totalParticipants > 0 ? Math.min(100, Math.round((paidParticipants / totalParticipants) * 100)) : 0;

  // Agrupa gastos por dia para exibição editorial por data
  const groupedPurchases = useMemo(() => {
    const groups: { key: string; label: string; items: VaquinhaPurchase[] }[] = [];
    for (const p of purchases) {
      const key = dayKeyFromIso(p.created_at);
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.items.push(p);
      } else {
        groups.push({
          key,
          label: formatDayHeading(p.created_at),
          items: [p],
        });
      }
    }
    return groups;
  }, [purchases]);

  // Agrupa eventos da linha do tempo por dia
  const groupedTimeline = useMemo(() => {
    const groups: { key: string; label: string; items: VaquinhaTimelineEvent[] }[] = [];
    for (const ev of timeline) {
      const key = dayKeyFromIso(ev.date);
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.items.push(ev);
      } else {
        groups.push({
          key,
          label: formatDayHeading(ev.date),
          items: [ev],
        });
      }
    }
    return groups;
  }, [timeline]);

  function openPurchaseFromTimeline(ev: VaquinhaTimelineEvent) {
    if (ev.type !== 'purchase') return;
    const found = purchases.find((p) => p.id === ev.ref_id);
    if (found) setSelectedPurchase(found);
  }

  return (
    <div className="min-h-dvh">
      <PageHeader
        kicker="Livro da ceia"
        title="Vaquinha"
        action={
          me.is_admin ? (
            <button
              type="button"
              onClick={() => setCreateSheet({ open: true, mode: 'participant' })}
              className="btn btn-ghost min-h-11 px-3.5 text-xs"
            >
              <UserPlus size={15} strokeWidth={1.5} className="text-champagne" />
              Parente
            </button>
          ) : null
        }
      />

      <div className="px-5">
        {loading && !data ? (
          <div className="surface rise flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 h-14 w-14">
              <LoopMedia
                name="mn-loader"
                className="h-full w-full"
                fallback={<LoaderStarFallback />}
              />
            </div>
            <p className="kicker">Abrindo o livro da ceia</p>
          </div>
        ) : (
          <>
            {/* Painel financeiro editorial */}
            <section className="surface rise relative overflow-hidden p-6">
              {allPaid && (
                <div className="pointer-events-none absolute inset-0 z-10">
                  <LoopMedia
                    name="mn-confete"
                    once
                    className="h-full w-full opacity-80"
                    fallback={<ConfettiFallback />}
                  />
                </div>
              )}

              <div className="relative z-20">
                <div className="flex items-center justify-between gap-2">
                  <p className="kicker">Livro da ceia</p>
                  <span className="text-xs text-marfim-3">
                    Cota individual: <strong className="numeral text-marfim-2">{brl(data?.contribution_value ?? 50)}</strong>
                  </span>
                </div>

                <div className="mt-4">
                  <span className="block text-xs uppercase tracking-widest text-marfim-3">
                    Saldo disponível
                  </span>
                  <p
                    className={`display numeral mt-1 text-[2.85rem] leading-none ${
                      (data?.saldo ?? 0) < 0 ? 'text-cereja' : 'text-marfim'
                    }`}
                  >
                    {brl(data?.saldo ?? 0)}
                  </p>
                </div>

                {/* Linha Arrecadado e Gasto separados por fio de 1px */}
                <div className="mt-6 flex items-stretch border-y border-linha py-4">
                  <div className="flex-1 pr-4">
                    <span className="block text-[11px] uppercase tracking-wider text-marfim-3">
                      Arrecadado
                    </span>
                    <span className="numeral mt-1 block text-xl text-champagne">
                      {brl(data?.arrecadado ?? 0)}
                    </span>
                  </div>

                  <div className="w-px bg-linha-forte" aria-hidden />

                  <div className="flex-1 pl-4">
                    <span className="block text-[11px] uppercase tracking-wider text-marfim-3">
                      Gasto
                    </span>
                    <span className="numeral mt-1 block text-xl text-marfim">
                      {brl(data?.gasto ?? 0)}
                    </span>
                  </div>
                </div>

                {/* Barra fina de quem pagou (x de y) */}
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-marfim-2">
                      {allPaid ? (
                        <span className="inline-flex items-center gap-1.5 text-champagne">
                          <Sparkles size={13} strokeWidth={1.5} />
                          Todos contribuíram ({paidParticipants} de {totalParticipants})
                        </span>
                      ) : (
                        <>
                          <strong className="numeral text-marfim">{paidParticipants}</strong> de{' '}
                          <strong className="numeral text-marfim">{totalParticipants}</strong> pagaram
                        </>
                      )}
                    </span>
                    <span className="numeral text-marfim-3">{progressPct}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-carvao-3">
                    <div
                      className="h-full rounded-full bg-champagne transition-all duration-700"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Minha contribuição pelo Pix (C6) */}
            {(() => {
              const eu = participants.find((p) => p.id === me.participant_id);
              if (!eu) return null;
              return eu.paid ? (
                <p className="rise mt-4 flex items-center justify-center gap-2 text-sm text-marfim-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-champagne" /> Sua parte já está paga. Obrigado!
                </p>
              ) : (
                <Link href="/pagar" className="btn btn-primary rise mt-4 w-full">
                  Pagar minha parte com Pix
                </Link>
              );
            })()}

            {/* Abas finas sublinhadas */}
            <nav
              aria-label="Seções da vaquinha"
              className="mt-6 flex border-b border-linha"
            >
              {(
                [
                  { id: 'pagamentos', label: 'Quem já pagou' },
                  { id: 'gastos', label: 'Gastos' },
                  { id: 'timeline', label: 'Linha do tempo' },
                ] as const
              ).map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`relative flex-1 py-3.5 text-center text-xs font-semibold tracking-wide transition ${
                      active ? 'text-marfim' : 'text-marfim-3 hover:text-marfim-2'
                    }`}
                  >
                    {item.label}
                    {active && (
                      <span className="absolute inset-x-3 bottom-0 h-0.5 bg-cereja" />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Conteúdo da aba ativa */}
            <div className="mt-4 pb-8">
              {tab === 'pagamentos' && (
                <section aria-label="Quem já pagou">
                  {participants.length === 0 ? (
                    <div className="surface rise px-6 py-12 text-center">
                      <div className="mx-auto mb-3 h-16 w-16">
                        <LoopMedia
                          name="mn-vazio"
                          className="h-full w-full"
                          fallback={<EmptyTreeFallback />}
                        />
                      </div>
                      <p className="display text-xl text-marfim">Nenhum participante ainda</p>
                      <p className="mt-1 text-sm text-marfim-3">
                        Assim que os parentes entrarem, a lista aparece aqui.
                      </p>
                    </div>
                  ) : (
                    <>
                      {me.is_admin && (
                        <p className="mb-2 px-1 text-xs text-marfim-3">
                          Toque em um parente para confirmar ou alterar o pagamento.
                        </p>
                      )}
                      <ul className="stagger divide-y divide-linha">
                        {participants.map((p) => {
                          const paidDateText = formatShortDate(p.paid_date);
                          const Wrapper = me.is_admin ? 'button' : 'div';
                          return (
                            <li key={p.id}>
                              <Wrapper
                                {...(me.is_admin
                                  ? {
                                      type: 'button' as const,
                                      onClick: () => setSelectedParticipant(p),
                                    }
                                  : {})}
                                className={`flex w-full items-center justify-between gap-3 py-3.5 text-left transition ${
                                  me.is_admin ? 'active:opacity-75' : ''
                                }`}
                              >
                                <div className="flex min-w-0 items-center gap-3.5">
                                  <Avatar
                                    name={p.name}
                                    src={p.avatar_url}
                                    size={42}
                                    ring={p.paid}
                                  />
                                  <div className="min-w-0">
                                    <p className="truncate font-medium text-marfim">{p.name}</p>
                                    <p className="mt-0.5 text-xs text-marfim-3">
                                      {p.paid
                                        ? paidDateText
                                          ? `Pago em ${paidDateText}`
                                          : 'Contribuição confirmada'
                                        : `Cota: ${brl(data?.contribution_value ?? 50)}`}
                                    </p>
                                  </div>
                                </div>

                                {p.paid ? (
                                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-champagne/50 bg-champagne/10 px-3 py-1 text-xs font-medium text-champagne">
                                    <Check size={13} strokeWidth={1.5} />
                                    Pago
                                  </span>
                                ) : (
                                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-linha px-3 py-1 text-xs text-marfim-3">
                                    <Clock size={12} strokeWidth={1.5} />
                                    pendente
                                  </span>
                                )}
                              </Wrapper>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </section>
              )}

              {tab === 'gastos' && (
                <section aria-label="Gastos da ceia">
                  {purchases.length === 0 ? (
                    <div className="surface rise px-6 py-12 text-center">
                      <div className="mx-auto mb-3 h-16 w-16">
                        <LoopMedia
                          name="mn-vazio"
                          className="h-full w-full"
                          fallback={<EmptyTreeFallback />}
                        />
                      </div>
                      <p className="display text-xl text-marfim">Nenhum gasto registrado</p>
                      <p className="mt-1 text-sm text-marfim-3">
                        Todas as compras da ceia e bebidas aparecerão aqui com fotos e valores.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {groupedPurchases.map((group) => (
                        <div key={group.key} className="rise">
                          <p className="kicker mb-2 px-1">{group.label}</p>
                          <ul className="divide-y divide-linha border-y border-linha">
                            {group.items.map((pur) => {
                              const thumb = pur.images?.[0] ?? null;
                              return (
                                <li key={pur.id}>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedPurchase(pur)}
                                    className="flex w-full items-center justify-between gap-3.5 py-3.5 text-left transition active:opacity-75"
                                  >
                                    <div className="flex min-w-0 items-center gap-3.5">
                                      {thumb ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={thumb}
                                          alt={pur.description}
                                          className="h-14 w-14 shrink-0 rounded-[14px] object-cover"
                                        />
                                      ) : (
                                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] border border-linha bg-carvao-2 text-champagne">
                                          <Receipt size={20} strokeWidth={1.5} />
                                        </span>
                                      )}
                                      <div className="min-w-0">
                                        <span className="kicker block text-[10px]">
                                          {pur.category}
                                        </span>
                                        <p className="mt-0.5 truncate font-medium text-marfim">
                                          {pur.description}
                                        </p>
                                        <p className="mt-0.5 truncate text-xs text-marfim-3">
                                          {[
                                            pur.brand,
                                            pur.quantity > 1 ? `${pur.quantity} un.` : null,
                                            pur.images.length > 1 ? `${pur.images.length} fotos` : null,
                                          ]
                                            .filter(Boolean)
                                            .join(' · ') || 'Toque para ver detalhes'}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="shrink-0 text-right">
                                      <span className="numeral text-lg text-marfim">
                                        {brl(pur.value)}
                                      </span>
                                    </div>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {tab === 'timeline' && (
                <section aria-label="Linha do tempo">
                  {timeline.length === 0 ? (
                    <div className="surface rise px-6 py-12 text-center">
                      <div className="mx-auto mb-3 h-16 w-16">
                        <LoopMedia
                          name="mn-vazio"
                          className="h-full w-full"
                          fallback={<EmptyTreeFallback />}
                        />
                      </div>
                      <p className="display text-xl text-marfim">Linha do tempo vazia</p>
                      <p className="mt-1 text-sm text-marfim-3">
                        Pagamentos e compras da família aparecem aqui em ordem cronológica.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {groupedTimeline.map((group) => (
                        <div key={group.key} className="rise">
                          <p className="kicker mb-3 px-1">{group.label}</p>
                          <ol className="relative ml-3 border-l border-champagne/35 pl-5 space-y-4">
                            {group.items.map((ev) => {
                              const isPayment = ev.type === 'payment';
                              const thumb = ev.images?.[0] ?? null;
                              return (
                                <li key={ev.id} className="relative">
                                  <span
                                    aria-hidden
                                    className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-carvao ${
                                      isPayment ? 'bg-champagne' : 'bg-cereja'
                                    }`}
                                  />
                                  <div
                                    onClick={() => openPurchaseFromTimeline(ev)}
                                    role={ev.type === 'purchase' ? 'button' : undefined}
                                    tabIndex={ev.type === 'purchase' ? 0 : undefined}
                                    onKeyDown={(e) => {
                                      if (
                                        ev.type === 'purchase' &&
                                        (e.key === 'Enter' || e.key === ' ')
                                      ) {
                                        openPurchaseFromTimeline(ev);
                                      }
                                    }}
                                    className={`flex items-center justify-between gap-3 rounded-[16px] border border-linha bg-carvao-2/70 p-3.5 ${
                                      ev.type === 'purchase' ? 'cursor-pointer active:opacity-80' : ''
                                    }`}
                                  >
                                    <div className="flex min-w-0 items-center gap-3">
                                      {isPayment ? (
                                        <Avatar
                                          name={ev.name || ev.description}
                                          src={ev.avatar_url}
                                          size={38}
                                          ring
                                        />
                                      ) : thumb ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={thumb}
                                          alt={ev.description}
                                          className="h-10 w-10 shrink-0 rounded-[10px] object-cover"
                                        />
                                      ) : (
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-carvao-3 text-champagne">
                                          <Receipt size={17} strokeWidth={1.5} />
                                        </span>
                                      )}

                                      <div className="min-w-0">
                                        <span className="kicker block text-[10px]">
                                          {isPayment ? 'Contribuição' : ev.category || 'Gasto'}
                                        </span>
                                        <p className="truncate text-sm font-medium text-marfim">
                                          {ev.description}
                                        </p>
                                      </div>
                                    </div>

                                    <span
                                      className={`numeral shrink-0 text-base ${
                                        isPayment ? 'text-champagne' : 'text-marfim'
                                      }`}
                                    >
                                      {isPayment ? '+' : '-'} {brl(ev.value)}
                                    </span>
                                  </div>
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          </>
        )}
      </div>

      {/* Botão flutuante '+' cereja para Admin */}
      {me.is_admin && (
        <button
          type="button"
          onClick={() =>
            setCreateSheet({
              open: true,
              mode: tab === 'pagamentos' ? 'participant' : 'purchase',
            })
          }
          aria-label="Adicionar gasto ou participante"
          className="fixed bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom)+16px)] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-cereja text-marfim shadow-[0_12px_28px_-8px_rgba(197,41,45,0.85)] transition active:scale-95"
        >
          <Plus size={24} strokeWidth={1.5} />
        </button>
      )}

      {/* Folhas inferiores (Bottom Sheets) */}
      <PurchaseDetailSheet
        key={`compra-${selectedPurchase?.id ?? 'nenhuma'}`}
        purchase={selectedPurchase}
        isAdmin={me.is_admin}
        onClose={() => setSelectedPurchase(null)}
        onDeleted={() => {
          setSelectedPurchase(null);
          load();
        }}
      />

      <ParticipantActionSheet
        key={`parente-${selectedParticipant?.id ?? 'nenhum'}`}
        participant={selectedParticipant}
        contributionValue={data?.contribution_value ?? 50}
        onClose={() => setSelectedParticipant(null)}
        onUpdated={() => {
          setSelectedParticipant(null);
          load();
        }}
      />

      <AdminCreateSheet
        key={`${createSheet.open}-${createSheet.mode}`}
        open={createSheet.open}
        initialMode={createSheet.mode}
        onClose={() => setCreateSheet((s) => ({ ...s, open: false }))}
        onSaved={() => {
          setCreateSheet((s) => ({ ...s, open: false }));
          load();
        }}
      />
    </div>
  );
}
