import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { theme } from '../../theme';
import { Text } from '../../ui/Text';

export function Cabecalho({
  titulo, italico, kicker, aoVoltar, rotuloVoltar = 'Voltar', extra, barra = false,
}: {
  titulo: string;
  italico?: string;
  kicker?: string;
  aoVoltar?: () => void;
  rotuloVoltar?: string;
  extra?: ReactNode;
  barra?: boolean;
}) {
  const insets = useSafeAreaInsets();
  if (barra) {
    return <View style={[styles.barra, { paddingTop: insets.top + 8 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={rotuloVoltar} disabled={!aoVoltar} onPress={aoVoltar} style={styles.voltar} hitSlop={8}>
        {aoVoltar ? <ChevronLeft size={24} color={theme.colors.ivory} strokeWidth={1.5} /> : null}
      </Pressable>
      <Text variant="display" accessibilityRole="header" style={styles.tituloBarra}>{titulo}</Text>
      <View style={styles.voltar}>{extra}</View>
    </View>;
  }
  return <View style={[styles.editorial, { paddingTop: insets.top + 16 }]}>
    {aoVoltar ? <Pressable accessibilityRole="button" accessibilityLabel={rotuloVoltar} onPress={aoVoltar} style={styles.voltarLinha} hitSlop={6}>
      <ChevronLeft size={18} color={theme.colors.secondary} strokeWidth={1.5} />
      <Text variant="muted">Voltar</Text>
    </Pressable> : null}
    <View style={styles.tituloLinha}>
      <View style={styles.flex}>
        {kicker ? <Text variant="kicker" style={styles.kicker}>{kicker}</Text> : null}
        <Text variant="display" accessibilityRole="header" style={styles.titulo}>
          {titulo}{italico ? <Text variant="displayItalic" style={styles.titulo}> {italico}</Text> : null}
        </Text>
      </View>
      {extra}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  editorial: { paddingHorizontal: 24, paddingBottom: 8, gap: 14 },
  voltarLinha: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -4 },
  tituloLinha: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 },
  kicker: { marginBottom: 8 },
  titulo: { fontSize: 40, lineHeight: 52 },
  barra: { minHeight: 52, paddingHorizontal: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' },
  voltar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  tituloBarra: { flex: 1, textAlign: 'center', fontSize: 24, lineHeight: 32 },
});
