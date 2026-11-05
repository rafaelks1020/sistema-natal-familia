import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Camera from 'lucide-react-native/icons/camera';
import X from 'lucide-react-native/icons/x';
import { escolherFotos, enviarFoto, type FotoLocal, type Origem } from '../../upload';
import { purchaseCategories, type PurchaseCategory } from '../../types/vaquinha';
import { theme } from '../../theme';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { parseValue, requireCurrentSession, type Purchase, type PurchaseInput } from './data';
import { sessionStore } from '../../api';

export function PurchaseForm({ busy, onSave, initial }: { initial?: Purchase | null; busy: boolean; onSave: (input: PurchaseInput, photos: FotoLocal[]) => void }) {
  const toast = useToast();
  const picking = useRef(false);
  const [choosing, setChoosing] = useState(false);
  const [photos, setPhotos] = useState<FotoLocal[]>([]);
  const [category, setCategory] = useState<PurchaseCategory>((initial?.category as PurchaseCategory) || 'Ceia');
  const [fields, setFields] = useState({ description: initial?.description || '', value: initial ? String(initial.value).replace('.', ',') : '', brand: initial?.brand || '', color: initial?.color || '', size: initial?.size || '', quantity: String(initial?.quantity || 1), notes: initial?.notes || '' });
  const [receipt, setReceipt] = useState(initial?.receipt_url || '');
  const [images, setImages] = useState(initial?.images || []);
  const [error, setError] = useState('');
  function field(key: keyof typeof fields, value: string) { setFields(current => ({ ...current, [key]: value })); }
  async function choose(source: Origem) {
    if (picking.current || busy || photos.length + images.length >= 6) return;
    picking.current = true; setChoosing(true);
    try { const selected = await escolherFotos(source, 6 - photos.length - images.length); setPhotos(current => [...current, ...selected].slice(0, 6)); }
    catch (cause) { toast(cause instanceof Error ? cause.message : 'Não foi possível escolher as fotos.', 'error'); }
    finally { picking.current = false; setChoosing(false); }
  }
  async function chooseReceipt() {
    if (picking.current || busy) return;
    const generation = sessionStore.getGeneration();
    picking.current = true; setChoosing(true);
    try { const selected = await escolherFotos('galeria', 1); requireCurrentSession(generation); if (selected[0]) { const url = await enviarFoto(selected[0]); requireCurrentSession(generation); setReceipt(url); } }
    catch (cause) { toast(cause instanceof Error ? cause.message : 'Não foi possível enviar o comprovante.', 'error'); }
    finally { picking.current = false; setChoosing(false); }
  }
  function save() {
    const value = parseValue(fields.value);
    const quantity = Number(fields.quantity);
    if (!fields.description.trim()) { setError('Conte o que foi comprado.'); return; }
    if (!Number.isFinite(value) || value <= 0 || value > 99999999.99) { setError('Informe um valor válido maior que zero, sem separador de milhar.'); return; }
    if (!/^\d+$/.test(fields.quantity) || !Number.isInteger(quantity) || quantity < 1 || quantity > 9999) { setError('A quantidade precisa ser de 1 a 9999.'); return; }
    setError('');
    onSave({ ...fields, description: fields.description.trim(), value, quantity, category, receipt_url: receipt || null, images }, photos);
  }
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Text variant="muted">Cada detalhe da ceia, compartilhado com a família.</Text>
    <Field label="O que foi comprado?" value={fields.description} onChangeText={value => field('description', value)} maxLength={160} editable={!busy} />
    <View style={styles.row}><View style={styles.flex}><Field label="Valor total (R$)" placeholder="0,00" keyboardType="decimal-pad" value={fields.value} onChangeText={value => field('value', value)} maxLength={12} editable={!busy} /></View>
      <View style={styles.flex}><Field label="Quantidade" keyboardType="number-pad" value={fields.quantity} onChangeText={value => field('quantity', value)} maxLength={4} editable={!busy} /></View></View>
    <Text variant="muted">Categoria</Text><View style={styles.categories} accessibilityRole="radiogroup" accessibilityLabel="Categoria da compra">{purchaseCategories.map(item => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: category === item, disabled: busy }} disabled={busy} onPress={() => setCategory(item)} style={[styles.chip, category === item && styles.selected]}><Text style={styles.chipText}>{item}</Text></Pressable>)}</View>
    <Field label="Marca (opcional)" value={fields.brand} onChangeText={value => field('brand', value)} maxLength={80} editable={!busy} />
    <View style={styles.row}><View style={styles.flex}><Field label="Cor (opcional)" value={fields.color} onChangeText={value => field('color', value)} maxLength={60} editable={!busy} /></View><View style={styles.flex}><Field label="Tamanho (opcional)" value={fields.size} onChangeText={value => field('size', value)} maxLength={60} editable={!busy} /></View></View>
    <Field label="Observações (opcional)" value={fields.notes} onChangeText={value => field('notes', value)} multiline maxLength={600} editable={!busy} />
    <Text variant="muted">Comprovante do gasto</Text>
    <Button variant="ghost" disabled={busy || choosing} onPress={() => { void chooseReceipt(); }}>{receipt ? 'Trocar comprovante' : 'Anexar comprovante'}</Button>
    {receipt ? <><Image source={{ uri: receipt }} style={styles.photo} contentFit="contain" accessibilityLabel="Comprovante anexado" /><Button variant="quiet" disabled={busy || choosing} onPress={() => setReceipt('')}>Remover comprovante</Button></> : null}
    {images.map((uri, index) => <View key={uri}><Image source={{ uri }} style={styles.photo} contentFit="cover" accessibilityLabel={`Foto existente ${index + 1}`} /><Button variant="quiet" disabled={busy || choosing} onPress={() => setImages(current => current.filter((_, i) => i !== index))}>Remover foto {index + 1}</Button></View>)}
    <Text variant="muted">Fotos da compra ({photos.length + images.length}/6)</Text>
    {photos.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{photos.map((photo, index) => <View key={`${photo.uri}-${index}`}><Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" accessibilityLabel={`Foto ${index + 1} da compra`} /><Pressable accessibilityRole="button" accessibilityLabel={`Remover foto ${index + 1}`} disabled={busy || choosing} onPress={() => setPhotos(current => current.filter((_, i) => i !== index))} style={styles.remove}><X size={17} color={theme.colors.ivory} /></Pressable></View>)}</ScrollView> : null}
    <View style={styles.row}><Button variant="ghost" style={styles.flex} disabled={busy || choosing || photos.length + images.length >= 6} onPress={() => { void choose('camera'); }} icon={<Camera size={16} color={theme.colors.ivory} />}>Câmera</Button><Button variant="ghost" style={styles.flex} loading={choosing} disabled={busy || photos.length + images.length >= 6} onPress={() => { void choose('galeria'); }}>Galeria</Button></View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <Button loading={busy} disabled={choosing} onPress={save}>{busy ? 'Salvando compra' : 'Salvar compra'}</Button>
  </ScrollView>;
}
const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 20 }, row: { flexDirection: 'row', gap: 10 }, flex: { flex: 1, minWidth: 0 }, categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: theme.colors.lineStrong }, selected: { borderColor: theme.colors.champagne, backgroundColor: theme.colors.field }, chipText: { fontSize: 12 },
  photo: { width: 128, height: 128, borderRadius: 14 }, remove: { position: 'absolute', top: 0, right: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.scrim, borderRadius: 14 }, error: { color: theme.colors.error, fontSize: 13 },
});
