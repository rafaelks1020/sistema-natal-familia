'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BellRing,
  Check,
  Plus,
  RefreshCw,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import Avatar from '@/app/ui/Avatar';
import PageHeader from '@/app/ui/PageHeader';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { useMe } from '@/app/ui/user';
import type { BingoCasa, BingoData, BingoItemRow } from '@/app/api/festa/bingo/_data';

export default function BingoClient({ initial }: { initial: BingoData }) {
  const me = useMe();
  const toast = useToast();

  const [data, setData] = useState<BingoData>(initial);
  const [busyPos, setBusyPos] = useState<number | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [casaSelecionada, setCasaSelecionada] = useState<BingoCasa | null>(null);

  // Gerenciamento da lista de situacoes pelo organizador
  const [mostrarListaAdmin, setMostrarListaAdmin] = useState(false);
  const [novoTexto, setNovoTexto] = useState('');
  const [editItem, setEditItem] = useState<BingoItemRow | null>(null);

  const recarregar = useCallback(async () => {
    try {
      const res = await api<BingoData>('/api/festa/bingo');
      setData(res);
    } catch {
      /* ignora falha de rede em polling */
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      void recarregar();
    }, 3500);
    return () => window.clearInterval(id);
  }, [recarregar]);

  const marcadasSet = useMemo(() => new Set(data.cartela.marcadas), [data.cartela.marcadas]);

  const posicoesEmBingo = useMemo(() => {
    const s = new Set<number>();
    for (const p of data.cartela.padroes_completos) {
      for (const pos of p.posicoes) s.add(pos);
    }
    return s;
  }, [data.cartela.padroes_completos]);

  async function alternarCasa(casa: BingoCasa) {
    setCasaSelecionada(casa);
    if (casa.livre || busyPos !== null) return;
    setBusyPos(casa.posicao);
    try {
      const res = await api<BingoData>('/api/festa/bingo', {
        method: 'POST',
        json: { acao: 'alternar_casa', posicao: casa.posicao },
      });
      setData(res);
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setBusyPos(null);
    }
  }

  async function gritarBingo() {
    if (busyAction) return;
    setBusyAction(true);
    try {
      const res = await api<BingoData>('/api/festa/bingo', {
        method: 'POST',
        json: { acao: 'gritar_bingo' },
      });
      setData(res);
      toast('BINGO! Toda a família recebeu o aviso!');
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setBusyAction(false);
    }
  }

  async function sortearNovaCartela() {
    if (
      !window.confirm(
        'Sortear uma nova cartela 5x5? As marcações atuais da sua cartela serão reiniciadas.',
      )
    ) {
      return;
    }
    setBusyAction(true);
    try {
      const res = await api<BingoData>('/api/festa/bingo', {
        method: 'POST',
        json: { acao: 'nova_cartela' },
      });
      setData(res);
      setCasaSelecionada(null);
      toast('Nova cartela sorteada!');
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setBusyAction(false);
    }
  }

  async function confirmarClaim(claimId: number, decisao: 'confirmado' | 'rejeitado') {
    if (busyAction) return;
    setBusyAction(true);
    try {
      const res = await api<BingoData>('/api/festa/bingo', {
        method: 'POST',
        json: { acao: 'confirmar_bingo', claim_id: claimId, decisao },
      });
      setData(res);
      toast(decisao === 'confirmado' ? 'Bingo confirmado!' : 'Pedido descartado.');
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setBusyAction(false);
    }
  }

  async function adicionarSituacao(e: React.FormEvent) {
    e.preventDefault();
    if (!novoTexto.trim() || busyAction) return;
    setBusyAction(true);
    try {
      const res = await api<BingoData>('/api/festa/bingo', {
        method: 'POST',
        json: { acao: 'adicionar_item', texto: novoTexto.trim() },
      });
      setData(res);
      setNovoTexto('');
      toast('Situação adicionada à lista!');
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setBusyAction(false);
    }
  }

  async function salvarEdicaoItem(e: React.FormEvent) {
    e.preventDefault();
    if (!editItem || busyAction) return;
    setBusyAction(true);
    try {
      const res = await api<BingoData>('/api/festa/bingo', {
        method: 'POST',
        json: {
          acao: 'editar_item',
          id: editItem.id,
          texto: editItem.texto,
          ativo: editItem.ativo,
        },
      });
      setData(res);
      setEditItem(null);
      toast('Situação atualizada!');
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setBusyAction(false);
    }
  }

  async function excluirItem(id: number) {
    if (!window.confirm('Remover esta situação da lista do Bingo?')) return;
    setBusyAction(true);
    try {
      const res = await api<BingoData>('/api/festa/bingo', {
        method: 'POST',
        json: { acao: 'excluir_item', id },
      });
      setData(res);
      toast('Situação removida.');
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setBusyAction(false);
    }
  }

  const temLinhaCompleta = data.cartela.padroes_completos.length > 0;

  return (
    <div className="pb-nav">
      <PageHeader kicker="Jogos da Ceia" title="Bingo da Ceia" back="/festa" />

      <nav aria-label="Jogos da ceia" className="mb-5 flex gap-2 overflow-x-auto px-5 no-scrollbar">
        <Link href="/festa/quiz" className="btn btn-ghost min-h-11 shrink-0 px-4 text-xs">
          Quiz da Família
        </Link>
        <Link href="/festa/bingo" className="btn btn-primary min-h-11 shrink-0 px-4 text-xs">
          Bingo da Ceia
        </Link>
        <Link href="/festa/enquete" className="btn btn-ghost min-h-11 shrink-0 px-4 text-xs">
          Enquete ao Vivo
        </Link>
      </nav>

      <div className="space-y-6 px-5">
        {/* BANNER DE GRITAR BINGO QUANDO COMPLETOU LINHA/COLUNA/DIAGONAL */}
        {temLinhaCompleta && (
          <section className="rise surface border-champagne bg-carvao-2 p-5 text-center">
            <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-cereja/25 text-champagne">
              <Sparkles size={22} />
            </div>
            <p className="kicker">Linha completa na sua cartela!</p>
            <h2 className="display mt-1 text-2xl text-marfim">
              {data.cartela.padroes_completos.map((p) => p.nome).join(' · ')}
            </h2>
            {data.cartela.ja_gritou ? (
              <p className="mt-2 text-xs text-champagne">
                Você já gritou Bingo! Confira abaixo na lista de confirmação.
              </p>
            ) : (
              <>
                <p className="mt-1 text-xs text-marfim-2">
                  Aperte o botão abaixo para avisar toda a família no celular!
                </p>
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => void gritarBingo()}
                  className="btn btn-primary mt-4 w-full text-base"
                >
                  <BellRing size={18} /> Gritar BINGO!
                </button>
              </>
            )}
          </section>
        )}

        {/* CARTELA 5X5 */}
        <section className="rise surface space-y-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="kicker">Sua cartela 5x5 ({data.ano})</p>
              <p className="text-xs text-marfim-2">
                Toque quando a situação acontecer na ceia ({data.cartela.marcadas.length}/25)
              </p>
            </div>
            <button
              type="button"
              disabled={busyAction}
              onClick={() => void sortearNovaCartela()}
              className="btn btn-quiet px-2.5 text-xs"
              title="Sortear outra cartela"
            >
              <RefreshCw size={14} /> Nova
            </button>
          </div>

          {/* Cabecalho B I N G O */}
          <div className="grid grid-cols-5 gap-1.5 text-center">
            {['B', 'I', 'N', 'G', 'O'].map((letra) => (
              <div key={letra} className="display py-1 text-sm text-champagne">
                {letra}
              </div>
            ))}
          </div>

          {/* Grade 5x5 */}
          <div className="grid grid-cols-5 gap-1.5">
            {data.cartela.casas.map((casa) => {
              const marcada = casa.livre || marcadasSet.has(casa.posicao);
              const emBingo = posicoesEmBingo.has(casa.posicao);
              const carregando = busyPos === casa.posicao;

              let cls = 'border-linha bg-carvao-3 text-marfim-2';
              if (emBingo) {
                cls = 'border-champagne bg-cereja/35 text-marfim ring-1 ring-champagne';
              } else if (marcada) {
                cls = 'border-champagne/80 bg-salvia/30 text-marfim';
              }

              return (
                <button
                  key={casa.posicao}
                  type="button"
                  disabled={carregando}
                  onClick={() => void alternarCasa(casa)}
                  aria-pressed={marcada}
                  aria-label={`Casa ${casa.posicao + 1}: ${casa.texto}`}
                  className={`relative flex min-h-[70px] flex-col items-center justify-center rounded-xl border p-1.5 text-center transition active:scale-95 ${cls}`}
                >
                  {casa.livre ? (
                    <>
                      <Star size={16} className="mb-1 text-champagne" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-champagne">
                        Livre
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="line-clamp-3 text-[10px] leading-tight">{casa.texto}</span>
                      {marcada && (
                        <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-champagne/25 text-champagne">
                          <Check size={10} strokeWidth={2.4} />
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {/* Leitor da casa tocada para facilitar a leitura para avos / fontes grandes */}
          {casaSelecionada && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-linha bg-carvao-3 px-3.5 py-2.5 text-xs">
              <div className="min-w-0">
                <p className="kicker">
                  Casa #{casaSelecionada.posicao + 1}{' '}
                  {marcadasSet.has(casaSelecionada.posicao) ? '· Marcada' : '· Não marcada'}
                </p>
                <p className="mt-0.5 text-sm text-marfim">{casaSelecionada.texto}</p>
              </div>
              <button
                type="button"
                onClick={() => setCasaSelecionada(null)}
                className="btn btn-quiet px-2"
                aria-label="Fechar detalhe da casa"
              >
                <X size={15} />
              </button>
            </div>
          )}
        </section>

        {/* PEDIDOS E VENCEDORES DE BINGO */}
        {data.claims.length > 0 && (
          <section className="rise surface space-y-3 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="kicker">Gritos na roda</p>
                <h2 className="display text-xl">Quem gritou Bingo!</h2>
              </div>
              <Trophy size={20} className="text-champagne" />
            </div>

            <ul className="space-y-3">
              {data.claims.map((c) => (
                <li
                  key={c.id}
                  className={`rounded-2xl border p-4 ${
                    c.status === 'confirmado'
                      ? 'border-champagne bg-carvao-3'
                      : c.status === 'pendente'
                        ? 'border-cereja/70 bg-carvao-3'
                        : 'border-linha bg-carvao-3/50 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={c.user_name} src={c.avatar_url} size={36} ring={c.status === 'confirmado'} />
                      <div>
                        <p className="text-sm font-semibold text-marfim">{c.user_name}</p>
                        <p className="text-xs text-champagne">{c.padrao}</p>
                      </div>
                    </div>
                    <span className="rounded-full border border-linha-forte px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-marfim-2">
                      {c.status === 'confirmado'
                        ? 'Confirmado!'
                        : c.status === 'pendente'
                          ? 'Aguardando'
                          : 'Descartado'}
                    </span>
                  </div>

                  <ul className="mt-3 space-y-1 border-t border-linha pt-2.5 text-xs text-marfim-2">
                    {c.frases.map((f, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <Check size={12} className="shrink-0 text-champagne" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {me.is_admin && c.status === 'pendente' && (
                    <div className="mt-3 flex gap-2 border-t border-linha pt-3">
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={() => void confirmarClaim(c.id, 'confirmado')}
                        className="btn btn-primary flex-1 text-xs"
                      >
                        <Check size={15} /> Confirmar Bingo
                      </button>
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={() => void confirmarClaim(c.id, 'rejeitado')}
                        className="btn btn-ghost px-4 text-xs"
                      >
                        Descartar
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* PROGRESSO DA FAMILIA */}
        <section className="rise surface space-y-3 p-5">
          <p className="kicker">Acompanhamento</p>
          <h2 className="display text-xl">Cartelas da família</h2>
          {data.participantes.length === 0 ? (
            <p className="text-sm text-marfim-3">Ninguém abriu cartela ainda.</p>
          ) : (
            <ul className="divide-y divide-linha">
              {data.participantes.map((p) => (
                <li key={p.user_id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={p.name} src={p.avatar_url} size={32} ring={p.tem_bingo} />
                    <div>
                      <p className="text-sm font-medium text-marfim">{p.name}</p>
                      {p.tem_bingo && <p className="text-xs text-champagne">Gritou Bingo!</p>}
                    </div>
                  </div>
                  <span className="numeral text-sm text-marfim-2">{p.marcadas}/25</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* AREA DO ORGANIZADOR: EDITAR LISTA DE 40+ SITUACOES */}
        {me.is_admin && (
          <section className="rise space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="kicker">Só quem organiza</p>
                <h2 className="display text-2xl">
                  Lista de situações ({data.itens.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setMostrarListaAdmin((v) => !v)}
                className="btn btn-ghost px-4 text-xs"
              >
                {mostrarListaAdmin ? 'Ocultar lista' : 'Editar lista'}
              </button>
            </div>

            {mostrarListaAdmin && (
              <div className="surface space-y-4 p-5">
                <form onSubmit={(e) => void adicionarSituacao(e)} className="space-y-2.5">
                  <label className="block text-xs text-marfim-2">
                    Adicionar nova situação da ceia
                    <input
                      className="field mt-1.5"
                      placeholder="Ex.: Tio pediu para colocar Roberto Carlos"
                      value={novoTexto}
                      onChange={(e) => setNovoTexto(e.target.value)}
                      maxLength={140}
                      required
                    />
                  </label>
                  <button type="submit" disabled={busyAction} className="btn btn-primary w-full text-xs">
                    <Plus size={16} /> Adicionar situação
                  </button>
                </form>

                {editItem && (
                  <form
                    onSubmit={(e) => void salvarEdicaoItem(e)}
                    className="space-y-2.5 rounded-2xl border border-champagne/60 bg-carvao-3 p-3.5"
                  >
                    <p className="kicker">Editando situação</p>
                    <input
                      className="field"
                      value={editItem.texto}
                      onChange={(e) =>
                        setEditItem((prev) => (prev ? { ...prev, texto: e.target.value } : null))
                      }
                      maxLength={140}
                      required
                    />
                    <div className="flex gap-2">
                      <button type="submit" disabled={busyAction} className="btn btn-primary flex-1 text-xs">
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditItem(null)}
                        className="btn btn-ghost px-4 text-xs"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}

                <ul className="max-h-96 divide-y divide-linha overflow-y-auto pr-1">
                  {data.itens.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                      <span className={item.ativo ? 'text-marfim' : 'text-marfim-3 line-through'}>
                        {item.texto}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditItem(item)}
                          className="btn btn-quiet min-h-9 px-2 text-xs"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void excluirItem(item.id)}
                          className="btn btn-quiet min-h-9 px-2 text-marfim-3"
                          aria-label="Excluir situação"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
