'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Award,
  Crown,
  Flame,
  HelpCircle,
  Lock,
  MicVocal,
  Sparkles,
  Trophy,
} from 'lucide-react';
import PageHeader from '@/app/ui/PageHeader';
import Avatar from '@/app/ui/Avatar';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { Loading, Sheet } from '../familia/_components/shared';
import ToastConquista, { IconeConquista } from '@/app/components/ToastConquista';
import type {
  LinhaRanking,
  Origem,
  PainelPontos,
  PerfilPontos,
} from '@/app/lib/gamificacao/tipos';
import {
  ESTILO_NIVEL,
  ORDEM_ORIGENS,
  ROTULOS_NIVEL,
  ROTULOS_ORIGEM,
  calcularContagemRegressiva,
  filtrarExtratoPorOrigem,
  formatarDataHoraSP,
  formatarDiaExtrato,
  formatarHoraSP,
  separarPodioEResto,
} from './_logica';

function NumeroAnimado({ valor }: { valor: number }) {
  const [exibido, setExibido] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    const inicio = performance.now();
    const duracao = 750;
    const passo = (agora: number) => {
      if (reduzir || valor === 0) {
        setExibido(valor);
        return;
      }
      const t = Math.min(1, (agora - inicio) / duracao);
      const ease = 1 - Math.pow(1 - t, 3);
      setExibido(Math.round(valor * ease));
      if (t < 1) {
        frame = window.requestAnimationFrame(passo);
      }
    };
    frame = window.requestAnimationFrame(passo);
    return () => window.cancelAnimationFrame(frame);
  }, [valor]);

  return <>{exibido.toLocaleString('pt-BR')}</>;
}

