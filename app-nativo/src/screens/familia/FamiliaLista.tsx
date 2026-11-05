import { useEffect } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { api } from '../../api';
import type { Membro, Presenca } from '../../types/familia';
import { theme } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { EmptyState } from '../../ui/EmptyState';
import { Rise } from '../../ui/motion';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { Cabecalho } from './Cabecalho';
import { familiaKeys } from './chaves';
import { useAutenticado } from './sessao';

const presencaTexto: Record<Presenca, string> = { yes: 'Vou', maybe: 'Talvez', no: 'Não' };
const presencaCor: Record<Presenca, string> = { yes: theme.colors.sage, maybe: theme.colors.champagne, no: theme.colors.muted };

export default function FamiliaLista() {
  const ok = useAutenticado();
  const toast = useToast();
  const lista = useQuery({
    queryKey: familiaKeys.lista,
    queryFn: ({ signal }) => api<Membro[]>('/api/family', { signal }),
    enabled: ok,
  });
  useEffect(() => { if (lista.error) toast(lista.error.message, 'error'); }, [lista.error, toast]);
  if (!ok) return null;
  return <View style={styles.pagina}>
    <ScrollView contentContainerStyle={styles.miolo} contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={lista.isRefetching} onRefresh={() => { void lista.refetch(); }} tintColor={theme.colors.champagne} colors={[theme.colors.cherry]} progressBackgroundColor={theme.colors.surface} />}>
      <Cabecalho kicker="Quem faz o nosso Natal" titulo="A" italico="família" aoVoltar={() => { if (router.canGoBack()) router.back(); else router.navigate('/'); }}
        extra={lista.data ? <Text variant="numeral" accessibilityLabel={`${lista.data.length} ${lista.data.length === 1 ? 'pessoa' : 'pessoas'}`} style={styles.total}>{lista.data.length}</Text> : null} />
      <Text variant="muted" style={styles.chamada}>Cada história tem um lugar à mesa.</Text>
      <View style={styles.regua} />
      {lista.isPending ? <Esqueleto /> : !lista.data ? <EmptyState title="Não foi possível reunir a família" message={lista.error?.message ?? 'Tente novamente para ver os perfis.'} action="Tentar novamente" onAction={() => { void lista.refetch(); }} />
        : lista.data.length === 0 ? <EmptyState title="A mesa está sendo preparada" message="Os parentes aparecerão aqui quando forem adicionados." />
          : lista.data.map((membro, indice) => <Linha key={membro.id !== null ? `u${membro.id}` : `p${membro.participant_id ?? indice}`} membro={membro} indice={indice} />)}
    </ScrollView>
  </View>;
}

function Linha({ membro, indice }: { membro: Membro; indice: number }) {
  const posts = membro.posts_count ?? 0;
  const conteudo = <View style={styles.linha}>
    <Avatar name={membro.name} src={membro.avatar_url} size={58} />
    <View style={styles.flex}>
      <View style={styles.nomeLinha}>
        <Text variant="display" style={styles.nome}>{membro.name}</Text>
        {membro.is_admin ? <Text style={styles.selo}>organiza</Text> : null}
      </View>
      {membro.bio ? <Text variant="muted" numberOfLines={2} style={styles.bio}>{membro.bio}</Text> : null}
      <View style={styles.meta}>
        <Text variant="muted" style={styles.metaTexto}>{membro.has_login ? `${posts} ${posts === 1 ? 'post' : 'posts'}` : 'ainda sem acesso'}</Text>
        {membro.attendance ? <Text style={[styles.metaTexto, { color: presencaCor[membro.attendance] }]}>{presencaTexto[membro.attendance]}</Text> : null}
      </View>
    </View>
    {membro.has_login ? <ChevronRight size={18} color={theme.colors.muted} strokeWidth={1.5} /> : null}
  </View>;
  return <Rise index={Math.min(indice, 6)}>
    {membro.id !== null && membro.has_login ? <Pressable accessibilityRole="button" accessibilityLabel={`Abrir perfil de ${membro.name}`}
      onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); router.push(`/familia/${String(membro.id)}`); }}
      style={({ pressed }) => (pressed ? styles.pressionado : undefined)}>{conteudo}</Pressable>
      : <View style={styles.semAcesso}>{conteudo}</View>}
  </Rise>;
}

function Esqueleto() {
  return <View accessibilityLabel="Preparando a família" style={styles.esqueleto}>{[0, 1, 2, 3].map((item) => <View key={item} style={styles.linha}>
    <Skeleton style={styles.bola} /><View style={styles.flex}><Skeleton style={{ width: '62%' }} /><Skeleton style={{ width: '36%', height: 12 }} /></View>
  </View>)}</View>;
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: theme.colors.background },
  miolo: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 40 },
  chamada: { paddingHorizontal: 24, paddingBottom: 18 },
  regua: { height: 1, marginHorizontal: 24, backgroundColor: theme.colors.line },
  total: { fontSize: 32, lineHeight: 40, color: theme.colors.champagne },
  linha: { minHeight: 96, paddingHorizontal: 24, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  flex: { flex: 1, minWidth: 0, gap: 4 },
  nomeLinha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  nome: { fontSize: 24, lineHeight: 32 },
  selo: { borderWidth: 1, borderColor: 'rgba(191,165,119,0.4)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, color: theme.colors.champagne, fontFamily: theme.fonts.semibold, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  bio: { fontSize: 12, lineHeight: 18 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 2 },
  metaTexto: { fontSize: 12, lineHeight: 18 },
  semAcesso: { opacity: 0.5 },
  pressionado: { opacity: 0.72 },
  esqueleto: { paddingTop: 8 },
  bola: { width: 58, height: 58, borderRadius: 29 },
});
