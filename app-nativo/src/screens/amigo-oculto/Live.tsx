import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router, useIsFocused } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { api } from '../../api';
import { useSession } from '../../session';
import { theme } from '../../theme';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Skeleton } from '../../ui/Skeleton';
import { Surface } from '../../ui/Surface';
import { Text } from '../../ui/Text';
import { useReduceMotion } from '../../ui/motion';
import { featureKeys, useFeatureMutation, type LiveData, type LivePair } from './featureData';
function Reveal({ pair, focused }: { pair: LivePair; focused: boolean }) {
  const reduced = useReduceMotion();
  const [shown, setShown] = useState(false);
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!reduced && focused) scale.set(withRepeat(withTiming(1.06, { duration: 550 }), -1, true));
    return () => { cancelAnimation(scale); };
  }, [reduced, scale, focused]);
  useEffect(() => { const timer = setTimeout(() => setShown(true), 1800); return () => clearTimeout(timer); }, []);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return <Surface style={styles.card}><View accessibilityLiveRegion="polite" style={styles.gap}>{!shown ? <Animated.View style={animated}><Text variant="display" style={styles.suspense}>Quem será?</Text><Text variant="muted" style={styles.center}>O segredo vai acabar...</Text></Animated.View> : <><Text variant="display" style={styles.name}>{pair.giver}</Text><Text variant="kicker" style={styles.center}>tirou</Text><Text variant="display" style={[styles.name, { color: theme.colors.champagne }]}>{pair.receiver}</Text><Text variant="muted" style={styles.center}>{pair.acertos.length ? `Acertou o palpite: ${pair.acertos.join(', ')}` : 'Esse segredo foi bem guardado!'}</Text></>}</View></Surface>;
}
export default function Live() {
  const { user } = useSession();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const query = useQuery({ queryKey: featureKeys.live, queryFn: ({ signal }) => api<LiveData>('/api/secret-santa/live', { signal }),
    refetchInterval: (q) => !focused ? false : q.state.data?.live?.encerrado_em ? 20000 : 3000, enabled: !!user });
  const mutation = useFeatureMutation();
  const live = query.data?.live, pair = live?.pairs.at(-1);
  function advance() {
    if (live) mutation.send({ path: '/api/secret-santa/live', method: 'POST', json: { action: 'next', atual: live.atual } });
    else Alert.alert('Começar a revelação?', 'Toda a família será avisada. Os palpites e as dicas serão encerrados.', [{ text: 'Aguardar', style: 'cancel' }, { text: 'Começar', onPress: () => mutation.send({ path: '/api/secret-santa/live', method: 'POST', json: { action: 'start' } }) }]);
  }
  return <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 }]}><Text variant="kicker">A noite da ceia</Text><Text variant="display" style={styles.title}>Revelação ao vivo</Text>
    {query.isPending ? <Skeleton style={{ height: 300 }} /> : !query.data ? <EmptyState title="A revelação aguarda" message={query.error?.message} action="Tentar novamente" onAction={() => { void query.refetch(); }} /> : pair ? <Reveal key={pair.giver_id} pair={pair} focused={focused} /> : <Surface style={styles.card}><Text variant="displayItalic" style={styles.name}>{live ? 'O primeiro segredo vem aí...' : 'Junte a família'}</Text><Text variant="muted" style={styles.center}>{live ? 'Quem organiza vai anunciar o primeiro par.' : 'A revelação aparece aqui quando quem organiza começar.'}</Text></Surface>}
    {live ? <Text variant="kicker" style={styles.center}>{Math.max(0, live.atual + 1)} de {live.total}{live.encerrado_em ? ' · Todos os segredos revelados' : ''}</Text> : null}
    {query.isError && query.data ? <Text accessibilityRole="alert" variant="muted">Não conseguimos atualizar. Tentando novamente...</Text> : null}
    {user?.is_admin && query.data && !live?.encerrado_em ? <Button loading={mutation.isPending} onPress={advance}>{live ? 'Próximo' : 'Iniciar revelação'}</Button> : null}
    {live && live.pairs.length > 1 ? <View style={styles.gap}><Text variant="display" style={{ fontSize: 26 }}>Já revelados</Text>{live.pairs.slice(0, -1).map(p => <Surface key={p.giver_id}><Text>{p.giver} tirou {p.receiver}</Text></Surface>)}</View> : null}
    <Button variant="ghost" onPress={() => router.back()}>Voltar</Button>
  </ScrollView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: theme.colors.background }, content: { paddingHorizontal: 24, gap: 24 }, gap: { gap: 18 }, title: { fontSize: 38, lineHeight: 48 }, card: { paddingVertical: 40, gap: 20 }, center: { textAlign: 'center' }, name: { fontSize: 33, lineHeight: 43, textAlign: 'center' }, suspense: { fontSize: 37, lineHeight: 49, textAlign: 'center', color: theme.colors.champagne } });
