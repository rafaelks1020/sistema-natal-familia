'use client';

import { useEffect, useState } from 'react';
import { Copy, Search } from 'lucide-react';
import PageHeader from '@/app/ui/PageHeader';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import type { Editavel, ItemAdmin, PaginaRecurso, RecursoMeta, RespostaAcao } from '@/app/lib/admin/tipos';
import { Empty, Loading, Sheet } from '../../familia/_components/shared';
import { formatar, Miniatura, rotuloOpcao, Valor } from '../_lib';

type Estado = { chave: string; meta: RecursoMeta; itens: ItemAdmin[]; proximo: string | null };

export default function RecursoClient({ recurso }: { recurso: string }) {
  const toast = useToast();
  const [busca, setBusca] = useState('');
  const [q, setQ] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState<{ chave: string; texto: string } | null>(null);
  const [aberto, setAberto] = useState<ItemAdmin | null>(null);
  const [busy, setBusy] = useState(false);

  const chave = `${recurso}|${q}|${tentativa}`;

  useEffect(() => {
    let ativo = true;
    api<PaginaRecurso>(`/api/admin/r/${encodeURIComponent(recurso)}?q=${encodeURIComponent(q)}`)
      .then((p) => { if (ativo) setEstado({ chave, meta: p.recurso, itens: p.itens, proximo: p.proximo }); })
      .catch((e: Error) => { if (ativo) setErro({ chave, texto: e.message }); });
    return () => { ativo = false; };
  }, [recurso, q, tentativa, chave]);

  const carregando = !estado || estado.chave !== chave;
  const falhou = erro?.chave === chave ? erro.texto : null;
  const meta = estado?.meta ?? null;

  async function maisItens() {
    if (!estado?.proximo) return;
    setBusy(true);
    try {
      const p = await api<PaginaRecurso>(`/api/admin/r/${encodeURIComponent(recurso)}?q=${encodeURIComponent(q)}&cursor=${encodeURIComponent(estado.proximo)}`);
      setEstado((e) => (e && e.chave === chave ? { ...e, itens: [...e.itens, ...p.itens], proximo: p.proximo } : e));
    } catch (e) { toast((e as Error).message, 'erro'); }
    finally { setBusy(false); }
  }

  function atualizarItem(item: ItemAdmin) {
    setEstado((e) => (e ? { ...e, itens: e.itens.map((i) => (i.id === item.id ? item : i)) } : e));
    setAberto(item);
  }
  function removerItem(id: ItemAdmin['id']) {
    setEstado((e) => (e ? { ...e, itens: e.itens.filter((i) => i.id !== id) } : e));
    setAberto(null);
  }
  function recarregar() { setAberto(null); setTentativa((v) => v + 1); }

  return (
    <main className="mx-auto max-w-xl pb-10 md:max-w-none">
      <PageHeader kicker="Painel admin" title={meta?.nome ?? 'Carregando'} back="/admin" />
      <div className="px-5 md:relative md:left-1/2 md:w-[min(76rem,calc(100vw-3rem))] md:-translate-x-1/2 md:px-0">
        <form className="mb-5 flex gap-2" role="search" onSubmit={(e) => { e.preventDefault(); setQ(busca.trim()); }}>
          <input className="field" type="search" aria-label="Buscar" placeholder="Buscar" maxLength={80} value={busca} onChange={(e) => setBusca(e.target.value)} />
          <button className="btn btn-ghost shrink-0" aria-label="Buscar"><Search size={18} strokeWidth={1.5} /></button>
        </form>

        {falhou ? (
          <div className="space-y-3"><p className="text-sm text-marfim-2">{falhou}</p><button className="btn btn-ghost" onClick={() => { setErro(null); setTentativa((v) => v + 1); }}>Tentar novamente</button></div>
        ) : carregando ? <Loading /> : !estado.itens.length ? (
          <Empty title={q ? 'Nada encontrado' : 'Nada por aqui'} text={q ? 'Tente buscar de outro jeito.' : 'Ainda não há registros nesta área.'} />
        ) : (
          <>
            <Cartoes meta={estado.meta} itens={estado.itens} onAbrir={setAberto} />
            <Tabela meta={estado.meta} itens={estado.itens} onAbrir={setAberto} />
            {estado.proximo && <button className="btn btn-ghost mt-6 w-full" disabled={busy} onClick={() => void maisItens()}>{busy ? 'Buscando...' : 'Carregar mais'}</button>}
          </>
        )}
      </div>
      {meta && aberto && (
        <Detalhe key={String(aberto.id)} recurso={recurso} meta={meta} item={aberto} onFechar={() => setAberto(null)}
          onAtualizado={atualizarItem} onRemovido={removerItem} onRecarregar={recarregar} />
      )}
    </main>
  );
}

