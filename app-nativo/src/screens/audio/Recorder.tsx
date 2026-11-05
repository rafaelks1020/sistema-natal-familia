import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { File } from 'expo-file-system';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../api';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { AudioPlayer, tempo } from './Player';

// Voz mono a 32 kbps: uns 15 minutos cabem no limite de 4,5 MB por envio da Vercel.
const options = { ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 32000, sampleRate: 22050 };
type Clip = { uri: string; type: string; name: string; seconds: number };
export function AudioRecorder({ value, onChange, onBusy }: { value: string; onChange: (url: string, seconds: number) => void; onBusy: (busy: boolean) => void }) {
  const toast = useToast(); const mounted = useRef(true);
  const recorder = useAudioRecorder(options);
  const status = useAudioRecorderState(recorder, 250);
  const active = useRef(false); const stopping = useRef(false);
  const [phase, setPhase] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [starting, setStarting] = useState(false); const [clip, setClip] = useState<Clip | null>(null);
  const clipRef = useRef<Clip | null>(null);
  function setLocal(value: Clip | null) { clipRef.current = value; setClip(value); }
  const upload = useMutation({
    mutationFn: async (file: Clip) => {
      const local = new File(file.uri);
      if (!local.exists || !local.size || local.size > 4.3 * 1024 * 1024) throw new Error('Escolha ou grave um áudio de até 4 MB (uns 15 minutos).');
      const form = new FormData();
      form.append('file', { uri: file.uri, type: file.type, name: file.name } as unknown as Blob);
      return api<{ url: string }>('/api/upload/audio', { method: 'POST', body: form, timeoutMs: 120000 });
    },
    onMutate: () => onBusy(true),
    onSuccess: (result, file) => { if (mounted.current) { onChange(result.url, file.seconds); setLocal(null); toast('Áudio pronto para salvar.'); } },
    onError: error => toast(error.message, 'error'),
    onSettled: () => { if (mounted.current) onBusy(Boolean(clipRef.current)); },
  });
  useEffect(() => { onBusy(starting || phase !== 'idle' || upload.isPending || Boolean(clip)); }, [starting, phase, upload.isPending, clip, onBusy]);
  const stop = useCallback(async () => {
    if (!active.current || stopping.current) return;
    stopping.current = true;
    try {
      const seconds = Math.round(recorder.getStatus().durationMillis / 1000);
      await recorder.stop(); active.current = false;
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      if (!mounted.current) return;
      const uri = recorder.uri;
      if (uri) {
        const local = new File(uri);
        if (local.size > 4.3 * 1024 * 1024) throw new Error('O áudio ficou grande demais (até uns 15 minutos). Grave um trecho menor.');
        const file = { uri, type: 'audio/mp4', name: `gravacao-${Date.now()}.m4a`, seconds };
        clipRef.current = file; setClip(file);
      }
    } catch (error) { if (mounted.current) toast(error instanceof Error ? error.message : 'Não foi possível terminar a gravação.', 'error'); }
    finally { active.current = false; stopping.current = false; if (mounted.current) { setPhase('idle'); onBusy(Boolean(clipRef.current)); } }
  }, [recorder, toast, onBusy]);
  useEffect(() => {
    mounted.current = true;
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') void stop(); });
    return () => {
      mounted.current = false; sub.remove();
      if (active.current) { active.current = false; void recorder.stop().catch(() => {}).finally(() => { void setAudioModeAsync({ allowsRecording: false }).catch(() => {}); }); }
    };
  }, [recorder, stop]);
  useFocusEffect(useCallback(() => () => { void stop(); }, [stop]));
  useEffect(() => { if (active.current && (status.fileSize >= 19 * 1024 * 1024 || status.durationMillis >= 1200000 || status.mediaServicesDidReset)) void stop(); }, [status.fileSize, status.durationMillis, status.mediaServicesDidReset, stop]);
  async function start() {
    if (starting || active.current || upload.isPending) return;
    setStarting(true); onBusy(true);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error('Permita o microfone nos Ajustes para gravar sua lembrança.');
      if (!mounted.current) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false, allowsBackgroundRecording: false });
      await recorder.prepareToRecordAsync();
      recorder.record(); active.current = true; setLocal(null); setPhase('recording');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível abrir o microfone.', 'error');
      onBusy(false); await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    } finally { if (mounted.current) setStarting(false); }
  }
  async function choose() {
    if (starting || upload.isPending) return;
    setStarting(true); onBusy(true);
    try {
      const result = await File.pickFileAsync({ mimeTypes: ['audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/webm', 'audio/ogg'] });
      if (result.canceled || !mounted.current) return;
      const file = result.result;
      if (!file.size || file.size > 4.3 * 1024 * 1024) throw new Error('Escolha um áudio de até 4 MB (uns 15 minutos).');
      setLocal({ uri: file.uri, type: file.type || 'audio/mp4', name: file.name, seconds: 0 });
    } catch (error) { toast(error instanceof Error ? error.message : 'Não foi possível escolher o áudio.', 'error'); }
    finally { if (mounted.current) { setStarting(false); onBusy(false); } }
  }
  const duration = useCallback((seconds: number) => {
    if (clipRef.current && clipRef.current.seconds !== seconds) {
      const next = { ...clipRef.current, seconds }; clipRef.current = next; setClip(next);
    }
  }, []);
  return <View style={{ gap: 12 }}>
    <Text variant="kicker">A voz de quem conta</Text>
    <Text variant="muted">Fale com calma. Termine a gravação e ouça antes de usar. Até uns 15 minutos.</Text>
    {phase === 'idle' ? <>
      <Button variant="ghost" loading={starting} disabled={upload.isPending} onPress={() => void start()}>Gravar áudio</Button>
      <Button variant="quiet" disabled={starting || upload.isPending} onPress={() => void choose()}>Escolher arquivo de áudio</Button>
    </> : <>
      <Text variant="numeral" accessibilityLiveRegion="polite">{tempo(status.durationMillis / 1000)}</Text>
      <Text>{phase === 'paused' ? 'Gravação pausada' : 'Gravando sua voz'}</Text>
      <Button variant="ghost" onPress={() => {
        try { if (phase === 'recording') { recorder.pause(); setPhase('paused'); } else { recorder.record(); setPhase('recording'); } }
        catch { toast('Não foi possível pausar ou continuar. Termine a gravação.', 'error'); }
      }}>{phase === 'recording' ? 'Pausar gravação' : 'Continuar gravação'}</Button>
      <Button onPress={() => void stop()}>Terminar e ouvir</Button>
    </>}
    {clip && phase === 'idle' && !starting ? <>
      <Text>Ouça antes de usar</Text><AudioPlayer key={clip.uri} url={clip.uri} onDuration={duration} />
      <Button loading={upload.isPending} disabled={starting} onPress={() => upload.mutate(clip)}>Usar este áudio</Button>
      <Button variant="quiet" disabled={upload.isPending || starting} onPress={() => setLocal(null)}>Descartar áudio</Button>
      <Text variant="muted">Toque em Usar este áudio antes de salvar.</Text>
    </> : value && phase === 'idle' && !starting ? <><AudioPlayer key={value} url={value} /><Button variant="quiet" disabled={upload.isPending || starting} onPress={() => onChange('', 0)}>Remover áudio</Button></> : null}
  </View>;
}
