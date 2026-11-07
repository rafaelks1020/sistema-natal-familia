import type { ComponentType } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import ArrowUpRight from 'lucide-react-native/icons/arrow-up-right';
import BookOpen from 'lucide-react-native/icons/book-open';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import Camera from 'lucide-react-native/icons/camera';
import Car from 'lucide-react-native/icons/car';
import Dices from 'lucide-react-native/icons/dices';
import Flame from 'lucide-react-native/icons/flame';
import Gamepad2 from 'lucide-react-native/icons/gamepad-2';
import Gift from 'lucide-react-native/icons/gift';
import HeartHandshake from 'lucide-react-native/icons/heart-handshake';
import Headphones from 'lucide-react-native/icons/headphones';
import Hourglass from 'lucide-react-native/icons/hourglass';
import Images from 'lucide-react-native/icons/images';
import Mail from 'lucide-react-native/icons/mail';
import Mic from 'lucide-react-native/icons/mic';
import MicVocal from 'lucide-react-native/icons/mic-vocal';
import PartyPopper from 'lucide-react-native/icons/party-popper';
import Receipt from 'lucide-react-native/icons/receipt';
import Sparkles from 'lucide-react-native/icons/sparkles';
import TreePine from 'lucide-react-native/icons/tree-pine';
import Trophy from 'lucide-react-native/icons/trophy';
import Tv from 'lucide-react-native/icons/tv';
import UserPlus from 'lucide-react-native/icons/user-plus';
import Users from 'lucide-react-native/icons/users';
import Utensils from 'lucide-react-native/icons/utensils';
import Vote from 'lucide-react-native/icons/vote';
import { API_BASE_URL } from '../../api';
import { theme } from '../../theme';
import { Text } from '../../ui/Text';
import { Cabecalho } from '../familia/Cabecalho';

type Icone = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
// rota começando com "web:" abre o site no navegador (o telão é para a TV).
type Item = { rota: string; titulo: string; texto: string; icon: Icone };
const GRUPOS: { titulo: string; itens: Item[] }[] = [
  { titulo: 'Antes da ceia', itens: [
    { rota: '/ceia', titulo: 'A ceia', texto: 'Presença, quem leva o quê e votações', icon: Utensils },
    { rota: '/advento', titulo: 'Calendário do Advento', texto: 'Uma surpresa por dia até o Natal', icon: CalendarDays },
    { rota: '/caronas', titulo: 'Caronas e hospedagem', texto: 'Quem dá carona e quem tem quarto sobrando', icon: Car },
    { rota: '/contas-da-ceia', titulo: 'Contas da ceia', texto: 'Quem pagou o quê e o acerto pelo Pix', icon: Receipt },
    { rota: '/playlist', titulo: 'Playlist da família', texto: 'As músicas da noite no Spotify', icon: Headphones },
    { rota: '/cartao', titulo: 'Cartão de Natal', texto: 'Sua foto num cartão para mandar no WhatsApp', icon: Mail },
    { rota: '/convidar', titulo: 'Convidar parente', texto: 'Chamou gente nova? Peça o convite aqui', icon: UserPlus },
  ] },
  { titulo: 'Na noite de Natal', itens: [
    { rota: '/festa', titulo: 'A festa', texto: 'Tudo da noite num lugar só', icon: PartyPopper },
    { rota: '/amigo-oculto-ao-vivo', titulo: 'Revelação ao vivo', texto: 'O amigo oculto revelado na hora', icon: Gift },
    { rota: '/festa-desafio', titulo: 'Desafio de foto', texto: 'Melhor careta, melhor look e votação', icon: Camera },
    { rota: '/festa-quiz', titulo: 'Quiz da família', texto: 'Quem disse isso? Que ano foi essa foto?', icon: Trophy },
    { rota: '/festa-bingo', titulo: 'Bingo da ceia', texto: 'O tio contou a mesma piada? Marca!', icon: Dices },
    { rota: '/festa-enquete', titulo: 'Enquete ao vivo', texto: 'Votação na hora, com resultado na tela', icon: Vote },
    { rota: '/festa-foto-oficial', titulo: 'Foto oficial do ano', texto: 'A mesma pose, todo ano', icon: Users },
    { rota: 'web:/karaoke', titulo: 'Karaokê', texto: 'Escolha a música, entre na fila e veja seus melhores momentos', icon: MicVocal },
    { rota: 'web:/festa/jogos-novos', titulo: 'Jogos da noite', texto: 'Mímica, quem é o bebê, roleta e times', icon: Gamepad2 },
    { rota: 'web:/ao-vivo', titulo: 'Telão ao vivo', texto: 'Mande reações e recados para a TV', icon: HeartHandshake },
    { rota: 'web:/telao', titulo: 'Telão na TV', texto: 'Abra no navegador da TV ou do computador', icon: Tv },
  ] },
  { titulo: 'Memórias da família', itens: [
    { rota: '/memorias', titulo: 'Memórias', texto: 'Neste dia, linha do tempo e retrospectiva', icon: Images },
    { rota: '/receitas', titulo: 'Livro de receitas', texto: 'A receita da vó, com o segredo', icon: BookOpen },
    { rota: '/historias', titulo: 'Histórias contadas', texto: 'Como era o Natal antigamente, em áudio', icon: Mic },
    { rota: '/capsula', titulo: 'Cápsula do tempo', texto: 'Uma mensagem que só abre no próximo Natal', icon: Hourglass },
    { rota: '/arvore', titulo: 'Árvore da família', texto: 'Quem é filho de quem', icon: TreePine },
    { rota: '/homenagem', titulo: 'Homenagem', texto: 'Lembranças de quem partiu', icon: Flame },
    { rota: '/conquistas', titulo: 'Conquistas', texto: 'Selos e o ranking leve do ano', icon: Sparkles },
  ] },
];

function abrir(rota: string) {
  if (rota.startsWith('web:')) void Linking.openURL(`${API_BASE_URL}${rota.slice(4)}`);
  else router.push(rota as Href);
}

export default function TudoDoNatal() {
  return <View style={styles.page}>
    <ScrollView contentContainerStyle={styles.content}>
      <Cabecalho kicker="Natal em Família" titulo="Tudo do Natal" aoVoltar={() => router.back()} />
      {GRUPOS.map(grupo => <View key={grupo.titulo} style={styles.grupo}>
        <Text variant="kicker">{grupo.titulo}</Text>
        <View style={styles.lista}>
          {grupo.itens.map(({ rota, titulo, texto, icon: Icon }) => <Pressable key={rota} accessibilityRole="button" accessibilityLabel={titulo}
            onPress={() => abrir(rota)} style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}>
            <View style={styles.icone}><Icon size={20} color={theme.colors.champagne} strokeWidth={1.5} /></View>
            <View style={styles.flex}>
              <Text variant="display" style={styles.titulo}>{titulo}</Text>
              <Text variant="muted" style={styles.texto}>{texto}</Text>
            </View>
            <ArrowUpRight size={16} color={theme.colors.champagne} strokeWidth={1.5} />
          </Pressable>)}
        </View>
      </View>)}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingBottom: 60 },
  grupo: { paddingHorizontal: 24, marginTop: 28, gap: 12 },
  lista: { borderTopWidth: 1, borderColor: theme.colors.line },
  item: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: theme.colors.line },
  icone: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(191,165,119,0.4)', alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  titulo: { fontSize: 20, lineHeight: 26 },
  texto: { fontSize: 12, marginTop: 2 },
});
