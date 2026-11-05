import { Text as NativeText, StyleSheet, type TextProps } from 'react-native';
import { theme } from '../theme';
export type TextVariant = 'display' | 'displayItalic' | 'kicker' | 'numeral' | 'body' | 'muted';
export function Text({ variant = 'body', style, ...props }: TextProps & { variant?: TextVariant }) {
  return <NativeText {...props} style={[styles.base, styles[variant], style]} />;
}
const styles = StyleSheet.create({
  base: { color: theme.colors.ivory, fontFamily: theme.fonts.body, fontSize: 15, lineHeight: 23 },
  display: { fontFamily: theme.fonts.display, fontSize: 32, lineHeight: 40 },
  displayItalic: { fontFamily: theme.fonts.italic, fontSize: 32, lineHeight: 40 },
  kicker: { fontFamily: theme.fonts.semibold, fontSize: 10, lineHeight: 17, letterSpacing: 2.2, textTransform: 'uppercase', color: theme.colors.champagne },
  numeral: { fontFamily: theme.fonts.display, fontSize: 40, lineHeight: 52, fontVariant: ['tabular-nums'] },
  body: {}, muted: { color: theme.colors.secondary, fontSize: 13, lineHeight: 21 },
});
