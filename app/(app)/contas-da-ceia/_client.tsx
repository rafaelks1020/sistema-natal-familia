'use client';
import { useRef, useState } from 'react';
import { api, brl, uploadImage } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import PageHeader from '@/app/ui/PageHeader';
import type { ContasData } from '@/app/api/contas-da-ceia/_types';

export default function ContasClient({ initial, me }: { initial: ContasData; me: { id: number; is_admin: boolean } }) {
  const [data, setData] = useState(initial);
  const [partes, setPartes] = useState(initial.pessoas.filter(p => p.confirmou).map(p => p.id));
  const [pix, setPix] = useState(initial.minha_chave);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const toast = useToast();
  const nomes = new Map(data.pessoas.map(p => [p.id, p.name]));
  async function executar(action: () => Promise<unknown>): Promise<boolean> {
    if (lock.current) return false;
    lock.current = true; setBusy(true);
    try {
      await action();
      try { setData(await api<ContasData>('/api/contas-da-ceia')); toast('Pronto, atualizado.'); }
      catch { toast('Salvo. Recarregue a página para ver os saldos atuais.', 'erro'); }
      return true;
    }
    catch (e) { toast((e as Error).message, 'erro'); return false; }
    finally { lock.current = false; setBusy(false); }
  }
  async function copiar(chave: string) {
    try { await navigator.clipboard.writeText(chave); toast('Chave Pix copiada. Confira o nome no banco antes de pagar.'); }
    catch { toast('Não foi possível copiar. Selecione a chave e copie.', 'erro'); }
  }
  return <>
    <PageHeader title="Contas da ceia" kicker={`Natal ${data.ano}`} back="/" />
    <main className="space-y-7 px-5 pb-12">
      <p className="text-sm text-marfim-2">Dividam as compras feitas por cada pessoa. Este controle é separado da vaquinha.</p>
      <section className="surface space-y-2 p-5"><p className="kicker">Despesas desta edição</p><p className="display text-4xl">{brl(data.total_centavos / 100)}</p></section>
      {me.is_admin && data.denuncias.length ? <section className="surface space-y-4 p-5"><h2 className="display text-2xl">Despesas denunciadas</h2>{data.denuncias.map(d => <div key={d.id} className="space-y-3 break-words border-t border-linha pt-3"><p className="text-sm">{d.trecho}</p><p className="text-xs text-marfim-3">Motivo: {d.motivo}</p><button disabled={busy} className="btn btn-ghost min-h-11 w-full" onClick={() => { void executar(() => api(`/api/contas-da-ceia/denuncias/${d.id}`, { method: 'POST', json: { acao: 'manter' } })); }}>Manter despesa</button><button disabled={busy} className="btn btn-quiet min-h-11 w-full" onClick={() => { if (window.confirm('Apagar a despesa denunciada e recalcular os saldos?')) void executar(() => api(`/api/contas-da-ceia/denuncias/${d.id}`, { method: 'POST', json: { acao: 'apagar' } })); }}>Apagar despesa denunciada</button></div>)}</section> : null}
      <form className="surface space-y-3 p-5" onSubmit={e => { e.preventDefault(); void executar(() => api('/api/contas-da-ceia', { method: 'PATCH', json: { pix_key: pix } })); }}>
        <label className="block text-sm">Minha chave Pix<input className="field mt-2" value={pix} onChange={e => setPix(e.target.value)} maxLength={200} /></label><p className="text-xs text-marfim-3">A família poderá copiar sua chave para acertar as contas. Deixe em branco para remover.</p><button disabled={busy} className="btn btn-ghost min-h-11 w-full">Salvar minha chave</button>
      </form>
      <details className="surface p-5"><summary className="min-h-11 cursor-pointer py-3 text-champagne">Lançar uma despesa que paguei</summary>
        <form className="mt-3 space-y-4" onSubmit={async e => {
          e.preventDefault(); const form = e.currentTarget; const f = new FormData(form);
          const valorTexto = String(f.get('valor')).trim().replace(',', '.');
          if (!/^\d+(\.\d{1,2})?$/.test(valorTexto)) { toast('Informe um valor como 42,90.', 'erro'); return; }
          const [inteiros, decimais = ''] = valorTexto.split('.');
          const valor_centavos = Number(inteiros) * 100 + Number(decimais.padEnd(2, '0'));
          if (await executar(async () => {
            const foto = f.get('foto');
            const comprovante_url = foto instanceof File && foto.size ? await uploadImage(foto) : null;
            await api('/api/contas-da-ceia', { method: 'POST', json: { descricao: f.get('descricao'), valor_centavos, partes, comprovante_url } });
          })) form.reset();
        }}>
          <label className="block text-sm">O que você pagou?<input className="field mt-2" name="descricao" maxLength={240} required /></label>
          <label className="block text-sm">Valor em reais<input className="field mt-2" name="valor" inputMode="decimal" placeholder="42,90" required /></label>
          <fieldset disabled={busy} className="space-y-2"><legend className="mb-2 text-sm">Dividir igualmente entre</legend><p className="text-xs text-marfim-3">Começamos com quem confirmou presença. Você pode mudar.</p><button type="button" className="btn btn-quiet min-h-11" onClick={() => setPartes(data.pessoas.filter(p => p.confirmou).map(p => p.id))}>Usar presenças confirmadas</button><div className="max-h-72 overflow-y-auto">{data.pessoas.map(p => <label key={p.id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-cereja" checked={partes.includes(p.id)} onChange={e => setPartes(atual => e.target.checked ? [...atual, p.id] : atual.filter(id => id !== p.id))} />{p.name}</label>)}</div></fieldset>
          <label className="block text-sm">Foto do comprovante (opcional)<input className="field mt-2 max-w-full text-sm" name="foto" type="file" accept="image/*" /></label>
          <button disabled={busy || !partes.length} className="btn btn-primary min-h-11 w-full">{busy ? 'Salvando...' : 'Lançar despesa'}</button>
        </form>
      </details>
      <section className="space-y-3"><h2 className="display text-2xl">Saldo de cada pessoa</h2><p className="text-xs text-marfim-3">Os centavos que sobrarem são distribuídos na ordem do cadastro.</p>{data.pessoas.map(p => <div key={p.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-linha py-3"><p className="min-w-0 break-words text-sm">{p.name}</p><p className="text-sm text-champagne">{p.saldo_centavos > 0 ? 'Recebe ' : p.saldo_centavos < 0 ? 'Paga ' : ''}{brl(Math.abs(p.saldo_centavos) / 100)}</p></div>)}</section>
      <section className="space-y-4"><h2 className="display text-2xl">Quem paga para quem</h2><p className="text-sm text-marfim-3">Juntamos os saldos para reduzir as transferências. Confirme somente depois de conferir o recebimento no banco.</p>{!data.transferencias.length ? <p className="text-sm text-salvia">Tudo acertado por enquanto.</p> : null}
        {data.transferencias.map(t => { const recebedor = data.pessoas.find(p => p.id === t.para_user_id); return <article key={`${t.de_user_id}-${t.para_user_id}`} className="surface min-w-0 space-y-3 break-words p-5"><p className="text-sm">{nomes.get(t.de_user_id)} paga para {recebedor?.name}</p><p className="display text-3xl">{brl(t.valor_centavos / 100)}</p>{recebedor?.pix_key ? <><p className="select-all break-all text-xs text-marfim-2">{recebedor.pix_key}</p><button className="btn btn-ghost min-h-11 w-full" onClick={() => { void copiar(recebedor.pix_key!); }}>Copiar chave Pix</button></> : <p className="text-xs text-marfim-3">Peça a chave Pix ao recebedor.</p>}{t.para_user_id === me.id ? <button disabled={busy} className="btn btn-primary min-h-11 w-full" onClick={() => { if (window.confirm(`Você conferiu no banco o recebimento de ${brl(t.valor_centavos / 100)} de ${nomes.get(t.de_user_id)}?`)) void executar(() => api('/api/contas-da-ceia', { method: 'PUT', json: { de_user_id: t.de_user_id, valor_centavos: t.valor_centavos } })); }}>Confirmar que recebi</button> : <p className="text-xs text-marfim-3">Só quem recebe confirma o acerto.</p>}</article>; })}
      </section>
      <section className="space-y-4"><h2 className="display text-2xl">Despesas</h2>{!data.despesas.length ? <p className="text-sm text-marfim-3">Nenhuma despesa visível nesta edição.</p> : null}{data.despesas.map(d => <article key={d.id} className="surface min-w-0 space-y-3 break-words p-5"><h3 className="font-medium">{d.descricao}</h3><p className="text-sm text-champagne">{brl(d.valor_centavos / 100)} · Pago por {nomes.get(d.user_id)}</p><p className="text-xs text-marfim-3">Dividido entre {d.partes.map(id => nomes.get(id)).join(', ')}</p>{d.comprovante_url ? <a className="btn btn-ghost min-h-11 w-full" href={d.comprovante_url} target="_blank" rel="noreferrer">Ver comprovante</a> : null}{d.user_id === me.id || me.is_admin ? <button className="btn btn-quiet min-h-11 w-full" disabled={busy} onClick={() => { if (window.confirm('Apagar esta despesa? Os saldos serão recalculados.')) void executar(() => api(`/api/contas-da-ceia/${d.id}`, { method: 'DELETE' })); }}>Apagar despesa</button> : null}{d.user_id !== me.id ? <><button className="btn btn-quiet min-h-11 w-full" disabled={busy} onClick={() => { const motivo = window.prompt('Por que deseja denunciar esta despesa?'); if (motivo?.trim()) void executar(() => api(`/api/contas-da-ceia/${d.id}/denunciar`, { method: 'POST', json: { motivo } })); }}>Denunciar despesa</button><button className="btn btn-quiet min-h-11 w-full" disabled={busy} onClick={() => { if (window.confirm(`Bloquear ${nomes.get(d.user_id)}? O conteúdo da pessoa ficará oculto. Os saldos continuam completos.`)) void executar(() => api('/api/blocks', { method: 'POST', json: { user_id: d.user_id } })); }}>Bloquear {nomes.get(d.user_id)}</button></> : null}</article>)}</section>
      <section className="space-y-3"><h2 className="display text-2xl">Acertos confirmados</h2>{!data.acertos.length ? <p className="text-sm text-marfim-3">Nenhum recebimento confirmado ainda.</p> : null}{data.acertos.map(a => <p key={a.id} className="border-b border-linha py-3 text-sm">{nomes.get(a.para_user_id)} confirmou {brl(a.valor_centavos / 100)} de {nomes.get(a.de_user_id)} em {new Date(a.confirmado_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.</p>)}</section>
    </main>
  </>;
}
