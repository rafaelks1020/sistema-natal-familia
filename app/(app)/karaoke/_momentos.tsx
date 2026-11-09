'use client';
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from 'react';
import { Download, Play, Share2 } from 'lucide-react';
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

function Botoes({ url, nome, mime, titulo, fallback = 'copiar', compacto = false }: { url: string; nome: string; mime: string; titulo: string; fallback?: 'copiar' | 'baixar'; compacto?: boolean }) {
  const toast = useToast();
  // .btn-quiet trava a altura em 40px. No cartão estreito o rótulo vai embaixo do ícone, sem essa classe, para o toque passar de 48px.
  const cls = compacto
    ? 'inline-flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-full px-1 text-sm font-semibold text-marfim-2'
    : 'btn btn-quiet gap-1';
  return <div className={compacto ? 'flex flex-col gap-2' : 'flex flex-wrap gap-2'}>
    <button type="button" className={cls} style={compacto ? undefined : { minHeight: 48 }} onClick={() => void baixar(url, nome)}><Download size={18} strokeWidth={1.6} aria-hidden="true" />Baixar</button>
    <button type="button" className={cls} style={compacto ? undefined : { minHeight: 48 }} onClick={() => void compartilhar(url, nome, mime, titulo, fallback).then((aviso) => { if (aviso) toast(aviso); })}><Share2 size={18} strokeWidth={1.6} aria-hidden="true" />Compartilhar</button>
  </div>;
}

const POR_PAGINA = 6;

type CartaoVideo = {
  chave: string;
  url: string;
  nome: string;
  mime: string;
  titulo: string;
  fallback: 'copiar' | 'baixar';
  kicker: string;
  detalhe: string;
  legenda: string;
  destaque: boolean;
};

/** O vídeo só entra na página depois do toque em Assistir. Enquanto isso, o cartão é só miniatura. */
function CartaoAssistir({ item, aberto, onAbrir }: { item: CartaoVideo; aberto: boolean; onAbrir: () => void }) {
  return <li className={`surface flex min-w-0 flex-col gap-2 p-3 ${item.destaque ? 'border border-champagne' : ''} ${aberto ? 'col-span-2' : ''}`}>
    {aberto ? <video className="aspect-video w-full rounded-xl bg-black" src={item.url} controls playsInline preload="none" aria-label={item.legenda} /> : (
      <button type="button" className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl bg-black text-sm font-semibold" onClick={onAbrir}>
        <Play size={28} strokeWidth={1.6} aria-hidden="true" />
        Assistir
      </button>
    )}
    <p className="break-words text-sm font-medium">{item.kicker}</p>
    {item.detalhe ? <p className="break-words text-sm text-marfim-2">{item.detalhe}</p> : null}
    {aberto ? <Botoes url={item.url} nome={item.nome} mime={item.mime} titulo={item.titulo} fallback={item.fallback} /> : null}
  </li>;
}

