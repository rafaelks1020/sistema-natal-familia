'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Megaphone, Pause, Play, RotateCw } from 'lucide-react';
import { api } from '@/app/ui/client';
import { CENAS, NOMES_CENA, type Cena, type EstadoTelao } from '../tipos';

// Controle remoto do telão, pelo celular de quem organiza. Visual Meia-Noite, uma mão só.
type Acao = { acao: 'cena'; cena: Cena | null } | { acao: 'pausar' } | { acao: 'continuar' } | { acao: 'proxima' } | { acao: 'anterior' } | { acao: 'aviso'; texto: string };

export default function ControleClient() {
  const [estado, setEstado] = useState<EstadoTelao | null>(null);
  const [texto, setTexto] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const ler = useCallback(async () => {
    try { setEstado(await api<EstadoTelao>('/api/telao/estado')); } catch (e) { setMsg((e as Error).message); }
  }, []);

  useEffect(() => {
    const primeira = setTimeout(() => void ler(), 0);
    const t = setInterval(() => void ler(), 4000);
    return () => { clearTimeout(primeira); clearInterval(t); };
  }, [ler]);

  async function enviar(corpo: Acao, ok = '') {
    if (busy) return;
    setBusy(true);
    setMsg('');
    try {
      await api('/api/telao/controle', { method: 'POST', json: corpo });
      if (ok) setMsg(ok);
      await ler();
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  }

  const fixa = estado?.controle.cena_fixa ?? null;
  const pausado = estado?.controle.pausado ?? false;
  const jogo = estado?.jogo;

  return <main className="mx-auto min-h-dvh max-w-lg px-5 pb-12 pt-[calc(env(safe-area-inset-top)+20px)]">
    <header className="rise pb-6">
      <Link href="/festa" className="mb-3 -ml-1 inline-flex items-center gap-1 text-sm text-marfim-2"><ChevronLeft size={18} strokeWidth={1.5} /> Voltar</Link>
      <p className="kicker mb-2">Telão da TV</p>
      <h1 className="display text-[2.4rem] font-bold">Controle remoto</h1>
      <p className="mt-2 text-sm text-marfim-2">
        {estado ? <>No ar: {fixa ? <b className="text-champagne">{NOMES_CENA[fixa]} (fixa)</b> : 'ciclo automático'}{pausado ? ', pausado' : ''}.{jogo ? ' Um jogo ao vivo está na tela.' : ''}</> : 'Lendo o telão...'}
      </p>
    </header>

    <section className="surface mb-4 p-4" aria-label="Navegação">
      <p className="kicker mb-3">Navegar</p>
      <div className="grid grid-cols-3 gap-2">
        <button className="btn btn-ghost" disabled={busy} onClick={() => void enviar({ acao: 'anterior' })}><ChevronLeft size={18} /> Voltar</button>
        <button className="btn btn-ghost" disabled={busy} onClick={() => void enviar({ acao: pausado ? 'continuar' : 'pausar' })}>{pausado ? <><Play size={18} /> Seguir</> : <><Pause size={18} /> Pausar</>}</button>
        <button className="btn btn-ghost" disabled={busy} onClick={() => void enviar({ acao: 'proxima' })}>Próxima <ChevronRight size={18} /></button>
      </div>
    </section>

    <section className="surface mb-4 p-4" aria-label="Cenas">
      <p className="kicker mb-3">Fixar uma cena</p>
      <div className="grid gap-2">
        {CENAS.map((c) => <button key={c} disabled={busy} onClick={() => void enviar({ acao: 'cena', cena: c })}
          className={`btn min-h-14 justify-between px-5 ${fixa === c ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={fixa === c}>
          <span>{NOMES_CENA[c]}</span>{fixa === c && <span className="text-xs uppercase tracking-widest">no ar</span>}
        </button>)}
        <button disabled={busy || !fixa} onClick={() => void enviar({ acao: 'cena', cena: null })} className="btn btn-quiet min-h-12 justify-between px-5">
          <span>Voltar ao ciclo automático</span><RotateCw size={16} />
        </button>
      </div>
      <p className="mt-3 text-xs text-marfim-3">Jogos ao vivo (quiz, enquete, bingo, amigo oculto) passam na frente de qualquer cena.</p>
    </section>

    <section className="surface p-4" aria-label="Aviso">
      <p className="kicker mb-3">Mostrar aviso na TV</p>
      <form onSubmit={(ev) => { ev.preventDefault(); const t = texto.trim(); if (t) void enviar({ acao: 'aviso', texto: t }, 'Aviso enviado. Fica 15 segundos na TV.').then(() => setTexto('')); }}>
        <label className="block text-sm text-marfim-2">Texto curto
          <textarea className="field mt-2 min-h-24" maxLength={120} value={texto} onChange={(ev) => setTexto(ev.target.value)} placeholder="A ceia está servida!" />
        </label>
        <div className="mt-1 text-right text-xs text-marfim-3">{texto.length}/120</div>
        <button className="btn btn-primary mt-2 w-full" disabled={busy || !texto.trim()}><Megaphone size={18} /> Mostrar na TV</button>
      </form>
    </section>

    {msg && <p role="status" className="mt-4 text-center text-sm text-champagne">{msg}</p>}
    <Link href="/telao" className="btn btn-quiet mt-6 w-full">Abrir o telão neste aparelho</Link>
  </main>;
}
