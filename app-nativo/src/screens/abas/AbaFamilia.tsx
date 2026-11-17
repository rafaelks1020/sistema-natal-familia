import { ScrollView, StyleSheet, View } from 'react-native';
import BookOpen from 'lucide-react-native/icons/book-open';
import Flame from 'lucide-react-native/icons/flame';
import Headphones from 'lucide-react-native/icons/headphones';
import Hourglass from 'lucide-react-native/icons/hourglass';
import Images from 'lucide-react-native/icons/images';
import Mail from 'lucide-react-native/icons/mail';
import MessagesSquare from 'lucide-react-native/icons/messages-square';
import Mic from 'lucide-react-native/icons/mic';
import Sparkles from 'lucide-react-native/icons/sparkles';
import TreePine from 'lucide-react-native/icons/tree-pine';
import Users from 'lucide-react-native/icons/users';
import { theme } from '../../theme';
import { Cabecalho } from '../familia/Cabecalho';
import { ListaAtalhos, type Atalho } from './ListaAtalhos';

const ITENS: Atalho[] = [
  { rota: '/mural', titulo: 'Mural da família', texto: 'Recados, fotos e enquetes', icon: MessagesSquare },
  { rota: '/album', titulo: 'Álbum de fotos', texto: 'As fotos de todos os Natais', icon: Images },
  { rota: '/familia', titulo: 'As pessoas da família', texto: 'Quem é quem, com foto', icon: Users },
  { rota: '/memorias', titulo: 'Memórias', texto: 'Neste dia, linha do tempo e retrospectiva', icon: Sparkles },
  { rota: '/receitas', titulo: 'Livro de receitas', texto: 'A receita da vó, com o segredo', icon: BookOpen },
  { rota: '/historias', titulo: 'Histórias contadas', texto: 'Como era o Natal antigamente, em áudio', icon: Mic },
  { rota: '/arvore', titulo: 'Árvore da família', texto: 'Quem é filho de quem', icon: TreePine },
  { rota: '/homenagem', titulo: 'Homenagem', texto: 'Lembranças de quem partiu', icon: Flame },
  { rota: '/capsula', titulo: 'Cápsula do tempo', texto: 'Uma mensagem que só abre no próximo Natal', icon: Hourglass },
  { rota: '/playlist', titulo: 'Playlist da família', texto: 'As músicas da noite', icon: Headphones },
  { rota: '/cartao', titulo: 'Cartão de Natal', texto: 'Sua foto num cartão para mandar no WhatsApp', icon: Mail },
];

export default function AbaFamilia() {
  return <ScrollView style={styles.pagina} contentContainerStyle={styles.miolo} contentInsetAdjustmentBehavior="automatic">
    <Cabecalho kicker="Memórias e conversas" titulo="Família" />
    <View style={styles.conteudo}><ListaAtalhos itens={ITENS} /></View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: theme.colors.background },
  miolo: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 48 },
  conteudo: { paddingHorizontal: 24, marginTop: 16 },
});
