import { AtivarAvisos } from './AtivarAvisos';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ArrowUpRight from 'lucide-react-native/icons/arrow-up-right';
import Check from 'lucide-react-native/icons/check';
import Gift from 'lucide-react-native/icons/gift';
import MapPin from 'lucide-react-native/icons/map-pin';
import Settings2 from 'lucide-react-native/icons/settings-2';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Users from 'lucide-react-native/icons/users';
import { api, ApiError, queryClient, queryKeys, sessionStore } from '../api';
import { brl, greeting, timeAgo } from '../format';
import { useSession } from '../session';
import type { Attendance, AttendanceStatus, HomeData, User } from '../types';
import { theme } from '../theme';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { LoopVideo } from '../ui/LoopVideo';
import { Rise } from '../ui/motion';
import { Skeleton } from '../ui/Skeleton';
import { Surface } from '../ui/Surface';
import { Text } from '../ui/Text';
import { useToast } from '../ui/Toast';

function optimisticAttendance(previous: Attendance, status: AttendanceStatus, user: User): Attendance {
  if (user.participant_id === null) return previous;
  const people = previous.people.filter(person => person.participant_id !== user.participant_id);
  people.push({ participant_id: user.participant_id, name: user.name, avatar_url: user.avatar_url, status });
  const counts = { ...previous.counts };
  if (previous.mine) counts[previous.mine] = Math.max(0, counts[previous.mine] - 1);
  counts[status]++;
  return { mine: status, counts, people };
}
export default function Home() {
  const { user } = useSession();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [celebrate, setCelebrate] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const saving = useRef(false);
  const heroHeight = Math.max(500, Math.min(height * 0.73, 740));
  const home = useQuery({ queryKey: queryKeys.home, queryFn: ({ signal }) => api<HomeData>('/api/home', { signal }) });
  useEffect(() => { if (home.error) toast(home.error.message, 'error'); }, [home.error, toast]);
  useEffect(() => { if (!celebrate) return; const timer = setTimeout(() => setCelebrate(false), 3500); return () => clearTimeout(timer); }, [celebrate]);
  const mutation = useMutation({
    mutationFn: ({ status, generation }: { status: AttendanceStatus; generation: number }) => {
      if (generation !== sessionStore.getGeneration()) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return api<Attendance>('/api/attendance', { method: 'POST', json: { status } });
    },
    onMutate: async ({ status, generation }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.home });
      const previous = queryClient.getQueryData<HomeData>(queryKeys.home);
      if (previous && user && generation === sessionStore.getGeneration()) queryClient.setQueryData<HomeData>(queryKeys.home, { ...previous, attendance: optimisticAttendance(previous.attendance, status, user) });
      return { previous, generation };
    },
    onError: (error, _status, context) => {
      if (context?.previous && context.generation === sessionStore.getGeneration() && sessionStore.getSnapshot().status === 'authenticated') queryClient.setQueryData(queryKeys.home, context.previous);
      toast(error.message, 'error');
    },
    onSuccess: (attendance, { status, generation }) => {
      if (generation !== sessionStore.getGeneration()) return;
      if (sessionStore.getSnapshot().status !== 'authenticated') return;
      queryClient.setQueryData<HomeData>(queryKeys.home, current => current ? { ...current, attendance } : current);
      queryClient.setQueryData(queryKeys.attendance, attendance);
      if (status === 'yes') {
        setCelebrate(true); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        toast('Seu lugar à mesa está confirmado!');
      } else toast('Sua resposta foi salva.');
    },
    onSettled: (_data, _error, _status, context) => {
      saving.current = false;
      if (context?.generation === sessionStore.getGeneration() && sessionStore.getSnapshot().status === 'authenticated') void queryClient.invalidateQueries({ queryKey: queryKeys.home });
    },
  });
  if (!user) return null;
  if (home.isPending) return <HomeSkeleton />;
  if (!home.data) return <EmptyState title="Vamos tentar de novo?" message={home.error?.message ?? 'Não conseguimos trazer as novidades da família.'} action="Tentar novamente" onAction={() => { void home.refetch(); }} />;
  const { settings, attendance, vaquinha, recentPosts, secretSanta } = home.data;
  const date = new Date(settings.event_date);
  const dateLabel = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });
  const confirmed = attendance.people.filter(person => person.status === 'yes');
  const progress = vaquinha.total ? Math.min(1, Math.max(0, vaquinha.pagos / vaquinha.total)) : 0;
  function respond(status: AttendanceStatus) {
    if (saving.current || mutation.isPending || attendance.mine === status) return;
    if (user?.participant_id === null) { toast('Seu acesso ainda não está ligado a um participante. Peça para quem organiza.', 'error'); return; }
    saving.current = true; mutation.mutate({ status, generation: sessionStore.getGeneration() });
  }
  return <View style={styles.page}>
    <ScrollView contentContainerStyle={{ paddingBottom: 32, width: '100%', maxWidth: 720, alignSelf: 'center' }}
      contentInsetAdjustmentBehavior="automatic" scrollEventThrottle={160} onScroll={event => setScrollY(event.nativeEvent.contentOffset.y)}
      refreshControl={<RefreshControl refreshing={home.isRefetching && !mutation.isPending} onRefresh={() => { if (!saving.current) void home.refetch(); }} tintColor={theme.colors.champagne} colors={[theme.colors.cherry]} progressBackgroundColor={theme.colors.surface} progressViewOffset={insets.top} />}>
      <View style={[styles.hero, { minHeight: heroHeight, paddingTop: insets.top + 80 }]}>
        <LoopVideo name="mn-hero" visible={scrollY < heroHeight} style={[StyleSheet.absoluteFill, { opacity: 0.8 }]} />
        <LinearGradient colors={['rgba(23,27,24,0.1)', 'rgba(23,27,24,0.2)', theme.colors.background]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
        <Pressable style={[styles.profile, { top: insets.top + 20 }]} accessibilityRole="button" accessibilityLabel="Abrir meu perfil" onPress={() => router.push(`/familia/${String(user.id)}`)}>
          <Avatar name={user.name} src={user.avatar_url} />
        </Pressable>
        <Rise style={styles.heroText}>
          <Text variant="kicker">{dateLabel}</Text>
          <View accessible accessibilityRole="header" accessibilityLabel="Natal em Família">
            <Text variant="display" style={[styles.title, { fontSize: Math.min(78, width * 0.165) }]}>Natal em</Text>
            <Text variant="displayItalic" style={[styles.title, { fontSize: Math.min(78, width * 0.165) }]}>Família</Text>
          </View>
          <View style={styles.redRule} /><Greeting name={user.name} />
          {settings.event_place ? <View style={styles.inline}><MapPin size={14} color={theme.colors.champagne} strokeWidth={1.5} /><Text variant="muted" style={styles.flex}>{settings.event_place}</Text></View> : null}
        </Rise>
      </View>
      <View style={styles.content}>
        <Rise index={1}><Surface style={styles.countdown}>
          <LoopVideo name="mn-countdown" visible={scrollY < heroHeight + 250 && scrollY + height > heroHeight} style={[StyleSheet.absoluteFill, { opacity: 0.25 }]} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(23,27,24,0.45)' }]} />
          <Text variant="kicker" style={styles.center}>{settings.event_title}</Text><Countdown target={date.getTime()} />
        </Surface></Rise>
        <AtivarAvisos />
        <Rise index={2} style={styles.attendance}>
          <View style={styles.heading}><Users size={21} color={theme.colors.champagne} strokeWidth={1.5} /><Text variant="display" style={styles.sectionTitle}>Você vai à ceia?</Text></View>
          <View style={styles.row}>
            {(['yes', 'maybe', 'no'] as const).map((status, index) => <Button key={status} style={styles.flex} variant={attendance.mine === status ? 'primary' : 'ghost'}
              selected={attendance.mine === status} disabled={mutation.isPending || user.participant_id === null} onPress={() => respond(status)}
              icon={attendance.mine === status ? <Check size={15} color={theme.colors.ivory} /> : undefined}>{['Vou', 'Talvez', 'Não'][index]}</Button>)}
          </View>
          {user.participant_id === null ? <Text variant="muted">Peça para quem organiza vincular seu acesso a um participante para confirmar presença.</Text> : null}
          <View style={styles.confirmed}>
            <View style={styles.inline}>{confirmed.slice(0, 5).map((person, index) => <View key={person.participant_id} style={{ marginLeft: index ? -10 : 0 }}><Avatar name={person.name} src={person.avatar_url} size={31} /></View>)}</View>
            <Text variant="muted" style={[styles.flex, { fontSize: 12 }]} accessibilityLiveRegion="polite">{attendance.counts.yes ? `${attendance.counts.yes} ${attendance.counts.yes === 1 ? 'pessoa confirmada' : 'pessoas confirmadas'}` : 'A mesa está esperando pela família.'}</Text>
          </View>
          {celebrate ? <View style={styles.celebration} accessibilityLiveRegion="polite" accessibilityLabel="Vamos brindar à sua presença"><LoopVideo name="mn-brinde" once style={StyleSheet.absoluteFill} /></View> : null}
        </Rise>
        <Rise index={3} style={styles.fund}>
          <Pressable accessibilityRole="button" accessibilityLabel="Ver a vaquinha da ceia" onPress={() => router.navigate('/vaquinha')}>
            <View style={styles.between}><View style={styles.flex}><Text variant="kicker">Cada um faz parte</Text><Text variant="display" style={styles.sectionTitle}>Vaquinha da ceia</Text></View><ArrowUpRight size={21} color={theme.colors.champagne} strokeWidth={1.5} /></View>
            <View style={[styles.row, { marginTop: 24 }]}>
              {([['Arrecadado', vaquinha.arrecadado], ['Gasto', vaquinha.gasto], ['Saldo', vaquinha.saldo]] as const).map(([label, value]) => <View key={label} style={styles.flex}>
                <Text variant="muted" style={{ fontSize: 11 }}>{label}</Text><Text variant="numeral" adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.65} style={{ fontSize: 23, lineHeight: 36, color: label === 'Saldo' && value < 0 ? theme.colors.error : theme.colors.ivory }}>{brl(value)}</Text>
              </View>)}
            </View>
            <View accessibilityRole="progressbar" accessibilityLabel="Contribuições recebidas" accessibilityValue={{ min: 0, max: vaquinha.total || 1, now: vaquinha.pagos }} style={styles.progress}>
              <View style={{ width: `${progress * 100}%`, height: 4, backgroundColor: theme.colors.sage }} />
            </View><Text variant="muted" style={styles.footnote}>{vaquinha.pagos} de {vaquinha.total} contribuições recebidas</Text>
          </Pressable>
        </Rise>
        <Rise index={4}><Pressable accessibilityRole="button" accessibilityLabel="Abrir Tudo do Natal" onPress={() => router.push('/natal')}>
          <Surface style={[styles.santa, { borderColor: 'rgba(197,41,45,0.3)' }]}><Sparkles color={theme.colors.cherry} size={30} strokeWidth={1.3} />
            <View style={styles.flex}><Text variant="kicker">Novidades deste Natal</Text><Text variant="display" style={{ fontSize: 25, lineHeight: 33 }}>Tudo do Natal</Text>
              <Text variant="muted" style={styles.footnote}>Advento, ceia, caronas, jogos da noite, receitas e memórias</Text></View>
            <ArrowUpRight color={theme.colors.champagne} size={18} />
          </Surface>
        </Pressable></Rise>
        <Rise index={4}><Pressable accessibilityRole="button" accessibilityLabel="Abrir amigo oculto" onPress={() => router.navigate('/amigo-oculto')}>
          <Surface style={styles.santa}><Gift color={theme.colors.champagne} size={32} strokeWidth={1.2} />
            <View style={styles.flex}><Text variant="kicker">Um segredo da família</Text><Text variant="display" style={{ fontSize: 25, lineHeight: 33 }}>
              {secretSanta.active ? secretSanta.revealed ? 'Um presente cheio de carinho' : 'Seu amigo oculto está esperando' : 'A magia de presentear'}
            </Text><Text variant="muted" style={styles.footnote}>{secretSanta.active ? secretSanta.revealed ? 'Seu sorteio já foi revelado.' : 'Uma surpresa só sua.' : 'O próximo sorteio começa por aqui.'}</Text></View>
            <ArrowUpRight color={theme.colors.champagne} size={18} />
          </Surface>
        </Pressable></Rise>
        <Rise index={5}>
          <View style={styles.between}><Text variant="display" style={styles.sectionTitle}>No mural</Text><Button variant="quiet" onPress={() => router.navigate('/mural')} icon={<ArrowUpRight size={16} color={theme.colors.champagne} />}>Ver tudo</Button></View>
          {recentPosts.length ? recentPosts.map(post => <Pressable key={post.id} style={styles.post} accessibilityRole="button" accessibilityLabel={`Recado de ${post.user_name}`} onPress={() => router.navigate('/mural')}>
            <Avatar name={post.user_name} src={post.avatar_url} size={36} />
            <View style={styles.flex}><Text style={{ fontFamily: theme.fonts.medium, fontSize: 14 }}>{post.user_name}</Text><Text variant="muted" style={styles.footnote}>{timeAgo(post.created_at)}</Text><Text variant="muted" numberOfLines={3} style={{ marginTop: 10 }}>{post.content}</Text></View>
            {post.first_image ? <Image source={{ uri: post.first_image }} contentFit="cover" accessibilityLabel="Foto compartilhada no mural" style={styles.postImage} /> : null}
          </Pressable>) : <View style={{ paddingVertical: 24, gap: 8 }}><Text variant="display" style={{ fontSize: 23 }}>As primeiras memórias começam aqui.</Text><Text variant="muted">Logo, os recados da família vão encher este cantinho.</Text></View>}
        </Rise>
        {user.is_admin ? <Pressable accessibilityRole="button" accessibilityLabel="Organizar o Natal" onPress={() => router.push('/organizar')} style={styles.organize}>
          <Settings2 size={15} color={theme.colors.muted} strokeWidth={1.5} />
          <Text variant="muted" style={styles.organizeLabel}>Organizar o Natal</Text>
        </Pressable> : null}
        <Text variant="kicker" style={[styles.center, { color: theme.colors.muted, paddingTop: 6 }]}>Feito para viver junto</Text>
      </View>
    </ScrollView>
  </View>;
}
function useClock(period: number) {
  const [now, setNow] = useState(Date.now);
  useFocusEffect(useCallback(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), period); return () => clearInterval(timer); }, [period]));
  return now;
}
function Greeting({ name }: { name: string }) { const now = useClock(60000); return <Text variant="muted">{greeting(now)}, {name.trim().split(/\s+/)[0]}.</Text>; }
function Countdown({ target }: { target: number }) {
  const now = useClock(1000);
  const seconds = Math.max(0, Math.floor((target - now) / 1000));
  if (!Number.isFinite(seconds)) return <Text variant="muted">A data da ceia será anunciada em breve.</Text>;
  if (!seconds) return <Text variant="display" style={[styles.center, { fontSize: 42 }]}>Feliz Natal</Text>;
  const values = [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60];
  return <View style={styles.row}>{values.map((value, index) => <View key={index} style={[styles.timeCell, index > 0 && styles.timeBorder]}>
    <Text variant="numeral" style={{ fontSize: 46 }}>{String(value).padStart(2, '0')}</Text><Text variant="muted" style={{ fontSize: 11 }}>{['dias', 'horas', 'min'][index]}</Text>
  </View>)}</View>;
}
function HomeSkeleton() {
  return <View style={[styles.page, { padding: 24, paddingTop: 110, gap: 24 }]} accessibilityLabel="Preparando o início"><Skeleton style={{ height: 220 }} /><Skeleton style={{ height: 145 }} /><Skeleton style={{ height: 120 }} /><Skeleton style={{ height: 80 }} /></View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background }, hero: { justifyContent: 'flex-end', paddingHorizontal: 24, paddingBottom: 48 },
  profile: { position: 'absolute', right: 20, padding: 4, minWidth: 48, minHeight: 48 }, heroText: { gap: 18 },
  title: { lineHeight: 83 }, redRule: { height: 1, width: 64, backgroundColor: theme.colors.cherry, marginVertical: 6 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 }, row: { flexDirection: 'row', gap: 8 }, flex: { flex: 1, minWidth: 0 },
  content: { paddingHorizontal: 24, gap: 36 }, countdown: { gap: 20, paddingHorizontal: 14 }, center: { textAlign: 'center' },
  timeCell: { flex: 1, alignItems: 'center' }, timeBorder: { borderLeftWidth: 1, borderColor: theme.colors.lineStrong },
  attendance: { gap: 18 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, sectionTitle: { fontSize: 28, lineHeight: 38 },
  confirmed: { flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  celebration: { position: 'absolute', right: 0, top: -70, width: 140, height: 100, overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: theme.colors.champagne, zIndex: 10 },
  fund: { borderTopWidth: 1, borderColor: theme.colors.line, paddingTop: 30 }, between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  progress: { marginTop: 18, height: 4, backgroundColor: theme.colors.field, borderRadius: 2, overflow: 'hidden' }, footnote: { fontSize: 10, color: theme.colors.muted, marginTop: 8 },
  santa: { flexDirection: 'row', alignItems: 'center', gap: 16, borderColor: 'rgba(191,165,119,0.25)' },
  post: { paddingVertical: 22, borderBottomWidth: 1, borderColor: theme.colors.line, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }, postImage: { height: 72, width: 72, borderRadius: 14 },
  organize: { minHeight: 44, marginTop: 8, borderTopWidth: 1, borderColor: theme.colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  organizeLabel: { fontSize: 12 },
});
