import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Flame from 'lucide-react-native/icons/flame';
import { theme } from '../../theme';
import { abrirNoSite } from '../../web';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Skeleton } from '../../ui/Skeleton';
import { Surface } from '../../ui/Surface';
import { Text } from '../../ui/Text';
import { Cabecalho } from '../familia/Cabecalho';
import { useAutenticado } from '../familia/sessao';
import { useMissoes } from '../pontos/dados';
import { dataHoraSP, maisPontos } from '../pontos/logica';

function voltar() { if (router.canGoBack()) router.back(); else router.replace('/'); }

export default function Missoes() {
  const autenticado = useAutenticado();
  const consulta = useMissoes();
  if (!autenticado) return null;
  const dados = consulta.data;
  return <ScrollView style={styles.pagina} contentContainerStyle={styles.miolo} contentInsetAdjustmentBehavior="automatic"
    refreshControl={<RefreshControl refreshing={consulta.isRefetching} onRefresh={() => { void consulta.refetch(); }} tintColor={theme.colors.champagne} colors={[theme.colors.cherry]} progressBackgroundColor={theme.colors.surface} />}>
    <Cabecalho kicker={dados ? `Natal de ${dados.ano}` : 'Natal em Família'} titulo="Missões relâmpago" aoVoltar={voltar} />
    <View style={styles.conteudo}>
      <Text variant="muted">Um desafio surpresa, com prazo. Quem responde a tempo ganha os pontos da missão.</Text>
      {consulta.isPending ? <Skeleton style={{ minHeight: 180 }} />
        : !dados ? <EmptyState title="Não foi possível abrir as missões" message={consulta.error?.message ?? 'Tente de novo em instantes.'} action="Tentar novamente" onAction={() => { void consulta.refetch(); }} />
        : dados.ativas.length === 0 ? <EmptyState title="Nenhuma missão valendo agora" message="Quando aparecer uma, o aviso chega no celular." />
        : dados.ativas.map((m) => <Surface key={m.id} style={styles.cartao}>
          <View style={styles.topo}><Flame size={22} color={theme.colors.cherry} strokeWidth={1.6} /><Text style={styles.valor}>{maisPontos(m.pontos)}</Text></View>
          <Text variant="display" accessibilityRole="header" style={styles.titulo}>{m.titulo}</Text>
          <Text variant="muted">{m.descricao}</Text>
          <Text variant="muted">Termina em {dataHoraSP(m.termina_em)}</Text>
          {m.minha_resposta ? <Text style={styles.respondeu}>Você já respondeu</Text> : <View style={styles.acao}>
            <Button onPress={() => { void abrirNoSite('/missoes'); }}>Responder agora</Button>
            <Text variant="muted" style={styles.centro}>Abre no navegador</Text>
          </View>}
        </Surface>)}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: theme.colors.background },
  miolo: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 48 },
  conteudo: { paddingHorizontal: 24, gap: 16, paddingTop: 8 },
  cartao: { gap: 12, borderColor: 'rgba(197,41,45,0.45)' }, topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  valor: { color: theme.colors.champagne, fontFamily: theme.fonts.semibold }, titulo: { fontSize: 26, lineHeight: 34 },
  respondeu: { color: theme.colors.champagne, fontFamily: theme.fonts.semibold }, acao: { gap: 8 }, centro: { textAlign: 'center' },
});
