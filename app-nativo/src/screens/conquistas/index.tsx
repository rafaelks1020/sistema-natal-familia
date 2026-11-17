import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Award from 'lucide-react-native/icons/award';
import Lock from 'lucide-react-native/icons/lock';
import { useAutenticado } from '../familia/sessao';
import { theme } from '../../theme';
import type { ConquistaVista } from '../../types/pontos';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Skeleton } from '../../ui/Skeleton';
import { Surface } from '../../ui/Surface';
import { Text } from '../../ui/Text';
import { Cabecalho } from '../familia/Cabecalho';
import { usePontos } from '../pontos/dados';
import { agruparPorCategoria, faltaPouco, jaConquistadas, ROTULOS_NIVEL, valePontos } from './logica';

function Barra({ atual, meta, rotulo }: { atual: number; meta: number; rotulo: string }) {
  const parte = meta > 0 ? Math.min(1, Math.max(0, atual / meta)) : 0;
  return <View accessibilityRole="progressbar" accessibilityLabel={rotulo} accessibilityValue={{ min: 0, max: meta || 1, now: Math.min(atual, meta || 1) }} style={styles.barra}>
    <View style={{ width: `${parte * 100}%`, height: 8, backgroundColor: theme.colors.sage }} />
  </View>;
}

function Cartao({ c, modo }: { c: ConquistaVista; modo: 'falta' | 'feita' | 'lista' }) {
  const ganha = Boolean(c.ganha_em);
  const faltam = c.progresso ? Math.max(0, c.progresso.meta - c.progresso.atual) : 0;
  const data = c.ganha_em ? new Date(c.ganha_em).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }) : '';
  return <Surface style={styles.cartao}>
    <View style={styles.linha}>
      {ganha ? <Award size={26} color={theme.colors.champagne} strokeWidth={1.5} /> : <Lock size={24} color={theme.colors.muted} strokeWidth={1.5} />}
      <Text style={[styles.flex, styles.nome]}>{c.nome}</Text>
    </View>
    <Text variant="muted">{c.descricao}</Text>
    {!ganha && c.progresso ? <>
      {modo !== 'feita' ? <Text style={styles.destaque}>Faltam {faltam.toLocaleString('pt-BR')}</Text> : null}
      <Barra atual={c.progresso.atual} meta={c.progresso.meta} rotulo={`Progresso de ${c.nome}`} />
    </> : null}
    <Text variant="muted" style={ganha ? styles.destaque : undefined}>
      {ganha && modo !== 'falta' ? `Conquistada em ${data}. ` : ''}{ROTULOS_NIVEL[c.nivel]}. {valePontos(c)}
    </Text>
  </Surface>;
}

export default function Conquistas() {
  const autenticado = useAutenticado();
  const consulta = usePontos();
  const [todas, setTodas] = useState(false);
  if (!autenticado) return null;
  const dados = consulta.data;
  const lista = dados?.conquistas ?? [];
  const falta = faltaPouco(lista);
  const feitas = jaConquistadas(lista);
  return <ScrollView style={styles.pagina} contentContainerStyle={styles.miolo} contentInsetAdjustmentBehavior="automatic"
    refreshControl={<RefreshControl refreshing={consulta.isRefetching} onRefresh={() => { void consulta.refetch(); }} tintColor={theme.colors.champagne} colors={[theme.colors.cherry]} progressBackgroundColor={theme.colors.surface} />}>
    <Cabecalho titulo="Conquistas" kicker={dados ? `Natal de ${dados.ano}` : 'Natal em Família'} aoVoltar={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }} />
    <View style={styles.conteudo}>
      {consulta.isPending ? <Skeleton style={{ minHeight: 200 }} /> : !dados ? <EmptyState title="Não foi possível abrir as conquistas" message={consulta.error?.message ?? 'Tente de novo em instantes.'} action="Tentar novamente" onAction={() => { void consulta.refetch(); }} /> : <>
        <Surface style={styles.resumo}>
          <Text variant="display" style={styles.titulo}>Você tem {dados.conquistas_ganhas} de {dados.conquistas_total} conquistas</Text>
          <Barra atual={dados.conquistas_ganhas} meta={dados.conquistas_total} rotulo="Conquistas ganhas" />
          <Text variant="muted">Conquistas são prêmios por participar. Cada uma vale pontos: Bronze 20, Prata 50, Ouro 100 e Lendária 250.</Text>
        </Surface>

        {falta.length ? <View style={styles.secao}>
          <Text variant="display" accessibilityRole="header" style={styles.titulo}>Falta pouco</Text>
          {falta.map((c) => <Cartao key={c.id} c={c} modo="falta" />)}
        </View> : null}

        <View style={styles.secao}>
          <Text variant="display" accessibilityRole="header" style={styles.titulo}>Já conquistadas ({feitas.length})</Text>
          {feitas.length ? feitas.map((c) => <Cartao key={c.id} c={c} modo="feita" />) : <Text variant="muted">Suas primeiras conquistas vão aparecer aqui.</Text>}
        </View>

        <Button variant="ghost" onPress={() => setTodas((v) => !v)} selected={todas}>{todas ? 'Esconder a lista completa' : `Ver todas as ${dados.conquistas_total} conquistas`}</Button>
        {todas ? agruparPorCategoria(lista).map((g) => <View key={g.categoria} style={styles.secao}>
          <Text variant="display" accessibilityRole="header" style={styles.subtitulo}>{g.titulo} ({g.ganhas} de {g.itens.length})</Text>
          {g.itens.map((c) => <Cartao key={c.id} c={c} modo="lista" />)}
        </View>) : null}
      </>}
    </View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: theme.colors.background },
  miolo: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 48 },
  conteudo: { paddingHorizontal: 24, gap: 24, paddingTop: 8 },
  resumo: { gap: 14, borderColor: 'rgba(191,165,119,0.4)' }, secao: { gap: 12 }, cartao: { gap: 10 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12 }, flex: { flex: 1, minWidth: 0 }, nome: { fontFamily: theme.fonts.medium },
  titulo: { fontSize: 28, lineHeight: 38 }, subtitulo: { fontSize: 24, lineHeight: 32 },
  destaque: { color: theme.colors.champagne, fontFamily: theme.fonts.semibold },
  barra: { height: 8, borderRadius: 4, backgroundColor: theme.colors.field, overflow: 'hidden' },
});
