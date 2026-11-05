import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '../ui/Text';
import { EmptyState } from '../ui/EmptyState';
import { LoopVideo } from '../ui/LoopVideo';
import { theme } from '../theme';
export function ComingSoon({ title, message }: { title: string; message: string }) {
  return <View style={styles.page}>
    <LoopVideo name="mn-hero" style={[StyleSheet.absoluteFill, { opacity: 0.2 }]} />
    <LinearGradient colors={['transparent', theme.colors.background]} style={StyleSheet.absoluteFill} />
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.page}>
      <View style={styles.header}><Text variant="kicker">Natal em Família</Text><Text variant="display" accessibilityRole="header">{title}</Text></View>
      <EmptyState title="Chegando" message={message} />
      <Text variant="muted" style={styles.footer}>Feito para viver junto.</Text>
    </SafeAreaView>
  </View>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: 'transparent' }, header: { padding: 24, gap: 10 }, footer: { textAlign: 'center', padding: 28, color: theme.colors.muted } });
