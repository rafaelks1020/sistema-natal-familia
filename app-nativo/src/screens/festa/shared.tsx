import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import { useSession } from '../../session';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { Skeleton } from '../../ui/Skeleton';
import { theme } from '../../theme';
export function FestaFrame({ title, children, refreshing = false, onRefresh }: { title: string; children: ReactNode; refreshing?: boolean; onRefresh?: () => void }) {
  const { status } = useSession();
  if (status === 'guest' || status === 'locked') return <Redirect href="/entrar" />;
  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.champagne} /> : undefined}>
    <Button variant="quiet" onPress={() => { if (router.canGoBack()) router.back(); else router.replace(title === 'A noite da ceia' ? '/(tabs)' : '/festa'); }}>Voltar</Button>
    <View style={styles.gap}><Text variant="kicker">Natal em Família</Text><Text variant="display" accessibilityRole="header">{title}</Text></View>{children}
  </ScrollView></SafeAreaView>;
}
export function FestaLoading() { return <View style={styles.gap}><Skeleton style={{ height: 160 }} /><Skeleton style={{ height: 120 }} /></View>; }
export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background }, content: { padding: theme.space.xl, gap: theme.space.xl, paddingBottom: theme.space.section },
  gap: { gap: theme.space.md }, row: { flexDirection: 'row', alignItems: 'center', gap: theme.space.md },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: theme.radius.field, backgroundColor: theme.colors.field },
  winner: { borderColor: theme.colors.champagne }, video: { height: 120, width: '100%', borderRadius: theme.radius.field },
});
