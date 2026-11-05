import { useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import Camera from 'lucide-react-native/icons/camera';
import ImagePlus from 'lucide-react-native/icons/image-plus';
import Star from 'lucide-react-native/icons/star';
import X from 'lucide-react-native/icons/x';
import { api, queryClient, sessionStore } from '../../api';
import { brl } from '../../format';
import { theme } from '../../theme';
import type { WishFields as BaseWishFields, WishItem as BaseWishItem } from '../../types/amigo-oculto';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Sheet } from '../../ui/Sheet';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { enviarFoto, escolherFotos, type Origem } from '../../upload';
import { assertSession, sameSession, santaKeys } from './data';

export interface WishFieldsExt extends BaseWishFields {
  price_min_cents?: number | null;
  price_max_cents?: number | null;
  image_url?: string | null;
}

export interface WishItemExt extends BaseWishItem {
  price_min_cents?: number | null;
  price_max_cents?: number | null;
  image_url?: string | null;
  purchased_by_me?: boolean;
}

export interface WishParticipant {
  id: number;
  name: string;
  avatar_url: string | null;
  wish_count: number;
}

export interface WishlistDataExt {
  config_id: number | null;
  items: WishItemExt[];
  participants?: WishParticipant[];
}

type WishChangeExt =
  | { kind: 'create'; fields: WishFieldsExt }
  | { kind: 'edit'; id: number; fields: WishFieldsExt }
  | { kind: 'delete'; id: number }
  | { kind: 'purchase'; id: number; purchased: boolean };

type WishOperationExt = WishChangeExt & { generation: number; optimisticId: number };

function sortWishesExt(items: WishItemExt[]) {
  return [...items].sort(
    (a, b) => b.priority - a.priority || a.created_at.localeCompare(b.created_at) || a.id - b.id,
  );
}

