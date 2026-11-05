import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../api';
import { theme } from '../../theme';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { EmptyState } from '../../ui/EmptyState';
import { Skeleton } from '../../ui/Skeleton';
import { useReduceMotion } from '../../ui/motion';
import { PhotoViewer } from '../album/PhotoViewer';
import type { AlbumMetadata } from '../album/types';
import type { Retrospective } from './types';

function ProgressBar({ complete, active, paused }: { complete: boolean; active: boolean; paused: boolean }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(progress); progress.set(complete ? 1 : 0);
    if (active && !paused) progress.set(withTiming(1, { duration: 6000, easing: Easing.linear }));
    return () => cancelAnimation(progress);
  }, [active, complete, paused, progress]);
  const style = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` as `${number}%` }));
  return <View style={styles.track}><Animated.View style={[styles.progress, style]} /></View>;
}

export default function RetrospectiveScreen() {
  const params = useLocalSearchParams<{ ano?: string }>();
  const metadata = useQuery({ queryKey: ['album', 'metadata'], queryFn: ({ signal }) => api<AlbumMetadata>('/api/album?meta=1', { signal }), enabled: !params.ano });
  const year = params.ano ? Number(params.ano) : metadata.data?.currentYear;
  const valid = year !== undefined && Number.isInteger(year) && year >= 1900;
  const retrospective = useQuery({ queryKey: ['album', 'retrospectiva', year], queryFn: ({ signal }) => api<Retrospective>(`/api/memorias/retrospectiva/${year}`, { signal }), enabled: valid });
  if (retrospective.data) return <Stories key={year} initial={retrospective.data} />;
  return <View style={[styles.root, styles.loading]}><Button variant="quiet" onPress={() => router.back()}>Voltar</Button>
    {retrospective.isError || metadata.isError || (year !== undefined && !valid) ? <EmptyState title="Retrospectiva indisponível" message={retrospective.error?.message ?? metadata.error?.message ?? 'Confira o ano da edição.'} action="Tentar de novo" onAction={() => { if (params.ano) void retrospective.refetch(); else void metadata.refetch(); }} /> : <Skeleton style={{ height: 320 }} />}
  </View>;
}

function Stories({ initial }: { initial: Retrospective }) {
  const inset = useSafeAreaInsets(); const reduced = useReduceMotion(); const [storedIndex, setIndex] = useState(0);
  const [paused, setPaused] = useState(false); const [viewer, setViewer] = useState(false); const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => { const subscription = AppState.addEventListener('change', state => setForeground(state === 'active')); return () => subscription.remove(); }, []);
  const last = initial.slides.length - 1; const index = Math.min(storedIndex, last); const slide = initial.slides[index];
  const stopped = paused || reduced || viewer || !foreground || !focused;
  const advance = useCallback((delta: number) => setIndex(i => Math.max(0, Math.min(last, i + delta))), [last]);
  useEffect(() => { if (stopped || index === last) return; const timer = setTimeout(() => advance(1), 6000); return () => clearTimeout(timer); }, [index, last, stopped, advance]);
  if (!slide) return null;
  const photo = slide.photo; const url = photo?.url ?? slide.url;
  return <View style={[styles.root, { paddingTop: inset.top + 12, paddingBottom: inset.bottom + 16 }]}>
    <View style={styles.bars} accessibilityLabel={`Momento ${index + 1} de ${initial.slides.length}`}>
      {initial.slides.map((_, i) => <ProgressBar key={i} complete={i < index || index === last} active={i === index} paused={stopped} />)}
    </View>
    <View style={styles.top}><Text variant="kicker">Natal de {initial.edition.ano}</Text><View style={styles.row}>
      <Button variant="quiet" disabled={reduced} onPress={() => setPaused(p => !p)}>{reduced ? 'Manual' : paused ? 'Continuar' : 'Pausar'}</Button><Button variant="quiet" onPress={() => router.back()}>Fechar</Button>
    </View></View>
    <Pressable accessibilityRole="button" accessibilityLabel="Avançar para o próximo momento" onPress={() => advance(1)} style={styles.stage}>
      {url && <Image source={{ uri: url }} contentFit="contain" style={styles.photo} accessibilityLabel={photo?.caption || slide.title} />}
      <Text variant="display" accessibilityRole="header" style={styles.title}>{slide.title}</Text><Text numberOfLines={4} style={styles.text}>{slide.text}</Text>
    </Pressable>
    <View style={styles.footer}>{photo && <Button variant="quiet" onPress={() => setViewer(true)}>Opções da foto e denúncia</Button>}
      <View style={styles.row}><Button style={styles.flex} variant="ghost" disabled={index === 0} onPress={() => advance(-1)}>Anterior</Button>
        <Button style={styles.flex} onPress={() => { if (index === last) router.back(); else advance(1); }}>{index === last ? 'Voltar às memórias' : 'Próximo'}</Button>
      </View>
    </View>
    {viewer && photo && <PhotoViewer initialKey={photo.key} photos={[photo]} hasMore={false} loadingMore={false} error={null} onLoadMore={() => {}} onClose={() => setViewer(false)} />}
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: theme.colors.background }, loading: { padding: 24, paddingTop: 64, gap: 24 }, bars: { flexDirection: 'row', gap: 3, paddingHorizontal: 16 }, track: { flex: 1, height: 3, backgroundColor: theme.colors.lineStrong, overflow: 'hidden', borderRadius: 2 }, progress: { height: 3, backgroundColor: theme.colors.champagne }, top: { paddingHorizontal: 20, paddingTop: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }, row: { flexDirection: 'row', gap: 8 }, stage: { flex: 1, minHeight: 0, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 }, photo: { width: '100%', flex: 1, minHeight: 60 }, title: { fontSize: 34, lineHeight: 42, textAlign: 'center' }, text: { textAlign: 'center', color: theme.colors.secondary }, footer: { paddingHorizontal: 24, gap: 8 }, flex: { flex: 1 } });
