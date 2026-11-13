'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Intervalo = number | (() => number);

/**
 * Polling de tela ao vivo: uma requisição por vez, pausa com a aba oculta e recarrega na hora
 * ao voltar. `carregar` recebe `obsoleta()` (true se alguma escrita da própria pessoa começou ou
 * terminou depois que esta leitura saiu: nesse caso descarte a resposta). Depois de 3 falhas
 * seguidas `semConexao` fica true, e volta a false no primeiro sucesso.
 */
export function usePolling(
  carregar: (obsoleta: () => boolean) => Promise<void>,
  intervalo: Intervalo,
) {
  const [semConexao, setSemConexao] = useState(false);
  const carregarRef = useRef(carregar);
  const intervaloRef = useRef(intervalo);
  const seqEscrita = useRef(0);
  const falhas = useRef(0);
  const emVoo = useRef(false);

  useEffect(() => {
    carregarRef.current = carregar;
    intervaloRef.current = intervalo;
  });

  const rodar = useCallback(async () => {
    if (emVoo.current) return;
    emVoo.current = true;
    const inicio = seqEscrita.current;
    try {
      await carregarRef.current(() => seqEscrita.current !== inicio);
      falhas.current = 0;
      setSemConexao(false);
    } catch {
      falhas.current += 1;
      if (falhas.current >= 3) setSemConexao(true);
    } finally {
      emVoo.current = false;
    }
  }, []);

  /** Envolva POST/PUT da própria pessoa: leituras que saíram antes são descartadas. */
  const escrita = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    seqEscrita.current += 1;
    try {
      return await fn();
    } finally {
      seqEscrita.current += 1;
    }
  }, []);

  useEffect(() => {
    let parado = false;
    let timer: number | undefined;

    const agendar = () => {
      window.clearTimeout(timer);
      if (parado || document.hidden) return;
      const atual = intervaloRef.current;
      const ms = typeof atual === 'function' ? atual() : atual;
      timer = window.setTimeout(() => {
        void rodar().then(agendar);
      }, ms);
    };

    const aoMudarVisibilidade = () => {
      if (document.hidden) {
        window.clearTimeout(timer);
        return;
      }
      void rodar().then(agendar);
    };

    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    agendar();
    return () => {
      parado = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    };
  }, [rodar]);

  return { semConexao, escrita };
}

/** Aviso discreto e fixo (não é toast): some sozinho quando a conexão volta. */
export function AvisoSemConexao({ visivel }: { visivel: boolean }) {
  if (!visivel) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-[80] flex justify-center px-4"
    >
      <p className="surface px-4 py-2 text-xs text-marfim-2">Sem conexão. Tentando de novo...</p>
    </div>
  );
}
