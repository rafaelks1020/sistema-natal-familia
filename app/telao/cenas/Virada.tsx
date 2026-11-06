'use client';

import { useEffect, useRef } from 'react';
import { Confete } from '../_confete';
import styles from './cenas.module.css';

export interface ViradaCenaProps {
  agora: number;
  meiaNoite: string;
  nomes: string[];
}

const dois = (n: number) => String(n).padStart(2, '0');

function tocarSino() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const t0 = ctx.currentTime;
    const notas = [523.25, 659.25, 783.99, 1046.5];
    notas.forEach((freq, i) => {
      const inicio = t0 + i * 0.18;
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, inicio);
      ganho.gain.setValueAtTime(0.0001, inicio);
      ganho.gain.exponentialRampToValueAtTime(0.18, inicio + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + 1.1);
      osc.connect(ganho);
      ganho.connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + 1.15);
    });
    setTimeout(() => { void ctx.close().catch(() => undefined); }, 2200);
  } catch {
    // Sem suporte ou bloqueio de áudio pelo navegador: segue silencioso.
  }
}

export function ViradaCena({ agora, meiaNoite, nomes }: ViradaCenaProps) {
  const alvo = Date.parse(meiaNoite);
  const resto = Number.isFinite(alvo) ? alvo - agora : 0;
  const zerou = resto <= 0;
  const tocouRef = useRef(false);

  useEffect(() => {
    if (zerou && !tocouRef.current) {
      tocouRef.current = true;
      tocarSino();
    } else if (!zerou) {
      tocouRef.current = false;
    }
  }, [zerou]);

  if (zerou) {
    const lista = nomes.length ? [...nomes, ...nomes] : [];
    return (
      <div className={styles.cena}>
        <Confete modo="explosao" />
        <div className={styles.viradaFesta}>
          <p className={styles.kicker}>Meia-noite em família</p>
          <h2 className={styles.felizNatalGigante}>Feliz Natal!</h2>
          <p className={styles.subtitulo}>Que a paz e a alegria desta noite fiquem com todos nós.</p>
          {lista.length > 0 && (
            <div className={styles.nomesFaixa} aria-label="Pessoas presentes na celebração">
              <div className={styles.nomesTrilho}>
                {lista.map((nome, idx) => (
                  <span key={`${nome}-${idx}`} className={styles.nomeTag}>{nome}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (resto <= 10_000) {
    const seg = Math.max(1, Math.ceil(resto / 1000));
    return (
      <div className={styles.cena}>
        <p className={styles.kicker}>Prepare o abraço</p>
        <div key={seg} className={styles.viradaDez} role="timer" aria-live="assertive">
          {seg}
        </div>
      </div>
    );
  }

  const totalSeg = Math.max(0, Math.floor(resto / 1000));
  const hh = dois(Math.floor(totalSeg / 3600));
  const mm = dois(Math.floor((totalSeg % 3600) / 60));
  const ss = dois(totalSeg % 60);

  return (
    <div className={styles.cena}>
      <div className={styles.viradaAntes}>
        <p className={styles.kicker}>Contagem da virada</p>
        <h2 className={styles.titulo}>Faltam {hh}:{mm}:{ss} para a meia-noite</h2>
        <div className={styles.viradaRelogio} role="timer">
          {hh}:{mm}:{ss}
        </div>
      </div>
    </div>
  );
}

export default ViradaCena;
