import { StyleSheet, View } from 'react-native';
import Sparkles from 'lucide-react-native/icons/sparkles';
import { theme } from '../theme';
import { Text } from './Text';
import { Button } from './Button';
import { Rise } from './motion';
export function EmptyState({ title, message, action, onAction }: { title: string; message: string; action?: string; onAction?: () => void }) {
  return <View style={styles.wrap}><Rise style={styles.content}>
    <Sparkles color={theme.colors.champagne} size={30} strokeWidth={1.2} />
    <Text variant="display" style={styles.center}>{title}</Text><Text variant="muted" style={styles.center}>{message}</Text>
    {action && onAction ? <Button onPress={onAction} variant="ghost">{action}</Button> : null}
  </Rise></View>;
}
const styles = StyleSheet.create({ wrap: { flex: 1, justifyContent: 'center', minHeight: 260, padding: 30 }, content: { alignItems: 'center', gap: 20 }, center: { textAlign: 'center' } });
