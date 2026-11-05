import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../ui/Text';

export function Secao({ indice, kicker, titulo, texto, children }: { indice: string; kicker: string; titulo: string; texto?: string; children: ReactNode }) {
  return <View style={styles.secao}>
    <Text variant="kicker">{indice} / {kicker}</Text>
    <Text variant="display" accessibilityRole="header" style={styles.titulo}>{titulo}</Text>
    {texto ? <Text variant="muted">{texto}</Text> : null}
    {children}
  </View>;
}

const styles = StyleSheet.create({
  secao: { gap: 14 },
  titulo: { fontSize: 32, lineHeight: 40 },
});
