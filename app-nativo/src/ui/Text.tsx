import { Text as NativeText, StyleSheet, type TextProps, type TextStyle } from 'react-native';
import { useEscalaLetra } from '../letra';
import { theme } from '../theme';

export type TextVariant = 'display' | 'displayItalic' | 'kicker' | 'numeral' | 'body' | 'muted';

export function Text({ variant = 'body', style, maxFontSizeMultiplier = 1.3, ...props }: TextProps & { variant?: TextVariant }) {
  const escala = useEscalaLetra();
  const achatado = (StyleSheet.flatten([styles.base, styles[variant], style]) ?? styles.base) as TextStyle;
  const aplicado = escala === 1 ? achatado : {
    ...achatado,
    ...(typeof achatado.fontSize === 'number' ? { fontSize: Math.round(achatado.fontSize * escala) } : null),
    ...(typeof achatado.lineHeight === 'number' ? { lineHeight: Math.round(achatado.lineHeight * escala) } : null),
  };
  return <NativeText {...props} maxFontSizeMultiplier={maxFontSizeMultiplier} style={aplicado} />;
}

const styles = StyleSheet.create({
  base: { color: theme.colors.ivory, fontFamily: theme.fonts.body, fontSize: 17, lineHeight: 25 },
  display: { fontFamily: theme.fonts.display, fontSize: 32, lineHeight: 40 },
  displayItalic: { fontFamily: theme.fonts.italic, fontSize: 32, lineHeight: 40 },
  kicker: { fontFamily: theme.fonts.semibold, fontSize: 12, lineHeight: 18, letterSpacing: 1.4, textTransform: 'uppercase', color: theme.colors.champagne },
  numeral: { fontFamily: theme.fonts.display, fontSize: 40, lineHeight: 52, fontVariant: ['tabular-nums'] },
  body: {},
  muted: { color: theme.colors.secondary, fontSize: 15, lineHeight: 22 },
});
