'use client';
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from 'react';
import { Download, Film, Share2 } from 'lucide-react';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { useMe } from '@/app/ui/user';
import { quemCanta, type MomentoKaraoke, type ReelKaraoke, type RespostaMomentos } from '@/app/telao/karaoke/tipos';

/** Vídeo da apresentação inteira (GET /api/karaoke/performance): só de quem cantou, cantor ou dueto. */
type PerformanceKaraoke = {
  fila_id: number;
  video_url: string;
  titulo: string;
  faixa: string | null;
  nome: string;
  dueto_nome: string | null;
  user_id: number;
  dueto_user_id: number | null;
};
type RespostaPerformances = { ano: number; eu: number; performances: PerformanceKaraoke[] };

const nomeDoArquivo = (m: { fila_id: number; id?: number }, ext: string, prefixo: string) => `karaoke-${prefixo}-${m.fila_id}${m.id ? `-${m.id}` : ''}.${ext}`;
const musicaDe = (m: { faixa: string | null; titulo: string }) => m.faixa || m.titulo;

/** Baixa o arquivo (via blob, porque o atributo download não vale para outro endereço). Se não der, abre o arquivo. */
async function baixar(url: string, nome: string) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('falhou');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await r.blob());
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 15000);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}

/** Compartilha o arquivo (Web Share API com o arquivo quando o aparelho deixa), senão o link. Sem Web Share: copia o link. O vídeo inteiro (fallback "baixar") nunca passa por fetch + blob: compartilha o link ou entrega o link de download direto. */
async function compartilhar(url: string, nome: string, mime: string, titulo: string, fallback: 'copiar' | 'baixar' = 'copiar'): Promise<string | null> {
  if (fallback === 'baixar') {
    // Vídeo da apresentação inteira (pesado): nada de fetch + blob. Compartilha o link, ou entrega o link de download direto.
    try {
      if (typeof navigator.share === 'function') { await navigator.share({ url, title: titulo }); return null; }
    } catch (e) { if ((e as Error).name === 'AbortError') return null; }
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return null;
  }
  try {
    const r = await fetch(url);
    if (r.ok) {
      const arquivo = new File([await r.blob()], nome, { type: mime });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [arquivo] })) { await navigator.share({ files: [arquivo], title: titulo }); return null; }
    }
  } catch (e) { if ((e as Error).name === 'AbortError') return null; }
  try {
    if (typeof navigator.share === 'function') { await navigator.share({ url, title: titulo }); return null; }
  } catch (e) { if ((e as Error).name === 'AbortError') return null; }
  try { await navigator.clipboard.writeText(url); return 'Link copiado.'; } catch { return 'Não consegui compartilhar neste aparelho.'; }
}

function Botoes({ url, nome, mime, titulo, fallback = 'copiar' }: { url: string; nome: string; mime: string; titulo: string; fallback?: 'copiar' | 'baixar' }) {
  const toast = useToast();
  return <div className="flex flex-wrap gap-2">
    <button type="button" className="btn btn-quiet min-h-11 gap-1" onClick={() => void baixar(url, nome)}><Download size={18} strokeWidth={1.6} aria-hidden="true" />Baixar</button>
    <button type="button" className="btn btn-quiet min-h-11 gap-1" onClick={() => void compartilhar(url, nome, mime, titulo, fallback).then((aviso) => { if (aviso) toast(aviso); })}><Share2 size={18} strokeWidth={1.6} aria-hidden="true" />Compartilhar</button>
  </div>;
}

function ClipeVideo({ url, nome, titulo, legenda, detalhe }: { url: string; nome: string; titulo: string; legenda: string; detalhe?: string }) {
  return <li className="space-y-2 py-4">
    <video className="w-full rounded-xl bg-black" src={url} controls playsInline preload="metadata" aria-label={legenda} />
    <div className="min-w-0"><p className="break-words font-medium">{legenda}</p>{detalhe ? <p className="break-words text-sm text-marfim-2">{detalhe}</p> : null}</div>
    <Botoes url={url} nome={nome} mime="video/webm" titulo={titulo} />
  </li>;
}

