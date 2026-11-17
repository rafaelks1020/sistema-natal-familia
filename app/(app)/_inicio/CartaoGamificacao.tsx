'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronRight, Flame } from 'lucide-react';
import { api } from '@/app/ui/client';
import ToastConquista from '@/app/components/ToastConquista';
import type { PainelMissoes, PainelPontos } from '@/app/lib/gamificacao/tipos';
import { calcularContagemRegressiva, proximasSugestoes } from '../pontos/_logica';

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

  const proximas = proximasSugestoes(pontos?.sugestoes, 3);

  return (
    <section
      aria-label="Seus pontos do Natal"
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
          <p className="kicker mb-1.5">Pontos do Natal</p>
          <h2 className="display text-2xl leading-tight text-marfim">
            {pontos ? (
              <>
                Você tem{' '}
                <span className="numeral text-4xl text-champagne">
                  {pontos.total.toLocaleString('pt-BR')}
                </span>{' '}
                {pontos.total === 1 ? 'ponto' : 'pontos'}
              </>
            ) : (
              'Seus pontos do Natal'
            )}
          </h2>
        </div>
        <ArrowUpRight size={20} strokeWidth={1.5} className="mt-1 shrink-0 text-champagne" aria-hidden />
      </Link>

      <p className="mt-3 text-sm leading-relaxed text-marfim-2">
        Quem tiver mais pontos na noite de Natal é o Campeão do Natal.
        {pontos
          ? pontos.posicao !== null
            ? ` Você está em ${pontos.posicao}º lugar.`
            : ' As posições ficam em segredo até a festa.'
          : ''}
      </p>

      {proximas.length > 0 && (
        <div className="mt-5 border-t border-linha pt-4">
          <h3 className="text-base font-semibold text-marfim">Para ganhar mais pontos hoje</h3>
          <ul className="mt-1 divide-y divide-linha">
            {proximas.map((s) => (
              <li key={s.regra}>
                <Link href={s.href} className="flex min-h-14 items-center gap-3 py-2.5 focus-visible:outline-2 focus-visible:outline-champagne">
                  <span className="min-w-0 flex-1 text-base leading-snug text-marfim">{s.titulo}</span>
                  <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-champagne">
                    +{s.pontos} {s.pontos === 1 ? 'ponto' : 'pontos'}
                  </span>
                  <ChevronRight size={18} strokeWidth={1.6} className="shrink-0 text-champagne" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* No início a missão aberta já aparece em "Para fazer agora"; aqui ela só entra quando o cartão anda sozinho (tela Eu). */}
      {buscaPropria && missaoAtiva && (
        <Link
          href="/missoes"
          className="mt-4 block rounded-2xl border border-cereja/50 bg-carvao-3/80 p-4 transition hover:border-champagne"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-cereja">
              <Flame size={16} strokeWidth={1.8} aria-hidden />
              Missão relâmpago valendo agora
            </span>
            <span className="whitespace-nowrap text-sm font-semibold text-champagne">
              +{missaoAtiva.pontos} pontos
            </span>
          </div>
          <p className="display mt-1.5 text-xl leading-snug text-marfim">
            {missaoAtiva.titulo}
          </p>
          <p className="mt-1 line-clamp-2 text-sm text-marfim-2">{missaoAtiva.descricao}</p>
          <div className="mt-2.5 flex items-center justify-between gap-2 text-sm">
            <span className="text-marfim-2">
              {contagem && !contagem.encerrado
                ? `Restam ${contagem.textoCurto}`
                : 'Últimos instantes'}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-champagne">
              {missaoAtiva.minha_resposta?.status === 'aprovada'
                ? 'Missão cumprida'
                : 'Responder agora'}
              <ArrowUpRight size={16} strokeWidth={1.6} aria-hidden />
            </span>
          </div>
        </Link>
      )}

      <div className="mt-4 space-y-2 border-t border-linha pt-4">
        <Link href="/pontos" className="btn btn-ghost w-full justify-between px-5 text-left">
          Como funcionam os pontos
          <ArrowUpRight size={18} strokeWidth={1.6} className="shrink-0 text-champagne" aria-hidden />
        </Link>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/conquistas" className="btn btn-ghost px-3 text-center text-sm leading-tight">
            Conquistas{pontos ? ` (${pontos.conquistas_ganhas} de ${pontos.conquistas_total})` : ''}
          </Link>
          <Link href="/missoes" className="btn btn-ghost px-3 text-sm">
            <Flame size={16} className="shrink-0 text-cereja" aria-hidden />
            Missões
          </Link>
        </div>
      </div>
    </section>
  );
}