function Cartoes({ meta, itens, onAbrir }: { meta: RecursoMeta; itens: ItemAdmin[]; onAbrir: (i: ItemAdmin) => void }) {
  const foto = meta.colunas.find((c) => c.tipo === 'imagem');
  const texto = meta.colunas.filter((c) => c.tipo !== 'imagem');
  const [titulo, ...resto] = texto;
  const linhas = resto.filter((c) => c.tipo !== 'longo').slice(0, 3);
  return (
    <ul className="divide-y divide-linha border-y border-linha md:hidden">
      {itens.map((item) => (
        <li key={String(item.id)}>
          <button type="button" onClick={() => onAbrir(item)} className="flex min-h-16 w-full items-center gap-3 py-4 text-left">
            {foto && <Miniatura url={item[foto.campo]} />}
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 break-words text-sm">{formatar(item[titulo.campo], titulo.tipo)}</span>
              {linhas.map((c) => (
                <span key={c.campo} className="mt-1 block truncate text-xs text-marfim-3">{c.rotulo}: {formatar(item[c.campo], c.tipo)}</span>
              ))}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Tabela({ meta, itens, onAbrir }: { meta: RecursoMeta; itens: ItemAdmin[]; onAbrir: (i: ItemAdmin) => void }) {
  return (
    <div className="hidden overflow-x-auto rounded-2xl border border-linha md:block">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-linha-forte text-xs text-marfim-3">
            {meta.colunas.map((c) => <th key={c.campo} scope="col" className="whitespace-nowrap px-4 py-3 font-normal">{c.rotulo}</th>)}
            <th scope="col" className="px-4 py-3"><span className="sr-only">Abrir</span></th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => (
            <tr key={String(item.id)} className="cursor-pointer border-b border-linha last:border-0 hover:bg-carvao-2" onClick={() => onAbrir(item)}>
              {meta.colunas.map((c) => (
                <td key={c.campo} className="max-w-[18rem] px-4 py-3 align-top">
                  {c.tipo === 'imagem' ? <Miniatura url={item[c.campo]} /> : <span className="line-clamp-2 break-words">{formatar(item[c.campo], c.tipo)}</span>}
                </td>
              ))}
              <td className="px-4 py-3 text-right"><button type="button" className="btn btn-quiet text-champagne" onClick={(e) => { e.stopPropagation(); onAbrir(item); }}>Abrir</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Forma = Record<string, string | boolean>;

function formaInicial(meta: RecursoMeta, item: ItemAdmin): Forma {
  const f: Forma = {};
  for (const e of meta.editaveis) {
    const v = item[e.campo];
    if (e.tipo === 'bool') f[e.campo] = Boolean(v);
    else if (e.tipo === 'dinheiro') f[e.campo] = v == null ? '' : (Number(v) / 100).toFixed(2).replace('.', ',');
    else f[e.campo] = v == null ? '' : String(v);
  }
  return f;
}

function valorParaEnvio(e: Editavel, v: string | boolean): unknown {
  if (e.tipo === 'bool') return v;
  const s = String(v).trim();
  if (e.tipo === 'numero') return s === '' ? null : Number(s);
  if (e.tipo === 'dinheiro') return s === '' ? null : Math.round(Number(s.replace(',', '.')) * 100);
  return s;
}

function Detalhe({ recurso, meta, item, onFechar, onAtualizado, onRemovido, onRecarregar }: {
  recurso: string; meta: RecursoMeta; item: ItemAdmin; onFechar: () => void;
  onAtualizado: (i: ItemAdmin) => void; onRemovido: (id: ItemAdmin['id']) => void; onRecarregar: () => void;
}) {
  const toast = useToast();
  const [editando, setEditando] = useState(false);
  const [forma, setForma] = useState<Forma>(() => formaInicial(meta, item));
  const [pendente, setPendente] = useState<string | null>(null); // 'apagar' ou id de ação perigosa esperando confirmação
  const [senha, setSenha] = useState('');
  const [busy, setBusy] = useState(false);
  const base = `/api/admin/r/${encodeURIComponent(recurso)}/${encodeURIComponent(String(item.id))}`;
  const titulo = formatar(item[meta.colunas[0].campo], meta.colunas[0].tipo);

  async function salvar(ev: React.FormEvent) {
    ev.preventDefault();
    const original = formaInicial(meta, item);
    const corpo: Record<string, unknown> = {};
    for (const e of meta.editaveis) if (forma[e.campo] !== original[e.campo]) corpo[e.campo] = valorParaEnvio(e, forma[e.campo]);
    if (!Object.keys(corpo).length) { setEditando(false); return; }
    setBusy(true);
    try {
      const r = await api<{ ok: boolean; item: ItemAdmin }>(base, { method: 'PATCH', json: corpo });
      toast('Salvo.');
      setEditando(false);
      onAtualizado(r.item);
    } catch (e) { toast((e as Error).message, 'erro'); }
    finally { setBusy(false); }
  }

  async function apagar() {
    setBusy(true);
    try {
      await api(base, { method: 'DELETE' });
      toast('Apagado.');
      onRemovido(item.id);
    } catch (e) { toast((e as Error).message, 'erro'); setPendente(null); }
    finally { setBusy(false); }
  }

  async function executar(id: string) {
    setBusy(true);
    try {
      const r = await api<RespostaAcao>(`${base}/acao`, { method: 'POST', json: { acao: id } });
      toast(r.mensagem ?? 'Pronto.');
      if (r.senha_temporaria) { setSenha(r.senha_temporaria); setPendente(null); }
      else onRecarregar();
    } catch (e) { toast((e as Error).message, 'erro'); setPendente(null); }
    finally { setBusy(false); }
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(senha); toast('Senha copiada.'); }
    catch { toast('Não foi possível copiar. Selecione a senha e copie à mão.', 'erro'); }
  }

  const fechar = () => { if (senha) onRecarregar(); else onFechar(); };

  if (senha) {
    return (
      <Sheet title="Senha temporária" onClose={fechar}>
        <p className="text-sm leading-relaxed text-marfim-2">Passe para {titulo} e peça para trocar no perfil. Ela só aparece desta vez.</p>
        <input aria-label="Senha temporária" readOnly value={senha} onFocus={(e) => e.target.select()} className="field my-6 text-center font-mono text-2xl tracking-[0.2em] text-champagne" />
        <button className="btn btn-primary w-full" onClick={() => void copiar()}><Copy size={18} strokeWidth={1.5} />Copiar senha</button>
        <button className="btn btn-ghost mt-3 w-full" onClick={fechar}>Fechar</button>
      </Sheet>
    );
  }

  const acaoPendente = meta.acoes.find((a) => a.id === pendente);

  return (
    <Sheet title={titulo.length > 28 ? `${titulo.slice(0, 28)}...` : titulo} busy={busy} onClose={onFechar}>
      {editando ? (
        <form className="space-y-4" onSubmit={(e) => void salvar(e)}>
          {meta.editaveis.map((e) => (
            <label key={e.campo} className="block text-sm text-marfim-2">
              {e.tipo === 'bool' ? (
                <span className="flex min-h-11 items-center gap-3">
                  <input type="checkbox" className="h-5 w-5 accent-[#c5292d]" checked={Boolean(forma[e.campo])} onChange={(ev) => setForma({ ...forma, [e.campo]: ev.target.checked })} />{e.rotulo}
                </span>
              ) : (
                <>
                  {e.rotulo}
                  {e.tipo === 'longo' ? <textarea className="field mt-2" rows={5} value={String(forma[e.campo])} onChange={(ev) => setForma({ ...forma, [e.campo]: ev.target.value })} />
                    : e.tipo === 'opcao' ? (
                      <select className="field mt-2" value={String(forma[e.campo])} onChange={(ev) => setForma({ ...forma, [e.campo]: ev.target.value })}>
                        {e.opcoes?.map((o) => <option key={o} value={o}>{rotuloOpcao(o)}</option>)}
                      </select>
                    ) : (
                      <input className="field mt-2" type={e.tipo === 'numero' ? 'number' : 'text'} inputMode={e.tipo === 'texto' ? 'text' : 'decimal'}
                        placeholder={e.tipo === 'dinheiro' ? '0,00' : undefined} value={String(forma[e.campo])} onChange={(ev) => setForma({ ...forma, [e.campo]: ev.target.value })} />
                    )}
                </>
              )}
            </label>
          ))}
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</button>
          <button type="button" className="btn btn-ghost w-full" disabled={busy} onClick={() => { setEditando(false); setForma(formaInicial(meta, item)); }}>Cancelar</button>
        </form>
      ) : (
        <>
          <dl className="space-y-4">
            {meta.colunas.map((c) => (
              <div key={c.campo}>
                <dt className="kicker mb-1">{c.rotulo}</dt>
                <dd className="text-sm"><Valor valor={item[c.campo]} tipo={c.tipo} /></dd>
              </div>
            ))}
          </dl>

          {pendente ? (
            <div className="mt-8 rounded-2xl border border-cereja/60 p-4">
              <p className="text-sm text-marfim-2">{pendente === 'apagar' ? 'Apagar de vez? Isso não tem volta.' : `${acaoPendente?.rotulo}? Confira antes de continuar.`}</p>
              <button className="btn btn-primary mt-4 w-full" disabled={busy} onClick={() => void (pendente === 'apagar' ? apagar() : executar(pendente))}>{busy ? 'Um instante...' : 'Sim, confirmar'}</button>
              <button className="btn btn-ghost mt-3 w-full" disabled={busy} onClick={() => setPendente(null)}>Cancelar</button>
            </div>
          ) : (
            <div className="mt-8 space-y-3">
              {meta.editaveis.length > 0 && <button className="btn btn-ghost w-full" disabled={busy} onClick={() => { setForma(formaInicial(meta, item)); setEditando(true); }}>Editar</button>}
              {meta.acoes.map((a) => (
                <button key={a.id} className={`btn w-full ${a.perigosa ? 'btn-ghost' : 'btn-primary'}`} disabled={busy} onClick={() => (a.perigosa ? setPendente(a.id) : void executar(a.id))}>{a.rotulo}</button>
              ))}
              {meta.pode_apagar && <button className="btn btn-quiet w-full text-cereja" disabled={busy} onClick={() => setPendente('apagar')}>Apagar</button>}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
