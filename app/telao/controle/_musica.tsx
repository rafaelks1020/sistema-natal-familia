'use client';
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Music2, Pause, Play, Shuffle, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { api } from '@/app/ui/client';
import { MOMENTO_IDS, MOMENTOS, type Momento } from '@/app/api/spotify/momentos';

// Controle da música do telão pelo celular de quem organiza. Fala com /api/spotify/player (só admin).
type Faixa = { nome: string; artista: string; capa: string | null };
type Estado = { precisa_reconectar: true } | { telao_conectado: boolean; tocando: boolean; volume: number | null; aleatorio: boolean; faixa: Faixa | null };
type Acao = { acao: 'pausar' | 'continuar' | 'proxima' | 'anterior' } | { acao: 'tocar'; momento: Momento } | { acao: 'volume'; valor: number } | { acao: 'aleatorio'; ligado: boolean };

export default function MusicaControle() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [volLocal, setVolLocal] = useState<number | null>(null);
  const tempoVolume = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const soltaVolume = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const ler = useCallback(async () => {
    try {
      const r = await api<{ estado?: Estado; precisa_reconectar?: boolean }>('/api/spotify/player?parte=estado');
      if (r.estado) setEstado(r.estado);
    } catch (e) { setMsg((e as Error).message); }
  }, []);

  useEffect(() => {
    const primeira = setTimeout(() => void ler(), 0);
    const t = setInterval(() => void ler(), 4000);
    return () => { clearTimeout(primeira); clearInterval(t); clearTimeout(tempoVolume.current); clearTimeout(soltaVolume.current); };
  }, [ler]);

  async function enviar(corpo: Acao, ok = '') {
    setMsg('');
    try {
      const r = await api<{ precisa_reconectar?: boolean }>('/api/spotify/player', { method: 'POST', json: corpo });
      if (r.precisa_reconectar) setEstado({ precisa_reconectar: true });
      else if (ok) setMsg(ok);
      await ler();
    } catch (e) { setMsg((e as Error).message); }
  }

  async function comTrava(corpo: Acao, ok = '') {
    if (busy) return;
    setBusy(true);
    try { await enviar(corpo, ok); } finally { setBusy(false); }
  }

  function mudarVolume(v: number) {
    setVolLocal(v);
    clearTimeout(tempoVolume.current);
    clearTimeout(soltaVolume.current);
    tempoVolume.current = setTimeout(() => void enviar({ acao: 'volume', valor: v }), 350);
    soltaVolume.current = setTimeout(() => setVolLocal(null), 3500);
  }

  if (!estado) return <section className="surface mb-4 p-4" aria-label="Música do telão">
    <p className="kicker mb-3">Música no telão</p>
    <p className="text-sm text-marfim-2">{msg || 'Carregando...'}</p>
  </section>;

  if ('precisa_reconectar' in estado) return <section className="surface mb-4 p-4" aria-label="Música do telão">
    <p className="kicker mb-3">Música no telão</p>
    <p className="text-sm text-marfim-2">O Spotify precisa ser reconectado para tocar no telão.</p>
    <a href="/api/spotify/conectar" className="btn btn-primary mt-3 w-full">Reconectar o Spotify</a>
  </section>;

  const conectado = estado.telao_conectado;
  const volume = volLocal ?? estado.volume ?? 60;
  return <section className="surface mb-4 p-4" aria-label="Música do telão">
    <p className="kicker mb-3">Música no telão</p>
    {!conectado ? <p className="text-sm text-marfim-2">Abra o telão no notebook e toque em <b className="text-champagne">Ligar a música</b>.</p> : <>
      <div className="mb-4 flex items-center gap-3">
        {estado.faixa?.capa ? <img src={estado.faixa.capa} alt="" className="h-16 w-16 flex-none rounded-lg object-cover" />
          : <span className="grid h-16 w-16 flex-none place-items-center rounded-lg bg-carvao-3 text-champagne"><Music2 size={24} /></span>}
        <div className="min-w-0">
          <p className="display truncate text-lg font-bold">{estado.faixa?.nome || 'Nada tocando'}</p>
          <p className="truncate text-sm text-marfim-2">{estado.faixa?.artista || 'Escolha um momento abaixo'}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button className="btn btn-ghost min-h-16" disabled={busy} onClick={() => void comTrava({ acao: 'anterior' })} aria-label="Música anterior"><SkipBack size={24} /></button>
        <button className="btn btn-primary min-h-16" disabled={busy} onClick={() => void comTrava({ acao: estado.tocando ? 'pausar' : 'continuar' })} aria-label={estado.tocando ? 'Pausar' : 'Continuar'}>
          {estado.tocando ? <Pause size={26} /> : <Play size={26} />}
        </button>
        <button className="btn btn-ghost min-h-16" disabled={busy} onClick={() => void comTrava({ acao: 'proxima' })} aria-label="Próxima música"><SkipForward size={24} /></button>
      </div>
      <label className="mt-4 flex items-center gap-3 text-sm text-marfim-2">
        <Volume2 size={20} className="flex-none text-champagne" aria-hidden="true" />
        <input type="range" min={0} max={100} value={volume} onChange={(ev) => mudarVolume(Number(ev.target.value))}
          className="h-10 w-full accent-champagne" aria-label="Volume" />
        <span className="w-9 flex-none text-right tabular-nums">{volume}</span>
      </label>
      <button className={`btn mt-3 w-full ${estado.aleatorio ? 'btn-primary' : 'btn-ghost'}`} disabled={busy} aria-pressed={estado.aleatorio}
        onClick={() => void comTrava({ acao: 'aleatorio', ligado: !estado.aleatorio })}><Shuffle size={18} /> Aleatório {estado.aleatorio ? 'ligado' : 'desligado'}</button>
      <p className="kicker mb-2 mt-5">Momentos da playlist</p>
      <div className="grid gap-2">
        {MOMENTO_IDS.map((id) => <div key={id} className="flex items-center justify-between gap-3 rounded-xl border border-linha-forte px-4 py-3">
          <div className="min-w-0">
            <p className="font-semibold">{MOMENTOS[id].nome}</p>
            <p className="truncate text-xs text-marfim-3">{MOMENTOS[id].descricao}</p>
          </div>
          <button className="btn btn-ghost flex-none" disabled={busy} onClick={() => void comTrava({ acao: 'tocar', momento: id }, `Tocando: ${MOMENTOS[id].nome}.`)}>Tocar este momento</button>
        </div>)}
      </div>
    </>}
    {msg && <p role="status" className="mt-3 text-center text-sm text-champagne">{msg}</p>}
  </section>;
}
