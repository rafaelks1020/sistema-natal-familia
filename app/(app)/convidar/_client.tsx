'use client';

import { useState } from 'react';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import type { PedidoConvite } from '@/app/lib/convites';

export default function PedidosConvite({ initial, organizar = false, onChanged }: { initial: PedidoConvite[]; organizar?: boolean; onChanged?: () => void }) {
  const [pedidos, setPedidos] = useState(initial);
  const [nome, setNome] = useState('');
  const [parentesco, setParentesco] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  async function carregar() { setPedidos(await api<PedidoConvite[]>(`/api/convidar${organizar ? '?organizar=1' : ''}`)); }
  async function criar(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      await api('/api/convidar', { method: 'POST', json: { nome, parentesco } });
      setNome(''); setParentesco(''); toast('Pedido enviado para quem organiza.'); await carregar();
    } catch (err) { toast((err as Error).message, 'erro'); } finally { setBusy(false); }
  }
  async function decidir(id: number, status?: 'aprovado' | 'recusado') {
    if (!status && !window.confirm('Apagar este pedido e cancelar o link, se houver?')) return;
    setBusy(true);
    try {
      await api(`/api/convidar/${id}`, { method: status ? 'PATCH' : 'DELETE', json: status ? { status } : undefined });
      toast(status === 'aprovado' ? 'Convite aprovado.' : status ? 'Pedido recusado.' : 'Pedido apagado.'); await carregar(); onChanged?.();
    } catch (err) { toast((err as Error).message, 'erro'); } finally { setBusy(false); }
  }
  async function compartilhar(token: string) {
    const url = `${window.location.origin}/entrar?convite=${encodeURIComponent(token)}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Natal em Família', text: 'Vem participar do nosso Natal em Família!', url });
      else { await navigator.clipboard.writeText(url); toast('Link copiado. Pode mandar no WhatsApp.'); }
    } catch (err) { if (!(err instanceof Error && err.name === 'AbortError')) toast('Não foi possível compartilhar. Use o botão WhatsApp.', 'erro'); }
  }
  return <div className="space-y-5">
    {!organizar && <form onSubmit={criar} className="surface space-y-4 p-5">
      <p className="text-sm text-marfim-2">Quer trazer alguém novo? Peça o convite. Quem organiza analisa e libera o link para você enviar.</p>
      <label className="block text-sm">Nome da pessoa<input className="field mt-2" value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={60} autoComplete="off" /></label>
      <label className="block text-sm">Como ela faz parte da família?<input className="field mt-2" value={parentesco} onChange={(e) => setParentesco(e.target.value)} placeholder="Ex.: namorada do João" required maxLength={120} /></label>
      <p className="text-xs text-marfim-3">Este pedido é privado: só você e quem organiza podem ver.</p>
      <button disabled={busy} className="btn btn-primary w-full">{busy ? 'Um instante...' : 'Pedir convite'}</button>
    </form>}
    <h2 className="display text-2xl">{organizar ? 'Pedidos de parentes' : 'Seus pedidos'}</h2>
    {!pedidos.length && <p className="text-sm text-marfim-3">Nenhum pedido por aqui.</p>}
    {pedidos.map((p) => <article key={p.id} className="surface space-y-3 break-words p-5">
      <div><h3 className="text-lg font-medium">{p.nome}</h3><p className="text-sm text-marfim-2">{p.parentesco}</p>{organizar && <p className="mt-1 text-xs text-marfim-3">Pedido de {p.solicitante}</p>}</div>
      <p className="text-sm text-champagne">{p.status === 'pendente' ? 'Aguardando aprovação' : p.status === 'recusado' ? 'Não aprovado. Converse com quem organiza.' : p.link_ativo ? 'Aprovado! O link vale para um cadastro, por até 30 dias.' : 'Aprovado. O link foi usado, venceu ou foi cancelado.'}</p>
      {p.status === 'aprovado' && p.token && p.link_ativo && <><button className="btn btn-primary w-full" onClick={() => compartilhar(p.token!)}>Compartilhar convite</button><a className="btn btn-ghost w-full" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Vem participar do nosso Natal em Família! https://natalemfamilia.com.br/entrar?convite=${p.token}`)}`}>Enviar no WhatsApp</a><input aria-label={`Link do convite para ${p.nome}`} className="field min-w-0 text-xs" readOnly value={`https://natalemfamilia.com.br/entrar?convite=${p.token}`} /></>}
      {organizar && <div className="flex flex-wrap gap-2">{p.status === 'pendente' && <><button className="btn btn-primary" disabled={busy} onClick={() => decidir(p.id, 'aprovado')}>Aprovar</button><button className="btn btn-ghost" disabled={busy} onClick={() => decidir(p.id, 'recusado')}>Recusar</button></>}<button className="btn btn-quiet" disabled={busy} onClick={() => decidir(p.id)}>Apagar pedido</button></div>}
    </article>)}
  </div>;
}
