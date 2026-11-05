'use client';
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api, thumb } from '@/app/ui/client';
import ModerationActions from '@/app/(app)/mural/_components/ModerationActions';
import type { ScreenData } from '@/app/api/telao/data';
import styles from './telao.module.css';
export default function ScreenClient({ initial }: { initial: ScreenData }) {
  const [data, setData] = useState(initial);
  const [key, setKey] = useState(initial.fotos[0]?.key ?? '');
  const [now, setNow] = useState(Date.parse(initial.agora));
  const [erro, setErro] = useState('');
  const latest = useRef(initial);
  const current = useRef(initial.fotos[0]?.key ?? '');
  const pending = useRef<string[]>([]);
  const seen = useRef(new Set(initial.fotos.map((p) => p.key)));
  useEffect(() => {
    const controller = new AbortController();
    let reading = false;
    const poll = setInterval(async () => {
      if (reading) return;
      reading = true;
      try {
        const next = await api<ScreenData>('/api/telao', { signal: controller.signal });
        if (controller.signal.aborted) return;
        const recent = next.fotos.filter((p) => !seen.current.has(p.key) && Date.parse(p.created_at) >= Date.now() - 600000);
        const valid = new Set(next.fotos.map((p) => p.key));
        pending.current = [...recent.map((p) => p.key), ...pending.current.filter((k) => valid.has(k))];
        seen.current = valid; latest.current = next; setData(next); setErro('');
        if (!valid.has(current.current)) { current.current = next.fotos[0]?.key ?? ''; setKey(current.current); }
      } catch (e) { if (!controller.signal.aborted) setErro((e as Error).message); }
      finally { reading = false; }
    }, 10000);
    const slides = setInterval(() => {
      const fotos = latest.current.fotos;
      if (!fotos.length) return;
      const index = fotos.findIndex((p) => p.key === current.current);
      current.current = pending.current.shift() ?? fotos[(index + 1) % fotos.length].key;
      setKey(current.current);
    }, 9000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { controller.abort(); clearInterval(poll); clearInterval(slides); clearInterval(clock); };
  }, []);
  const foto = data.fotos.find((p) => p.key === key) ?? data.fotos[0];
  const remaining = Math.max(0, Math.floor((Date.parse(data.meiaNoite) - now) / 1000));
  const countdown = [Math.floor(remaining / 3600), Math.floor(remaining / 60) % 60, remaining % 60].map((v) => String(v).padStart(2, '0')).join(':');
  return <main className={styles.screen}>
    {foto ? <div key={`${foto.key}-${foto.url}`} className={styles.slide}><img src={thumb(foto.url, 1280, 85)} alt={foto.legenda || `Foto de ${foto.nome}`} className={styles.photo} /></div> : <div className={styles.empty}><p className="kicker">Natal {data.ano}</p><h1 className="display text-5xl">Nossa noite, nossas lembranças.</h1><p>Publique uma foto no mural ou participe do desafio.</p></div>}
    <header className={styles.header}><p className="kicker">Natal em Família · {data.ano}</p><div className="text-right"><time className={styles.clock}>{new Date(now).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time><p className="mt-1 text-sm text-marfim-2">{remaining ? `${countdown} para a meia-noite` : 'Feliz Natal!'}</p></div></header>
    <footer className={styles.footer}><div className="min-w-0"><p className="display break-words text-3xl">{foto?.nome ?? 'A família toda reunida'}</p>{foto?.legenda && <p className="mt-2 line-clamp-2 max-w-2xl break-words text-marfim-2">{foto.legenda}</p>}{data.desafio && <Link href="/festa/desafio" className="mt-4 inline-flex min-h-11 items-center rounded-full border border-champagne/50 bg-carvao/80 px-4 py-2 text-sm text-champagne">Desafio aberto: {data.desafio.titulo}</Link>}<p className="mt-4 break-all text-sm text-marfim-2">natalemfamilia.com.br</p>{erro && <p role="status" className="mt-2 text-xs text-champagne">Atualização indisponível. Tentando novamente...</p>}</div></footer>
    <details className={styles.controls}><summary className="btn btn-ghost min-h-11 cursor-pointer bg-carvao/90 px-4">Opções</summary><div className="mt-2 grid gap-2 rounded-2xl border border-linha bg-carvao p-3"><button className="btn btn-ghost min-h-11" onClick={() => { void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch(() => setErro('Use a opção de tela cheia do navegador.')); }}>Tela cheia</button><Link className="btn btn-quiet min-h-11" href="/festa">Voltar à festa</Link>{foto?.user_id && foto.user_id !== data.meId && <ModerationActions key={foto.key} userId={foto.user_id} name={foto.nome} {...(foto.source === 'desafio' ? { alvoTipo: 'desafio', alvoId: foto.id } : { postId: foto.id })} />}</div></details>
  </main>;
}
