'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/app/ui/client';

// Camada ao vivo do telão. Quem integra monta estes componentes dentro do <main> do telão.
// Não depende de tipos.ts: os outros arquivos do telão estão sendo editados em paralelo.

export type ReacaoAoVivo = { id: number; emoji: string };
export type RecadoAoVivo = { id: number; nome: string; texto: string };
export type PendenteAoVivo = { id: number; nome: string; texto: string };

export type RespostaAoVivo = {
  reacoes: ReacaoAoVivo[];
  recados: RecadoAoVivo[];
  pendentes?: PendenteAoVivo[];
};

export type AoVivoEstado = {
  reacoes: ReacaoAoVivo[];
  recados: RecadoAoVivo[];
  pendentes: PendenteAoVivo[];
  erro: string;
};

const CSS_REACOES = `
.aovivo-reacoes { position: absolute; inset: 0; z-index: 6; overflow: hidden; pointer-events: none; }
.aovivo-emoji {
  position: absolute; bottom: 2vmin; font-size: 12vmin; line-height: 1;
  animation-name: aovivo-sobe; animation-timing-function: linear; animation-fill-mode: both;
  will-change: transform, opacity;
  filter: drop-shadow(0 0.8vmin 1.4vmin rgba(0, 0, 0, 0.45));
}
@keyframes aovivo-sobe {
  0% { opacity: 0; transform: translate3d(0, 10vmin, 0) scale(0.55); }
  12% { opacity: 1; transform: translate3d(var(--zig), -6vmin, 0) scale(1); }
  38% { opacity: 1; transform: translate3d(calc(var(--zig) * -0.85), -34vmin, 0) scale(1); }
  68% { opacity: 1; transform: translate3d(calc(var(--zig) * 0.7), -64vmin, 0) scale(1); }
  100% { opacity: 0; transform: translate3d(calc(var(--zig) * -0.35), -98vmin, 0) scale(0.92); }
}
@media (prefers-reduced-motion: reduce) {
  .aovivo-emoji { animation-duration: 1.2s !important; animation-delay: 0s !important; }
  @keyframes aovivo-sobe {
    0% { opacity: 0; transform: none; }
    25% { opacity: 1; transform: none; }
    100% { opacity: 0; transform: none; }
  }
}
`;

const CSS_RECADO = `
.aovivo-recado-camada { position: absolute; inset: 0; z-index: 7; overflow: hidden; pointer-events: none; }
.aovivo-recado {
  position: absolute; left: 4.5vmin; bottom: 8vmin; width: min(68vw, calc(100% - 32vmin));
  display: flex; flex-direction: column; gap: 1.1vmin; padding: 2.8vmin 3.4vmin;
  border-radius: 2.4vmin; background: rgba(29, 34, 31, 0.94);
  border: 0.28vmin solid rgba(191, 165, 119, 0.72);
  box-shadow: 0 2vmin 6vmin rgba(0, 0, 0, 0.45);
}
.aovivo-recado-entra { animation: aovivo-recado-entra 0.8s cubic-bezier(0.22, 1, 0.36, 1) both; }
.aovivo-recado-sai { animation: aovivo-recado-sai 0.8s ease both; }
.aovivo-recado-kicker {
  font-size: 1.9vmin; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: #c5292d;
}
.aovivo-recado-nome {
  font-size: 2.4vmin; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #bfa577;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.aovivo-recado-texto {
  font-family: var(--font-bodoni), "Bodoni Moda", Georgia, serif; font-weight: 700;
  font-size: 4.8vmin; line-height: 1.18; color: #f3ebdc; text-wrap: balance;
}
@keyframes aovivo-recado-entra {
  from { opacity: 0; transform: translateX(-110%); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes aovivo-recado-sai {
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(-110%); }
}
@media (orientation: portrait) {
  .aovivo-recado { bottom: 26vmin; width: min(90vw, calc(100% - 10vmin)); }
}
@media (prefers-reduced-motion: reduce) {
  .aovivo-recado-entra, .aovivo-recado-sai { animation-duration: 0.6s; }
}
`;

function mesmaLista<T extends { id: number }>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((item, i) => item.id === b[i].id);
}

const LIMITE_VISTOS = 500;
const TIMEOUT_AO_VIVO_MS = 8000;

/** A noite inteira enche o conjunto. Passou do limite, esvazia: o cursor `desde` não manda de novo o que já subiu. */
function esvaziarSePassou(ids: Set<number>) {
  if (ids.size > LIMITE_VISTOS) ids.clear();
}

