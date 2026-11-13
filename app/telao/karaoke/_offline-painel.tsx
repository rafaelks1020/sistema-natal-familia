'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { assinarDownload, estadoCache, formatarTamanho, iniciarDownload, lerDownload, lerDownloadServidor, limparCache } from './_offline';
import styles from './_offline.module.css';

/** Baixa o catálogo pronto para o telão tocar sem internet. O download vive em _offline.ts: fechar o painel não o interrompe. */
export function PainelOffline({ className, limparBloqueado = false }: { className?: string; limparBloqueado?: boolean }) {
  const [musicas, setMusicas] = useState(0);
  const [total, setTotal] = useState(0);
  const [bytes, setBytes] = useState(0);
  const [limpando, setLimpando] = useState(false);
  const [visto, setVisto] = useState(false);
  const [erroLocal, setErroLocal] = useState('');
  const dl = useSyncExternalStore(assinarDownload, lerDownload, lerDownloadServidor);
  const baixando = dl.baixando;
  const eraBaixando = useRef(baixando);

  const atualizar = useCallback(async () => {
    const e = await estadoCache();
    setMusicas(e.musicas);
    setTotal(e.total);
    setBytes(e.bytes);
    setVisto(true);
  }, []);

  useEffect(() => {
    let vivo = true;
    void estadoCache().then((e) => {
      if (!vivo) return;
      setMusicas(e.musicas);
      setTotal(e.total);
      setBytes(e.bytes);
      setVisto(true);
    }).catch(() => { if (vivo) setVisto(true); });
    return () => { vivo = false; };
  }, []);

  // Quando o download termina (com o painel aberto), relê o que ficou salvo.
  useEffect(() => assinarDownload(() => {
    const agora = lerDownload().baixando;
    if (eraBaixando.current && !agora) void atualizar().catch(() => undefined);
    eraBaixando.current = agora;
  }), [atualizar]);

  const baixar = () => {
    if (baixando || limpando) return;
    setErroLocal('');
    iniciarDownload();
  };

  const limpar = () => {
    if (limpando || limparBloqueado) return;
    setErroLocal('');
    setLimpando(true);
    void limparCache()
      .then(() => atualizar())
      .catch((e: unknown) => {
        setErroLocal(e instanceof Error ? e.message : 'Não consegui limpar as músicas salvas.');
      })
      .finally(() => setLimpando(false));
  };

  const feitos = baixando ? dl.feitos : musicas;
  const totalMostrado = baixando ? dl.total : total;
  const bytesMostrado = baixando ? dl.bytes : bytes;
  const erro = erroLocal || dl.erro;
  const pct = totalMostrado > 0 ? Math.min(1, Math.max(0, feitos / totalMostrado)) : 0;
  const classe = className ? `${styles.painel} ${className}` : styles.painel;

  return (
    <section className={classe} aria-label="Músicas sem internet">
      <h3>Sem internet</h3>
      <p className={styles.contagem}>
        {visto || baixando ? `${feitos} de ${totalMostrado} prontas para tocar offline` : 'Vendo o que já está salvo...'}
      </p>
      <p className={styles.tamanho}>{formatarTamanho(bytesMostrado)}</p>
      <div
        className={styles.barra}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct * 100)}
        aria-label="Progresso do download"
      >
        <div className={styles.barraCheia} style={{ transform: `scaleX(${pct})` }} />
      </div>
      <div className={styles.acoes}>
        <button type="button" className={styles.principal} onClick={baixar} disabled={baixando || limpando}>
          {baixando ? 'Baixando...' : dl.erro ? 'Tentar de novo' : 'Baixar músicas para usar sem internet'}
        </button>
        <button
          type="button"
          className={styles.botao}
          onClick={limpar}
          disabled={limpando || limparBloqueado || (!baixando && musicas === 0 && bytes === 0)}
          title={limparBloqueado ? 'Espere a música terminar para limpar' : 'Apagar as músicas salvas neste aparelho'}
        >
          {limpando ? 'Limpando...' : 'Limpar'}
        </button>
      </div>
      {baixando ? <p className={styles.tamanho}>O download continua mesmo com este painel fechado.</p> : null}
      {erro ? <p className={styles.erro} role="alert">{erro}</p> : null}
    </section>
  );
}
