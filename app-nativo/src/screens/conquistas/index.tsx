import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Award from 'lucide-react-native/icons/award';
import Lock from 'lucide-react-native/icons/lock';
import { useAutenticado } from '../familia/sessao';
import { theme } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { EmptyState } from '../../ui/EmptyState';
import { Skeleton } from '../../ui/Skeleton';
import { Surface } from '../../ui/Surface';
import { Text } from '../../ui/Text';
import { Cabecalho } from '../familia/Cabecalho';
import { useConquistas } from './data';

export default function Conquistas() {
  const autenticado = useAutenticado();
  const consulta = useConquistas();
  if (!autenticado) return null;
  const dados = consulta.data;
  return <ScrollView style={styles.pagina} contentContainerStyle={styles.miolo} contentInsetAdjustmentBehavior="automatic"
    refreshControl={<RefreshControl refreshing={consulta.isRefetching} onRefresh={() => { void consulta.refetch(); }} tintColor={theme.colors.champagne} />}>
    <Cabecalho titulo="Conquistas" kicker={dados ? `Nosso Natal de ${dados.ano}` : 'Cada gesto conta'} aoVoltar={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }} />
    <View style={styles.conteudo}>
      {consulta.isPending ? <Skeleton style={{ height: 200 }} /> : consulta.isError ? <EmptyState title="Não foi possível abrir as conquistas" message={consulta.error.message} action="Tentar novamente" onAction={() => { void consulta.refetch(); }} /> : dados ? <>
        <Text variant="muted">Cada gesto vira uma lembrança. Os selos celebram seu jeito de participar.</Text>
        {dados.selos.map((s) => <Surface key={s.id} style={styles.selo}>
          <View style={styles.linha}>{s.conquistado ? <Award size={24} color={theme.colors.champagne} /> : <Lock size={22} color={theme.colors.muted} />}<Text style={styles.flex}>{s.nome}</Text></View>
          <Text variant="muted">{s.descricao}</Text><Text style={{ color: s.conquistado ? theme.colors.champagne : theme.colors.muted, fontSize: 12 }}>{s.conquistado ? 'Conquistado' : 'Ainda por conquistar'}</Text>
        </Surface>)}
        <Text variant="kicker">Uma brincadeira da edição</Text><Text variant="display" style={styles.titulo}>Destaques da família</Text>
        <Text variant="muted">Um aplauso para quem espalhou memórias e carinho. Aqui todo mundo tem lugar.</Text>
        {dados.ranking.map((r) => <Surface key={r.id} style={styles.selo}><Text variant="display" style={styles.subtitulo}>{r.titulo}</Text>
          {!r.pessoas.length ? <Text variant="muted">As primeiras participações vão aparecer aqui.</Text> : r.pessoas.map((p) => <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Ver perfil de ${p.nome}`} onPress={() => router.push({ pathname: '/familia/[id]', params: { id: p.id } })} style={styles.pessoa}>
            <Avatar name={p.nome} src={p.avatar_url} size={40} /><View style={styles.flex}><Text>{p.nome}</Text><Text variant="muted">{p.total} {r.id === 'fotos' ? 'fotos' : r.id === 'comentarios' ? 'comentários' : 'curtidas'}</Text></View>
          </Pressable>)}
        </Surface>)}
      </> : null}
    </View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: theme.colors.background },
  miolo: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 48 },
  conteudo: { paddingHorizontal: 24, gap: 16 },
  selo: { gap: 12 }, linha: { flexDirection: 'row', alignItems: 'center', gap: 12 }, flex: { flex: 1 },
  titulo: { fontSize: 32, lineHeight: 40 }, subtitulo: { fontSize: 26, lineHeight: 34 },
  pessoa: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
});
