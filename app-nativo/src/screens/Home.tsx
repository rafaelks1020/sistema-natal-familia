import { AtivarAvisos } from './AtivarAvisos';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ArrowUpRight from 'lucide-react-native/icons/arrow-up-right';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import Gift from 'lucide-react-native/icons/gift';
import MapPin from 'lucide-react-native/icons/map-pin';
import Flame from 'lucide-react-native/icons/flame';
import Users from 'lucide-react-native/icons/users';
import Wallet from 'lucide-react-native/icons/wallet';
import { api, ApiError, queryClient, queryKeys, sessionStore } from '../api';
import { brl, greeting, timeAgo } from '../format';
import { useSession } from '../session';
import type { Attendance, AttendanceStatus, HomeData, User } from '../types';
import { theme } from '../theme';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { LoopVideo } from '../ui/LoopVideo';
import { media } from '../media';
import { Rise } from '../ui/motion';
import { PerguntaLetra } from '../ui/TamanhoDaLetra';
import { Skeleton } from '../ui/Skeleton';
import { Surface } from '../ui/Surface';
import { Text } from '../ui/Text';
import { useToast } from '../ui/Toast';
import { syncWidget } from '../widget/sync';
import { useMissoes } from './pontos/dados';
import CartaoPontos from './pontos/CartaoPontos';

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
  // Só o que muda a tela vira estado: se o vídeo do topo está visível. Guardar a posição da rolagem em estado
  // redesenhava a tela inteira várias vezes por segundo enquanto a pessoa rolava (25% dos quadros travavam no S24).
  const [heroVisivel, setHeroVisivel] = useState(true);
  const saving = useRef(false);
  const heroHeight = Math.max(300, Math.min(height * 0.42, 420));
  const home = useQuery({ queryKey: queryKeys.home, queryFn: ({ signal }) => api<HomeData>('/api/home', { signal }) });
  const missoes = useMissoes();
  const agora = useClock(60000);
  useEffect(() => { if (home.error) toast(home.error.message, 'error'); }, [home.error, toast]);
  useEffect(() => { if (home.data) void syncWidget(home.data.settings); }, [home.data?.settings.event_date, home.data?.settings.event_title]); // eslint-disable-line react-hooks/exhaustive-deps
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
        toast('Seu lugar à mesa está confirmado! Confirmar presença vale 30 pontos.');
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
  const adventoHoje = emAdvento(agora);
  const missoesAbertas = (missoes.data?.ativas ?? []).filter(missao => !missao.minha_resposta);
  function respond(status: AttendanceStatus) {
    if (saving.current || mutation.isPending || attendance.mine === status) return;
    if (user?.participant_id === null) { toast('Seu acesso ainda não está ligado a um participante. Peça para quem organiza.', 'error'); return; }
    saving.current = true; mutation.mutate({ status, generation: sessionStore.getGeneration() });
  }
  return <View style={styles.page}>
    <ScrollView contentContainerStyle={{ paddingBottom: 32, width: '100%', maxWidth: 720, alignSelf: 'center' }}
      contentInsetAdjustmentBehavior="automatic" scrollEventThrottle={160} onScroll={event => setHeroVisivel(event.nativeEvent.contentOffset.y < heroHeight)}
      refreshControl={<RefreshControl refreshing={home.isRefetching && !mutation.isPending} onRefresh={() => { if (!saving.current) { void home.refetch(); void missoes.refetch(); } }} tintColor={theme.colors.champagne} colors={[theme.colors.cherry]} progressBackgroundColor={theme.colors.surface} progressViewOffset={insets.top} />}>
      <View style={[styles.hero, { minHeight: heroHeight, paddingTop: insets.top + 76 }]}>
        <LoopVideo name="mn-hero" visible={heroVisivel} style={[StyleSheet.absoluteFill, { opacity: 0.8 }]} />
        <LinearGradient colors={['rgba(23,27,24,0.1)', 'rgba(23,27,24,0.2)', theme.colors.background]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
        <Pressable style={[styles.profile, { top: insets.top + 16 }]} accessibilityRole="button" accessibilityLabel="Abrir minha área" onPress={() => router.navigate('/aba-eu' as Href)}>
          <Avatar name={user.name} src={user.avatar_url} size={48} />
        </Pressable>
        <Rise style={styles.heroText}>
          <Text variant="kicker">{dateLabel}</Text>
          <View accessible accessibilityRole="header" accessibilityLabel="Natal em Família">
            <Text variant="display" style={[styles.title, { fontSize: Math.min(64, width * 0.14), lineHeight: Math.min(64, width * 0.14) * 1.1 }]}>Natal em</Text>
            <Text variant="displayItalic" style={[styles.title, { fontSize: Math.min(64, width * 0.14), lineHeight: Math.min(64, width * 0.14) * 1.1 }]}>Família</Text>
          </View>
          <View style={styles.redRule} /><Greeting name={user.name} />
          {settings.event_place ? <View style={styles.inline}><MapPin size={16} color={theme.colors.champagne} strokeWidth={1.5} /><Text variant="muted" style={styles.flex}>{settings.event_place}</Text></View> : null}
        </Rise>
      </View>
      <View style={styles.content}>
        <Rise index={1}><Surface style={styles.countdown}>
          <Image source={media['mn-countdown'].poster} contentFit="cover" style={[StyleSheet.absoluteFill, { opacity: 0.25 }]} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(23,27,24,0.45)' }]} />
          <Text variant="kicker" style={styles.center}>{settings.event_title}</Text><Countdown target={date.getTime()} />
        </Surface></Rise>

        <Rise index={2} style={styles.agora}>
          <Text variant="display" accessibilityRole="header" style={styles.sectionTitle}>Para fazer agora</Text>
          <PerguntaLetra />
          <AtivarAvisos />
          {attendance.mine === null ? <Surface style={styles.attendance}>
            <View style={styles.heading}><Users size={22} color={theme.colors.champagne} strokeWidth={1.5} /><Text variant="display" style={styles.perguntaTitulo}>Você vai à ceia?</Text></View>
            <View style={styles.row}>
              {(['yes', 'maybe', 'no'] as const).map((status, index) => <Button key={status} style={styles.flex} variant="ghost"
                disabled={mutation.isPending || user.participant_id === null} onPress={() => respond(status)}>{['Vou', 'Talvez', 'Não'][index]}</Button>)}
            </View>
            {user.participant_id === null ? <Text variant="muted">Peça para quem organiza vincular seu acesso a um participante para confirmar presença.</Text> : null}
            <View style={styles.confirmed}>
              <View style={styles.inline}>{confirmed.slice(0, 5).map((person, index) => <View key={person.participant_id} style={{ marginLeft: index ? -10 : 0 }}><Avatar name={person.name} src={person.avatar_url} size={32} /></View>)}</View>
              <Text variant="muted" style={styles.flex} accessibilityLiveRegion="polite">{attendance.counts.yes ? `${attendance.counts.yes} ${attendance.counts.yes === 1 ? 'pessoa confirmada' : 'pessoas confirmadas'}` : 'A mesa está esperando pela família.'}</Text>
            </View>
          </Surface> : <View style={styles.respondeu}>
            <Text variant="muted" style={styles.flex}>Você respondeu: {RESPOSTA[attendance.mine]}.</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Mudar minha resposta sobre a ceia" onPress={() => router.push('/ceia')} style={styles.mudar}><Text style={styles.mudarTexto}>Mudar</Text></Pressable>
          </View>}
          {celebrate ? <View style={styles.celebration} accessibilityLiveRegion="polite" accessibilityLabel="Vamos brindar à sua presença"><LoopVideo name="mn-brinde" once style={StyleSheet.absoluteFill} /></View> : null}
          {secretSanta.active && !secretSanta.revealed ? <CartaoAcao href="/amigo-oculto" icone={Gift} titulo="Veja quem você tirou no amigo oculto" texto="O nome fica só com você" /> : null}
          {adventoHoje ? <CartaoAcao href="/advento" icone={CalendarDays} titulo="Abra a janelinha de hoje do Advento" texto="A surpresa deste dia" /> : null}
          {missoesAbertas.map(missao => <CartaoAcao key={missao.id} href="/missoes" icone={Flame} titulo={`Missão relâmpago: ${missao.titulo}`} texto={`+${missao.pontos} ${missao.pontos === 1 ? 'ponto' : 'pontos'}`} />)}
          {vaquinha.total > 0 ? <CartaoAcao href="/vaquinha" icone={Wallet} titulo="Dinheiro da ceia" texto={`${brl(vaquinha.saldo)} de saldo. ${vaquinha.pagos} de ${vaquinha.total} já pagaram`} /> : null}
        </Rise>

        <Rise index={3}><CartaoPontos /></Rise>

        <Rise index={4}>
          <View style={styles.between}><Text variant="display" accessibilityRole="header" style={styles.sectionTitle}>No mural</Text><Button variant="quiet" onPress={() => router.navigate('/mural')} icon={<ArrowUpRight size={18} color={theme.colors.champagne} />}>Ver tudo</Button></View>
          {recentPosts.length ? recentPosts.slice(0, 2).map(post => <Pressable key={post.id} style={styles.post} accessibilityRole="button" accessibilityLabel={`Recado de ${post.user_name}`} onPress={() => router.navigate('/mural')}>
            <Avatar name={post.user_name} src={post.avatar_url} size={40} />
            <View style={styles.flex}><Text style={styles.autor}>{post.user_name}</Text><Text variant="muted">{timeAgo(post.created_at)}</Text><Text variant="muted" numberOfLines={3} style={{ marginTop: 8 }}>{post.content}</Text></View>
            {post.first_image ? <Image source={{ uri: post.first_image }} contentFit="cover" accessibilityLabel="Foto compartilhada no mural" style={styles.postImage} /> : null}
          </Pressable>) : <View style={{ paddingVertical: 24, gap: 8 }}><Text variant="display" style={{ fontSize: 23 }}>As primeiras memórias começam aqui.</Text><Text variant="muted">Logo, os recados da família vão encher este cantinho.</Text></View>}
        </Rise>
        <Text variant="kicker" style={[styles.center, { color: theme.colors.muted, paddingTop: 6 }]}>Feito para viver junto</Text>
      </View>
    </ScrollView>
  </View>;
}
const RESPOSTA: Record<AttendanceStatus, string> = { yes: 'Vou', maybe: 'Talvez', no: 'Não' };
/** De 1 a 24 de dezembro, no horário de Brasília. */
function emAdvento(agora: number): boolean {
  const partes = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'numeric' }).formatToParts(agora);
  const dia = Number(partes.find(p => p.type === 'day')?.value);
  const mes = Number(partes.find(p => p.type === 'month')?.value);
  return mes === 12 && dia >= 1 && dia <= 24;
}
function CartaoAcao({ href, icone: Icone, titulo, texto }: { href: Href; icone: typeof Gift; titulo: string; texto: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${titulo}. ${texto}`} onPress={() => router.push(href)}>
    <Surface style={styles.acao}>
      <View style={styles.acaoIcone}><Icone size={24} color={theme.colors.champagne} strokeWidth={1.5} /></View>
      <View style={styles.flex}><Text variant="display" style={styles.acaoTitulo}>{titulo}</Text><Text variant="muted">{texto}</Text></View>
      <ArrowUpRight size={20} color={theme.colors.champagne} />
    </Surface>
  </Pressable>;
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
    <Text variant="numeral" style={{ fontSize: 46 }}>{String(value).padStart(2, '0')}</Text><Text variant="muted">{['dias', 'horas', 'minutos'][index]}</Text>
  </View>)}</View>;
}
function HomeSkeleton() {
  return <View style={[styles.page, { padding: 24, paddingTop: 110, gap: 24 }]} accessibilityLabel="Preparando o início"><Skeleton style={{ height: 220 }} /><Skeleton style={{ height: 145 }} /><Skeleton style={{ height: 120 }} /><Skeleton style={{ height: 80 }} /></View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background }, hero: { justifyContent: 'flex-end', paddingHorizontal: 24, paddingBottom: 32 },
  profile: { position: 'absolute', right: 20, padding: 4, minWidth: 56, minHeight: 56, zIndex: 2 }, heroText: { gap: 12 },
  title: { lineHeight: 70 }, redRule: { height: 1, width: 64, backgroundColor: theme.colors.cherry, marginVertical: 4 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 }, row: { flexDirection: 'row', gap: 8 }, flex: { flex: 1, minWidth: 0 },
  content: { paddingHorizontal: 24, gap: 32 }, countdown: { gap: 20, paddingHorizontal: 14 }, center: { textAlign: 'center' },
  timeCell: { flex: 1, alignItems: 'center' }, timeBorder: { borderLeftWidth: 1, borderColor: theme.colors.lineStrong },
  agora: { gap: 16 }, attendance: { gap: 16 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionTitle: { fontSize: 28, lineHeight: 38 }, perguntaTitulo: { fontSize: 26, lineHeight: 34, flex: 1 },
  confirmed: { flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  respondeu: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  mudar: { minHeight: 48, minWidth: 80, alignItems: 'center', justifyContent: 'center' }, mudarTexto: { color: theme.colors.champagne, fontFamily: theme.fonts.semibold },
  celebration: { position: 'absolute', right: 0, top: -70, width: 140, minHeight: 100, overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: theme.colors.champagne, zIndex: 10 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  acao: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderColor: 'rgba(191,165,119,0.25)' },
  acaoIcone: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(191,165,119,0.5)', alignItems: 'center', justifyContent: 'center' },
  acaoTitulo: { fontSize: 22, lineHeight: 29 },
  post: { minHeight: 48, paddingVertical: 20, borderBottomWidth: 1, borderColor: theme.colors.line, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  autor: { fontFamily: theme.fonts.medium }, postImage: { height: 72, width: 72, borderRadius: 14 },
});
