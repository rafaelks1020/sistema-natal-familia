import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View, Modal } from 'react-native';
import { Image } from 'expo-image';
import type { Purchase } from './data';
import { theme } from '../../theme';
import { brl } from '../../format';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { Text } from '../../ui/Text';
import { dateLabel } from './data';

export function PurchaseDetail({ purchase, onClose, onDelete, onEdit, busy }: { purchase: Purchase; onClose: () => void; onDelete?: () => void; onEdit?: () => void; busy: boolean }) {
  const { width } = useWindowDimensions();
  const photoWidth = Math.max(180, width - 48);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [page, setPage] = useState(0);
  return <Sheet visible title="Um detalhe da nossa ceia" onClose={onClose}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text variant="kicker">{purchase.category} · {dateLabel(purchase.created_at)}</Text>
      <Text variant="display" style={styles.title}>{purchase.description}</Text>
      <Text variant="numeral">{brl(purchase.value)}</Text>
      {purchase.receipt_url ? <><Button variant="ghost" onPress={() => setReceiptOpen(true)}>Ampliar comprovante</Button><Modal visible={receiptOpen} animationType="fade" onRequestClose={() => setReceiptOpen(false)}><View style={{ flex: 1, backgroundColor: theme.colors.background, padding: 24, paddingVertical: 60 }}><Button variant="ghost" onPress={() => setReceiptOpen(false)}>Fechar comprovante</Button><ScrollView maximumZoomScale={4} minimumZoomScale={1} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}><Image source={{ uri: purchase.receipt_url }} contentFit="contain" style={{ width: photoWidth, height: 550 }} accessibilityLabel={`Comprovante de ${purchase.description}`} /></ScrollView></View></Modal></> : null}
      {purchase.images.length ? <View style={styles.gallery}><ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={event => setPage(Math.round(event.nativeEvent.contentOffset.x / photoWidth))}>
        {purchase.images.map((uri, index) => <Image key={`${uri}-${index}`} source={{ uri }} contentFit="contain" style={{ width: photoWidth, height: Math.min(photoWidth, 350), backgroundColor: theme.colors.background }} accessibilityLabel={`Foto ${index + 1} de ${purchase.images.length}: ${purchase.description}`} />)}
      </ScrollView><Text variant="muted" style={styles.counter}>{page + 1} de {purchase.images.length} fotos</Text></View> : null}
      <View style={styles.details}>{([['Quantidade', String(purchase.quantity)], ['Marca', purchase.brand], ['Cor', purchase.color], ['Tamanho', purchase.size]] as const).map(([label, value]) => value ? <View key={label} style={styles.row}><Text variant="muted">{label}</Text><Text style={styles.value}>{value}</Text></View> : null)}</View>
      {purchase.notes ? <Text variant="muted">{purchase.notes}</Text> : null}
      {onEdit ? <Button variant="ghost" disabled={busy} onPress={onEdit}>Editar gasto e comprovante</Button> : null}
      {onDelete ? <Button variant="ghost" disabled={busy} onPress={onDelete}>Apagar compra</Button> : null}
    </ScrollView>
  </Sheet>;
}
const styles = StyleSheet.create({ content: { gap: 16, paddingBottom: 20 }, title: { fontSize: 30 }, gallery: { overflow: 'hidden', borderRadius: 14 }, counter: { textAlign: 'center', paddingTop: 8, fontSize: 11 }, details: { gap: 12 }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 }, value: { flex: 1, textAlign: 'right', fontSize: 14 } });
