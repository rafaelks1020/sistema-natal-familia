'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Flame, Lock, Sparkles, Trophy } from 'lucide-react';
import { api } from '@/app/ui/client';
import ToastConquista from '@/app/components/ToastConquista';
import type { PainelMissoes, PainelPontos } from '@/app/lib/gamificacao/tipos';
import { calcularContagemRegressiva } from '../pontos/_logica';

/** `missoesDoPai`: quando a tela que usa o cartão já buscou as missões, passa aqui (null = ainda carregando). Sem a prop, o cartão busca sozinho. */
export default function CartaoGamificacao({ missoesDoPai }: { missoesDoPai?: PainelMissoes | null }) {
  const [pontos, setPontos] = useState<PainelPontos | null>(null);
  const [missoesProprias, setMissoesProprias] = useState<PainelMissoes | null>(null);
  const buscaPropria = missoesDoPai === undefined;
  const missoes = buscaPropria ? missoesProprias : missoesDoPai;
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const ctrl = new AbortController();
    api<PainelPontos>('/api/pontos', { signal: ctrl.signal })
      .then((p) => {
        if (!ctrl.signal.aborted) setPontos(p);
      })
      .catch(() => {});
    if (buscaPropria) {
      api<PainelMissoes>('/api/missoes', { signal: ctrl.signal })
        .then((m) => {
          if (!ctrl.signal.aborted) setMissoesProprias(m);
        })
        .catch(() => {});
    }
    return () => ctrl.abort();
  }, [buscaPropria]);

  const missaoAtiva = missoes?.ativas[0] ?? null;

  useEffect(() => {
    if (!missaoAtiva) return;
    const id = window.setInterval(() => setAgora(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [missaoAtiva]);

  const contagem = missaoAtiva
    ? calcularContagemRegressiva(missaoAtiva.termina_em, agora)
    : null;

  return (
    <section
      aria-label="Seus pontos e missões do Natal"
      className="rounded-[18px] border border-champagne/35 bg-carvao-2 p-6"
    >
      {pontos && (
        <ToastConquista
          conquistas={pontos.conquistas}
          ano={pontos.ano}
          userId={pontos.user_id}
        />
      )}

      <Link
        href="/pontos"
        className="flex items-start justify-between gap-4 focus-visible:outline-2 focus-visible:outline-champagne"
      >
        <div className="min-w-0">
          <p className="kicker mb-1.5">Campeão do Natal</p>
          <h2 className="display text-2xl leading-tight text-marfim">
            {pontos ? (
              <>
                <span className="numeral text-3xl text-champagne">
                  {pontos.total.toLocaleString('pt-BR')}
                </span>{' '}
                pontos na edição
              </>
            ) : (
              'Pontos, conquistas e missões'
            )}
          </h2>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-marfim-2">
            {pontos ? (
              pontos.posicao !== null ? (
                <span className="inline-flex items-center gap-1 text-champagne">
                  <Trophy size={13} strokeWidth={1.6} aria-hidden />
                  {pontos.posicao}º lugar no ranking
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-marfim-3">
                  <Lock size={13} strokeWidth={1.6} aria-hidden />
                  Ranking escondido até a festa
                </span>
              )
            ) : (
              <span>Veja o ranking da família, seu extrato e os dois brindes</span>
            )}
            {pontos ? (
              <span className="text-marfim-3">
                · {pontos.conquistas_ganhas}/{pontos.conquistas_total} conquistas
              </span>
            ) : null}
          </p>
        </div>
        <ArrowUpRight size={18} strokeWidth={1.5} className="shrink-0 text-champagne" />
      </Link>

      {missaoAtiva && (
        <Link
          href="/missoes"
          className="mt-4 block rounded-2xl border border-cereja/50 bg-carvao-3/80 p-4 transition hover:border-champagne"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cereja">
              <Flame size={14} strokeWidth={1.8} aria-hidden />
              Missão relâmpago ativa
            </span>
            <span className="numeral text-xs font-semibold text-champagne">
              +{missaoAtiva.pontos} pts
            </span>
          </div>
          <p className="display mt-1.5 text-xl leading-snug text-marfim">
            {missaoAtiva.titulo}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-marfim-2">{missaoAtiva.descricao}</p>
          <div className="mt-2.5 flex items-center justify-between text-xs">
            <span className="text-marfim-3">
              {contagem && !contagem.encerrado
                ? `Restam ${contagem.textoCurto}`
                : 'Últimos instantes'}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-champagne">
              {missaoAtiva.minha_resposta?.status === 'aprovada'
                ? 'Missão cumprida · Ver mural'
                : 'Responder agora'}
              <ArrowUpRight size={14} strokeWidth={1.6} aria-hidden />
            </span>
          </div>
        </Link>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-linha pt-4 text-center text-xs">
        <Link
          href="/pontos"
          className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-linha bg-carvao-3/50 px-2 text-marfim hover:border-champagne"
        >
          <Trophy size={13} className="text-champagne" aria-hidden />
          Ranking
        </Link>
        <Link
          href="/conquistas"
          className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-linha bg-carvao-3/50 px-2 text-marfim hover:border-champagne"
        >
          <Sparkles size={13} className="text-champagne" aria-hidden />
          Conquistas
        </Link>
        <Link
          href="/missoes"
          className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-linha bg-carvao-3/50 px-2 text-marfim hover:border-champagne"
        >
          <Flame size={13} className="text-cereja" aria-hidden />
          Missões
        </Link>
      </div>
    </section>
  );
}