function ContagemAteEncerrar({ encerraEm }: { encerraEm: string }) {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const c = calcularContagemRegressiva(encerraEm, agora);
  if (c.encerrado) {
    return (
      <p className="mt-4 rounded-xl border border-champagne/40 bg-carvao-3 px-4 py-3 text-center text-sm text-champagne">
        A contagem de pontos encerrou. Preparem o coração para a revelação no telão!
      </p>
    );
  }

  const blocos = [
    ['dias', String(c.dias)],
    ['horas', String(c.horas).padStart(2, '0')],
    ['min', String(c.minutos).padStart(2, '0')],
    ['seg', String(c.segundos).padStart(2, '0')],
  ] as const;

  return (
    <div className="mt-4">
      <p className="mb-2 text-center text-xs text-marfim-3">
        Tempo restante para somar pontos até {formatarDataHoraSP(encerraEm)}
      </p>
      <div className="grid grid-cols-4 gap-2" aria-label="Contagem regressiva até o encerramento">
        {blocos.map(([rotulo, num]) => (
          <div
            key={rotulo}
            className="rounded-2xl border border-linha bg-carvao-3 px-2 py-3 text-center"
          >
            <span className="numeral block text-2xl leading-none text-marfim">{num}</span>
            <span className="mt-1 block text-[10px] uppercase tracking-[0.16em] text-marfim-3">
              {rotulo}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CartaoPodio({
  item,
  euId,
  onSelecionar,
}: {
  item: LinhaRanking;
  euId: number;
  onSelecionar: (userId: number) => void;
}) {
  const primeiro = item.posicao === 1;
  const segundo = item.posicao === 2;
  const souEu = item.user_id === euId;
  const borda = primeiro
    ? 'border-yellow-500/70 bg-carvao-3'
    : segundo
      ? 'border-slate-400/50 bg-carvao-2'
      : 'border-amber-700/60 bg-carvao-2';
  const corMedalha = primeiro
    ? 'text-yellow-300'
    : segundo
      ? 'text-slate-200'
      : 'text-amber-300';

  return (
    <button
      type="button"
      onClick={() => onSelecionar(item.user_id)}
      className={`flex min-w-0 flex-col items-center rounded-2xl border p-3 text-center transition hover:border-champagne ${borda} ${
        primeiro ? ' -mt-2 pb-4 pt-4 shadow-lg' : ''
      }`}
    >
      <span className={`display flex items-center gap-1 text-lg ${corMedalha}`}>
        {primeiro ? <Crown size={16} strokeWidth={1.8} aria-hidden /> : null}
        {item.posicao}º
      </span>
      <div className="my-2">
        <Avatar name={item.nome} src={item.avatar_url} size={primeiro ? 52 : 44} ring={primeiro || souEu} />
      </div>
      <span className="w-full truncate text-xs font-medium text-marfim">
        {item.nome.trim().split(/\s+/)[0]}
        {souEu ? ' (você)' : ''}
      </span>
      <span className="numeral mt-1 text-lg text-champagne">
        {item.total.toLocaleString('pt-BR')}
      </span>
      <span className="text-[10px] text-marfim-3">
        {item.conquistas} {item.conquistas === 1 ? 'selo' : 'selos'}
      </span>
    </button>
  );
}

export default function PontosClient() {
  const toast = useToast();
  const [painel, setPainel] = useState<PainelPontos | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [filtroOrigem, setFiltroOrigem] = useState<Origem | 'todas'>('todas');
  const [perfilAberto, setPerfilAberto] = useState<PerfilPontos | null>(null);
  const [carregandoPerfil, setCarregandoPerfil] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const dados = await api<PainelPontos>('/api/pontos');
      setPainel(dados);
      setErro('');
    } catch (e) {
      setErro((e as Error).message || 'Não foi possível carregar os seus pontos.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function abrirPerfil(userId: number) {
    setCarregandoPerfil(true);
    try {
      const p = await api<PerfilPontos>(`/api/pontos/${userId}`);
      setPerfilAberto(p);
    } catch (e) {
      toast((e as Error).message, 'erro');
    } finally {
      setCarregandoPerfil(false);
    }
  }

  const extratoFiltrado = painel ? filtrarExtratoPorOrigem(painel.extrato, filtroOrigem) : [];
  const { podio, resto } = painel?.ranking ? separarPodioEResto(painel.ranking) : { podio: [], resto: [] };

  return (
    <div className="pb-12">
      {painel && (
        <ToastConquista
          conquistas={painel.conquistas}
          ano={painel.ano}
          userId={painel.user_id}
        />
      )}
      <PageHeader
        kicker={painel ? `Edição ${painel.ano}` : 'Natal em Família'}
        title="Pontos e Ranking"
        back="/"
      />

      <div className="space-y-8 px-5">
        {erro ? (
          <div role="alert" className="surface space-y-3 p-5">
            <p className="text-sm text-marfim-2">{erro}</p>
            <button
              type="button"
              className="btn btn-ghost w-full"
              onClick={() => void carregar()}
            >
              Tentar novamente
            </button>
          </div>
        ) : carregando || !painel ? (
          <Loading />
        ) : (
          <>
            {/* Resumo principal: total grande animado e posição */}
            <section
              aria-label="Sua pontuação"
              className="surface relative overflow-hidden border border-champagne/40 p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="kicker">Sua pontuação na edição</p>
                  <p className="numeral mt-2 text-[clamp(3rem,13vw,4.4rem)] leading-none text-marfim">
                    <NumeroAnimado valor={painel.total} />
                    <span className="ml-2 text-lg font-normal text-champagne">pts</span>
                  </p>
                </div>
                <div className="text-right">
                  {painel.posicao !== null ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-champagne/60 bg-carvao-3 px-3.5 py-1.5 text-sm font-semibold text-champagne">
                      <Trophy size={16} strokeWidth={1.6} aria-hidden />
                      {painel.posicao}º lugar
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-linha-forte bg-carvao-3 px-3.5 py-1.5 text-xs text-marfim-2">
                      <Lock size={14} strokeWidth={1.6} aria-hidden />
                      Posição em suspense
                    </span>
                  )}
                  <p className="mt-2 text-xs text-marfim-3">
                    {painel.conquistas_ganhas} de {painel.conquistas_total} conquistas
                  </p>
                </div>
              </div>

              {/* Resumo por origem */}
              <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-linha pt-4">
                {ORDEM_ORIGENS.map((origem) => {
                  const valor = painel.por_origem?.[origem] ?? 0;
                  return (
                    <div
                      key={origem}
                      className="rounded-xl border border-linha bg-carvao-3/60 px-3 py-2"
                    >
                      <dt className="truncate text-[11px] text-marfim-3">
                        {ROTULOS_ORIGEM[origem]}
                      </dt>
                      <dd className="numeral mt-0.5 text-base text-marfim">
                        {valor >= 0 ? `+${valor}` : valor}
                      </dd>
                    </div>
                  );
                })}
              </dl>

              {/* Atalhos rápidos */}
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <Link
                  href="/conquistas"
                  className="btn btn-ghost min-h-11 justify-between px-4 text-xs"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles size={15} className="text-champagne" aria-hidden />
                    Conquistas ({painel.conquistas_ganhas}/{painel.conquistas_total})
                  </span>
                  <ArrowUpRight size={15} className="text-champagne" aria-hidden />
                </Link>
                <Link
                  href="/missoes"
                  className="btn btn-ghost min-h-11 justify-between px-4 text-xs"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Flame size={15} className="text-cereja" aria-hidden />
                    Missões relâmpago
                  </span>
                  <ArrowUpRight size={15} className="text-champagne" aria-hidden />
                </Link>
              </div>
            </section>

            {/* Ranking com pódio OU estado oculto com contagem regressiva */}
            <section aria-labelledby="sec-ranking" className="space-y-4">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="kicker">Disputa saudável da família</p>
                  <h2 id="sec-ranking" className="display mt-1 text-3xl">
                    Ranking do Natal
                  </h2>
                </div>
                {painel.ranking !== null && !painel.encerrado && (
                  <p className="text-right text-xs text-marfim-3">
                    Visível até {formatarDataHoraSP(painel.ranking_oculto_em)}
                  </p>
                )}
              </div>

              {painel.ranking === null ? (
                <div className="surface border border-champagne/40 p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-champagne/50 bg-carvao-3 text-champagne">
                      <Lock size={20} strokeWidth={1.6} aria-hidden />
                    </span>
                    <div>
                      <h3 className="display text-2xl text-marfim">
                        O ranking está escondido: o resultado sai na festa
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-marfim-2">
                        Na reta final a tabela fica secreta para manter o suspense. Continue participando: cada ponto segue valendo até o encerramento!
                      </p>
                    </div>
                  </div>
                  <ContagemAteEncerrar encerraEm={painel.encerra_em} />
                </div>
              ) : painel.ranking.length === 0 ? (
                <p className="surface p-5 text-sm text-marfim-2">
                  Os primeiros pontos da família vão aparecer aqui assim que a participação começar.
                </p>
              ) : (
                <div className="space-y-4">
                  {/* Pódio (top 3) */}
                  {podio.length > 0 && (
                    <div
                      className="grid grid-cols-3 items-end gap-2.5 pt-2"
                      aria-label="Pódio dos três primeiros"
                    >
                      {podio.map((item) => (
                        <CartaoPodio
                          key={item.user_id}
                          item={item}
                          euId={painel.user_id}
                          onSelecionar={(id) => void abrirPerfil(id)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Demais posições */}
                  {resto.length > 0 && (
                    <ol className="surface divide-y divide-linha px-4">
                      {resto.map((linha) => {
                        const souEu = linha.user_id === painel.user_id;
                        return (
                          <li key={linha.user_id}>
                            <button
                              type="button"
                              disabled={carregandoPerfil}
                              onClick={() => void abrirPerfil(linha.user_id)}
                              className={`flex min-h-14 w-full items-center gap-3 py-3 text-left transition hover:opacity-90 ${
                                souEu ? 'text-champagne' : 'text-marfim'
                              }`}
                            >
                              <span className="numeral w-7 shrink-0 text-base text-champagne">
                                {linha.posicao}º
                              </span>
                              <Avatar
                                name={linha.nome}
                                src={linha.avatar_url}
                                size={36}
                                ring={souEu}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">
                                  {linha.nome}
                                  {souEu ? ' (você)' : ''}
                                </span>
                                <span className="block text-xs text-marfim-3">
                                  {linha.conquistas}{' '}
                                  {linha.conquistas === 1 ? 'conquista' : 'conquistas'}
                                </span>
                              </span>
                              <span className="numeral shrink-0 text-lg text-marfim">
                                {linha.total.toLocaleString('pt-BR')} pts
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  <p className="text-xs text-marfim-3">
                    Toque em qualquer pessoa para ver as conquistas que ela já desbloqueou.
                  </p>
                </div>
              )}
            </section>

            {/* Extrato por dia com filtro por origem */}
            <section aria-labelledby="sec-extrato" className="space-y-4">
              <div>
                <p className="kicker">Transparência total</p>
                <h2 id="sec-extrato" className="display mt-1 text-3xl">
                  Seu extrato de pontos
                </h2>
                <p className="mt-1 text-sm text-marfim-2">
                  Cada ponto tem dia, hora e explicação de onde veio.
                </p>
              </div>

              <div
                className="no-scrollbar flex gap-2 overflow-x-auto pb-1"
                role="group"
                aria-label="Filtrar extrato por origem"
              >
                <button
                  type="button"
                  aria-pressed={filtroOrigem === 'todas'}
                  onClick={() => setFiltroOrigem('todas')}
                  className={`btn min-h-10 shrink-0 px-3.5 text-xs ${
                    filtroOrigem === 'todas' ? 'btn-primary' : 'btn-ghost'
                  }`}
                >
                  Todas
                </button>
                {ORDEM_ORIGENS.map((origem) => (
                  <button
                    key={origem}
                    type="button"
                    aria-pressed={filtroOrigem === origem}
                    onClick={() => setFiltroOrigem(origem)}
                    className={`btn min-h-10 shrink-0 px-3.5 text-xs ${
                      filtroOrigem === origem ? 'btn-primary' : 'btn-ghost'
                    }`}
                  >
                    {ROTULOS_ORIGEM[origem]}
                  </button>
                ))}
              </div>

              {extratoFiltrado.length === 0 ? (
                <p className="surface p-5 text-sm text-marfim-2">
                  {filtroOrigem === 'todas'
                    ? 'Você ainda não tem pontos registrados nesta edição. Participe do mural, álbum, Advento ou karaokê para começar!'
                    : `Nenhum lançamento encontrado em "${ROTULOS_ORIGEM[filtroOrigem]}".`}
                </p>
              ) : (
                <div className="space-y-4">
                  {extratoFiltrado.map((dia) => (
                    <article key={dia.dia} className="surface p-4">
                      <header className="flex items-center justify-between border-b border-linha pb-2.5">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-champagne">
                          {formatarDiaExtrato(dia.dia)}
                        </h3>
                        <span className="numeral text-sm text-marfim">
                          {dia.total >= 0 ? `+${dia.total}` : dia.total} pts no dia
                        </span>
                      </header>
                      <ul className="divide-y divide-linha">
                        {dia.lancamentos.map((l, idx) => {
                          const hora = formatarHoraSP(l.ocorreu_em);
                          return (
                            <li
                              key={`${l.regra}-${l.ocorreu_em}-${idx}`}
                              className="flex items-center justify-between gap-3 py-2.5"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="break-words text-sm text-marfim">{l.descricao}</p>
                                <p className="mt-0.5 text-xs text-marfim-3">
                                  {ROTULOS_ORIGEM[l.origem] ?? l.origem}
                                  {hora ? ` · ${hora}` : ''}
                                </p>
                              </div>
                              <span
                                className={`numeral shrink-0 text-base ${
                                  l.pontos >= 0 ? 'text-champagne' : 'text-cereja'
                                }`}
                              >
                                {l.pontos >= 0 ? `+${l.pontos}` : l.pontos}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* Como funciona: explicação dos dois brindes + tabela de regras */}
            <section aria-labelledby="sec-como-funciona" className="space-y-5">
              <div>
                <p className="kicker">Jogo limpo e claro</p>
                <h2 id="sec-como-funciona" className="display mt-1 text-3xl">
                  Como funciona
                </h2>
                <p className="mt-1 text-sm text-marfim-2">
                  Tudo o que vale pontos e como funcionam os dois brindes da noite de Natal.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <article className="surface border border-champagne/40 p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-champagne/50 text-champagne">
                      <Trophy size={18} strokeWidth={1.6} aria-hidden />
                    </span>
                    <div>
                      <p className="kicker">1º Brinde</p>
                      <h3 className="display text-2xl">Campeão do Natal</h3>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-marfim-2">
                    Para quem mais participa da vida da família no app: soma os pontos de uso diário, mural, álbum, Advento, brincadeiras da festa, apresentações no karaokê, missões relâmpago e conquistas desbloqueadas.
                  </p>
                </article>

                <article className="surface border border-cereja/40 p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cereja/60 text-cereja">
                      <MicVocal size={18} strokeWidth={1.6} aria-hidden />
                    </span>
                    <div>
                      <p className="kicker">2º Brinde</p>
                      <h3 className="display text-2xl">Voz do Natal</h3>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-marfim-2">
                    Para a maior pontuação na Prova do Karaokê: eliminatória nas 5 músicas oficiais em nível Difícil (uma tentativa por música) e grande final ao vivo na noite de Natal. A mesma pessoa pode ganhar os dois brindes!
                  </p>
                </article>
              </div>

              <div className="surface space-y-2 p-5 text-sm leading-relaxed text-marfim-2">
                <p className="flex items-center gap-2 font-medium text-marfim">
                  <HelpCircle size={16} className="text-champagne" aria-hidden />
                  Regras de justiça
                </p>
                <p>
                  Carona e dinheiro (vaquinha ou pagamentos) não dão pontos, para ninguém levar vantagem financeira. Conquistas ligadas a dinheiro dão apenas o selo de lembrança, com 0 pontos.
                </p>
                <p>
                  O ranking fica visível até 48 horas antes do encerramento ({formatarDataHoraSP(painel.ranking_oculto_em)}) e depois entra em suspense até a revelação no telão da festa.
                </p>
              </div>

              {/* Tabela de regras vinda de PainelPontos.regras */}
              <div className="surface overflow-hidden">
                <div className="border-b border-linha px-5 py-4">
                  <h3 className="display text-2xl">Tabela de pontuação</h3>
                  <p className="mt-1 text-xs text-marfim-3">
                    Limites diários seguem o horário de São Paulo. Conteúdo apagado deixa de contar.
                  </p>
                </div>
                {painel.regras.length === 0 ? (
                  <p className="p-5 text-sm text-marfim-2">
                    A tabela de regras será carregada em instantes.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-linha text-[11px] uppercase tracking-wider text-marfim-3">
                          <th className="px-4 py-3 font-semibold">Atividade</th>
                          <th className="px-3 py-3 font-semibold">Pontos</th>
                          <th className="px-4 py-3 font-semibold">Limite</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-linha">
                        {painel.regras.map((r) => (
                          <tr key={r.regra}>
                            <td className="px-4 py-3">
                              <span className="block font-medium text-marfim">{r.titulo}</span>
                              <span className="text-xs text-marfim-3">
                                {ROTULOS_ORIGEM[r.origem] ?? r.origem}
                              </span>
                            </td>
                            <td className="numeral whitespace-nowrap px-3 py-3 text-champagne">
                              {r.pontos}
                            </td>
                            <td className="px-4 py-3 text-xs text-marfim-2">
                              {r.teto ?? 'Sem teto'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {/* Sheet de perfil de outra pessoa (GET /api/pontos/[userId]) */}
      {perfilAberto && (
        <Sheet
          title={perfilAberto.nome}
          onClose={() => setPerfilAberto(null)}
        >
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar name={perfilAberto.nome} src={perfilAberto.avatar_url} size={56} ring />
              <div>
                <p className="text-sm text-marfim-2">Pontuação acumulada</p>
                {perfilAberto.total !== null ? (
                  <p className="numeral text-3xl text-champagne">
                    {perfilAberto.total.toLocaleString('pt-BR')} pts
                  </p>
                ) : (
                  <p className="text-sm text-marfim-3">Ranking oculto até a festa</p>
                )}
              </div>
            </div>

            <div>
              <h3 className="kicker mb-3">
                Conquistas desbloqueadas (
                {perfilAberto.conquistas.filter((c) => Boolean(c.ganha_em)).length})
              </h3>
              {perfilAberto.conquistas.filter((c) => Boolean(c.ganha_em)).length === 0 ? (
                <p className="text-sm text-marfim-3">
                  Ainda não desbloqueou conquistas nesta edição.
                </p>
              ) : (
                <ul className="grid grid-cols-1 gap-2.5">
                  {perfilAberto.conquistas
                    .filter((c) => Boolean(c.ganha_em))
                    .map((c) => {
                      const est = ESTILO_NIVEL[c.nivel] ?? ESTILO_NIVEL.bronze;
                      return (
                        <li
                          key={c.id}
                          className={`flex items-center gap-3 rounded-2xl border p-3 ${est.borda} bg-carvao-3/60`}
                        >
                          <span
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${est.iconeFundo}`}
                          >
                            <IconeConquista nome={c.icone} size={20} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-marfim">{c.nome}</p>
                            <p className="truncate text-xs text-marfim-2">{c.descricao}</p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${est.selo}`}
                          >
                            {ROTULOS_NIVEL[c.nivel]}
                          </span>
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>

            <Link
              href={`/conquistas?user=${perfilAberto.user_id}`}
              className="btn btn-ghost w-full"
              onClick={() => setPerfilAberto(null)}
            >
              <Award size={17} strokeWidth={1.6} aria-hidden />
              Ver álbum completo de {perfilAberto.nome.trim().split(/\s+/)[0]}
            </Link>
          </div>
        </Sheet>
      )}
    </div>
  );
}