/** Consulta /api/telao/ao-vivo a cada 2 s. `reacoes` é só o lote novo (id > desde). */
export function useAoVivo(): AoVivoEstado {
  const desde = useRef(0);
  const pedido = useRef(0);
  const aplicado = useRef(0);
  const [reacoes, setReacoes] = useState<ReacaoAoVivo[]>([]);
  const [recados, setRecados] = useState<RecadoAoVivo[]>([]);
  const [pendentes, setPendentes] = useState<PendenteAoVivo[]>([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    let lendo = false;
    const ctl = new AbortController();
    const ler = async () => {
      if (!vivo || lendo) return;
      lendo = true;
      const meu = ++pedido.current;
      try {
        const data = await api<RespostaAoVivo>(`/api/telao/ao-vivo?desde=${desde.current}`, { signal: ctl.signal, timeoutMs: TIMEOUT_AO_VIVO_MS });
        if (!vivo || meu < aplicado.current) return;
        aplicado.current = meu;
        const novas = data.reacoes ?? [];
        const maior = novas.reduce((max, r) => Math.max(max, r.id), desde.current);
        desde.current = maior;
        setReacoes((atual) => (mesmaLista(atual, novas) ? atual : novas));
        const listaRecados = data.recados ?? [];
        setRecados((atual) => (mesmaLista(atual, listaRecados) ? atual : listaRecados));
        const listaPendentes = data.pendentes ?? [];
        setPendentes((atual) => (mesmaLista(atual, listaPendentes) ? atual : listaPendentes));
        setErro('');
      } catch (err) {
        if (!vivo || meu !== pedido.current) return;
        setErro((err as Error).message);
      } finally { lendo = false; }
    };
    const primeira = window.setTimeout(() => void ler(), 0);
    const timer = window.setInterval(() => void ler(), 2000);
    return () => {
      vivo = false;
      ctl.abort();
      window.clearTimeout(primeira);
      window.clearInterval(timer);
    };
  }, []);

  return { reacoes, recados, pendentes, erro };
}

type EmojiAtivo = ReacaoAoVivo & { x: number; zig: number; dur: number; atraso: number };

export function ReacoesFlutuantes({ reacoes }: { reacoes: ReacaoAoVivo[] }) {
  const vistas = useRef<Set<number>>(new Set());
  const timers = useRef<number[]>([]);
  const [ativas, setAtivas] = useState<EmojiAtivo[]>([]);

  useEffect(() => {
    const h = window.setTimeout(() => {
      esvaziarSePassou(vistas.current);
      const novas: EmojiAtivo[] = [];
      for (const r of reacoes) {
        if (!Number.isInteger(r.id) || vistas.current.has(r.id)) continue;
        vistas.current.add(r.id);
        novas.push({
          ...r,
          x: 6 + Math.random() * 56,
          zig: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 6),
          dur: 4.4 + Math.random() * 1.2,
          atraso: Math.min(novas.length * 0.12, 1.2),
        });
      }
      if (!novas.length) return;
      setAtivas((xs) => [...xs, ...novas].slice(-40));
      for (const r of novas) {
        const t = window.setTimeout(() => {
          setAtivas((xs) => xs.filter((a) => a.id !== r.id));
        }, (r.atraso + r.dur) * 1000 + 400);
        timers.current.push(t);
      }
    }, 0);
    return () => window.clearTimeout(h);
  }, [reacoes]);

  useEffect(() => () => {
    timers.current.forEach((h) => window.clearTimeout(h));
    timers.current = [];
  }, []);

  return <div className="aovivo-reacoes" aria-hidden="true">
    <style>{CSS_REACOES}</style>
    {ativas.map((r) => <span
      key={r.id}
      className="aovivo-emoji"
      style={{ left: `${r.x}%`, animationDuration: `${r.dur}s`, animationDelay: `${r.atraso}s`, ['--zig' as string]: `${r.zig}vmin` }}
      onAnimationEnd={() => setAtivas((xs) => xs.filter((a) => a.id !== r.id))}
    >{r.emoji}</span>)}
  </div>;
}

function normalizarRecados(recado: RecadoAoVivo | RecadoAoVivo[] | null): RecadoAoVivo[] {
  if (!recado) return [];
  return Array.isArray(recado) ? recado : [recado];
}

/** Balão único. `recado` pode ser o item novo ou a lista inteira do hook: a fila mostra um por vez, 10 s. */
export function RecadoVivo({ recado }: { recado: RecadoAoVivo | RecadoAoVivo[] | null }) {
  const vistos = useRef<Set<number>>(new Set());
  const [fila, setFila] = useState<RecadoAoVivo[]>([]);
  const [saindo, setSaindo] = useState(false);
  const atual = fila[0] ?? null;

  useEffect(() => {
    const lista = normalizarRecados(recado);
    const h = window.setTimeout(() => {
      esvaziarSePassou(vistos.current);
      const novos: RecadoAoVivo[] = [];
      for (const item of lista) {
        if (!Number.isInteger(item.id) || vistos.current.has(item.id)) continue;
        vistos.current.add(item.id);
        novos.push(item);
      }
      if (!novos.length) return;
      setFila((f) => {
        if (f.length === 0) return novos.slice(-8);
        const cauda = [...f.slice(1), ...novos].slice(-7);
        return [f[0], ...cauda];
      });
    }, 0);
    return () => window.clearTimeout(h);
  }, [recado]);

  useEffect(() => {
    if (!atual || saindo) return;
    const t = window.setTimeout(() => setSaindo(true), 10_000);
    return () => window.clearTimeout(t);
  }, [atual, saindo]);

  useEffect(() => {
    if (!saindo) return;
    const t = window.setTimeout(() => {
      setSaindo(false);
      setFila((f) => f.slice(1));
    }, 900);
    return () => window.clearTimeout(t);
  }, [saindo]);

  return <div className="aovivo-recado-camada">
    <style>{CSS_RECADO}</style>
    {atual && <aside key={atual.id} className={saindo ? 'aovivo-recado aovivo-recado-sai' : 'aovivo-recado aovivo-recado-entra'} role="status" aria-live="polite">
      <p className="aovivo-recado-kicker">Recado ao vivo</p>
      <p className="aovivo-recado-nome">{atual.nome}</p>
      <p className="aovivo-recado-texto">{atual.texto}</p>
    </aside>}
  </div>;
}
