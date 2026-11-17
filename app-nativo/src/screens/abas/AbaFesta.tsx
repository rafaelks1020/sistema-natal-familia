import { ScrollView, StyleSheet, View } from 'react-native';
import Camera from 'lucide-react-native/icons/camera';
import Dices from 'lucide-react-native/icons/dices';
import Gamepad2 from 'lucide-react-native/icons/gamepad-2';
import Gift from 'lucide-react-native/icons/gift';
import MessageCircleHeart from 'lucide-react-native/icons/message-circle-heart';
import MicVocal from 'lucide-react-native/icons/mic-vocal';
import Trophy from 'lucide-react-native/icons/trophy';
import Tv from 'lucide-react-native/icons/tv';
import Users from 'lucide-react-native/icons/users';
import Vote from 'lucide-react-native/icons/vote';
import { theme } from '../../theme';
import { Cabecalho } from '../familia/Cabecalho';
import { ListaAtalhos, type Atalho } from './ListaAtalhos';

const ITENS: Atalho[] = [
  { site: '/karaoke', titulo: 'Karaokê', texto: 'Cante com a letra na TV', icon: MicVocal },
  { rota: '/amigo-oculto-ao-vivo', titulo: 'Revelação do amigo oculto', texto: 'Acompanhe cada surpresa da noite', icon: Gift },
  { site: '/ao-vivo', titulo: 'Mandar recado para a TV', texto: 'Sua mensagem aparece na TV da sala', icon: MessageCircleHeart },
  { rota: '/festa-quiz', titulo: 'Quiz da família', texto: 'Perguntas sobre a nossa história', icon: Trophy },
  { rota: '/festa-bingo', titulo: 'Bingo da ceia', texto: 'O tio contou a mesma piada? Marca!', icon: Dices },
  { rota: '/festa-enquete', titulo: 'Enquete ao vivo', texto: 'Votação na hora, com resultado na tela', icon: Vote },
  { rota: '/festa-desafio', titulo: 'Desafio de foto', texto: 'Melhor careta, melhor roupa e votação', icon: Camera },
  { rota: '/festa-foto-oficial', titulo: 'Foto oficial do ano', texto: 'A mesma pose, todo ano', icon: Users },
  { site: '/festa/jogos-novos', titulo: 'Jogos da noite', texto: 'Mímica, quem é o bebê, roleta e times', icon: Gamepad2 },
  { site: '/telao', titulo: 'Telão na TV', texto: 'Abra no navegador da TV ou do computador', icon: Tv },
];

export default function AbaFesta() {
  return <ScrollView style={styles.pagina} contentContainerStyle={styles.miolo} contentInsetAdjustmentBehavior="automatic">
    <Cabecalho kicker="Na noite de Natal" titulo="Festa" />
    <View style={styles.conteudo}><ListaAtalhos itens={ITENS} /></View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: theme.colors.background },
  miolo: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 48 },
  conteudo: { paddingHorizontal: 24, marginTop: 16 },
});
