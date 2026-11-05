import { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { media, type MediaName } from '../media';
import { theme } from '../theme';
import { useReduceMotion } from './motion';
export function LoopVideo({ name, once = false, onEnded, style, visible = true }: { name: MediaName; once?: boolean; onEnded?: () => void; style?: StyleProp<ViewStyle>; visible?: boolean }) {
  const reduced = useReduceMotion();
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => { const sub = AppState.addEventListener('change', state => setActive(state === 'active')); return () => sub.remove(); }, []);
  return <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.frame, style]}>
    <Image source={media[name].poster} contentFit="cover" style={StyleSheet.absoluteFill} />
    {!reduced ? <Playback name={name} once={once} onEnded={onEnded} playing={focused && active && visible} /> : null}
  </View>;
}
function Playback({ name, once, playing, onEnded }: { name: MediaName; once: boolean; playing: boolean; onEnded?: () => void }) {
  const [failed, setFailed] = useState(false);
  const [ended, setEnded] = useState(false);
  const player = useVideoPlayer(media[name].video, value => { value.muted = true; value.loop = !once; value.staysActiveInBackground = false; });
  useEffect(() => {
    const end = player.addListener('playToEnd', () => { if (once) { setEnded(true); onEnded?.(); } });
    const status = player.addListener('statusChange', event => { if (event.status === 'error') setFailed(true); });
    return () => { end.remove(); status.remove(); };
  }, [player, once, onEnded]);
  useEffect(() => { if (playing && !failed && !ended) player.play(); else player.pause(); }, [playing, failed, ended, player]);
  return failed ? null : <VideoView player={player} nativeControls={false} contentFit="cover" surfaceType="textureView" style={StyleSheet.absoluteFill} />;
}
const styles = StyleSheet.create({ frame: { overflow: 'hidden', backgroundColor: theme.colors.background } });
