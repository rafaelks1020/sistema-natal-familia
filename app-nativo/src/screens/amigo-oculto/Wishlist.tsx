import { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import ExternalLink from 'lucide-react-native/icons/external-link';
import Pencil from 'lucide-react-native/icons/pencil';
import Plus from 'lucide-react-native/icons/plus';
import { theme } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { Skeleton } from '../../ui/Skeleton';
import { Surface } from '../../ui/Surface';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import {
  formatWishPrice,
  Priority,
  useWishlistExt,
  WishEditor,
  type WishItemExt,
} from './WishEditor';

export function Wishlist({
  participantId,
  configId,
  canWrite = true,
  embedded = false,
}: {
  participantId?: number;
  configId?: number;
  canWrite?: boolean;
  embedded?: boolean;
}) {
  const owner = participantId === undefined;
  const { query, pending, change } = useWishlistExt(participantId, configId);
  const [editor, setEditor] = useState<WishItemExt | 'new' | null>(null);
  const [selectedRelativeId, setSelectedRelativeId] = useState<number | null>(null);
  const toast = useToast();
  const allowed = canWrite && query.data?.config_id != null;

  async function openLink(value: string) {
    try {
      const parsed = new URL(value.trim());
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Link inválido.');
      }
      await Linking.openURL(parsed.toString());
    } catch {
      toast('Não foi possível abrir o link deste presente.', 'error');
    }
  }

  const participants = owner && !embedded ? (query.data?.participants ?? []) : [];

  return (
    <View style={styles.section}>
      {!embedded ? (
        <View style={styles.heading}>
          <View style={styles.flex}>
            <Text variant="kicker">{owner ? 'Pistas para o seu presente' : 'Escolhido com carinho'}</Text>
            <Text variant="display" accessibilityRole="header" style={styles.title}>
              {owner ? 'Minha lista de desejos' : 'Lista de desejos'}
            </Text>
          </View>
          {owner ? (
            <Button
              variant="ghost"
              disabled={!allowed || pending || query.isPending}
              accessibilityLabel="Adicionar desejo"
              icon={<Plus size={18} color={theme.colors.ivory} />}
              onPress={() => setEditor('new')}
            >
              Adicionar
            </Button>
          ) : null}
        </View>
      ) : null}

      {query.isPending ? (
        <Skeleton style={{ height: 126 }} />
      ) : !query.data ? (
        <Surface style={styles.gap}>
          <Text variant="muted">{query.error?.message ?? 'Não conseguimos carregar os desejos.'}</Text>
          <Button
            variant="ghost"
            onPress={() => {
              void query.refetch();
            }}
          >
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <>
          {query.isError ? (
            <Button
              variant="quiet"
              onPress={() => {
                void query.refetch();
              }}
            >
              Não foi possível atualizar. Tentar novamente
            </Button>
          ) : null}
          {!query.data.items.length ? (
            <Surface style={styles.gap}>
              <Text variant="displayItalic" style={styles.emptyTitle}>
                {owner ? 'Pequenas pistas, grandes sorrisos.' : 'O carinho também inspira.'}
              </Text>
              <Text variant="muted">
                {owner
                  ? !canWrite
                    ? 'Seu acesso ainda precisa ser vinculado à lista da família para incluir desejos.'
                    : !allowed
                      ? 'Assim que o primeiro sorteio for organizado, você poderá escrever seus desejos aqui.'
                      : 'Conte o que você adoraria ganhar. Tamanho, cor, faixa de preço e um link ajudam na escolha.'
                  : 'Esta pessoa ainda não escreveu seus desejos. Volte em breve para conferir.'}
              </Text>
            </Surface>
          ) : (
            query.data.items.map((item) => {
              const priceLabel = formatWishPrice(item.price_min_cents, item.price_max_cents);
              const bought = !owner && item.purchased === true;
              const boughtByOther = bought && item.purchased_by_me === false;
              return (
                <Surface key={item.id} style={styles.item}>
                  <View style={styles.heading}>
                    {item.image_url ? (
                      <Image
                        source={{ uri: item.image_url }}
                        style={styles.wishImage}
                        accessibilityLabel={`Foto de ${item.item_name}`}
                      />
                    ) : null}
                    <View style={styles.flex}>
                      <Priority value={item.priority} />
                      <Text style={[styles.itemName, bought && styles.purchased]}>{item.item_name}</Text>
                      {priceLabel ? (
                        <Text variant="numeral" style={styles.priceBadge}>
                          {priceLabel}
                        </Text>
                      ) : null}
                    </View>
                    {owner ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Editar ${item.item_name}`}
                        accessibilityState={{ disabled: pending }}
                        disabled={pending}
                        onPress={() => setEditor(item)}
                        style={styles.edit}
                      >
                        <Pencil size={17} color={theme.colors.champagne} />
                      </Pressable>
                    ) : null}
                  </View>
                  {item.item_description ? <Text variant="muted">{item.item_description}</Text> : null}
                  <View style={styles.actions}>
                    {item.item_url ? (
                      <Button
                        variant="quiet"
                        accessibilityLabel={`Abrir link de ${item.item_name} no navegador`}
                        icon={<ExternalLink size={15} color={theme.colors.champagne} />}
                        onPress={() => {
                          if (item.item_url) void openLink(item.item_url);
                        }}
                      >
                        Ver presente
                      </Button>
                    ) : null}
                    {!owner && typeof item.purchased === 'boolean' ? (
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityLabel={`Já comprei: ${item.item_name}`}
                        accessibilityState={{ checked: bought, disabled: pending || boughtByOther }}
                        disabled={pending || boughtByOther}
                        onPress={() => {
                          void change({ kind: 'purchase', id: item.id, purchased: !bought });
                        }}
                        style={[styles.purchase, (pending || boughtByOther) && styles.dim]}
                      >
                        <View style={[styles.checkbox, bought && styles.checked]}>
                          {bought ? <Check color={theme.colors.ivory} size={12} /> : null}
                        </View>
                        <Text variant="muted" style={styles.purchaseText}>
                          {boughtByOther ? 'Já comprado' : 'Já comprei'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Surface>
              );
            })
          )}
          {!owner && query.data.items.length ? (
            <Text variant="muted" style={styles.note}>
              A marcação de compra fica em segredo para quem recebe.
            </Text>
          ) : null}
        </>
      )}

      {participants.length > 0 ? (
        <View style={styles.familySection}>
          <Text variant="kicker">Presentes da família</Text>
          <Text variant="display" style={styles.familyTitle}>
            Ver lista de outra pessoa
          </Text>
          <Text variant="muted" style={styles.note}>
            Veja os desejos de um parente e marque o que já comprou. Quem ganha nunca vê as marcações.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {participants.map((p) => {
              const active = selectedRelativeId === p.id;
              return (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelectedRelativeId(active ? null : p.id)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Avatar name={p.name} src={p.avatar_url} size={22} />
                  <Text style={styles.chipText}>
                    {p.name}
                    {p.wish_count > 0 ? ` (${p.wish_count})` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {selectedRelativeId !== null ? (
            <Wishlist
              key={`rel:${selectedRelativeId}:${query.data?.config_id ?? 0}`}
              participantId={selectedRelativeId}
              configId={query.data?.config_id ?? undefined}
              embedded
            />
          ) : null}
        </View>
      ) : null}

      {editor ? (
        <WishEditor
          key={editor === 'new' ? 'new' : editor.id}
          item={editor === 'new' ? null : editor}
          pending={pending}
          onClose={() => {
            if (!pending) setEditor(null);
          }}
          onSave={async (fields) => {
            const saved = await change(
              editor === 'new' ? { kind: 'create', fields } : { kind: 'edit', id: editor.id, fields },
            );
            if (saved) setEditor(null);
          }}
          onDelete={async () => {
            if (editor !== 'new' && (await change({ kind: 'delete', id: editor.id }))) setEditor(null);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 16 },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  flex: { flex: 1, minWidth: 150 },
  title: { fontSize: 27, lineHeight: 35, marginTop: 5 },
  gap: { gap: 12 },
  emptyTitle: { fontSize: 26, lineHeight: 34 },
  item: { gap: 10, padding: 18 },
  wishImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.field,
  },
  itemName: { fontSize: 17, fontFamily: theme.fonts.medium, marginTop: 4 },
  priceBadge: { fontSize: 13, color: theme.colors.champagne, marginTop: 2 },
  purchased: { color: theme.colors.secondary, textDecorationLine: 'line-through' },
  edit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 4,
  },
  purchase: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44, paddingHorizontal: 4 },
  purchaseText: { fontSize: 11 },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: theme.colors.muted,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: { backgroundColor: theme.colors.sage, borderColor: theme.colors.sage },
  dim: { opacity: 0.5 },
  note: { fontSize: 11 },
  familySection: {
    gap: 10,
    marginTop: 12,
    paddingTop: 18,
    borderTopWidth: 1,
    borderColor: theme.colors.line,
  },
  familyTitle: { fontSize: 22, lineHeight: 28 },
  chipsRow: { gap: 8, paddingVertical: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  chipActive: {
    borderColor: theme.colors.champagne,
    backgroundColor: theme.colors.field,
  },
  chipText: { fontSize: 13 },
});
