import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useIsFocused } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Gift from 'lucide-react-native/icons/gift';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import { api, queryClient, queryKeys, sessionStore } from '../../api';
import { brl } from '../../format';
import { useSession } from '../../session';
import { theme } from '../../theme';
import type { User } from '../../types';
import type { Receiver, SantaConfig, SantaData } from '../../types/amigo-oculto';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LoopVideo } from '../../ui/LoopVideo';
import { Rise, useReduceMotion } from '../../ui/motion';
import { Skeleton } from '../../ui/Skeleton';
import { Surface } from '../../ui/Surface';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { assertSession, sameSession, santaKeys } from './data';
import { Organizer } from './Organizer';
import { Ticket } from './Ticket';
import { Wishlist } from './Wishlist';

export default function AmigoOculto() {
  const { user, status } = useSession();
  if (!user || status !== 'authenticated') return null;
  return <AmigoContent key={`${user.id}:${sessionStore.getGeneration()}`} user={user} />;
}

function AmigoContent({ user }: { user: User }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const reduced = useReduceMotion();
  const focused = useIsFocused();
  const [shownConfig, setShownConfig] = useState<number | null>(null);
  const [celebrating, setCelebrating] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [heroVisible, setHeroVisible] = useState(true);
  const heroBottom = useRef(900);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const saving = useRef(false);
  const isFocused = useRef(false);
  const query = useQuery({
    queryKey: santaKeys.draw,
    queryFn: ({ signal }) => api<SantaData>('/api/secret-santa', { signal }),
    refetchInterval: state => state.state.data?.config && !state.state.data.can_reveal ? 30_000 : false,
  });
  useFocusEffect(useCallback(() => {
    isFocused.current = true;
    void queryClient.invalidateQueries({ queryKey: santaKeys.draw });
    return () => { isFocused.current = false; setShownConfig(null); setCelebrating(null); };
  }, []));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setActive(state === 'active');
      if (state !== 'active') { setShownConfig(null); setCelebrating(null); }
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (celebrating === null) return;
    const timer = setTimeout(() => setCelebrating(null), reduced ? 0 : 6500);
    return () => clearTimeout(timer);
  }, [celebrating, reduced]);
  const mutation = useMutation({
    mutationFn: async ({ generation }: { generation: number; configId: number }) => {
      assertSession(generation);
      await api<{ receiver: Receiver }>('/api/secret-santa/reveal', { method: 'POST' });
      return api<SantaData>('/api/secret-santa');
    },
    onMutate: async operation => {
      await queryClient.cancelQueries({ queryKey: santaKeys.draw });
      assertSession(operation.generation);
    },
    onSuccess: (result, operation) => {
      if (!sameSession(operation.generation)) return;
      const current = queryClient.getQueryData<SantaData>(santaKeys.draw);
      if (current?.config?.id !== operation.configId) return;
      queryClient.setQueryData(santaKeys.draw, result);
      if (result.config?.id !== operation.configId || !result.draw?.revealed || !result.can_reveal) {
        toast('O sorteio foi atualizado. Confira a nova organização.');
        return;
      }
      if (isFocused.current && AppState.currentState === 'active') {
        setShownConfig(operation.configId);
        setCelebrating(reduced ? null : operation.configId);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    },
    onError: (error, operation) => { if (sameSession(operation.generation)) toast(error.message, 'error'); },
    onSettled: (_result, _error, operation) => {
      saving.current = false;
      if (!sameSession(operation.generation)) return;
      void queryClient.invalidateQueries({ queryKey: santaKeys.draw });
      void queryClient.invalidateQueries({ queryKey: santaKeys.admin });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
    },
  });

  function reveal() {
    const data = queryClient.getQueryData<SantaData>(santaKeys.draw);
    if (saving.current || !data?.can_reveal || !data.config || !data.participating || !focused) return;
    saving.current = true;
    mutation.mutate({ generation: sessionStore.getGeneration(), configId: data.config.id });
  }

  async function refresh() {
    const generation = sessionStore.getGeneration();
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: santaKeys.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.home }),
      ]);
    } finally { if (sameSession(generation)) setRefreshing(false); }
  }

  const data = query.data;
  const receiver = data?.draw?.revealed && data.can_reveal ? data.draw.receiver : undefined;
  const playingReveal = data?.config?.id === celebrating;
  const videoVisible = focused && active && heroVisible;
  return <View style={styles.page}>
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 22, paddingBottom: Math.max(insets.bottom, 24) + 24 }]}
      keyboardShouldPersistTaps="handled" onScroll={event => setHeroVisible(event.nativeEvent.contentOffset.y < heroBottom.current)} scrollEventThrottle={100}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refresh(); }} tintColor={theme.colors.champagne} colors={[theme.colors.champagne]} />}>
      <Rise style={styles.header}><View style={styles.heading}><Text variant="kicker">Um segredo da família</Text><Gift size={23} color={theme.colors.cherry} strokeWidth={1.3} /></View>
        <Text variant="display" accessibilityRole="header" style={styles.title}>Amigo oculto</Text><View style={styles.redRule} /></Rise>
      <View onLayout={event => { heroBottom.current = event.nativeEvent.layout.y + event.nativeEvent.layout.height; }}>
        {query.isPending ? <View style={styles.loading} accessibilityLabel="Preparando sua surpresa"><Skeleton style={{ height: 340 }} /><Skeleton style={{ height: 48, width: '65%' }} /></View>
          : !data ? <EmptyState title="O segredo pode esperar um instante." message={query.error?.message ?? 'Não conseguimos carregar o sorteio.'} action="Tentar novamente" onAction={() => { void query.refetch(); }} />
            : !data.config || !data.participating || !data.draw ? <Rise index={1} style={styles.waiting}>
              <LoopVideo name="mn-presente" visible={videoVisible} style={styles.giftVideo} />
              <Text variant="displayItalic" style={styles.waitingTitle}>{data.config ? 'Um lugar na próxima surpresa.' : 'O carinho já está embrulhado.'}</Text>
              <Text variant="muted" style={styles.center}>{data.config ? 'Você ainda não está neste sorteio. Quem organiza pode incluir você no próximo.' : 'O próximo sorteio vem aí. Enquanto isso, deixe suas pistas na lista de desejos.'}</Text>
            </Rise>
              : playingReveal ? <View style={styles.celebration} accessibilityLiveRegion="polite">
                <LoopVideo name="mn-revelacao" once visible={videoVisible} onEnded={() => setCelebrating(null)} style={styles.revealVideo} />
                <Text variant="displayItalic" style={styles.waitingTitle}>Uma surpresa só sua.</Text>
                <Button variant="quiet" onPress={() => setCelebrating(null)}>Ver meu amigo oculto</Button>
              </View>
                : receiver ? <Revealed receiver={receiver} config={data.config} hidden={shownConfig !== data.config.id || !focused || !active} onToggle={() => setShownConfig(value => value === data.config?.id ? null : data.config?.id ?? null)} />
                  : <Rise index={1}><Ticket key={data.config.id} canReveal={data.can_reveal} opensAt={data.reveal_opens_at} busy={mutation.isPending} onReveal={reveal} /></Rise>}
      </View>
      {data && query.isError ? <Text accessibilityRole="alert" variant="muted">Não conseguimos atualizar o sorteio. Puxe a tela para tentar novamente.</Text> : null}
      <Rise index={2}><Wishlist canWrite={user.participant_id !== null} /></Rise>
      {user.is_admin ? <Rise index={3}><Organizer /></Rise> : null}
      <Text variant="kicker" style={styles.footer}>O melhor presente é estar junto</Text>
    </ScrollView>
  </View>;
}

