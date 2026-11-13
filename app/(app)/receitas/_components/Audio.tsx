'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';

export function AudioPlayer({ url, onDuration }: { url: string; onDuration?: (seconds: number) => void }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [speed, setSpeed] = useState(1);
  useEffect(() => { const player = audio.current; return () => player?.pause(); }, []);
  return <div className="space-y-2 rounded-2xl bg-carvao-3 p-4">
    <audio ref={audio} src={url} controls preload="metadata" className="w-full min-w-0" aria-label="Ouvir áudio da família"
      onLoadedMetadata={() => { const duration = audio.current?.duration; if (duration && Number.isFinite(duration)) onDuration?.(Math.round(duration)); }} />
    <button type="button" className="btn btn-quiet min-h-11" onClick={() => {
      const next = speed === 1 ? 1.5 : 1; setSpeed(next); if (audio.current) audio.current.playbackRate = next;
    }} aria-label={`Velocidade ${speed}x. Toque para mudar`}>Velocidade {speed}x</button>
  </div>;
}

export function AudioField({ value, onChange, onBusy }: { value: string; onChange: (url: string, seconds: number) => void; onBusy: (busy: boolean) => void }) {
  const toast = useToast();
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const [state, setState] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [clip, setClip] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const alive = useRef(true);
  useEffect(() => { onBusy(busy || starting || state !== 'idle' || Boolean(clip)); }, [busy, starting, state, clip, onBusy]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (recorder.current?.state !== 'inactive') recorder.current?.stop();
      stream.current?.getTracks().forEach(track => track.stop());
    };
  }, []);
  useEffect(() => {
    if (!clip) return;
    const url = URL.createObjectURL(clip); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [clip]);
  useEffect(() => {
    if (state !== 'recording') return;
    const timer = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, [state]);
  function choose(file: File | null) {
    if (!file) return;
    if (!file.size || file.size > 4.3 * 1024 * 1024) { toast('Escolha um áudio de até 4 MB (uns 15 minutos).', 'erro'); return; }
    setSeconds(0); setClip(file); onBusy(true);
  }
  async function start() {
    if (starting || busy) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast('Neste navegador, use Escolher arquivo de áudio.', 'erro'); return;
    }
    setStarting(true); onBusy(true);
    try {
      const input = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) { input.getTracks().forEach(track => track.stop()); return; }
      stream.current = input;
      const mime = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mime) throw new Error('Este navegador não grava um formato compatível. Escolha um arquivo de áudio.');
      const rec = new MediaRecorder(input, { mimeType: mime, audioBitsPerSecond: 32000 }); recorder.current = rec;
      const chunks: Blob[] = []; let size = 0; let tooBig = false;
      rec.ondataavailable = event => {
        size += event.data.size;
        if (size > 4.3 * 1024 * 1024) { tooBig = true; if (rec.state !== 'inactive') rec.stop(); }
        else chunks.push(event.data);
      };
      rec.onerror = () => { toast('Não foi possível gravar. Escolha um arquivo de áudio.', 'erro'); if (rec.state !== 'inactive') rec.stop(); };
      rec.onstop = () => {
        input.getTracks().forEach(track => track.stop());
        if (!alive.current) return;
        setState('idle'); onBusy(!tooBig);
        if (tooBig) { toast('A gravação ficou grande demais (até uns 15 minutos). Grave um trecho menor.', 'erro'); return; }
        const blob = new Blob(chunks, { type: mime });
        if (blob.size) setClip(new File([blob], `gravacao.${mime === 'audio/mp4' ? 'm4a' : mime.split('/')[1]}`, { type: mime }));
      };
      setClip(null); setSeconds(0); rec.start(1000); setState('recording');
    } catch (error) {
      stream.current?.getTracks().forEach(track => track.stop()); onBusy(false);
      toast(error instanceof DOMException && error.name === 'NotAllowedError' ? 'Permita o microfone nas configurações do navegador ou escolha um arquivo de áudio.' : error instanceof Error ? error.message : 'Permita o microfone ou escolha um arquivo.', 'erro');
    } finally { setStarting(false); }
  }
  async function send() {
    if (!clip || busy) return;
    setBusy(true); onBusy(true);
    try {
      const form = new FormData(); form.append('file', clip);
      const result = await api<{ url: string }>('/api/upload/audio', { method: 'POST', body: form, timeoutMs: 60_000 });
      onChange(result.url, seconds); setClip(null); toast('Áudio pronto para salvar.');
    } catch (error) { toast((error as Error).message, 'erro'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded-2xl border border-champagne/20 p-4">
    <p className="kicker">A voz de quem conta</p>
    <p className="text-sm text-marfim-2">Grave com calma. Ouça antes de usar. Até uns 15 minutos por áudio.</p>
    {state === 'idle' ? <>
      <button type="button" className="btn btn-ghost w-full" disabled={busy || starting} onClick={() => void start()}>{starting ? 'Abrindo microfone...' : 'Gravar com o microfone'}</button>
      <label className="block text-sm">Escolher arquivo de áudio<input type="file" accept="audio/mp4,audio/m4a,audio/x-m4a,audio/aac,audio/mpeg,audio/webm,audio/ogg" className="field mt-2 min-h-11 w-full min-w-0" disabled={busy || starting} onChange={e => { choose(e.target.files?.[0] ?? null); e.target.value = ''; }} /></label>
    </> : <>
      <p role="status">{state === 'paused' ? 'Pausado' : 'Gravando'}: {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</p>
      <button type="button" className="btn btn-ghost w-full" onClick={() => {
        const rec = recorder.current;
        if (rec?.state === 'recording') { rec.pause(); setState('paused'); }
        else if (rec?.state === 'paused') { rec.resume(); setState('recording'); }
      }}>{state === 'recording' ? 'Pausar gravação' : 'Continuar gravação'}</button>
      <button type="button" className="btn btn-primary w-full" onClick={() => { if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop(); }}>Terminar e ouvir</button>
    </>}
    {clip && preview && state === 'idle' && !starting ? <><p className="text-sm break-all">Pré-escuta: {clip.name}</p><AudioPlayer key={preview} url={preview} onDuration={setSeconds} />
      <button type="button" className="btn btn-primary w-full" disabled={busy || starting || state !== 'idle'} onClick={() => void send()}>{busy ? 'Enviando áudio...' : 'Usar este áudio'}</button>
      <button type="button" className="btn btn-quiet w-full" disabled={busy} onClick={() => { setClip(null); onBusy(false); }}>Descartar gravação ou arquivo</button></> : value && state === 'idle' && !starting ? <><AudioPlayer key={value} url={value} />
      <button type="button" className="btn btn-quiet w-full" disabled={busy || starting || state !== 'idle'} onClick={() => onChange('', 0)}>Remover áudio</button></> : null}
    {clip ? <p className="text-sm text-champagne">Toque em Usar este áudio antes de salvar.</p> : null}
  </section>;
}
