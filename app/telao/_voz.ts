'use client';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

// Reconhecimento e fala do navegador (Web Speech API). Sem suporte, o recurso some sem erro.

const semAssinatura = () => () => {};
const detectar = () => typeof window !== 'undefined' && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

const FEMININAS = /francisca|luciana|maria|fernanda|vit[oó]ria|camila|thalita|raquel|google portugu[eê]s do brasil|feminina|female/i;

function escolherVoz(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null;
  const vozes = speechSynthesis.getVoices();
  const br = vozes.filter((v) => /^pt[-_]BR$/i.test(v.lang));
  return br.find((v) => FEMININAS.test(v.name)) ?? br[0] ?? vozes.find((v) => /^pt/i.test(v.lang)) ?? null;
}

export function useVoz(aoOuvir: (alternativas: string[]) => void) {
  const suportado = useSyncExternalStore(semAssinatura, detectar, () => false);
  const [ativa, setAtiva] = useState(false);
  const [erro, setErro] = useState('');
  const queroRef = useRef(false);
  const recRef = useRef<any>(null);
  const ignorarAteRef = useRef(0);
  const falhasRef = useRef(0);
  const iniciouEmRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aoOuvirRef = useRef(aoOuvir);
  const iniciarRef = useRef<() => void>(() => {});
  useEffect(() => { aoOuvirRef.current = aoOuvir; }, [aoOuvir]);

  const falar = useCallback((texto: string) => {
    if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'pt-BR';
      u.rate = 1;
      u.pitch = 1.05;
      const voz = escolherVoz();
      if (voz) u.voice = voz;
      // O microfone não pode ouvir a própria resposta.
      ignorarAteRef.current = Date.now() + texto.length * 90 + 2000; // teto, caso o navegador não avise o fim da fala
      u.onend = u.onerror = () => { ignorarAteRef.current = Date.now() + 900; };
      speechSynthesis.speak(u);
    } catch {
      ignorarAteRef.current = Date.now() + 900;
    }
  }, []);

  const iniciar = useCallback(() => {
    if (!queroRef.current) return;
    const Reconhecedor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Reconhecedor) return;
    const rec = new Reconhecedor();
    rec.lang = 'pt-BR';
    rec.continuous = true;
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    rec.onresult = (e: any) => {
      falhasRef.current = 0;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal || Date.now() < ignorarAteRef.current) continue;
        const alternativas: string[] = [];
        for (let k = 0; k < e.results[i].length; k++) alternativas.push(String(e.results[i][k].transcript));
        aoOuvirRef.current(alternativas);
      }
    };
    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        queroRef.current = false; setAtiva(false);
        setErro('O microfone está bloqueado neste navegador.');
      } else if (e.error === 'audio-capture') {
        queroRef.current = false; setAtiva(false);
        setErro('Nenhum microfone encontrado.');
      }
    };
    rec.onend = () => {
      recRef.current = null;
      if (!queroRef.current) return;
      // Reinicia sozinho (o navegador encerra a escuta de tempos em tempos); se falhar logo, espera mais.
      falhasRef.current = Date.now() - iniciouEmRef.current < 1500 ? falhasRef.current + 1 : 0;
      const espera = Math.min(8000, 350 * 2 ** Math.min(falhasRef.current, 5));
      timerRef.current = setTimeout(() => iniciarRef.current(), espera);
    };
    recRef.current = rec;
    iniciouEmRef.current = Date.now();
    try { rec.start(); } catch { /* já estava iniciado */ }
  }, []);

  useEffect(() => { iniciarRef.current = iniciar; }, [iniciar]);

  const ativar = useCallback(() => {
    if (queroRef.current) return;
    queroRef.current = true;
    setErro('');
    setAtiva(true);
    iniciar();
  }, [iniciar]);

  const desativar = useCallback(() => {
    queroRef.current = false;
    setAtiva(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    try { recRef.current?.abort(); } catch { /* sem escuta ativa */ }
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }, []);

  useEffect(() => () => {
    queroRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    try { recRef.current?.abort(); } catch { /* sem escuta ativa */ }
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }, []);

  return { suportado, ativa, erro, ativar, desativar, falar };
}
