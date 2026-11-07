'use client';
import { useEffect, useRef, useState } from 'react';
import { cenaEm, progressoLinha, progressoPalavra, type Cena, type LinhaCantada } from './letra';
import styles from './karaoke.module.css';

const tamanhoDaLinha = (texto: string) => (texto.length <= 38 ? '7vmin' : texto.length <= 64 ? '6vmin' : '5vmin');

/** Posição de cada linha no palco: -1 anterior, 0 atual, 1 próxima; ±2 saindo ou entrando (invisíveis). */
function posicaoNoPalco(i: number, cena: Cena): number {
  if (cena.tipo === 'linha') return Math.max(-2, Math.min(2, i - cena.ant));
  return i <= cena.ant ? Math.max(-2, i - cena.ant - 1) : Math.min(2, i - cena.prox + 1);
}

/**
 * Letra no estilo karaokê: linha atual grande com preenchimento palavra a palavra, anterior e próxima esmaecidas.
 * lerMs devolve o instante da letra em ms (posição do vídeo já descontado o ajuste). O preenchimento roda em requestAnimationFrame
 * direto no DOM (variável --p de cada palavra); o React só renderiza quando a cena muda.
 */
export function LetraPalco({ linhas, lerMs }: { linhas: readonly LinhaCantada[]; lerMs: () => number }) {
  const palcoRef = useRef<HTMLDivElement>(null);
  const [cena, setCena] = useState<Cena>(() => cenaEm(linhas, lerMs()));

  useEffect(() => {
    let raf = 0;
    let chave = '';
    const passo = () => {
      const t = lerMs();
      const c = cenaEm(linhas, t);
      const nova = `${c.tipo}|${c.ant}|${c.pontos}`;
      if (nova !== chave) { chave = nova; setCena(c); }
      const palco = palcoRef.current;
      if (palco) {
        for (const el of palco.querySelectorAll<HTMLElement>('[data-i]')) {
          const linha = linhas[Number(el.dataset.i)];
          if (!linha) continue;
          const prog = progressoLinha(linha, t);
          const palavras = el.querySelectorAll<HTMLElement>('[data-w]');
          palavras.forEach((p, k) => {
            const v = Math.round(progressoPalavra(linha.faixas[k], prog) * 1000) / 1000;
            if (p.dataset.p !== String(v)) { p.dataset.p = String(v); p.style.setProperty('--p', String(v)); }
          });
        }
      }
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [linhas, lerMs]);

  const pivo = cena.tipo === 'linha' ? cena.ant : Math.min(cena.prox, linhas.length - 1);
  const visiveis = linhas.filter((l) => Math.abs(l.i - pivo) <= 3);

  return <div className={styles.palco} ref={palcoRef}>
    <div className={`${styles.pausa} ${cena.tipo === 'pausa' ? styles.pausaVisivel : ''}`} aria-hidden={cena.tipo !== 'pausa'}>
      <p className={styles.notas}>♪ ♪ ♪</p>
      {cena.prox < linhas.length ? <div className={styles.pontos}>
        {[0, 1, 2].map((k) => <span key={k} className={k < cena.pontos ? styles.pontoAceso : styles.pontoApagado} />)}
      </div> : null}
    </div>
    {visiveis.map((l) => {
      const pos = posicaoNoPalco(l.i, cena);
      return <div key={l.i} className={styles.linhaLetra} data-slot={pos} data-i={l.i} style={{ fontSize: tamanhoDaLinha(l.texto) }} aria-hidden={pos !== 0}>
        {l.palavras.map((p, k) => <span key={k}><span className={styles.palavra} data-w="">{p}</span>{k < l.palavras.length - 1 ? ' ' : ''}</span>)}
      </div>;
    })}
  </div>;
}
