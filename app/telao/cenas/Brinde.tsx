'use client';

import { Wine } from 'lucide-react';
import { Confete } from '../_confete';
import styles from './cenas.module.css';

export interface BrindeCenaProps {
  frase: string;
  inicio: number;
  agora: number;
}

export function BrindeCena({ frase, inicio, agora }: BrindeCenaProps) {
  const decorridoSeg = inicio > 0 ? Math.max(0, Math.floor((agora - inicio) / 1000)) : 3;
  const contagem = decorridoSeg < 3 ? 3 - decorridoSeg : 0;
  const textoFrase = frase.trim() || 'Que a nossa família esteja sempre unida com amor e alegria!';

  return (
    <div className={`${styles.cena} ${styles.brindeCena}`}>
      {contagem === 0 && <Confete modo="explosao" />}
      <p className={styles.kicker}>Levantem as taças</p>
      <h2 className={styles.titulo}>Hora do brinde</h2>
      <p className={styles.brindeFrase}>&ldquo;{textoFrase}&rdquo;</p>

      {contagem > 0 ? (
        <div key={contagem} className={styles.brindeNumero} role="timer" aria-live="assertive">
          {contagem}
        </div>
      ) : (
        <div className={styles.brindeSaudeBox}>
          <div className={styles.brindeTacas} aria-hidden="true">
            <Wine className={styles.tacaEsq} strokeWidth={1.6} />
            <Wine className={styles.tacaDir} strokeWidth={1.6} />
          </div>
          <p className={styles.brindeSaude}>Saúde!</p>
        </div>
      )}
    </div>
  );
}

export default BrindeCena;
