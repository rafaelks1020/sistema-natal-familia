import { Pressable, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Flame from 'lucide-react-native/icons/flame';
import { theme } from '../../theme';
import { Button } from '../../ui/Button';
import { Skeleton } from '../../ui/Skeleton';
import { Surface } from '../../ui/Surface';
import { Text } from '../../ui/Text';
import { usePontos } from './dados';
import { maisPontos, proximasSugestoes } from './logica';

export default function CartaoPontos() {
  const consulta = usePontos();
  const pontos = consulta.data;
  if (consulta.isPending) return <Skeleton style={styles.carregando} />;
  const proximas = proximasSugestoes(pontos?.sugestoes, 3);
  return <Surface style={styles.cartao} accessibilityLabel="Seus pontos do Natal">
    <Text variant="kicker">Pontos do Natal</Text>
    {pontos ? <Text variant="display" style={styles.titulo}>Você tem <Text variant="numeral" style={styles.numero}>{pontos.total.toLocaleString('pt-BR')}</Text> {pontos.total === 1 ? 'ponto' : 'pontos'}</Text>
      : <Text variant="display" style={styles.titulo}>Seus pontos do Natal</Text>}
    {pontos ? <Text variant="muted">
      Quem tiver mais pontos na noite de Natal é o Campeão do Natal.{pontos.posicao !== null ? ` Você está em ${pontos.posicao}º lugar.` : ' As posições ficam em segredo até a festa.'}
    </Text> : null}
    {proximas.length ? <View style={styles.sugestoes}>
      <Text accessibilityRole="header" style={styles.subtitulo}>Para ganhar mais pontos hoje</Text>
      {proximas.map((s, indice) => <Pressable key={s.regra} accessibilityRole="button" accessibilityLabel={`${s.titulo}. ${maisPontos(s.pontos)}`}
        onPress={() => router.push(s.href as Href)} style={[styles.linha, indice > 0 && styles.linhaBorda]}>
        <Text style={styles.flex}>{s.titulo}</Text>
        <Text style={styles.valor}>{maisPontos(s.pontos)}</Text>
        <ChevronRight size={20} color={theme.colors.champagne} strokeWidth={1.6} />
      </Pressable>)}
    </View> : null}
    <View style={styles.botoes}>
      <Button variant="ghost" onPress={() => router.push('/pontos')} icon={<ChevronRight size={18} color={theme.colors.champagne} strokeWidth={1.6} />}>Como funcionam os pontos</Button>
      {pontos ? <View style={styles.dupla}>
        <Button variant="ghost" style={styles.flex} onPress={() => router.push('/conquistas')}>{`Conquistas (${pontos.conquistas_ganhas} de ${pontos.conquistas_total})`}</Button>
        <Button variant="ghost" style={styles.flex} onPress={() => router.push('/missoes')} icon={<Flame size={18} color={theme.colors.cherry} strokeWidth={1.6} />}>Missões</Button>
      </View> : null}
    </View>
  </Surface>;
}
const styles = StyleSheet.create({
  carregando: { minHeight: 220, borderRadius: theme.radius.card },
  cartao: { gap: 12, padding: 22, borderColor: 'rgba(191,165,119,0.35)' },
  titulo: { fontSize: 24, lineHeight: 36 }, numero: { fontSize: 36, lineHeight: 44, color: theme.colors.champagne },
  sugestoes: { borderTopWidth: 1, borderColor: theme.colors.line, paddingTop: 12 },
  subtitulo: { fontFamily: theme.fonts.semibold },
  linha: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  linhaBorda: { borderTopWidth: 1, borderColor: theme.colors.line },
  flex: { flex: 1, minWidth: 0 }, valor: { color: theme.colors.champagne, fontFamily: theme.fonts.semibold, fontSize: 15 },
  botoes: { gap: 8, borderTopWidth: 1, borderColor: theme.colors.line, paddingTop: 16 }, dupla: { flexDirection: 'row', gap: 8 },
});
