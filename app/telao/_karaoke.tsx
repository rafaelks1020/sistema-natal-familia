'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react';
import { Music2 } from 'lucide-react';
import { api } from '@/app/ui/client';
import styles from './spotify.module.css';

type Linha = { ms: number; texto: string };

/** Quanto antes da marca a linha já aparece, para a leitura acompanhar o canto. */
const ANTECIPA_MS = 250;

/** Cena de karaokê: letra sincronizada (LRCLIB) com a linha atual grande. Sem letra, mostra a capa grande. */
export function KaraokeCena({ nome, artista, capa, posicaoMs, duracaoMs }: {
  nome: string; artista: string; capa: string | null; posicaoMs: number; duracaoMs: number;
}) {
  const chave = `${nome}|${artista}|${duracaoMs}`;
  const [dados, setDados] = useState<{ chave: string; linhas: Linha[] } | null>(null);

  useEffect(() => {
    let cancelado = false;
    const q = new URLSearchParams({ nome, artista, duracao_ms: String(Math.round(duracaoMs)) });
    api<{ linhas: Linha[] }>(`/api/telao/letra?${q}`)
      .then((r) => { if (!cancelado) setDados({ chave, linhas: Array.isArray(r.linhas) ? r.linhas : [] }); })
      .catch(() => { if (!cancelado) setDados({ chave, linhas: [] }); });
    return () => { cancelado = true; };
  }, [chave, nome, artista, duracaoMs]);

  const linhas = dados?.chave === chave ? dados.linhas : [];
  const fundo = capa ? { backgroundImage: `url("${capa}")` } : undefined;

  if (!linhas.length) {
    return <div className={styles.kara}>
      <div className={styles.kFundo} style={fundo} />
      <div className={styles.kVeu} />
      <div className={styles.kSemLetra}>
        <div className={styles.kCapaBox}>{capa ? <img src={capa} alt="" className={styles.kCapa} /> : <Music2 size="16vmin" aria-hidden="true" />}</div>
        <div className={styles.kTexto}>
          <p className={styles.kNome}>{nome}</p>
          <p className={styles.kArtista}>{artista}</p>
        </div>
      </div>
    </div>;
  }

  const alvo = posicaoMs + ANTECIPA_MS;
  let idx = -1;
  for (let i = 0; i < linhas.length && linhas[i].ms <= alvo; i++) idx = i;
  // Antes da primeira linha (introdução) ou em trecho instrumental (linha vazia), a linha grande é só um ♪.
  const visiveis: { k: string; texto: string; atual: boolean }[] = [];
  for (let j = idx - 1; j <= idx + 1; j++) {
    if (j < 0 && idx >= 0) continue;
    if (j >= linhas.length) continue;
    if (j === -1) { visiveis.push({ k: 'intro', texto: '♪', atual: true }); continue; }
    const texto = linhas[j].texto || (j === idx ? '♪' : '');
    if (texto) visiveis.push({ k: String(j), texto, atual: j === idx });
  }

  return <div className={styles.kara}>
    <div className={styles.kFundo} style={fundo} />
    <div className={styles.kVeu} />
    <div className={styles.kLetra} aria-live="off">
      {visiveis.map((l) => <p key={l.k} className={`${styles.kLinha} ${l.atual ? styles.kAtual : styles.kVizinha}`}>{l.texto}</p>)}
    </div>
    <div className={styles.kRodape}>
      {capa && <img src={capa} alt="" className={styles.kRodapeCapa} />}
      <div style={{ minWidth: 0 }}>
        <p className={styles.kRodapeNome}>{nome}</p>
        <p className={styles.kRodapeArtista}>{artista}</p>
      </div>
    </div>
  </div>;
}
