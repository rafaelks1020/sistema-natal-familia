import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { theme } from '../../theme';

export function tempo(value: number) {
  const s = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export function AudioPlayer({ url, onDuration }: { url: string; onDuration?: (seconds: number) => void }) {
  const player = useAudioPlayer(url, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player); const toast = useToast();
  const [speed, setSpeed] = useState(1); const [width, setWidth] = useState(1);
  const [loading, setLoading] = useState(false);
  useFocusEffect(useCallback(() => () => { player.pause(); }, [player]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') player.pause(); });
    return () => sub.remove();
  }, [player]);
  useEffect(() => { if (status.duration > 0 && Number.isFinite(status.duration)) onDuration?.(Math.round(status.duration)); }, [status.duration, onDuration]);
  async function seek(seconds: number) {
    try { await player.seekTo(Math.max(0, Math.min(seconds, status.duration))); }
    catch { toast('Não foi possível avançar o áudio.', 'error'); }
  }
  async function play() {
    if (loading) return; setLoading(true);
    try {
      if (status.playing) player.pause();
      else {
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false });
        if (status.didJustFinish || status.currentTime >= status.duration) await player.seekTo(0);
        player.play();
      }
    } catch { toast('Não foi possível ouvir o áudio. Tente novamente.', 'error'); }
    finally { setLoading(false); }
  }
  const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;
  return <View style={styles.wrap}>
    <Pressable accessibilityRole="adjustable" accessibilityLabel="Posição do áudio"
      accessibilityValue={{ min: 0, max: Math.round(status.duration || 0), now: Math.round(status.currentTime || 0), text: `${tempo(status.currentTime)} de ${tempo(status.duration)}` }}
      accessibilityActions={[{ name: 'increment', label: 'Avançar 15 segundos' }, { name: 'decrement', label: 'Voltar 15 segundos' }]}
      onAccessibilityAction={event => void seek(status.currentTime + (event.nativeEvent.actionName === 'increment' ? 15 : -15))}
      onLayout={event => setWidth(Math.max(1, event.nativeEvent.layout.width))}
      onPress={event => { if (status.isLoaded) void seek(event.nativeEvent.locationX / width * status.duration); }} style={styles.touch}>
      <View style={styles.track}><View style={[styles.progress, { width: `${progress * 100}%` }]} /></View>
    </Pressable>
    <Text variant="muted">{tempo(status.currentTime)} / {tempo(status.duration)}</Text>
    <Button loading={loading} disabled={!status.isLoaded} onPress={() => void play()} variant="ghost">{!status.isLoaded ? 'Carregando áudio...' : status.playing ? 'Pausar áudio' : 'Ouvir áudio'}</Button>
    <View style={styles.row}>
      <Button variant="quiet" disabled={!status.isLoaded} onPress={() => void seek(status.currentTime - 15)} style={styles.flex}>Voltar 15 s</Button>
      <Button variant="quiet" disabled={!status.isLoaded} onPress={() => void seek(status.currentTime + 15)} style={styles.flex}>Avançar 15 s</Button>
    </View>
    <Button variant="quiet" onPress={() => {
      try { const next = speed === 1 ? 1.5 : 1; player.setPlaybackRate(next); setSpeed(next); }
      catch { toast('Não foi possível mudar a velocidade.', 'error'); }
    }}>Velocidade {speed}x</Button>
  </View>;
}
const styles = StyleSheet.create({
  wrap: { gap: 6 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 }, flex: { flex: 1, minWidth: 110 },
  touch: { minHeight: 44, justifyContent: 'center' }, track: { height: 6, backgroundColor: theme.colors.lineStrong, borderRadius: 3, overflow: 'hidden' },
  progress: { height: 6, backgroundColor: theme.colors.champagne },
});
