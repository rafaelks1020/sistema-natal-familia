import { View, StyleSheet, type ViewProps } from 'react-native';
import { theme } from '../theme';
export function Surface({ style, ...props }: ViewProps) { return <View {...props} style={[styles.card, style]} />; }
const styles = StyleSheet.create({ card: { borderRadius: theme.radius.card, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface, padding: 22, overflow: 'hidden' } });
