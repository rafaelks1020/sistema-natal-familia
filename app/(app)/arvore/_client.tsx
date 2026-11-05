'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Minus, Plus } from 'lucide-react';
import { api, uploadImage } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import Avatar from '@/app/ui/Avatar';
import PageHeader from '@/app/ui/PageHeader';
import type { ArvoreDados, PessoaArvore, TipoVinculo, VinculoArvore } from '@/app/api/arvore/_data';
import { CARTAO_A, CARTAO_L, desenharArvore, rotuloAnos } from './_desenho';

export default function ArvoreClient({ initial }: { initial: ArvoreDados }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [escala, setEscala] = useState(1);
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const [editando, setEditando] = useState(false);
  const lock = useRef(false);
  const toast = useToast();
  const desenho = useMemo(
    () => desenharArvore(data.pessoas.map((p) => p.id), data.vinculos),
    [data.pessoas, data.vinculos],
  );
  const pessoa = data.pessoas.find((item) => item.id === escolhida) ?? null;

  useEffect(() => {
    const id = Number(window.location.hash.replace('#pessoa-', ''));
    if (Number.isInteger(id) && data.pessoas.some((item) => item.id === id)) setEscolhida(id);
  }, [data.pessoas]);

  async function protegido(trabalho: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await trabalho();
      try {
        setData(await api<ArvoreDados>('/api/arvore'));
        toast('Pronto, atualizado.');
      } catch {
        toast('Salvo. Recarregue a página para atualizar a árvore.', 'erro');
      }
    } catch (e) {
      toast((e as Error).message, 'erro');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return <>
    <PageHeader title="Árvore da família" kicker="Natal em Família" back="/" />
    <div className="space-y-7 px-5 pb-12">
      <p className="text-sm leading-relaxed text-marfim-2">Quem veio antes, os casais e os filhos. Toque numa pessoa para ver o cartão.</p>
      <details className="surface p-5">
        <summary className="min-h-11 cursor-pointer py-3 text-champagne">Adicionar pessoa</summary>
        <FormPessoa familia={data.familia} busy={busy} onSubmit={(form) => protegido(async () => { await api('/api/arvore', { method: 'POST', json: await jsonPessoa(form) }); form.reset(); })} />
      </details>
      {data.pessoas.length > 1 ? <details className="surface p-5">
        <summary className="min-h-11 cursor-pointer py-3 text-champagne">Ligar parentes</summary>
        <FormVinculo pessoas={data.pessoas} busy={busy} onSubmit={(json) => protegido(() => api('/api/arvore/vinculos', { method: 'POST', json }))} />
      </details> : null}
      {!data.pessoas.length ? <p className="py-6 text-sm text-marfim-3">A árvore ainda não tem ninguém. Comece por quem veio antes.</p> : <>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost min-h-11 flex-1" onClick={() => setEscala((valor) => Math.max(1, Math.round((valor - 0.2) * 100) / 100))}> <Minus size={16} strokeWidth={1.5} /> Diminuir</button>
          <button type="button" className="btn btn-ghost min-h-11 flex-1" onClick={() => setEscala((valor) => Math.min(1.6, Math.round((valor + 0.2) * 100) / 100))}> <Plus size={16} strokeWidth={1.5} /> Aumentar</button>
        </div>
        <div className="overflow-x-auto pb-2">
          <div style={{ width: desenho.largura * escala, height: desenho.altura * escala }}>
            <div className="relative" style={{ width: desenho.largura, height: desenho.altura, transform: `scale(${escala})`, transformOrigin: 'top left' }}>
              <svg width={desenho.largura} height={desenho.altura} className="absolute inset-0" aria-hidden>
                {desenho.linhas.map((linha, indice) => <line key={indice} x1={linha.x1} y1={linha.y1} x2={linha.x2} y2={linha.y2} stroke="#BFA577" strokeWidth={1.25} />)}
              </svg>
              {desenho.cartoes.map((cartao) => {
                const item = data.pessoas.find((p) => p.id === cartao.id);
                if (!item) return null;
                const anos = rotuloAnos(item.nascimento_ano, item.falecimento_ano);
                return <button key={item.id} id={`pessoa-${item.id}`} type="button" onClick={() => { setEscolhida(item.id); setEditando(false); }} className={`absolute overflow-hidden rounded-[14px] border px-2 py-2 text-left ${escolhida === item.id ? 'border-champagne bg-carvao-3' : 'border-linha bg-carvao-2'}`} style={{ left: cartao.esquerda, top: cartao.topo, width: CARTAO_L, height: CARTAO_A }}>
                  <span className="flex items-center gap-2"><Avatar name={item.nome} src={item.foto_url} size={32} /><span className="min-w-0"><span className="block truncate text-sm">{item.nome}</span>{item.apelido ? <span className="block truncate text-xs text-marfim-3">{item.apelido}</span> : null}</span></span>
                  {anos ? <span className="mt-1 block truncate text-xs text-marfim-3">{anos}</span> : null}
                </button>;
              })}
            </div>
          </div>
        </div>
      </>}
      {pessoa ? <Cartao pessoa={pessoa} vinculos={data.vinculos.filter((v) => v.pessoa_id === pessoa.id || v.parente_id === pessoa.id)} pessoas={data.pessoas} familia={data.familia} busy={busy} editando={editando} setEditando={setEditando} protegido={protegido} /> : null}
    </div>
  </>;
}

function Cartao({ pessoa, vinculos, pessoas, familia, busy, editando, setEditando, protegido }: {
  pessoa: PessoaArvore;
  vinculos: VinculoArvore[];
  pessoas: PessoaArvore[];
  familia: ArvoreDados['familia'];
  busy: boolean;
  editando: boolean;
  setEditando: (valor: boolean) => void;
  protegido: (trabalho: () => Promise<void>) => Promise<void>;
}) {
  const nomeDe = (id: number) => pessoas.find((item) => item.id === id)?.nome ?? 'alguém';
  return <section className="surface space-y-4 p-5" aria-live="polite">
    <div className="flex items-center gap-4"><Avatar name={pessoa.nome} src={pessoa.foto_url} size={72} ring /><div className="min-w-0"><p className="kicker">Cartão</p><h2 className="display break-words text-3xl">{pessoa.nome}</h2>{pessoa.apelido ? <p className="text-sm text-marfim-2">{pessoa.apelido}</p> : null}</div></div>
    {rotuloAnos(pessoa.nascimento_ano, pessoa.falecimento_ano) ? <p className="text-sm text-champagne">{rotuloAnos(pessoa.nascimento_ano, pessoa.falecimento_ano)}</p> : null}
    {pessoa.user_id ? <Link href={`/familia/${pessoa.user_id}`} className="btn btn-ghost min-h-11 w-full">Ver perfil</Link> : <p className="text-sm text-marfim-3">Sem conta no aplicativo.</p>}
    {vinculos.length ? <ul className="space-y-2">{vinculos.map((v) => {
      const outro = v.pessoa_id === pessoa.id ? v.parente_id : v.pessoa_id;
      const texto = v.tipo === 'conjuge' ? `Casal com ${nomeDe(outro)}` : v.pessoa_id === pessoa.id ? `Filho ou filha de ${nomeDe(outro)}` : `Pai ou mãe de ${nomeDe(outro)}`;
      return <li key={`${v.tipo}-${v.pessoa_id}-${v.parente_id}`} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 break-words">{texto}</span>{v.pode_apagar ? <button type="button" className="btn btn-quiet min-h-11 shrink-0" disabled={busy} onClick={() => { if (window.confirm('Desfazer esta ligação?')) void protegido(() => api('/api/arvore/vinculos', { method: 'DELETE', json: { pessoa_id: v.pessoa_id, parente_id: v.parente_id, tipo: v.tipo } })); }}>Desfazer</button> : null}</li>;
    })}</ul> : null}
    {pessoa.pode_editar && !editando ? <button type="button" className="btn btn-ghost min-h-11 w-full" disabled={busy} onClick={() => setEditando(true)}>Editar</button> : null}
    {pessoa.pode_editar && editando ? <FormPessoa familia={familia} busy={busy} pessoa={pessoa} onSubmit={(form) => protegido(async () => { await api(`/api/arvore/${pessoa.id}`, { method: 'PATCH', json: await jsonPessoa(form) }); setEditando(false); })} cancelar={() => setEditando(false)} /> : null}
    {pessoa.pode_editar ? <button type="button" className="btn btn-quiet min-h-11 w-full" disabled={busy} onClick={() => { if (window.confirm(`Tirar ${pessoa.nome} da árvore? As ligações também saem.`)) void protegido(() => api(`/api/arvore/${pessoa.id}`, { method: 'DELETE' })); }}>Tirar da árvore</button> : null}
  </section>;
}

async function jsonPessoa(form: HTMLFormElement): Promise<Record<string, unknown>> {
  const f = new FormData(form);
  const arquivo = form.querySelector<HTMLInputElement>('input[type="file"]')?.files?.[0];
  const json: Record<string, unknown> = {
    nome: f.get('nome'), apelido: f.get('apelido'), nascimento_ano: f.get('nascimento') || null,
    falecimento_ano: f.get('falecimento') || null, user_id: f.get('conta') ? Number(f.get('conta')) : null,
  };
  if (arquivo) json.foto_url = await uploadImage(arquivo);
  else if (f.get('tirar') === 'sim') json.foto_url = null;
  return json;
}

function FormPessoa({ familia, busy, pessoa, onSubmit, cancelar }: {
  familia: ArvoreDados['familia'];
  busy: boolean;
  pessoa?: PessoaArvore;
  onSubmit: (form: HTMLFormElement) => Promise<void>;
  cancelar?: () => void;
}) {
  return <form className="mt-3 space-y-4" onSubmit={(event) => { event.preventDefault(); void onSubmit(event.currentTarget); }}>
    <label className="block text-sm text-marfim-2">Nome<input className="field mt-2" name="nome" required maxLength={120} defaultValue={pessoa?.nome ?? ''} /></label>
    <label className="block text-sm text-marfim-2">Apelido (opcional)<input className="field mt-2" name="apelido" maxLength={60} defaultValue={pessoa?.apelido ?? ''} /></label>
    <div className="grid grid-cols-2 gap-3">
      <label className="block text-sm text-marfim-2">Nasceu em<input className="field mt-2" name="nascimento" inputMode="numeric" maxLength={4} placeholder="1940" defaultValue={pessoa?.nascimento_ano ?? ''} /></label>
      <label className="block text-sm text-marfim-2">Partiu em<input className="field mt-2" name="falecimento" inputMode="numeric" maxLength={4} placeholder="2019" defaultValue={pessoa?.falecimento_ano ?? ''} /></label>
    </div>
    <label className="block text-sm text-marfim-2">Conta no aplicativo
      <select className="field mt-2" name="conta" defaultValue={pessoa?.user_id ?? ''}>
        <option value="">Sem conta</option>
        {familia.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
    <label className="block text-sm text-marfim-2">Foto (opcional)<input className="field mt-2" type="file" accept="image/*" /></label>
    {pessoa?.foto_url ? <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="tirar" value="sim" /> Tirar a foto</label> : null}
    <button className="btn btn-primary min-h-11 w-full" disabled={busy} type="submit">{pessoa ? 'Salvar' : 'Adicionar'}</button>
    {cancelar ? <button className="btn btn-quiet min-h-11 w-full" type="button" onClick={cancelar}>Cancelar</button> : null}
  </form>;
}

function FormVinculo({ pessoas, busy, onSubmit }: { pessoas: PessoaArvore[]; busy: boolean; onSubmit: (json: { pessoa_id: number; parente_id: number; tipo: TipoVinculo }) => Promise<void> }) {
  const [tipo, setTipo] = useState<TipoVinculo>('pai_mae');
  return <form className="mt-3 space-y-4" onSubmit={(event) => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    void onSubmit({ pessoa_id: Number(f.get('pessoa')), parente_id: Number(f.get('parente')), tipo });
  }}>
    <label className="block text-sm text-marfim-2">Tipo de ligação
      <select className="field mt-2" value={tipo} onChange={(event) => setTipo(event.target.value as TipoVinculo)}>
        <option value="pai_mae">Pai ou mãe</option>
        <option value="conjuge">Casal</option>
      </select>
    </label>
    <label className="block text-sm text-marfim-2">{tipo === 'pai_mae' ? 'Filho ou filha' : 'Uma pessoa'}
      <select className="field mt-2" name="pessoa" required defaultValue=""><option value="">Escolha</option>{pessoas.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>
    </label>
    <label className="block text-sm text-marfim-2">{tipo === 'pai_mae' ? 'Pai ou mãe' : 'A outra pessoa'}
      <select className="field mt-2" name="parente" required defaultValue=""><option value="">Escolha</option>{pessoas.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>
    </label>
    <button className="btn btn-primary min-h-11 w-full" disabled={busy} type="submit">Ligar</button>
  </form>;
}
