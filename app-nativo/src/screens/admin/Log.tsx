import { useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../../api';
import { theme } from '../../theme';
import { EmptyState } from '../../ui/EmptyState';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';
import { Cabecalho } from '../familia/Cabecalho';
import { quandoBr, voltar } from './comum';
import { adminKeys, type PaginaLog } from './tipos';

export default function Log() {
  const consulta = useInfiniteQuery({
    queryKey: adminKeys.log,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => api<PaginaLog>(`/api/admin/log${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`, { signal }),
    getNextPageParam: (ultima) => ultima.proximo ?? undefined,
  });
  const itens = useMemo(() => consulta.data?.pages.flatMap((p) => p.itens) ?? [], [consulta.data]);
  return <View style={styles.pagina}>
    <FlatList
      data={itens}
      keyExtractor={(i) => String(i.id)}
      ListHeaderComponent={<Cabecalho kicker="Painel admin" titulo="Registro de ações" aoVoltar={voltar} />}
      contentContainerStyle={styles.miolo}
      onEndReachedThreshold={0.4}
      onEndReached={() => { if (consulta.hasNextPage && !consulta.isFetchingNextPage) void consulta.fetchNextPage(); }}
      refreshing={consulta.isRefetching && !consulta.isFetchingNextPage}
      onRefresh={() => { void consulta.refetch(); }}
      renderItem={({ item }) => <View style={styles.linha}>
        <Text variant="kicker">{quandoBr(item.quando)}</Text>
        <Text style={styles.titulo}>{item.quem} · {item.acao}</Text>
        <Text variant="muted">{item.recurso}{item.alvo_id ? ` #${item.alvo_id}` : ''}</Text>
        {item.detalhe ? <Text variant="muted" selectable>{item.detalhe}</Text> : null}
      </View>}
      ListEmptyComponent={consulta.isPending ? <View style={styles.esqueleto}><Skeleton style={{ height: 70 }} /><Skeleton style={{ height: 70 }} /></View>
        : consulta.isError ? <EmptyState title="Não deu para carregar" message={consulta.error.message} action="Tentar novamente" onAction={() => { void consulta.refetch(); }} />
        : <EmptyState title="Nada registrado ainda" message="As mudanças feitas no painel aparecem aqui." />}
      ListFooterComponent={consulta.isFetchingNextPage ? <ActivityIndicator color={theme.colors.champagne} style={styles.rodape} /> : undefined}
    />
  </View>;
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: theme.colors.background },
  miolo: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 48 },
  esqueleto: { paddingHorizontal: 24, gap: 12 },
  rodape: { paddingVertical: 20 },
  linha: { marginHorizontal: 24, paddingVertical: 14, gap: 3, borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  titulo: { fontFamily: theme.fonts.medium, fontSize: 15 },
});
