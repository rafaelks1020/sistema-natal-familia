import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import { useSession } from '../../session';
import { Cabecalho } from '../familia/Cabecalho';
import { Skeleton } from '../../ui/Skeleton';
import { theme } from '../../theme';
export function FestaFrame({ title, children, refreshing = false, onRefresh }: { title: string; children: ReactNode; refreshing?: boolean; onRefresh?: () => void }) {
  const { status } = useSession();
  if (status === 'guest' || status === 'locked') return <Redirect href="/entrar" />;
  function voltar() { if (router.canGoBack()) router.back(); else router.replace(title === 'A noite da ceia' ? '/(tabs)' : '/festa'); }
  return <SafeAreaView style={styles.safe} edges={['bottom']}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.miolo} refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.champagne} /> : undefined}>
    <Cabecalho kicker="Natal em Família" titulo={title} aoVoltar={voltar} />
    <View style={styles.corpo}>{children}</View>
  </ScrollView></SafeAreaView>;
}
export function FestaLoading() { return <View style={styles.gap}><Skeleton style={{ height: 160 }} /><Skeleton style={{ height: 120 }} /></View>; }
export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background }, content: { padding: theme.space.xl, gap: theme.space.xl, paddingBottom: theme.space.section },
  miolo: { paddingBottom: theme.space.section },
  corpo: { paddingHorizontal: theme.space.xl, paddingTop: theme.space.md, gap: theme.space.xl },
  gap: { gap: theme.space.md }, row: { flexDirection: 'row', alignItems: 'center', gap: theme.space.md },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: theme.radius.field, backgroundColor: theme.colors.field },
  winner: { borderColor: theme.colors.champagne }, video: { height: 120, width: '100%', borderRadius: theme.radius.field },
});
