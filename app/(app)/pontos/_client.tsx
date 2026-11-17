'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  Crown,
  Check,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Lock,
  MicVocal,
  Plus,
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
  situacaoSugestao,
  textoPontos,
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
            <span className="mt-1 block text-xs text-marfim-2">
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
      <span className="w-full truncate text-sm font-medium text-marfim">
        {item.nome.trim().split(/\s+/)[0]}
        {souEu ? ' (você)' : ''}
      </span>
      <span className="numeral mt-1 text-lg text-champagne">
        {item.total.toLocaleString('pt-BR')}
      </span>
      <span className="text-xs text-marfim-2">
        {item.conquistas} {item.conquistas === 1 ? 'conquista' : 'conquistas'}
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

  const sugestoes = painel?.sugestoes ?? [];
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
        kicker={painel ? `Natal de ${painel.ano}` : 'Natal em Família'}
        title="Meus pontos"
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
            {/* Resumo: quanto a pessoa tem e para que servem os pontos */}
            <section
              aria-label="Seus pontos"
              className="surface relative overflow-hidden border border-champagne/40 p-6"
            >
              <p className="kicker">Você tem</p>
              <p className="numeral mt-2 text-[clamp(3rem,13vw,4.4rem)] leading-none text-marfim">
                <NumeroAnimado valor={painel.total} />
                <span className="ml-3 text-2xl font-normal text-champagne">
                  {painel.total === 1 ? 'ponto' : 'pontos'}
                </span>
              </p>
              <p className="mt-4 flex items-center gap-2 text-base font-semibold text-champagne">
                {painel.posicao !== null ? (
                  <>
                    <Trophy size={18} strokeWidth={1.6} className="shrink-0" aria-hidden />
                    Você está em {painel.posicao}º lugar na família
                  </>
                ) : (
                  <>
                    <Lock size={18} strokeWidth={1.6} className="shrink-0" aria-hidden />
                    Sua posição fica em segredo até a festa
                  </>
                )}
              </p>
              <p className="mt-4 text-base leading-relaxed text-marfim">
                {painel.encerrado
                  ? 'A contagem de pontos terminou. O Campeão do Natal é revelado na TV da festa.'
                  : 'Quem tiver mais pontos na noite de Natal é o Campeão do Natal e ganha um brinde.'}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-marfim-2">
                Os pontos não se trocam por nada: servem para a classificação da família.
                {painel.encerrado ? '' : ' Ponto novo leva até 5 minutos para aparecer aqui.'}
              </p>
            </section>

            {/* Como ganhar pontos: o que ainda vale hoje, com o valor de cada coisa e o atalho para fazer */}
            <section aria-labelledby="sec-como-ganhar" className="space-y-4">
              <div>
                <p className="kicker">É só participar</p>
                <h2 id="sec-como-ganhar" className="display mt-1 text-3xl">
                  Como ganhar pontos
                </h2>
                {sugestoes.length > 0 && (
                  <p className="mt-1 text-sm text-marfim-2">Toque em uma linha para ir direto fazer.</p>
                )}
              </div>

              {sugestoes.length > 0 && (
                <ul className="surface divide-y divide-linha px-4">
                  {sugestoes.map((s) => {
                    const { texto, completo } = situacaoSugestao(s);
                    return (
                      <li key={s.regra}>
                        <Link href={s.href} className="flex min-h-16 items-center gap-3 py-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                              completo ? 'border-salvia bg-salvia/40 text-marfim' : 'border-champagne/50 text-champagne'
                            }`}
                          >
                            {completo ? (
                              <Check size={18} strokeWidth={2} aria-hidden />
                            ) : (
                              <Plus size={18} strokeWidth={1.8} aria-hidden />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-base font-medium text-marfim">{s.titulo}</span>
                            <span className="mt-0.5 block text-sm text-marfim-2">{texto}</span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="numeral block text-xl leading-none text-champagne">+{s.pontos}</span>
                            <span className="mt-1 block text-xs text-marfim-2">{s.pontos === 1 ? 'ponto' : 'pontos'}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="surface px-4">
                <h3 className="pt-4 text-base font-semibold text-marfim">
                  {painel.encerrado ? 'O que valeu pontos' : 'Também valem pontos'}
                </h3>
                <ul className="divide-y divide-linha">
                  <li className="py-3.5">
                    <p className="text-base text-marfim">Abrir o aplicativo</p>
                    <p className="mt-0.5 text-sm text-marfim-2">5 pontos por dia. Conta sozinho, é só entrar.</p>
                  </li>
                  <li>
                    <Link href="/missoes" className="flex min-h-16 items-center gap-3 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-base text-marfim">Missões relâmpago</span>
                        <span className="mt-0.5 block text-sm text-marfim-2">
                          Um desafio surpresa, com prazo. De 20 a 80 pontos.
                        </span>
                      </span>
                      <ChevronRight size={20} strokeWidth={1.6} className="shrink-0 text-champagne" aria-hidden />
                    </Link>
                  </li>
                  <li>
                    <Link href="/conquistas" className="flex min-h-16 items-center gap-3 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-base text-marfim">
                          Conquistas ({painel.conquistas_ganhas} de {painel.conquistas_total})
                        </span>
                        <span className="mt-0.5 block text-sm text-marfim-2">
                          Prêmios por participar bastante. De 20 a 250 pontos cada.
                        </span>
                      </span>
                      <ChevronRight size={20} strokeWidth={1.6} className="shrink-0 text-champagne" aria-hidden />
                    </Link>
                  </li>
                  <li className="py-3.5">
                    <p className="text-base text-marfim">Na noite de Natal</p>
                    <p className="mt-0.5 text-sm text-marfim-2">
                      Quiz, bingo, karaokê e brincadeiras também valem pontos.
                    </p>
                  </li>
                </ul>
                <a
                  href="#tabela"
                  className="flex min-h-12 items-center gap-2 border-t border-linha text-sm font-semibold text-champagne"
                >
                  Ver a tabela completa de pontos
                  <ChevronDown size={18} strokeWidth={1.6} aria-hidden />
                </a>
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
                  <p className="max-w-[45%] text-right text-xs text-marfim-2">
                    Aparece até {formatarDataHoraSP(painel.ranking_oculto_em)}
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
                        A classificação está em segredo: o resultado sai na festa
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-marfim-2">
                        Nos últimos dias ninguém vê a posição de ninguém, para manter a surpresa. Continue participando: os pontos seguem valendo até o fim.
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
                                {linha.total.toLocaleString('pt-BR')}
                                <span className="ml-1 font-sans text-sm text-marfim-2">pontos</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  <p className="text-sm text-marfim-2">
                    Toque em qualquer pessoa para ver as conquistas dela.
                  </p>
                </div>
              )}
            </section>

            {/* Como funciona: explicação dos dois brindes + tabela de regras */}
            <section aria-labelledby="sec-como-funciona" className="space-y-5">
              <div>
                <p className="kicker">Para que servem os pontos</p>
                <h2 id="sec-como-funciona" className="display mt-1 text-3xl">
                  Os dois brindes da noite
                </h2>
                <p className="mt-1 text-sm text-marfim-2">
                  Na noite de Natal a família conhece dois vencedores, revelados na TV da festa.
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
                    Para quem tiver mais pontos. Vale tudo o que está na lista Como ganhar pontos: recados, fotos, Advento, brincadeiras da festa, karaokê, missões e conquistas.
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
                    Para quem vencer a Prova do Karaokê, que não depende destes pontos: 5 músicas oficiais no nível Difícil, uma tentativa por música, e a final ao vivo na noite de Natal. A mesma pessoa pode ganhar os dois brindes.
                  </p>
                </article>
              </div>

              <div className="surface space-y-2 p-5 text-sm leading-relaxed text-marfim-2">
                <p className="flex items-center gap-2 font-medium text-marfim">
                  <HelpCircle size={16} className="text-champagne" aria-hidden />
                  Regras de justiça
                </p>
                <p>
                  Carona e dinheiro (vaquinha ou pagamentos) não dão pontos, para ninguém levar vantagem por ter mais dinheiro. As conquistas ligadas a dinheiro valem 0 pontos: são só uma lembrança.
                </p>
                <p>
                  Os pontos contam até {formatarDataHoraSP(painel.encerra_em)}. A classificação aparece até {formatarDataHoraSP(painel.ranking_oculto_em)} e depois fica em segredo até ser revelada na TV da festa.
                </p>
              </div>
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

              {/* De onde vieram os pontos */}
              <dl className="grid grid-cols-2 gap-2">
                {ORDEM_ORIGENS.map((origem) => {
                  const valor = painel.por_origem?.[origem] ?? 0;
                  return (
                    <div key={origem} className="rounded-xl border border-linha bg-carvao-2 px-3.5 py-2.5">
                      <dt className="text-xs text-marfim-2">{ROTULOS_ORIGEM[origem]}</dt>
                      <dd className="numeral mt-0.5 text-lg text-marfim">{valor >= 0 ? `+${valor}` : valor}</dd>
                    </div>
                  );
                })}
              </dl>

              <div
                className="no-scrollbar flex gap-2 overflow-x-auto pb-1"
                role="group"
                aria-label="Filtrar extrato por origem"
              >
                <button
                  type="button"
                  aria-pressed={filtroOrigem === 'todas'}
                  onClick={() => setFiltroOrigem('todas')}
                  className={`btn shrink-0 px-4 text-sm ${
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
                    className={`btn shrink-0 px-4 text-sm ${
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
                    ? 'Você ainda não tem pontos neste Natal. Mande um recado no mural ou uma foto para o álbum para começar!'
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
                          {dia.total >= 0 ? `+${dia.total}` : dia.total} no dia
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

            {/* Tabela completa, uma regra por linha (cabe na tela do celular sem cortar a coluna do limite) */}
            <section id="tabela" aria-labelledby="sec-tabela" className="scroll-mt-6 space-y-4">
              <div>
                <p className="kicker">Para quem quer os detalhes</p>
                <h2 id="sec-tabela" className="display mt-1 text-3xl">
                  Tabela completa de pontos
                </h2>
                <p className="mt-1 text-sm text-marfim-2">
                  O dia vira à meia-noite, no horário de Brasília. O que for apagado deixa de contar.
                </p>
              </div>
              {painel.regras.length === 0 ? (
                <p className="surface p-5 text-sm text-marfim-2">A tabela será carregada em instantes.</p>
              ) : (
                <ul className="surface divide-y divide-linha px-4">
                  {painel.regras.map((r) => (
                    <li key={r.regra} className="flex items-start justify-between gap-4 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-medium text-marfim">{r.titulo}</p>
                        <p className="mt-0.5 text-sm text-marfim-2">
                          {r.teto ? `Limite: ${r.teto}` : 'Vale toda vez'}
                        </p>
                      </div>
                      <p className="numeral max-w-[42%] shrink-0 text-right text-lg text-champagne">{r.pontos}</p>
                    </li>
                  ))}
                </ul>
              )}
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
                <p className="text-sm text-marfim-2">Pontos neste Natal</p>
                {perfilAberto.total !== null ? (
                  <p className="numeral text-3xl text-champagne">
                    {textoPontos(perfilAberto.total)}
                  </p>
                ) : (
                  <p className="text-sm text-marfim-2">Pontos em segredo até a festa</p>
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
                            className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${est.selo}`}
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
