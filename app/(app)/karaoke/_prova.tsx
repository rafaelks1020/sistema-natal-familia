'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/app/ui/client';
import type { PainelProva } from '@/app/telao/karaoke/prova-tipos';
import TentativasAdmin from '@/app/telao/karaoke/_prova-admin';
const fases = { preparando: 'Em preparação', eliminatoria: 'Eliminatória aberta', final: 'Final ao vivo', encerrada: 'Encerrada' };
export default function CardProva() {
  const [d, setDados] = useState<PainelProva | null>(null);
  const [erro, setErro] = useState('');
  const carregar = useCallback(async () => {
    try { setDados(await api<PainelProva>('/api/karaoke/prova')); setErro(''); }
    catch (e) { setErro((e as Error).message); }
  }, []);
  const ocultoEm = d?.ranking_oculto_em;
  const souAdmin = d?.admin;
  useEffect(() => {
    if (!ocultoEm || souAdmin) return;
    let timer: number;
    const verificar = () => {
      const falta = Date.parse(ocultoEm) - Date.now();
      if (falta <= 0) { setDados((p) => p?.classificacao ? { ...p, classificacao: null } : p); return; }
      timer = window.setTimeout(verificar, Math.min(falta, 2147483647));
    };
    timer = window.setTimeout(verificar, 0);
    return () => window.clearTimeout(timer);
  }, [ocultoEm, souAdmin]);

  useEffect(() => {
    const inicio = window.setTimeout(() => void carregar(), 0);
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void carregar(); }, 15000);
    return () => { window.clearTimeout(inicio); window.clearInterval(t); };
  }, [carregar]);
  return <section className="surface space-y-3 border border-champagne/50 p-5" aria-label="Prova do Karaokê">
    <p className="kicker">Disputa pelo brinde Voz do Natal</p><h2 className="display text-2xl">Prova do Karaokê</h2>
    <p className="text-sm text-marfim-2">Cinco músicas, nível Difícil, uma tentativa por música. As quatro maiores somas vão à final na festa.</p>
    {erro ? <p role="alert" className="text-sm">{erro} <button type="button" className="underline" onClick={() => void carregar()}>Tentar novamente</button></p> : null}
    {d?.config ? <>
      <p>{fases[d.config.status]}</p>
      <p className="text-sm">Eliminatória até {new Date(d.config.eliminatoria_ate).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (São Paulo).</p>
      <h3 className="font-semibold">Minhas tentativas oficiais</h3>
      <ul className="space-y-2 text-sm">{d.musicas.map((m) => {
        const t = d.minhas_tentativas.find((t) => t.catalogo_id === m.id && t.fase === 'eliminatoria');
        return <li key={m.id}><span className="font-medium">{m.faixa}</span><span className="block text-marfim-2">{m.artista}: {t ? t.status === 'cantando' ? 'cantando agora' : `${t.nota ?? 0}/100${t.status === 'abandonada' ? ' (parcial, sem nova tentativa)' : ' (tentativa usada)'}` : 'ainda não cantada: 0 ponto'}</span></li>;
      })}</ul>
      {d.minhas_tentativas.filter((t) => t.fase === 'final').map((t) => <p key={t.id}>Minha final: {t.status === 'cantando' ? 'cantando agora' : `${t.nota ?? 0}/100${t.status === 'abandonada' ? ' (parcial)' : ''}`}</p>)}
      <details><summary className="cursor-pointer py-2 font-semibold">Classificação da eliminatória</summary>
        {d.classificacao === null ? <p className="text-sm text-marfim-2">Classificação oculta para o suspense. Resultado no telão da festa.</p> : d.classificacao.length ? <ol className="space-y-2 text-sm">{d.classificacao.map((p) => <li key={p.user_id} className="flex justify-between gap-2"><span>{p.posicao}º {p.nome}</span><b>{p.soma_eliminatoria}/500</b></li>)}</ol> : <p>Ainda não há tentativas oficiais.</p>}
      </details>
      {d.finalistas?.length && ['final','encerrada'].includes(d.config.status) ? <p className="text-sm">Finalistas: {d.finalistas.map((p) => p.nome).join(', ')}.</p> : null}
      {d.config.status === 'eliminatoria' ? <Link href="/telao/karaoke?modo=prova" className="btn btn-primary w-full">Abrir telão em modo Prova</Link> : null}
    </> : !erro ? <p className="text-sm text-marfim-2">A organização ainda vai confirmar as cinco músicas e as datas.</p> : null}
    {d?.admin && d.tentativas_admin ? <TentativasAdmin classe="space-y-2 text-sm" tentativas={d.tentativas_admin} aoMudar={setDados} /> : null}
    <Link href="/karaoke/prova" className="inline-block py-2 text-sm text-champagne underline">Regulamento da Prova</Link>
  </section>;
}