/** Seção "Melhores momentos" do celular: o vídeo da apresentação inteira de quem cantou, o vídeo de melhores momentos pronto, os clipes e as fotos da noite (de todos), com filtro "Só os meus". */
export default function MelhoresMomentos() {
  const me = useMe();
  const [dados, setDados] = useState<RespostaMomentos | null>(null);
  const [videos, setVideos] = useState<PerformanceKaraoke[] | null>(null);
  const [soMeus, setSoMeus] = useState(false);

  const carregar = useCallback(async () => {
    const [mom, perf] = await Promise.all([
      api<RespostaMomentos>(`/api/karaoke/momentos${soMeus ? '?minhas=1' : ''}`).catch(() => null),
      api<RespostaPerformances>('/api/karaoke/performance').catch(() => null),
    ]);
    if (mom) setDados(mom);
    if (perf) setVideos(perf.performances);
  }, [soMeus]);

  useEffect(() => {
    const inicio = window.setTimeout(() => void carregar(), 0);
    const t = window.setInterval(() => { if (!document.hidden) void carregar(); }, 15000);
    return () => { window.clearTimeout(inicio); window.clearInterval(t); };
  }, [carregar]);

  const reels: ReelKaraoke[] = dados?.reels ?? [];
  const seus = reels.filter((r) => r.user_id === me.id || r.dueto_user_id === me.id);
  const dosOutros = reels.filter((r) => r.user_id !== me.id && r.dueto_user_id !== me.id);
  const clipes: MomentoKaraoke[] = (dados?.momentos ?? []).filter((m) => m.tipo === 'clipe');
  const fotos: MomentoKaraoke[] = (dados?.momentos ?? []).filter((m) => m.tipo === 'foto');
  const listaVideos = videos ?? [];
  const vazio = !reels.length && !clipes.length && !fotos.length;
  // Sem nada na noite e sem filtro ligado: a seção nem aparece. Com o filtro ligado ela fica, para dar para desligar. Vídeo próprio também mantém a seção.
  if (!listaVideos.length && (!dados || (vazio && !soMeus))) return null;

  return <section className="space-y-4" aria-label="Melhores momentos">
    <div className="flex items-center justify-between gap-3">
      <h2 className="display text-2xl">Melhores momentos</h2>
      <button type="button" className={`btn min-h-11 ${soMeus ? 'btn-primary' : 'btn-quiet'}`} aria-pressed={soMeus} onClick={() => setSoMeus((v) => !v)}>Só os meus</button>
    </div>
    {vazio && !listaVideos.length ? <p className="text-sm text-marfim-2">Você ainda não tem momentos salvos. Cante na versão estúdio: as melhores frases viram foto e clipe.</p> : null}

    {listaVideos.map((v) => <div key={`apresentacao-${v.fila_id}`} className="surface space-y-3 border border-champagne p-5">
      <p className="kicker inline-flex items-center gap-1"><Film size={14} strokeWidth={1.6} aria-hidden="true" />Seu vídeo</p>
      <video className="w-full rounded-xl bg-black" src={v.video_url} controls playsInline preload="metadata" aria-label={`Sua apresentação de ${musicaDe(v)}`} />
      <p className="break-words text-sm text-marfim-2">{musicaDe(v)}</p>
      <Botoes url={v.video_url} nome={nomeDoArquivo(v, 'webm', 'apresentacao')} mime="video/webm" titulo={`Sua apresentação: ${musicaDe(v)}`} fallback="baixar" />
    </div>)}

    {seus.map((r) => <div key={r.fila_id} className="surface space-y-3 border border-champagne p-5">
      <p className="kicker inline-flex items-center gap-1"><Film size={14} strokeWidth={1.6} aria-hidden="true" />Seu vídeo de melhores momentos está pronto</p>
      <video className="w-full rounded-xl bg-black" src={r.reel_url} controls playsInline preload="metadata" aria-label={`Melhores momentos de ${musicaDe(r)}`} />
      <p className="break-words text-sm text-marfim-2">{musicaDe(r)}</p>
      <Botoes url={r.reel_url} nome={nomeDoArquivo(r, 'mp4', 'melhores-momentos')} mime="video/mp4" titulo={`Melhores momentos: ${musicaDe(r)}`} />
    </div>)}
    {dosOutros.map((r) => <div key={r.fila_id} className="surface space-y-3 p-5">
      <p className="kicker">Melhores momentos de {quemCanta(r)}</p>
      <video className="w-full rounded-xl bg-black" src={r.reel_url} controls playsInline preload="metadata" aria-label={`Melhores momentos de ${quemCanta(r)}`} />
      <p className="break-words text-sm text-marfim-2">{musicaDe(r)}</p>
      <Botoes url={r.reel_url} nome={nomeDoArquivo(r, 'mp4', 'melhores-momentos')} mime="video/mp4" titulo={`Melhores momentos: ${musicaDe(r)}`} />
    </div>)}

    {clipes.length ? <div><h3 className="font-medium">Clipes</h3>
      <ul className="divide-y divide-linha">{clipes.map((m) => <ClipeVideo key={m.id} url={m.url} nome={nomeDoArquivo(m, 'webm', 'clipe')} titulo={`${quemCanta(m)}: ${musicaDe(m)}`} legenda={`${quemCanta(m)} cantando ${musicaDe(m)}`} detalhe={m.motivo ?? undefined} />)}</ul>
    </div> : null}

    {fotos.length ? <div className="space-y-2"><h3 className="font-medium">Fotos</h3>
      <ul className="grid grid-cols-2 gap-3">{fotos.map((m) => <li key={m.id} className="space-y-2">
        <img src={m.url} alt={`${quemCanta(m)} cantando ${musicaDe(m)}`} loading="lazy" className="aspect-video w-full rounded-xl bg-black object-cover" />
        <p className="break-words text-xs text-marfim-2">{quemCanta(m)}{m.motivo ? ` · ${m.motivo}` : ''}</p>
        <Botoes url={m.url} nome={nomeDoArquivo(m, 'jpg', 'foto')} mime="image/jpeg" titulo={`${quemCanta(m)} cantando ${musicaDe(m)}`} />
      </li>)}</ul>
    </div> : null}
  </section>;
}
