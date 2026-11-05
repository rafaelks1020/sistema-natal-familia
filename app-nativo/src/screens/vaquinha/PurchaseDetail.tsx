import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import type { Purchase } from '../../types/vaquinha';
import { theme } from '../../theme';
import { brl } from '../../format';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { Text } from '../../ui/Text';
import { dateLabel } from './data';

export function PurchaseDetail({ purchase, onClose, onDelete, busy }: { purchase: Purchase; onClose: () => void; onDelete?: () => void; busy: boolean }) {
  const { width } = useWindowDimensions();
  const photoWidth = Math.max(180, width - 48);
  const [page, setPage] = useState(0);
  return <Sheet visible title="Um detalhe da nossa ceia" onClose={onClose}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text variant="kicker">{purchase.category} · {dateLabel(purchase.created_at)}</Text>
      <Text variant="display" style={styles.title}>{purchase.description}</Text>
      <Text variant="numeral">{brl(purchase.value)}</Text>
      {purchase.images.length ? <View style={styles.gallery}><ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={event => setPage(Math.round(event.nativeEvent.contentOffset.x / photoWidth))}>
        {purchase.images.map((uri, index) => <Image key={`${uri}-${index}`} source={{ uri }} contentFit="contain" style={{ width: photoWidth, height: Math.min(photoWidth, 350), backgroundColor: theme.colors.background }} accessibilityLabel={`Foto ${index + 1} de ${purchase.images.length}: ${purchase.description}`} />)}
      </ScrollView><Text variant="muted" style={styles.counter}>{page + 1} de {purchase.images.length} fotos</Text></View> : null}
      <View style={styles.details}>{([['Quantidade', String(purchase.quantity)], ['Marca', purchase.brand], ['Cor', purchase.color], ['Tamanho', purchase.size]] as const).map(([label, value]) => value ? <View key={label} style={styles.row}><Text variant="muted">{label}</Text><Text style={styles.value}>{value}</Text></View> : null)}</View>
      {purchase.notes ? <Text variant="muted">{purchase.notes}</Text> : null}
      {onDelete ? <Button variant="ghost" disabled={busy} onPress={onDelete}>Apagar compra</Button> : null}
    </ScrollView>
  </Sheet>;
}
const styles = StyleSheet.create({ content: { gap: 16, paddingBottom: 20 }, title: { fontSize: 30 }, gallery: { overflow: 'hidden', borderRadius: 14 }, counter: { textAlign: 'center', paddingTop: 8, fontSize: 11 }, details: { gap: 12 }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 }, value: { flex: 1, textAlign: 'right', fontSize: 14 } });
