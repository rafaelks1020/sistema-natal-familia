'use client';
import { useRef, useState } from 'react';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import Avatar from '@/app/ui/Avatar';
import PageHeader from '@/app/ui/PageHeader';
import ModerationActions from '../mural/_components/ModerationActions';
import { rotulosCarona, tiposCarona, type CaronasData, type TipoCarona } from '@/app/api/caronas/_types';

export default function CaronasClient({ initial, me }: { initial: CaronasData; me: { id: number; is_admin: boolean } }) {
  const [data, setData] = useState(initial);
  const [aba, setAba] = useState<'oferta' | 'pedido'>('oferta');
  const [tipo, setTipo] = useState<TipoCarona>('carona_oferta');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const toast = useToast();
  async function executar(path: string, method: string, json?: unknown): Promise<boolean> {
    if (lock.current) return false;
    lock.current = true; setBusy(true);
    try {
      await api(path, { method, json });
      try { setData(await api<CaronasData>('/api/caronas')); toast('Pronto, atualizado.'); }
      catch { toast('Salvo. Recarregue a página para atualizar a lista.', 'erro'); }
      return true;
    } catch (e) { toast((e as Error).message, 'erro'); return false; }
    finally { lock.current = false; setBusy(false); }
  }
  const ofertas = data.ofertas.filter(o => o.tipo.endsWith(`_${aba}`));
  return <>
    <PageHeader title="Caronas e hospedagem" kicker={`Natal ${data.ano}`} back="/ceia" />
    <main className="space-y-7 px-5 pb-12">
      <p className="text-sm text-marfim-2">Um lugar no carro ou em casa para celebrar juntos.</p>
      <details className="surface p-5">
        <summary className="min-h-11 cursor-pointer py-3 text-champagne">Oferecer ou pedir ajuda</summary>
        <form className="mt-3 space-y-4" onSubmit={async e => {
          e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
          if (await executar('/api/caronas', 'POST', { tipo, origem: f.get('origem'), quando: f.get('quando'), vagas: Number(f.get('vagas')), observacao: f.get('observacao'), telefone: f.get('telefone') })) form.reset();
        }}>
          <label className="block text-sm">Como quer ajudar?<select className="field mt-2" value={tipo} onChange={e => setTipo(e.target.value as TipoCarona)}>{tiposCarona.map(t => <option key={t} value={t}>{rotulosCarona[t]}</option>)}</select></label>
          <label className="block text-sm">{tipo.startsWith('carona') ? 'De onde sai? Cidade ou bairro' : 'Em qual cidade?'}<input className="field mt-2" name="origem" required maxLength={160} /></label>
          <label className="block text-sm">Quando? Dia e horário<input className="field mt-2" name="quando" required maxLength={160} placeholder="24 de dezembro, às 18h" /></label>
          <label className="block text-sm">{tipo.endsWith('_oferta') ? 'Vagas disponíveis' : 'Quantas vagas precisa?'}<input className="field mt-2" name="vagas" type="number" inputMode="numeric" min="1" max="100" defaultValue="1" required /></label>
          <label className="block text-sm">Observação (opcional)<textarea className="field mt-2" name="observacao" maxLength={2000} /></label>
          <label className="block text-sm">Telefone para a família ver (opcional)<input className="field mt-2" name="telefone" type="tel" maxLength={40} /><span className="mt-1 block text-xs text-marfim-3">Preencha só se quiser mostrar seu telefone no anúncio.</span></label>
          <button disabled={busy} className="btn btn-primary min-h-11 w-full">Publicar</button>
        </form>
      </details>
      <div role="tablist" aria-label="Ofertas e pedidos" className="grid grid-cols-2 gap-2">{(['oferta', 'pedido'] as const).map(t => <button key={t} role="tab" aria-selected={aba === t} className={`btn min-h-11 ${aba === t ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setAba(t)}>{t === 'oferta' ? 'Ofertas' : 'Pedidos'}</button>)}</div>
      {!ofertas.length ? <p className="py-6 text-marfim-3">Ainda não há {aba === 'oferta' ? 'ofertas' : 'pedidos'} nesta edição.</p> : null}
      {ofertas.map(o => <article key={o.id} className="surface min-w-0 space-y-4 break-words p-5">
        <div className="flex items-center gap-3"><Avatar name={o.name} src={o.avatar_url} /><div className="min-w-0"><p className="kicker">{rotulosCarona[o.tipo]}</p><p>{o.name}</p></div></div>
        <h2 className="display text-2xl">{o.origem}</h2><p className="text-sm text-marfim-2">{o.quando}</p>
        <p className="text-sm text-champagne">{o.vagas} {o.tipo.endsWith('_oferta') ? 'vaga(s) disponível(is)' : 'vaga(s) necessária(s)'}{!o.ativo ? ' · Encerrado' : ''}</p>
        {o.observacao ? <p className="whitespace-pre-wrap text-sm">{o.observacao}</p> : null}
        {o.telefone ? <p className="text-sm text-marfim-2">Telefone: {o.telefone}</p> : null}
        {o.minha_reserva > 0 ? <><p className="text-sm text-salvia">Você reservou {o.minha_reserva} vaga(s).</p><button disabled={busy} className="btn btn-ghost min-h-11 w-full" onClick={() => { void executar(`/api/caronas/${o.id}/reservas`, 'DELETE', {}); }}>Cancelar minha reserva</button></> : null}
        {o.user_id !== me.id && o.ativo && o.tipo.endsWith('_oferta') && !o.minha_reserva ? <form className="space-y-3" onSubmit={e => { e.preventDefault(); const quantidade = Number(new FormData(e.currentTarget).get('quantidade')); void executar(`/api/caronas/${o.id}/reservas`, 'POST', { quantidade }); }}><label className="block text-sm">Quantidade de vagas<input className="field mt-2" name="quantidade" type="number" min="1" max={Math.max(1, o.vagas)} defaultValue="1" required /></label><button disabled={busy || o.vagas === 0} className="btn btn-primary min-h-11 w-full">{o.vagas ? 'Quero uma vaga' : 'Sem vagas no momento'}</button></form> : null}
        {o.user_id === me.id ? <><button disabled={busy} className="btn btn-ghost min-h-11 w-full" onClick={() => { void executar(`/api/caronas/${o.id}`, 'PATCH', { ativo: !o.ativo }); }}>{o.ativo ? 'Encerrar anúncio' : 'Reabrir anúncio'}</button>{o.reservas.length ? <div className="space-y-2 border-t border-linha pt-4"><p className="kicker">Quem reservou</p>{o.reservas.map(r => <div key={r.user_id} className="space-y-1"><p className="text-sm">{r.name}: {r.quantidade} vaga(s)</p><button disabled={busy} className="btn btn-quiet min-h-11" onClick={() => { if (window.confirm(`Remover a reserva de ${r.name}?`)) void executar(`/api/caronas/${o.id}/reservas`, 'DELETE', { reserva_user_id: r.user_id }); }}>Remover reserva</button></div>)}</div> : null}</> : null}
        {o.user_id === me.id || me.is_admin ? <button disabled={busy} className="btn btn-quiet min-h-11 w-full" onClick={() => { if (window.confirm('Apagar este anúncio e suas reservas?')) void executar(`/api/caronas/${o.id}`, 'DELETE'); }}>Apagar anúncio</button> : null}
        {o.user_id !== me.id ? <ModerationActions userId={o.user_id} name={o.name} alvoTipo="carona" alvoId={o.id} /> : null}
      </article>)}
    </main>
  </>;
}
