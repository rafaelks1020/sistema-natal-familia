'use client';
/* eslint-disable @next/next/no-img-element */

import { thumb } from '@/app/ui/client';
import styles from './cenas.module.css';

export interface FotoOficialTelao {
  ano: number;
  url: string;
  legenda: string | null;
}

export interface LinhaDoTempoCenaProps {
  fotos: FotoOficialTelao[];
  agora: number;
}

const PASSO_MS = 6500;

export function LinhaDoTempoCena({ fotos, agora }: LinhaDoTempoCenaProps) {
  const ordenadas = [...fotos].sort((a, b) => a.ano - b.ano);
  const total = ordenadas.length;
  const indiceAtivo = total > 0 ? Math.floor(Math.max(0, agora) / PASSO_MS) % total : 0;
  const deslocamentoVmin = total > 2 ? Math.max(0, indiceAtivo - 1) * 60 : 0;

  return (
    <div className={`${styles.cena} ${styles.linhaCena}`}>
      <header className={styles.linhaCabecalho}>
        <p className={styles.kicker}>Nossa história</p>
        <h2 className={styles.titulo}>Natal através dos anos</h2>
      </header>

      {total === 0 ? (
        <p className={styles.subtitulo}>As fotos oficiais de cada edição aparecerão nesta linha do tempo.</p>
      ) : (
        <div className={styles.linhaJanela}>
          <div
            className={styles.linhaTrilho}
            style={{ transform: `translateX(-${deslocamentoVmin}vmin)` }}
          >
            {ordenadas.map((foto, idx) => {
              const ativo = idx === indiceAtivo;
              return (
                <article
                  key={`${foto.ano}-${idx}`}
                  className={`${styles.linhaCard} ${ativo ? styles.linhaCardAtivo : ''}`}
                >
                  <div className={styles.linhaFotoMoldura}>
                    <img
                      src={thumb(foto.url, 1080, 80)}
                      alt={foto.legenda || `Foto oficial de ${foto.ano}`}
                      className={styles.linhaFoto}
                    />
                  </div>
                  <div className={styles.linhaAno}>{foto.ano}</div>
                  {foto.legenda && <p className={styles.linhaLegenda}>{foto.legenda}</p>}
                </article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default LinhaDoTempoCena;
