'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { api } from '@/app/ui/client';
import type { RevelacaoTelao } from '@/app/lib/gamificacao/tipos';
import { Confete } from '../_confete';

function Fogos() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let ultimo = 0;
    let width = 0;
    let height = 0;
    const particulas: { x: number; y: number; vx: number; vy: number; vida: number; cor: string }[] = [];
    const ajustar = () => { width = canvas.width = canvas.clientWidth; height = canvas.height = canvas.clientHeight; };
    ajustar(); window.addEventListener('resize', ajustar);
    const animar = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      if (t - ultimo > 850) {
        ultimo = t;
        const x = width * (0.15 + Math.random() * 0.7);
        const y = height * (0.15 + Math.random() * 0.35);
        const cor = ['#e6c98e','#ef6568','#f3ebdc','#9ec4a8'][Math.floor(Math.random() * 4)];
        for (let i = 0; i < 65; i++) { const a = i / 65 * Math.PI * 2; const v = 1 + Math.random() * 4; particulas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 1, cor }); }
      }
      for (let i = particulas.length - 1; i >= 0; i--) {
        const p = particulas[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.025; p.vida -= 0.012;
        if (p.vida <= 0) { particulas.splice(i, 1); continue; }
        ctx.globalAlpha = p.vida; ctx.fillStyle = p.cor; ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1; raf = requestAnimationFrame(animar);
    };
    raf = requestAnimationFrame(animar);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', ajustar); };
  }, []);
  return <canvas ref={canvasRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />;
}

/** Cada colocado tem 5 s de suspense e 9 s de celebração. Os dois brindes são independentes. */
export function RevelacaoBrindes() {
  const [dados, setDados] = useState<RevelacaoTelao | null>(null);
  const [tempo, setTempo] = useState(0);
  const [erro, setErro] = useState('');
  useEffect(() => {
    let vivo = true;
    let inicio: number | null = null;
    const carregar = async () => {
      try {
        const d = await api<RevelacaoTelao>('/api/telao/gamificacao');
        if (!vivo) return;
        setDados(d); setErro('');
        if (d.revelado && inicio === null) inicio = performance.now();
      } catch (e) { if (vivo) setErro((e as Error).message); }
    };
    void carregar();
    const consulta = window.setInterval(() => { if (inicio === null) void carregar(); }, 5000);
    const relogio = window.setInterval(() => { if (inicio !== null) setTempo(performance.now() - inicio); }, 250);
    return () => { vivo = false; window.clearInterval(consulta); window.clearInterval(relogio); };
  }, []);
  const roteiro = dados ? [
    ...[3, 2, 1].flatMap((posicao) => { const p = dados.campeao.find((p) => p.posicao === posicao); return p ? [{ premio: 'Campeão do Natal', posicao, nome: p.nome, avatar: p.avatar_url, pontos: `${p.total} pontos`, candidatos: dados.campeao.map((p) => p.nome) }] : []; }),
    ...[3, 2, 1].flatMap((posicao) => { const p = dados.prova.find((p) => p.posicao === posicao && p.nota_final !== null); return p ? [{ premio: 'Voz do Natal', posicao, nome: p.nome, avatar: p.avatar_url, pontos: `${p.nota_final}/100 na final · ${p.soma_eliminatoria}/500 na eliminatória`, candidatos: dados.prova.map((p) => p.nome) }] : []; }),
  ] : [];
  const indice = Math.min(roteiro.length - 1, Math.floor(tempo / 14000));
  const atual = roteiro[indice];
  const mostrou = tempo % 14000 >= 5000 || tempo >= roteiro.length * 14000;
  return <section style={{ position: 'relative', width: '100%', height: '100%', minHeight: '85dvh', display: 'grid', placeItems: 'center', textAlign: 'center', background: 'radial-gradient(ellipse at top, #354337, #171b18 70%)', color: '#f3ebdc', overflow: 'hidden', padding: '5vmin' }} aria-live="polite">
    {dados?.revelado && atual ? <>
      {mostrou ? <><Fogos key={`${atual.premio}-${atual.posicao}`} /><Confete key={`confete-${indice}`} modo={atual.posicao === 1 ? 'explosao' : 'rajada'} /></> : null}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <p style={{ color: '#e6c98e', letterSpacing: '.15em', fontSize: '2.5vmin' }}>OS BRINDES DO NATAL</p>
        <h2 style={{ fontFamily: 'Georgia,serif', fontSize: '7vmin', margin: '2vmin' }}>{atual.premio}</h2>
        <p style={{ fontSize: '4vmin', margin: '3vmin' }}>{atual.posicao}º lugar{mostrou ? '' : ': quem será?'}</p>
        {mostrou ? <>
          {atual.avatar ? <img src={atual.avatar} alt="" style={{ height: '17vmin', width: '17vmin', borderRadius: '50%', objectFit: 'cover', margin: 'auto', border: '3px solid #bfa577' }} /> : null}
          <p style={{ fontFamily: 'Georgia,serif', color: '#e6c98e', fontSize: '10vmin', lineHeight: 1.1, margin: '3vmin' }}>{atual.nome}</p>
          <p style={{ fontSize: '3vmin' }}>{atual.pontos}</p>
          {atual.posicao === 1 ? <p style={{ fontSize: '3vmin', marginTop: '2vmin' }}>A família celebra com você!</p> : null}
        </> : <><p style={{ fontSize: '12vmin', color: '#e6c98e' }}>{Math.max(1, Math.ceil((5000 - tempo % 14000) / 1000))}</p><p style={{ fontSize: '2.5vmin' }}>{atual.candidatos.join(' · ')}</p></>}
      </div>
    </> : <div><h2 style={{ font: '6vmin Georgia,serif' }}>A grande revelação</h2><p style={{ fontSize: '3vmin', marginTop: '3vmin' }}>{erro || (dados?.revelado ? 'Ainda não há resultados concluídos para revelar.' : 'Os resultados serão revelados quando a organização liberar.')}</p></div>}
  </section>;
}
