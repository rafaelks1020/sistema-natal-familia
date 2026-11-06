'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { PlateiaEnergia } from './pontuacao';
import { tocarAplauso } from './_aplauso';
import styles from './karaoke.module.css';

const ALTO = 0.8;
const ALTO_SAI = 0.7;
const BAIXO = 0.2;
const BAIXO_SAI = 0.3;
const PAUSA_APLAUSO_MS = 15000;

/**
 * Medidor de plateia na lateral esquerda: a barra sobe com acertos e cai com silêncio e erros.
 * Acima de 80% toca um aplauso curto (WebAudio) e mostra "A família tá amando!"; abaixo de 20% chama a voz de volta.
 * ativo: só avalia as mensagens (e o aplauso) com o microfone ligado.
 */
export function MedidorPlateia({ plateia, ativo }: { plateia: RefObject<PlateiaEnergia>; ativo: () => boolean }) {
  const cheioRef = useRef<HTMLDivElement>(null);
  const [humor, setHumor] = useState<'alto' | 'baixo' | null>(null);

  useEffect(() => {
    let raf = 0;
    let estado: 'alto' | 'baixo' | null = null;
    let ultimoAplauso = 0;
    const passo = () => {
      raf = requestAnimationFrame(passo);
      const n = plateia.current.nivel;
      const el = cheioRef.current;
      if (el) el.style.transform = `scaleY(${n.toFixed(3)})`;
      let novo = estado;
      if (!ativo()) novo = null;
      else if (n > ALTO) novo = 'alto';
      else if (n < BAIXO) novo = 'baixo';
      else if (estado === 'alto' && n < ALTO_SAI) novo = null;
      else if (estado === 'baixo' && n > BAIXO_SAI) novo = null;
      if (novo !== estado) {
        if (novo === 'alto' && performance.now() - ultimoAplauso > PAUSA_APLAUSO_MS) { ultimoAplauso = performance.now(); tocarAplauso(); }
        estado = novo;
        setHumor(novo);
      }
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [plateia, ativo]);

  return <div className={styles.plateia} aria-label="Energia da plateia">
    <p className={styles.plateiaTitulo}>Plateia</p>
    <div className={`${styles.plateiaTrilho} ${humor === 'alto' ? styles.plateiaAlta : ''}`}><div ref={cheioRef} className={styles.plateiaCheio} /></div>
    <p className={`${styles.plateiaMsg} ${humor ? styles.plateiaMsgVisivel : ''}`} role="status">
      {humor === 'alto' ? 'A família tá amando!' : humor === 'baixo' ? 'Bora, solta a voz!' : ''}
    </p>
  </div>;
}
