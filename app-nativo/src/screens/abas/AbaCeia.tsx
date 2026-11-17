import { ScrollView, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import Car from 'lucide-react-native/icons/car';
import Gift from 'lucide-react-native/icons/gift';
import Receipt from 'lucide-react-native/icons/receipt';
import UserPlus from 'lucide-react-native/icons/user-plus';
import Utensils from 'lucide-react-native/icons/utensils';
import Wallet from 'lucide-react-native/icons/wallet';
import { api, queryKeys } from '../../api';
import type { HomeData } from '../../types';
import { theme } from '../../theme';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';
import { Cabecalho } from '../familia/Cabecalho';
import { ListaAtalhos, type Atalho } from './ListaAtalhos';

const FUSO = 'America/Sao_Paulo';
const ITENS: Atalho[] = [
  { rota: '/ceia', titulo: 'A ceia', texto: 'Dizer se vai, quem leva o quê e as votações', icon: Utensils },
  { rota: '/vaquinha', titulo: 'Dinheiro da ceia', texto: 'Vaquinha, contas e Pix', icon: Wallet },
  { rota: '/amigo-oculto', titulo: 'Amigo oculto', texto: 'Veja quem você tirou e a lista de desejos', icon: Gift },
  { rota: '/caronas', titulo: 'Caronas e hospedagem', texto: 'Quem dá carona e quem tem quarto sobrando', icon: Car },
  { rota: '/advento', titulo: 'Calendário do Advento', texto: 'Uma surpresa por dia até o Natal', icon: CalendarDays },
  { rota: '/contas-da-ceia', titulo: 'Contas da ceia', texto: 'Quem pagou o quê e o acerto pelo Pix', icon: Receipt },
  { rota: '/convidar', titulo: 'Convidar parente', texto: 'Chamou gente nova? Peça o convite aqui', icon: UserPlus },
];

// Dia do calendário no fuso de São Paulo, em dias desde 1970 (para contar quantos faltam sem erro de fuso).
function diaNoFuso(data: Date): number {
  const [dia = 1, mes = 1, ano = 1970] = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: FUSO }).split('/').map(Number);
  return Math.round(Date.UTC(ano, mes - 1, dia) / 86_400_000);
}

function textoDaCeia(settings: HomeData['settings']): string {
  const data = new Date(settings.event_date);
  if (Number.isNaN(data.getTime())) return 'A data da ceia ainda vai ser combinada.';
  const dia = data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: FUSO });
  const [h, m] = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: FUSO }).split(':');
  const hora = m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
  const local = settings.event_place?.trim() ? `, em ${settings.event_place.trim()}` : '';
  const faltam = diaNoFuso(data) - diaNoFuso(new Date());
  const contagem = faltam > 1 ? `Faltam ${faltam} dias.` : faltam === 1 ? 'Falta 1 dia: é amanhã!' : faltam === 0 ? 'É hoje!' : 'A ceia deste ano já aconteceu.';
  const frase = `${dia}, às ${hora}${local}.`;
  return `${frase.charAt(0).toUpperCase()}${frase.slice(1)} ${contagem}`;
}

export default function AbaCeia() {
  const home = useQuery({ queryKey: queryKeys.home, queryFn: ({ signal }) => api<HomeData>('/api/home', { signal }) });
  return <ScrollView style={styles.pagina} contentContainerStyle={styles.miolo} contentInsetAdjustmentBehavior="automatic">
    <Cabecalho kicker="A mesa da família" titulo="Ceia" />
    <View style={styles.conteudo}>
      {home.data ? <Text style={styles.data} accessibilityRole="summary">{textoDaCeia(home.data.settings)}</Text>
        : home.isPending ? <Skeleton style={styles.carregando} />
          : <Text variant="muted">Não deu para trazer a data da ceia agora. Puxe para baixo na tela Hoje para tentar de novo.</Text>}
      <ListaAtalhos itens={ITENS} />
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: theme.colors.background },
  miolo: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 48 },
  conteudo: { paddingHorizontal: 24, marginTop: 16, gap: 24 },
  data: { fontSize: 18, lineHeight: 28 },
  carregando: { minHeight: 56 },
});
