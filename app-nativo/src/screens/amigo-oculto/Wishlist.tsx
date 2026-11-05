import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Star from 'lucide-react-native/icons/star';
import Plus from 'lucide-react-native/icons/plus';
import Pencil from 'lucide-react-native/icons/pencil';
import ExternalLink from 'lucide-react-native/icons/external-link';
import Check from 'lucide-react-native/icons/check';
import { sessionStore } from '../../api';
import { theme } from '../../theme';
import type { WishFields, WishItem } from '../../types/amigo-oculto';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Sheet } from '../../ui/Sheet';
import { Skeleton } from '../../ui/Skeleton';
import { Surface } from '../../ui/Surface';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { sameSession, useWishlist } from './data';

export function Wishlist({ participantId, configId, canWrite = true }: { participantId?: number; configId?: number; canWrite?: boolean }) {
  const owner = participantId === undefined;
  const { query, pending, change } = useWishlist(participantId, configId);
  const [editor, setEditor] = useState<WishItem | 'new' | null>(null);
  const toast = useToast();
  const allowed = canWrite && query.data?.config_id != null;

  async function openLink(value: string) {
    try {
      if (new URL(value).protocol !== 'https:') throw new Error('Link inválido.');
      await Linking.openURL(value);
    } catch { toast('Não foi possível abrir o link deste presente.', 'error'); }
  }

  return <View style={styles.section}>
    <View style={styles.heading}>
      <View style={styles.flex}><Text variant="kicker">{owner ? 'Pistas para o seu presente' : 'Escolhido com carinho'}</Text>
        <Text variant="display" accessibilityRole="header" style={styles.title}>{owner ? 'Minha lista de desejos' : 'Lista de desejos'}</Text></View>
      {owner ? <Button variant="ghost" disabled={!allowed || pending || query.isPending} accessibilityLabel="Adicionar desejo" icon={<Plus size={18} color={theme.colors.ivory} />} onPress={() => setEditor('new')}>Adicionar</Button> : null}
    </View>
    {query.isPending ? <Skeleton style={{ height: 126 }} /> : !query.data ? <Surface style={styles.gap}>
      <Text variant="muted">{query.error?.message ?? 'Não conseguimos carregar os desejos.'}</Text><Button variant="ghost" onPress={() => { void query.refetch(); }}>Tentar novamente</Button>
    </Surface> : <>
      {query.isError ? <Button variant="quiet" onPress={() => { void query.refetch(); }}>Não foi possível atualizar. Tentar novamente</Button> : null}
      {!query.data.items.length ? <Surface style={styles.gap}>
        <Text variant="displayItalic" style={styles.emptyTitle}>{owner ? 'Pequenas pistas, grandes sorrisos.' : 'O carinho também inspira.'}</Text>
        <Text variant="muted">{owner ? !canWrite ? 'Seu acesso ainda precisa ser vinculado à lista da família para incluir desejos.' : !allowed ? 'Assim que o primeiro sorteio for organizado, você poderá escrever seus desejos aqui.' : 'Conte o que você adoraria ganhar. Tamanho, cor e um link ajudam na escolha.' : 'Esta pessoa ainda não escreveu seus desejos. Volte em breve para conferir.'}</Text>
      </Surface> : query.data.items.map(item => <Surface key={item.id} style={styles.item}>
        <View style={styles.heading}><View style={styles.flex}>
          <Priority value={item.priority} />
          <Text style={[styles.itemName, item.purchased && styles.purchased]}>{item.item_name}</Text>
        </View>{owner ? <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${item.item_name}`} accessibilityState={{ disabled: pending }} disabled={pending} onPress={() => setEditor(item)} style={styles.edit}>
          <Pencil size={17} color={theme.colors.champagne} />
        </Pressable> : null}</View>
        {item.item_description ? <Text variant="muted">{item.item_description}</Text> : null}
        <View style={styles.actions}>
          {item.item_url ? <Button variant="quiet" accessibilityLabel={`Abrir link de ${item.item_name} no navegador`} icon={<ExternalLink size={15} color={theme.colors.champagne} />} onPress={() => { if (item.item_url) void openLink(item.item_url); }}>Ver presente</Button> : null}
          {!owner && typeof item.purchased === 'boolean' ? <Pressable accessibilityRole="checkbox" accessibilityLabel={`Já comprei: ${item.item_name}`} accessibilityState={{ checked: item.purchased, disabled: pending }} disabled={pending}
            onPress={() => { void change({ kind: 'purchase', id: item.id, purchased: !item.purchased }); }} style={[styles.purchase, pending && styles.dim]}>
            <View style={[styles.checkbox, item.purchased && styles.checked]}>{item.purchased ? <Check color={theme.colors.ivory} size={12} /> : null}</View>
            <Text variant="muted" style={styles.purchaseText}>Já comprei</Text>
          </Pressable> : null}
        </View>
      </Surface>)}
      {!owner && query.data.items.length ? <Text variant="muted" style={styles.note}>A marcação de compra fica em segredo para quem recebe.</Text> : null}
    </>}
    {editor ? <WishEditor key={editor === 'new' ? 'new' : editor.id} item={editor === 'new' ? null : editor} pending={pending}
      onClose={() => { if (!pending) setEditor(null); }}
      onSave={async fields => { const saved = await change(editor === 'new' ? { kind: 'create', fields } : { kind: 'edit', id: editor.id, fields }); if (saved) setEditor(null); }}
      onDelete={async () => { if (editor !== 'new' && await change({ kind: 'delete', id: editor.id })) setEditor(null); }} /> : null}
  </View>;
}

function Priority({ value }: { value: number }) {
  return <View accessible accessibilityLabel={`Prioridade ${value} de 3`} style={styles.stars}>
    {[1, 2, 3].map(star => <Star key={star} size={12} strokeWidth={1.3} color={theme.colors.champagne} fill={star <= value ? theme.colors.champagne : 'transparent'} />)}
  </View>;
}

function WishEditor({ item, pending, onClose, onSave, onDelete }: {
  item: WishItem | null; pending: boolean; onClose: () => void;
  onSave: (fields: WishFields) => Promise<void>; onDelete: () => Promise<void>;
}) {
  const [name, setName] = useState(item?.item_name ?? '');
  const [description, setDescription] = useState(item?.item_description ?? '');
  const [url, setUrl] = useState(item?.item_url ?? '');
  const [priority, setPriority] = useState(item?.priority ?? 1);
  const [errors, setErrors] = useState<{ name?: string; url?: string }>({});
  function save() {
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Dê um nome ao seu desejo.';
    let normalized: string | null = null;
    if (url.trim()) {
      try {
        const link = new URL(url.trim());
        if (link.protocol !== 'https:' || link.toString().length > 500) throw new Error('Link inválido.');
        normalized = link.toString();
      } catch { next.url = 'Use um link https:// com até 500 caracteres.'; }
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    void onSave({ item_name: name.trim(), item_description: description.trim() || null, item_url: normalized, priority });
  }
  function remove() {
    const generation = sessionStore.getGeneration();
    Alert.alert('Apagar desejo?', `“${item?.item_name ?? ''}” será removido da sua lista.`, [
      { text: 'Manter', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => { if (sameSession(generation)) void onDelete(); } },
    ]);
  }
  return <Sheet visible title={item ? 'Editar desejo' : 'Um desejo seu'} onClose={onClose}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
      <Field label="O que você gostaria de ganhar?" value={name} onChangeText={setName} maxLength={120} error={errors.name} editable={!pending} autoCapitalize="sentences" />
      <Field label="Detalhes (opcional)" placeholder="Cor, tamanho, edição..." value={description} onChangeText={setDescription} maxLength={400} multiline style={{ minHeight: 100, textAlignVertical: 'top' }} editable={!pending} />
      <Field label="Link do presente (opcional)" placeholder="https://" value={url} onChangeText={setUrl} maxLength={500} autoCapitalize="none" autoCorrect={false} keyboardType="url" error={errors.url} editable={!pending} />
      <Text variant="muted">Quanto você quer este presente?</Text>
      <View style={styles.priorities}>{[1, 2, 3].map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`Prioridade ${value} de 3`} accessibilityState={{ checked: priority === value, disabled: pending }} disabled={pending}
        onPress={() => setPriority(value)} style={[styles.priorityChoice, priority === value && styles.prioritySelected]}>
        <Priority value={value} /><Text variant="muted" style={styles.note}>{value === 1 ? 'Adoraria' : value === 2 ? 'Quero muito' : 'Meu favorito'}</Text>
      </Pressable>)}</View>
      <Button onPress={save} loading={pending}>Salvar desejo</Button>
      {item ? <Button variant="quiet" disabled={pending} onPress={remove}>Apagar desejo</Button> : null}
    </ScrollView>
  </Sheet>;
}

const styles = StyleSheet.create({
  section: { gap: 16 }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 150 }, title: { fontSize: 27, lineHeight: 35, marginTop: 5 }, gap: { gap: 12 },
  emptyTitle: { fontSize: 26, lineHeight: 34 }, item: { gap: 10, padding: 18 }, stars: { flexDirection: 'row', gap: 4, paddingVertical: 4 },
  itemName: { fontSize: 17, fontFamily: theme.fonts.medium, marginTop: 5 }, purchased: { color: theme.colors.secondary },
  edit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  purchase: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44, paddingHorizontal: 4 }, purchaseText: { fontSize: 11 },
  checkbox: { width: 18, height: 18, borderWidth: 1, borderColor: theme.colors.muted, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: theme.colors.sage, borderColor: theme.colors.sage }, dim: { opacity: 0.5 }, note: { fontSize: 11 },
  form: { gap: 18, paddingBottom: 16 }, priorities: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priorityChoice: { flexGrow: 1, padding: 10, minHeight: 60, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.field, gap: 4, alignItems: 'center' },
  prioritySelected: { borderColor: theme.colors.champagne, backgroundColor: theme.colors.field },
});