export function useWishlistExt(participantId?: number, configId?: number) {
  const key = santaKeys.wishlist(participantId, configId);
  const toast = useToast();
  const saving = useRef(false);

  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      api<WishlistDataExt>(
        participantId === undefined ? '/api/wishlist' : `/api/wishlist?participant_id=${participantId}`,
        { signal },
      ),
  });

  const mutation = useMutation({
    mutationFn: async (operation: WishOperationExt): Promise<WishItemExt | { ok: true }> => {
      assertSession(operation.generation);
      if (operation.kind === 'create') {
        return api<WishItemExt>('/api/wishlist', { method: 'POST', json: operation.fields });
      }
      if (operation.kind === 'delete') {
        return api<{ ok: true }>(`/api/wishlist/${operation.id}`, { method: 'DELETE' });
      }
      return api<WishItemExt>(`/api/wishlist/${operation.id}`, {
        method: 'PUT',
        json: operation.kind === 'purchase' ? { purchased: operation.purchased } : operation.fields,
      });
    },
    onMutate: async (operation) => {
      await queryClient.cancelQueries({ queryKey: key });
      assertSession(operation.generation);
      const previous = queryClient.getQueryData<WishlistDataExt>(key);
      if (previous) {
        let items = previous.items;
        if (operation.kind === 'create') {
          items = [
            ...items,
            { ...operation.fields, id: operation.optimisticId, created_at: new Date().toISOString() },
          ];
        } else if (operation.kind === 'delete') {
          items = items.filter((item) => item.id !== operation.id);
        } else {
          items = items.map((item) =>
            item.id !== operation.id
              ? item
              : operation.kind === 'edit'
                ? { ...item, ...operation.fields }
                : { ...item, purchased: operation.purchased, purchased_by_me: operation.purchased },
          );
        }
        queryClient.setQueryData<WishlistDataExt>(key, { ...previous, items: sortWishesExt(items) });
      }
      return { previous };
    },
    onError: (error, operation, context) => {
      if (!sameSession(operation.generation)) return;
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast(error.message, 'error');
    },
    onSuccess: (result, operation) => {
      if (!sameSession(operation.generation)) return;
      if ('id' in result) {
        queryClient.setQueryData<WishlistDataExt>(key, (current) =>
          current
            ? {
                ...current,
                items: sortWishesExt(
                  current.items.map((item) =>
                    item.id === (operation.kind === 'create' ? operation.optimisticId : result.id)
                      ? result
                      : item,
                  ),
                ),
              }
            : current,
        );
      }
      if (operation.kind !== 'purchase') {
        toast(operation.kind === 'delete' ? 'Desejo apagado.' : 'Desejo salvo com carinho.');
      }
    },
    onSettled: (_data, _error, operation) => {
      saving.current = false;
      if (sameSession(operation.generation)) void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  async function change(operation: WishChangeExt) {
    if (saving.current) return false;
    saving.current = true;
    const generation = sessionStore.getGeneration();
    try {
      await mutation.mutateAsync({ ...operation, generation, optimisticId: -Date.now() });
      return sameSession(generation);
    } catch {
      return false;
    } finally {
      saving.current = false;
    }
  }

  return { query, change, pending: mutation.isPending };
}

export function formatWishPrice(minCents?: number | null, maxCents?: number | null): string | null {
  const min = minCents != null && minCents > 0 ? minCents : null;
  const max = maxCents != null && maxCents > 0 ? maxCents : null;
  if (min != null && max != null) {
    if (min === max) return `Até ${brl(max / 100)}`;
    return `De ${brl(min / 100)} a ${brl(max / 100)}`;
  }
  if (max != null) return `Até ${brl(max / 100)}`;
  if (min != null) return `A partir de ${brl(min / 100)}`;
  return null;
}

export function reaisToCents(raw: string): number | null | 'invalido' {
  const clean = raw.trim().replace(/^R\$\s*/i, '');
  if (!clean) return null;
  const normalized = clean.includes(',')
    ? clean.replace(/\./g, '').replace(',', '.')
    : clean;
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) return 'invalido';
  const cents = Math.round(num * 100);
  if (cents === 0) return null;
  if (cents > 100_000_000) return 'invalido';
  return cents;
}

export function centsToReaisInput(cents?: number | null): string {
  if (cents == null || cents <= 0) return '';
  const reais = cents / 100;
  if (Number.isInteger(reais)) return String(reais);
  return reais.toFixed(2).replace('.', ',');
}

export function Priority({ value }: { value: number }) {
  return (
    <View accessible accessibilityLabel={`Prioridade ${value} de 3`} style={styles.stars}>
      {[1, 2, 3].map((star) => (
        <Star
          key={star}
          size={12}
          strokeWidth={1.3}
          color={theme.colors.champagne}
          fill={star <= value ? theme.colors.champagne : 'transparent'}
        />
      ))}
    </View>
  );
}

export function WishEditor({
  item,
  pending,
  onClose,
  onSave,
  onDelete,
}: {
  item: WishItemExt | null;
  pending: boolean;
  onClose: () => void;
  onSave: (fields: WishFieldsExt) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState(item?.item_name ?? '');
  const [description, setDescription] = useState(item?.item_description ?? '');
  const [url, setUrl] = useState(item?.item_url ?? '');
  const [priority, setPriority] = useState(item?.priority ?? 2);
  const [minReais, setMinReais] = useState(centsToReaisInput(item?.price_min_cents));
  const [maxReais, setMaxReais] = useState(centsToReaisInput(item?.price_max_cents));
  const [imageUrl, setImageUrl] = useState<string | null>(item?.image_url ?? null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; url?: string; price?: string }>({});

  async function pickPhoto(origem: Origem) {
    if (uploadingPhoto || pending) return;
    const generation = sessionStore.getGeneration();
    try {
      const fotos = await escolherFotos(origem, 1);
      const foto = fotos[0];
      if (!foto || !sameSession(generation)) return;
      setUploadingPhoto(true);
      const uploaded = await enviarFoto(foto);
      if (sameSession(generation)) setImageUrl(uploaded);
    } catch (err) {
      if (sameSession(generation)) {
        toast(err instanceof Error ? err.message : 'Não foi possível enviar a foto.', 'error');
      }
    } finally {
      if (sameSession(generation)) setUploadingPhoto(false);
    }
  }

  function save() {
    if (uploadingPhoto) return;
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Dê um nome ao seu desejo.';
    let normalized: string | null = null;
    if (url.trim()) {
      try {
        const link = new URL(url.trim());
        if ((link.protocol !== 'http:' && link.protocol !== 'https:') || !link.hostname || link.toString().length > 500) {
          throw new Error('Link inválido.');
        }
        normalized = link.toString();
      } catch {
        next.url = 'Use um link http:// ou https:// com até 500 caracteres.';
      }
    }
    const minCents = reaisToCents(minReais);
    const maxCents = reaisToCents(maxReais);
    if (minCents === 'invalido' || maxCents === 'invalido') {
      next.price = 'Informe valores válidos em reais.';
    } else if (minCents != null && maxCents != null && minCents > maxCents) {
      next.price = 'O valor mínimo não pode ser maior que o máximo.';
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    void onSave({
      item_name: name.trim(),
      item_description: description.trim() || null,
      item_url: normalized,
      priority,
      price_min_cents: typeof minCents === 'number' ? minCents : null,
      price_max_cents: typeof maxCents === 'number' ? maxCents : null,
      image_url: imageUrl,
    });
  }

  function remove() {
    const generation = sessionStore.getGeneration();
    Alert.alert('Apagar desejo?', `“${item?.item_name ?? ''}” será removido da sua lista.`, [
      { text: 'Manter', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: () => {
          if (sameSession(generation)) void onDelete();
        },
      },
    ]);
  }

  const busy = pending || uploadingPhoto;

  return (
    <Sheet visible title={item ? 'Editar desejo' : 'Um desejo seu'} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
        <Field
          label="O que você gostaria de ganhar?"
          value={name}
          onChangeText={setName}
          maxLength={120}
          error={errors.name}
          editable={!busy}
          autoCapitalize="sentences"
        />

        <View style={styles.priceRow}>
          <View style={styles.priceCol}>
            <Field
              label="De R$ (opcional)"
              placeholder="Ex.: 50"
              value={minReais}
              onChangeText={setMinReais}
              maxLength={12}
              keyboardType="decimal-pad"
              editable={!busy}
            />
          </View>
          <View style={styles.priceCol}>
            <Field
              label="Até R$ (opcional)"
              placeholder="Ex.: 120"
              value={maxReais}
              onChangeText={setMaxReais}
              maxLength={12}
              keyboardType="decimal-pad"
              editable={!busy}
            />
          </View>
        </View>
        {errors.price ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {errors.price}
          </Text>
        ) : null}

        <Field
          label="Link do presente (opcional)"
          placeholder="https://"
          value={url}
          onChangeText={setUrl}
          maxLength={500}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          error={errors.url}
          editable={!busy}
        />

        <View style={styles.photoSection}>
          <Text variant="muted">Foto do presente (opcional)</Text>
          {imageUrl ? (
            <View style={styles.photoPreviewRow}>
              <Image source={{ uri: imageUrl }} style={styles.photoThumb} accessibilityLabel="Foto do desejo" />
              <View style={styles.photoActions}>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onPress={() => {
                    void pickPhoto('galeria');
                  }}
                >
                  {uploadingPhoto ? 'Enviando...' : 'Trocar foto'}
                </Button>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remover foto"
                  disabled={busy}
                  onPress={() => setImageUrl(null)}
                  style={styles.removePhotoBtn}
                >
                  <X size={18} color={theme.colors.muted} />
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.photoRow}>
              <View style={styles.priceCol}>
                <Button
                  variant="ghost"
                  disabled={busy}
                  icon={<ImagePlus size={16} color={theme.colors.champagne} />}
                  onPress={() => {
                    void pickPhoto('galeria');
                  }}
                >
                  {uploadingPhoto ? 'Enviando...' : 'Galeria'}
                </Button>
              </View>
              <View style={styles.priceCol}>
                <Button
                  variant="ghost"
                  disabled={busy}
                  icon={<Camera size={16} color={theme.colors.champagne} />}
                  onPress={() => {
                    void pickPhoto('camera');
                  }}
                >
                  Câmera
                </Button>
              </View>
            </View>
          )}
        </View>

        <Field
          label="Detalhes (opcional)"
          placeholder="Cor, tamanho, edição..."
          value={description}
          onChangeText={setDescription}
          maxLength={400}
          multiline
          style={{ minHeight: 90, textAlignVertical: 'top' }}
          editable={!busy}
        />

        <Text variant="muted">Quanto você quer este presente?</Text>
        <View style={styles.priorities}>
          {[1, 2, 3].map((value) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={`Prioridade ${value} de 3`}
              accessibilityState={{ checked: priority === value, disabled: busy }}
              disabled={busy}
              onPress={() => setPriority(value)}
              style={[styles.priorityChoice, priority === value && styles.prioritySelected]}
            >
              <Priority value={value} />
              <Text variant="muted" style={styles.note}>
                {value === 1 ? 'Adoraria' : value === 2 ? 'Quero muito' : 'Meu favorito'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Button onPress={save} loading={pending || uploadingPhoto}>
          Salvar desejo
        </Button>
        {item ? (
          <Button variant="quiet" disabled={busy} onPress={remove}>
            Apagar desejo
          </Button>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stars: { flexDirection: 'row', gap: 4, paddingVertical: 4 },
  form: { gap: 16, paddingBottom: 16 },
  priceRow: { flexDirection: 'row', gap: 10 },
  priceCol: { flex: 1 },
  errorText: { color: theme.colors.cherry, fontSize: 13 },
  photoSection: { gap: 8 },
  photoRow: { flexDirection: 'row', gap: 10 },
  photoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.field,
  },
  photoThumb: { width: 64, height: 64, borderRadius: 10 },
  photoActions: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  removePhotoBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  priorities: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priorityChoice: {
    flexGrow: 1,
    padding: 10,
    minHeight: 60,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.field,
    gap: 4,
    alignItems: 'center',
  },
  prioritySelected: { borderColor: theme.colors.champagne, backgroundColor: theme.colors.field },
  note: { fontSize: 11 },
});
