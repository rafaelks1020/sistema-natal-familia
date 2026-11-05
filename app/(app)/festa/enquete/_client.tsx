'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Check,
  Lock,
  Minimize2,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Trophy,
  Tv,
  X,
} from 'lucide-react';
import PageHeader from '@/app/ui/PageHeader';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { useMe } from '@/app/ui/user';
import {
  SUGESTOES_ENQUETE,
  type EnqueteData,
  type LivePollItem,
} from '@/app/api/festa/enquete/_data';

export default function EnqueteClient({
  initial,
  initialTv = false,
}: {
  initial: EnqueteData;
  initialTv?: boolean;
}) {
  const me = useMe();
  const toast = useToast();

  const [data, setData] = useState<EnqueteData>(initial);
  const [modoTv, setModoTv] = useState<boolean>(initialTv);
  const [busy, setBusy] = useState(false);

  // Formulario do organizador para lancar enquete rapida
  const [pergunta, setPergunta] = useState('');
  const [opcoes, setOpcoes] = useState<string[]>(['', '', '']);
  const [mostrarForm, setMostrarForm] = useState<boolean>(initial.enquetes.length === 0);

  useEffect(() => {
    setModoTv(initialTv);
  }, [initialTv]);

  const recarregar = useCallback(async () => {
    try {
      const res = await api<EnqueteData>('/api/festa/enquete');
      setData(res);
    } catch {
      /* ignora falha pontual de polling */
    }
  }, []);

  // Atualiza a cada 2 s conforme requisito
  useEffect(() => {
    const id = window.setInterval(() => {
      void recarregar();
    }, 2000);
    return () => window.clearInterval(id);
  }, [recarregar]);

  async function votar(pollId: number, opcaoIndex: number) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api<EnqueteData>('/api/festa/enquete', {
        method: 'POST',
        json: { acao: 'votar', poll_id: pollId, opcao_index: opcaoIndex },
      });
      setData(res);
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setBusy(false);
    }
  }

  async function executarAdmin(payload: Record<string, unknown>, msg?: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api<EnqueteData>('/api/festa/enquete', {
        method: 'POST',
        json: payload,
      });
      setData(res);
      if (msg) toast(msg);
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setBusy(false);
    }
  }

  async function criarEnquete(e: React.FormEvent) {
    e.preventDefault();
    const limpas = opcoes.map((o) => o.trim()).filter(Boolean);
    if (limpas.length < 2) {
      toast('Informe pelo menos 2 opções.', 'erro');
      return;
    }
    setBusy(true);
    try {
      const res = await api<EnqueteData>('/api/festa/enquete', {
        method: 'POST',
        json: { acao: 'criar', pergunta: pergunta.trim(), opcoes: limpas },
      });
      setData(res);
      setPergunta('');
      setOpcoes(['', '', '']);
      setMostrarForm(false);
      toast('Enquete lançada ao vivo!');
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setBusy(false);
    }
  }

  function usarSugestao(s: { pergunta: string; opcoes: readonly string[] }) {
    setPergunta(s.pergunta);
    setOpcoes([...s.opcoes]);
    setMostrarForm(true);
  }

  const destaque = data.enquete_destaque;

  // MODO TV (/festa/enquete?tv=1) : LETRAS GRANDES PARA SALA DE ESTAR
  if (modoTv) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-carvao p-6 md:p-12">
        <div className="mx-auto max-w-5xl space-y-8">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-linha pb-6">
            <div>
              <p className="kicker text-sm">Natal em Família {data.ano} · Modo TV ao Vivo</p>
              <h1 className="display mt-1 text-3xl text-marfim md:text-5xl">Enquete da Ceia</h1>
            </div>
            <Link
              href="/festa/enquete"
              onClick={() => setModoTv(false)}
              className="btn btn-ghost text-sm"
            >
              <Minimize2 size={18} /> Sair do modo TV
            </Link>
          </header>

          {!destaque ? (
            <div className="surface p-12 text-center">
              <Sparkles size={40} className="mx-auto text-champagne" />
              <h2 className="display mt-4 text-3xl text-marfim md:text-4xl">
                Aguardando a próxima enquete
              </h2>
              <p className="mt-2 text-lg text-marfim-2">
                Assim que quem organiza lançar uma pergunta, ela aparece aqui ao vivo!
              </p>
            </div>
          ) : (
            <section className="surface space-y-8 p-8 md:p-12">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold uppercase tracking-widest ${
                    destaque.aberta
                      ? 'border-cereja bg-cereja/20 text-marfim'
                      : 'border-champagne bg-carvao-3 text-champagne'
                  }`}
                >
                  {destaque.aberta ? 'Votação aberta nos celulares' : 'Enquete encerrada · Resultado'}
                </span>
                <span className="numeral text-2xl text-champagne md:text-3xl">
                  {destaque.total_votos} {destaque.total_votos === 1 ? 'voto' : 'votos'}
                </span>
              </div>

              <h2 className="display text-3xl leading-tight text-marfim md:text-5xl">
                {destaque.pergunta}
              </h2>

              <div className="space-y-6">
                {destaque.opcoes.map((op) => (
                  <div
                    key={op.index}
                    className={`rounded-3xl border p-5 transition-all md:p-7 ${
                      op.vencedora
                        ? 'border-champagne bg-salvia/30 ring-2 ring-champagne'
                        : 'border-linha-forte bg-carvao-3'
                    }`}
                  >
                    <div className="mb-3 flex items-baseline justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {op.vencedora && (
                          <Trophy size={30} className="shrink-0 text-champagne" />
                        )}
                        <span className="text-xl font-semibold text-marfim md:text-3xl">
                          {op.texto}
                        </span>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="numeral text-3xl text-champagne md:text-5xl">
                          {op.percentual}%
                        </span>
                        <span className="ml-3 text-base text-marfim-2 md:text-xl">
                          ({op.votos})
                        </span>
                      </div>
                    </div>

                    <div className="h-5 w-full overflow-hidden rounded-full bg-carvao md:h-7">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          op.vencedora ? 'bg-champagne' : 'bg-cereja'
                        }`}
                        style={{ width: `${Math.max(op.percentual, op.votos > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-nav">
      <PageHeader
        kicker="Jogos da Ceia"
        title="Enquete ao Vivo"
        back="/festa"
        action={
          <Link
            href="/festa/enquete?tv=1"
            onClick={() => setModoTv(true)}
            className="btn btn-ghost min-h-11 px-3.5 text-xs"
          >
            <Tv size={16} /> Modo TV
          </Link>
        }
      />

      <nav aria-label="Jogos da ceia" className="mb-5 flex gap-2 overflow-x-auto px-5 no-scrollbar">
        <Link href="/festa/quiz" className="btn btn-ghost min-h-11 shrink-0 px-4 text-xs">
          Quiz da Família
        </Link>
        <Link href="/festa/bingo" className="btn btn-ghost min-h-11 shrink-0 px-4 text-xs">
          Bingo da Ceia
        </Link>
        <Link href="/festa/enquete" className="btn btn-primary min-h-11 shrink-0 px-4 text-xs">
          Enquete ao Vivo
        </Link>
      </nav>

      <div className="space-y-6 px-5">
        {/* ENQUETE EM DESTAQUE */}
        {!destaque ? (
          <section className="rise surface space-y-3 p-6 text-center">
            <BarChart3 size={28} className="mx-auto text-champagne" />
            <h2 className="display text-2xl text-marfim">Nenhuma enquete lançada ainda</h2>
            <p className="text-sm text-marfim-2">
              Quando quem organiza lançar uma pergunta rápida, todos votam por aqui e as barras atualizam ao vivo!
            </p>
          </section>
        ) : (
          <EnqueteCard
            poll={destaque}
            destaque
            isAdmin={me.is_admin}
            busy={busy}
            onVotar={(idx) => void votar(destaque.id, idx)}
            onEncerrar={() =>
              void executarAdmin(
                { acao: 'encerrar', poll_id: destaque.id },
                'Enquete encerrada! Vencedor revelado.',
              )
            }
            onReabrir={() =>
              void executarAdmin({ acao: 'reabrir', poll_id: destaque.id }, 'Enquete reaberta!')
            }
            onExcluir={() => {
              if (window.confirm('Excluir esta enquete?')) {
                void executarAdmin({ acao: 'excluir', poll_id: destaque.id }, 'Enquete excluída.');
              }
            }}
          />
        )}

        {/* PAINEL DO ORGANIZADOR PARA LANCAR ENQUETE RAPIDA */}
        {me.is_admin && (
          <section className="rise space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="kicker">Só quem organiza</p>
                <h2 className="display text-2xl">Lançar enquete</h2>
              </div>
              <button
                type="button"
                onClick={() => setMostrarForm((v) => !v)}
                className="btn btn-ghost px-4 text-xs"
              >
                {mostrarForm ? 'Fechar' : 'Nova enquete'}
              </button>
            </div>

            {mostrarForm && (
              <form onSubmit={(e) => void criarEnquete(e)} className="surface space-y-4 p-5">
                <div className="space-y-2">
                  <p className="kicker">Sugestões rápidas (1 toque)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGESTOES_ENQUETE.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => usarSugestao(s)}
                        className="rounded-xl border border-linha-forte bg-carvao-3 px-3 py-2 text-left text-xs text-marfim-2 transition hover:border-champagne"
                      >
                        {s.pergunta}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block space-y-1 text-xs text-marfim-2">
                  <span>Pergunta rápida</span>
                  <input
                    className="field"
                    placeholder="Ex.: Quem conta a melhor história na mesa?"
                    value={pergunta}
                    onChange={(e) => setPergunta(e.target.value)}
                    maxLength={240}
                    required
                  />
                </label>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-marfim-2">Opções de voto (2 a 6)</span>
                    {opcoes.length < 6 && (
                      <button
                        type="button"
                        onClick={() => setOpcoes((xs) => [...xs, ''])}
                        className="text-xs font-medium text-champagne"
                      >
                        + Adicionar opção
                      </button>
                    )}
                  </div>

                  {opcoes.map((op, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        className="field"
                        placeholder={`Opção ${idx + 1}`}
                        value={op}
                        onChange={(e) =>
                          setOpcoes((xs) => xs.map((item, i) => (i === idx ? e.target.value : item)))
                        }
                        maxLength={100}
                        required={idx < 2}
                      />
                      {opcoes.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setOpcoes((xs) => xs.filter((_, i) => i !== idx))}
                          className="btn btn-quiet px-2"
                          aria-label="Remover opção"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button type="submit" disabled={busy} className="btn btn-primary w-full">
                  <Plus size={17} /> Lançar enquete ao vivo (avisa a família)
                </button>
              </form>
            )}
          </section>
        )}

        {/* HISTORICO DE ENQUETES DA NOITE */}
        {data.enquetes.length > 1 && (
          <section className="rise space-y-3">
            <div>
              <p className="kicker">Histórico da noite</p>
              <h2 className="display text-xl">Enquetes anteriores</h2>
            </div>
            <div className="space-y-4">
              {data.enquetes
                .filter((e) => e.id !== destaque?.id)
                .map((poll) => (
                  <EnqueteCard
                    key={poll.id}
                    poll={poll}
                    destaque={false}
                    isAdmin={me.is_admin}
                    busy={busy}
                    onVotar={(idx) => void votar(poll.id, idx)}
                    onEncerrar={() =>
                      void executarAdmin({ acao: 'encerrar', poll_id: poll.id }, 'Enquete encerrada!')
                    }
                    onReabrir={() =>
                      void executarAdmin({ acao: 'reabrir', poll_id: poll.id }, 'Enquete reaberta!')
                    }
                    onExcluir={() => {
                      if (window.confirm('Excluir esta enquete?')) {
                        void executarAdmin({ acao: 'excluir', poll_id: poll.id }, 'Enquete excluída.');
                      }
                    }}
                  />
                ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function EnqueteCard({
  poll,
  destaque,
  isAdmin,
  busy,
  onVotar,
  onEncerrar,
  onReabrir,
  onExcluir,
}: {
  poll: LivePollItem;
  destaque: boolean;
  isAdmin: boolean;
  busy: boolean;
  onVotar: (idx: number) => void;
  onEncerrar: () => void;
  onReabrir: () => void;
  onExcluir: () => void;
}) {
  return (
    <section className="rise surface space-y-4 p-5">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
            poll.aberta
              ? 'border-cereja/70 bg-cereja/20 text-marfim'
              : 'border-champagne/60 bg-carvao-3 text-champagne'
          }`}
        >
          {poll.aberta ? 'Ao vivo · Pode trocar o voto' : 'Encerrada · Resultado final'}
        </span>
        <span className="numeral text-sm text-champagne">
          {poll.total_votos} {poll.total_votos === 1 ? 'voto' : 'votos'}
        </span>
      </div>

      <h2 className={`display text-marfim ${destaque ? 'text-2xl' : 'text-xl'}`}>
        {poll.pergunta}
      </h2>

      <div className="space-y-2.5">
        {poll.opcoes.map((op) => {
          const voteiNesta = poll.meu_voto === op.index;
          let cls = 'border-linha-forte bg-carvao-3';
          if (op.vencedora) {
            cls = 'border-champagne bg-salvia/30 ring-1 ring-champagne';
          } else if (voteiNesta) {
            cls = 'border-champagne/80 bg-carvao-3';
          }

          return (
            <button
              key={op.index}
              type="button"
              disabled={!poll.aberta || busy}
              onClick={() => onVotar(op.index)}
              className={`block w-full rounded-2xl border p-3.5 text-left transition ${cls}`}
            >
              <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 font-medium text-marfim">
                  {op.vencedora && <Trophy size={16} className="shrink-0 text-champagne" />}
                  {voteiNesta && !op.vencedora && (
                    <Check size={16} className="shrink-0 text-champagne" />
                  )}
                  <span>{op.texto}</span>
                </span>
                <span className="shrink-0 text-xs text-marfim-2">
                  <strong className="numeral text-sm text-champagne">{op.percentual}%</strong> (
                  {op.votos})
                </span>
              </div>

              <div className="h-2.5 w-full overflow-hidden rounded-full bg-carvao">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    op.vencedora ? 'bg-champagne' : 'bg-cereja'
                  }`}
                  style={{ width: `${Math.max(op.percentual, op.votos > 0 ? 4 : 0)}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {!poll.aberta && poll.total_votos > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-carvao-3 px-3.5 py-2.5 text-xs text-champagne">
          <Trophy size={15} className="shrink-0" />
          <span>
            Vencedor:{' '}
            <strong>
              {poll.opcoes
                .filter((o) => o.vencedora)
                .map((o) => o.texto)
                .join(' / ')}
            </strong>
          </span>
        </div>
      )}

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2 border-t border-linha pt-3">
          {poll.aberta ? (
            <button
              type="button"
              disabled={busy}
              onClick={onEncerrar}
              className="btn btn-primary flex-1 text-xs"
            >
              <Lock size={14} /> Encerrar e mostrar vencedor
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={onReabrir}
              className="btn btn-ghost flex-1 text-xs"
            >
              <RotateCcw size={14} /> Reabrir votação
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={onExcluir}
            className="btn btn-quiet px-2.5 text-marfim-3"
            aria-label="Excluir enquete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )}
    </section>
  );
}
