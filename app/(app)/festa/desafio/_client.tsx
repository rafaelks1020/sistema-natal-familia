'use client';
/* eslint-disable @next/next/no-img-element */
import { useCallback, useRef, useState } from 'react';
import PageHeader from '@/app/ui/PageHeader';
import Avatar from '@/app/ui/Avatar';
import LoopMedia from '@/app/ui/LoopMedia';
import { api, thumb, uploadImage } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import ModerationActions from '../../mural/_components/ModerationActions';
import type { ChallengeData } from '@/app/api/festa/desafio/data';
import { AvisoSemConexao, usePolling } from '../_polling';
const endpoint = '/api/festa/desafio';
const sugestoes = ['Melhor careta', 'Melhor look', 'Foto mais natalina', 'Melhor foto com a vó'];
export default function ChallengeClient({ initial }: { initial: ChallengeData }) {
  const [data, setData] = useState(initial);
  const [titulo, setTitulo] = useState(sugestoes[0]);
  const [legenda, setLegenda] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const refresh = useCallback(async () => {
    setData(await api<ChallengeData>(endpoint));
  }, []);
  const { semConexao, escrita } = usePolling(async (obsoleta) => {
    const next = await api<ChallengeData>(endpoint);
    if (obsoleta()) return;
    setData(next);
  }, 10000);
  async function mutate(method: string, json: unknown, success: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await escrita(async () => { await api(endpoint, { method, json }); await refresh(); }); toast(success); }
    catch (e) { toast((e as Error).message, 'erro'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function sendPhoto(desafio: number) {
    if (!file || lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const image_url = await uploadImage(file);
      await escrita(async () => {
        await api(endpoint, { method: 'PUT', json: { acao: 'foto', desafio_id: desafio, image_url, legenda } });
        await refresh();
      });
      setFile(null); setLegenda(''); if (input.current) input.current.value = '';
      toast('Foto enviada!');
    } catch (e) { toast((e as Error).message, 'erro'); }
    finally { lock.current = false; setBusy(false); }
  }
  const aberto = data.desafios.find((c) => c.aberto);
  const minha = data.fotos.find((p) => p.desafio_id === aberto?.id && p.user_id === data.me.id);
  return <><PageHeader back="/festa" kicker={`Natal ${data.ano}`} title="Desafio de foto" /><div className="space-y-6 px-5 pb-8">
    <p className="text-sm text-marfim-2">Uma foto por pessoa em cada desafio. Escolha a sua favorita e vote. Você pode trocar seu voto até encerrar.</p>
    <AvisoSemConexao visivel={semConexao} />
    {data.me.is_admin && !aberto && <form className="space-y-4 rounded-2xl border border-linha bg-carvao-2 p-5" onSubmit={(e) => { e.preventDefault(); void mutate('POST', { titulo }, 'Desafio aberto. A família será avisada.'); }}>
      <h2 className="display text-2xl">Começar um desafio</h2><div className="flex flex-wrap gap-2">{sugestoes.map((s) => <button key={s} type="button" disabled={busy} className="btn btn-ghost min-h-11 text-xs" onClick={() => setTitulo(s)}>{s}</button>)}</div>
      <label className="block text-sm">Nome do desafio<input className="field mt-2" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} required disabled={busy} /></label><button className="btn btn-primary w-full" disabled={busy}>Abrir desafio</button>
    </form>}
    {aberto && <section className="space-y-4 rounded-2xl border border-champagne/30 p-5"><p className="kicker">Valendo agora</p><h2 className="display text-3xl break-words">{aberto.titulo}</h2>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void sendPhoto(aberto.id); }}>
        <label className="block text-sm">{minha ? 'Trocar minha foto' : 'Escolher minha foto'}<input ref={input} className="field mt-2 min-h-11 w-full min-w-0 text-sm" type="file" accept="image/*" disabled={busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        <label className="block text-sm">Legenda (opcional)<textarea className="field mt-2" value={legenda} onChange={(e) => setLegenda(e.target.value)} maxLength={500} disabled={busy} /></label>
        {minha && <p className="text-xs text-marfim-3">Ao trocar a foto, os votos que ela recebeu são zerados.</p>}
        <button className="btn btn-primary w-full" disabled={busy || !file}>{busy ? 'Aguarde...' : minha ? 'Trocar foto' : 'Enviar foto'}</button>
      </form>
      {data.me.is_admin && <button className="btn btn-ghost w-full" disabled={busy} onClick={() => { if (window.confirm('Encerrar agora? Fotos e votos serão fechados.')) void mutate('PATCH', { desafio_id: aberto.id }, 'Desafio encerrado!'); }}>Encerrar e revelar resultado</button>}
    </section>}
    {!data.desafios.length && <p className="rounded-2xl border border-linha p-6 text-marfim-2">Quem organiza vai abrir o primeiro desafio. Prepare a câmera!</p>}
    {data.desafios.map((c) => {
      const fotos = data.fotos.filter((p) => p.desafio_id === c.id);
      const winners = fotos.filter((p) => p.vencedor);
      const voto = data.meusVotos.find((v) => v.desafio_id === c.id)?.entry_id;
      return <section key={c.id} className="space-y-4"><div className="rule" /><p className="kicker">{c.aberto ? 'Fotos participantes' : 'Desafio encerrado'}</p><h2 className="display break-words text-3xl">{c.titulo}</h2>
        {!c.aberto && <div className="relative overflow-hidden rounded-2xl border border-champagne/30 bg-carvao-2 p-5">{winners.length > 0 && <LoopMedia name="mn-confete" once className="mb-3 h-28 w-full rounded-xl" />}<p className="display text-2xl">{winners.length > 1 ? 'Empate! Vamos celebrar juntos.' : winners.length ? 'A foto vencedora!' : 'A rodada terminou.'}</p><p className="mt-2 text-sm text-marfim-2">{winners.length ? winners.map((p) => p.name).join(', ') : 'Ainda não há um vencedor para mostrar.'}</p></div>}
        {!fotos.length && <p className="text-sm text-marfim-3">Nenhuma foto para mostrar por aqui.</p>}
        {fotos.map((p) => <article key={p.id} className={`overflow-hidden rounded-2xl border bg-carvao-2 ${p.vencedor ? 'border-champagne' : 'border-linha'}`}>
          <img src={thumb(p.image_url)} alt={p.legenda || `Foto de ${p.name}`} loading="lazy" className="aspect-[4/3] w-full object-contain" /><div className="space-y-3 p-4"><div className="flex items-center gap-3"><Avatar name={p.name} src={p.avatar_url} size={36} /><p className="min-w-0 break-words text-sm">{p.name}{p.vencedor && ' · Vencedor'}</p></div><p className="whitespace-pre-wrap break-words text-sm text-marfim-2">{p.legenda}</p><p className="text-sm text-champagne">{p.votos} {p.votos === 1 ? 'voto' : 'votos'}</p>
          {c.aberto && p.user_id !== data.me.id && <button className={`btn w-full ${voto === p.id ? 'btn-primary' : 'btn-ghost'}`} disabled={busy || voto === p.id} onClick={() => { void mutate('PUT', { acao: 'votar', desafio_id: c.id, entry_id: p.id }, 'Voto registrado!'); }}>{voto === p.id ? 'Seu voto está aqui' : 'Votar nesta foto'}</button>}
          {((c.aberto && p.user_id === data.me.id) || data.me.is_admin) && <button className="btn btn-quiet min-h-11 w-full" disabled={busy} onClick={() => { if (window.confirm('Apagar esta foto e os votos recebidos?')) void mutate('DELETE', { entry_id: p.id }, 'Foto apagada.'); }}>Apagar foto</button>}
          {p.user_id !== data.me.id && <details><summary className="min-h-11 cursor-pointer py-3 text-xs text-marfim-3">Opções desta foto</summary><ModerationActions userId={p.user_id} name={p.name} alvoTipo="desafio" alvoId={p.id} /></details>}
        </div></article>)}
      </section>;
    })}
  </div></>;
}