/** Seção "Melhores momentos" do celular: o vídeo da apresentação inteira de quem cantou, o vídeo de melhores momentos pronto, os clipes e as fotos da noite (de todos), com filtro "Só os meus". */
export default function MelhoresMomentos() {
  const me = useMe();
  const [dados, setDados] = useState<RespostaMomentos | null>(null);
  const [videos, setVideos] = useState<PerformanceKaraoke[] | null>(null);
  const [soMeus, setSoMeus] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [assistindo, setAssistindo] = useState<string | null>(null);
  const [quantosVideos, setQuantosVideos] = useState(POR_PAGINA);
  const [quantosFotos, setQuantosFotos] = useState(POR_PAGINA);

  const carregar = useCallback(async () => {
    try {
      const [mom, perf] = await Promise.all([
        api<RespostaMomentos>(`/api/karaoke/momentos${soMeus ? '?minhas=1' : ''}`).catch(() => null),
        api<RespostaPerformances>('/api/karaoke/performance').catch(() => null),
      ]);
      if (mom) setDados(mom);
      if (perf) setVideos(perf.performances);
    } finally { setPronto(true); }
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
  const cartoes: CartaoVideo[] = [
    ...listaVideos.map((v): CartaoVideo => ({
      chave: `apresentacao-${v.fila_id}`,
      url: v.video_url,
      nome: nomeDoArquivo(v, 'webm', 'apresentacao'),
      mime: 'video/webm',
      titulo: `Sua apresentação: ${musicaDe(v)}`,
      fallback: 'baixar',
      kicker: 'Seu vídeo',
      detalhe: musicaDe(v),
      legenda: `Sua apresentação de ${musicaDe(v)}`,
      destaque: true,
    })),
    ...seus.map((r): CartaoVideo => ({
      chave: `reel-${r.fila_id}`,
      url: r.reel_url,
      nome: nomeDoArquivo(r, 'mp4', 'melhores-momentos'),
      mime: 'video/mp4',
      titulo: `Melhores momentos: ${musicaDe(r)}`,
      fallback: 'copiar',
      kicker: 'Seu vídeo de melhores momentos está pronto',
      detalhe: musicaDe(r),
      legenda: `Melhores momentos de ${musicaDe(r)}`,
      destaque: true,
    })),
    ...dosOutros.map((r): CartaoVideo => ({
      chave: `reel-${r.fila_id}`,
      url: r.reel_url,
      nome: nomeDoArquivo(r, 'mp4', 'melhores-momentos'),
      mime: 'video/mp4',
      titulo: `Melhores momentos: ${musicaDe(r)}`,
      fallback: 'copiar',
      kicker: `Melhores momentos de ${quemCanta(r)}`,
      detalhe: musicaDe(r),
      legenda: `Melhores momentos de ${quemCanta(r)}`,
      destaque: false,
    })),
    ...clipes.map((m): CartaoVideo => ({
      chave: `clipe-${m.id}`,
      url: m.url,
      nome: nomeDoArquivo(m, 'webm', 'clipe'),
      mime: 'video/webm',
      titulo: `${quemCanta(m)}: ${musicaDe(m)}`,
      fallback: 'copiar',
      kicker: `${quemCanta(m)} cantando ${musicaDe(m)}`,
      detalhe: m.motivo ?? '',
      legenda: `${quemCanta(m)} cantando ${musicaDe(m)}`,
      destaque: false,
    })),
  ];
  const fotosVisiveis = fotos.slice(0, quantosFotos);
  const falhou = pronto && !dados && !videos;
  const semConteudo = !cartoes.length && !fotos.length;

  return <section className="space-y-4" aria-label="Melhores momentos">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="display text-2xl">Melhores momentos</h2>
      <button type="button" className={`btn ${soMeus ? 'btn-primary' : 'btn-quiet'}`} style={{ minHeight: 48 }} aria-pressed={soMeus} onClick={() => setSoMeus((v) => !v)}>Só os meus</button>
    </div>
    {!pronto ? <p className="text-sm text-marfim-2">Carregando os vídeos...</p> : null}
    {falhou ? <p className="text-sm text-marfim-2" role="status">Não consegui carregar os vídeos agora. Vamos tentar de novo em instantes.</p> : null}
    {pronto && !falhou && semConteudo ? <p className="text-sm text-marfim-2">{soMeus ? 'Você ainda não tem momentos salvos. Cante na versão estúdio: as melhores frases viram foto e clipe.' : 'Ainda não há vídeos desta noite.'}</p> : null}

    {cartoes.length ? <ul className="grid grid-cols-2 gap-3">
      {cartoes.slice(0, quantosVideos).map((item) => <CartaoAssistir key={item.chave} item={item} aberto={assistindo === item.chave} onAbrir={() => setAssistindo(item.chave)} />)}
    </ul> : null}
    {cartoes.length > quantosVideos ? <button type="button" className="btn btn-ghost min-h-12 w-full" onClick={() => setQuantosVideos((n) => n + POR_PAGINA)}>Ver mais</button> : null}

    {fotos.length ? <div className="space-y-3"><h3 className="font-medium">Fotos</h3>
      <ul className="grid grid-cols-2 gap-3">{fotosVisiveis.map((m) => <li key={m.id} className="min-w-0 space-y-2">
        <img src={m.url} alt={`${quemCanta(m)} cantando ${musicaDe(m)}`} loading="lazy" className="aspect-video w-full rounded-xl bg-black object-cover" />
        <p className="break-words text-sm text-marfim-2">{quemCanta(m)}{m.motivo ? ` (${m.motivo})` : ''}</p>
        <Botoes url={m.url} nome={nomeDoArquivo(m, 'jpg', 'foto')} mime="image/jpeg" titulo={`${quemCanta(m)} cantando ${musicaDe(m)}`} compacto />
      </li>)}</ul>
      {fotos.length > quantosFotos ? <button type="button" className="btn btn-ghost min-h-12 w-full" onClick={() => setQuantosFotos((n) => n + POR_PAGINA)}>Ver mais fotos</button> : null}
    </div> : null}
  </section>;
}