function Revealed({ receiver, config, hidden, onToggle }: { receiver: Receiver; config: SantaConfig; hidden: boolean; onToggle: () => void }) {
  return <View style={styles.result}>
    <Rise><Surface style={styles.receiver}>
      {hidden ? <><Gift size={39} strokeWidth={1.2} color={theme.colors.champagne} /><Text variant="displayItalic" style={styles.waitingTitle}>Seu segredo está guardado.</Text>
        <Text variant="muted" style={styles.center}>Mostre o nome quando estiver a sós.</Text></>
        : <><Text variant="displayItalic" style={styles.youDrew}>Você tirou</Text>
          <View style={styles.avatarRing}><Avatar name={receiver.name} src={receiver.avatar_url} size={134} /></View>
          <Text variant="display" style={styles.receiverName} accessibilityLiveRegion="polite">{receiver.name}</Text>
          <Text variant="kicker">Um presente cheio de significado</Text>
          <GiftRange config={config} /></>}
      <Button variant="quiet" icon={hidden ? <Eye size={16} color={theme.colors.champagne} /> : <EyeOff size={16} color={theme.colors.champagne} />} onPress={onToggle}>{hidden ? 'Mostrar nome' : 'Esconder nome'}</Button>
    </Surface></Rise>
    {!hidden ? <Wishlist key={`${config.id}:${receiver.participant_id}`} participantId={receiver.participant_id} configId={config.id} /> : null}
  </View>;
}

function GiftRange({ config }: { config: SantaConfig }) {
  if (config.min_gift_value === null && config.max_gift_value === null) return <Text variant="muted">O valor do presente será combinado pela família.</Text>;
  const label = config.min_gift_value !== null && config.max_gift_value !== null
    ? `${brl(config.min_gift_value)} a ${brl(config.max_gift_value)}`
    : config.min_gift_value !== null ? `A partir de ${brl(config.min_gift_value)}` : `Até ${brl(config.max_gift_value ?? 0)}`;
  return <View style={styles.giftRange}><Text variant="muted" style={styles.rangeLabel}>Faixa do presente</Text><Text variant="numeral" style={styles.rangeValue}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background }, content: { paddingHorizontal: 24, gap: 34 },
  header: { gap: 12 }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, title: { fontSize: 42, lineHeight: 52 },
  redRule: { width: 46, height: 1, backgroundColor: theme.colors.cherry, marginTop: 5 }, loading: { gap: 20 }, waiting: { gap: 20, alignItems: 'center', paddingBottom: 8 },
  giftVideo: { width: '100%', aspectRatio: 1.2, borderRadius: theme.radius.card }, waitingTitle: { fontSize: 31, lineHeight: 40, textAlign: 'center' }, center: { textAlign: 'center' },
  celebration: { gap: 20 }, revealVideo: { width: '100%', aspectRatio: 0.95, borderRadius: theme.radius.card }, result: { gap: 32 },
  receiver: { alignItems: 'center', gap: 20, paddingTop: 28, paddingBottom: 12, borderColor: theme.colors.champagne },
  youDrew: { color: theme.colors.champagne, fontSize: 36, lineHeight: 45 }, avatarRing: { borderWidth: 1, borderColor: theme.colors.champagne, borderRadius: 76, padding: 7 },
  receiverName: { fontSize: 39, lineHeight: 49, textAlign: 'center' }, giftRange: { gap: 6, alignItems: 'center', paddingTop: 12, width: '100%', borderTopWidth: 1, borderColor: theme.colors.line },
  rangeLabel: { fontSize: 11 }, rangeValue: { fontSize: 25, lineHeight: 35, textAlign: 'center' }, footer: { textAlign: 'center', fontSize: 9, color: theme.colors.muted },
});
