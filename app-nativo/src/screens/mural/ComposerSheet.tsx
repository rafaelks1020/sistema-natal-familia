import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import Camera from 'lucide-react-native/icons/camera';
import ChartColumn from 'lucide-react-native/icons/chart-column';
import ImagePlus from 'lucide-react-native/icons/image-plus';
import X from 'lucide-react-native/icons/x';
import { escolherFotos, enviarFoto, type FotoLocal, type Origem } from '../../upload';
import type { PostItem } from '../../types/mural';
import { theme } from '../../theme';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Sheet } from '../../ui/Sheet';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { MURAL_MAX_PHOTOS, MURAL_OPTION_LIMIT, MURAL_POST_LIMIT, MURAL_QUESTION_LIMIT } from './cache';

interface DraftPhoto { key: string; uri: string; local?: FotoLocal; url?: string }
interface Draft { mode: 'post' | 'poll'; content: string; photos: DraftPhoto[]; question: string; options: string[] }

function emptyDraft(mode: 'post' | 'poll'): Draft {
  return { mode, content: '', photos: [], question: '', options: ['', ''] };
}

function draftFrom(editing: PostItem | null, mode: 'post' | 'poll'): Draft {
  if (!editing) return emptyDraft(mode);
  return {
    mode: 'post',
    content: editing.content,
    photos: editing.images.map((url, index) => ({ key: `edit-${editing.id}-${index}`, uri: url, url })),
    question: '',
    options: ['', ''],
  };
}

export function ComposerSheet({ visible, initialMode, editing, onClose, onSubmitPost, onSubmitPoll }: {
  visible: boolean;
  initialMode: 'post' | 'poll';
  editing: PostItem | null;
  onClose: () => void;
  onSubmitPost: (input: { content: string; images: string[] }) => Promise<unknown>;
  onSubmitPoll: (input: { question: string; options: string[] }) => Promise<unknown>;
}) {
  const toast = useToast();
  const { height } = useWindowDimensions();
  const desiredKey = visible ? `${editing?.id ?? 'new'}:${initialMode}` : 'closed';
  const [key, setKey] = useState(desiredKey);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(editing, initialMode));
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  if (key !== desiredKey) {
    setKey(desiredKey);
    setDraft(draftFrom(visible ? editing : null, initialMode));
    setSending(false);
    setProgress(null);
  }
  const title = editing ? 'Editar publicação' : draft.mode === 'poll' ? 'Nova enquete' : 'Contar para a família';
  async function addPhotos(origem: Origem) {
    if (sending) return;
    const remaining = MURAL_MAX_PHOTOS - draft.photos.length;
    if (remaining <= 0) { toast(`Máximo de ${MURAL_MAX_PHOTOS} fotos por publicação.`, 'error'); return; }
    try {
      const picked = await escolherFotos(origem, origem === 'camera' ? 1 : remaining);
      if (!picked.length) return;
      setDraft(current => {
        const room = MURAL_MAX_PHOTOS - current.photos.length;
        const next = picked.slice(0, room).map(local => ({ key: `${Date.now()}-${local.uri}`, uri: local.uri, local }));
        return { ...current, photos: [...current.photos, ...next] };
      });
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível escolher a foto.', 'error');
    }
  }
  async function publishPost() {
    if (sending) return;
    const content = draft.content.trim();
    if (!content && draft.photos.length === 0) { toast('Escreva algo ou adicione uma foto.', 'error'); return; }
    setSending(true);
    try {
      let photos = draft.photos.slice();
      const total = photos.filter(photo => !photo.url).length;
      let done = 0;
      for (let index = 0; index < photos.length; index += 1) {
        const photo = photos[index];
        if (!photo || photo.url) continue;
        if (!photo.local) throw new Error('Escolha a foto de novo.');
        done += 1;
        setProgress({ current: done, total: Math.max(total, 1) });
        const url = await enviarFoto(photo.local);
        photos = photos.map((item, itemIndex) => itemIndex === index ? { ...item, url, uri: url } : item);
        setDraft(current => ({ ...current, photos }));
      }
      const images = photos.map(photo => photo.url).filter((url): url is string => Boolean(url));
      if (images.length !== photos.length) throw new Error('Não foi possível enviar todas as fotos.');
      setProgress(null);
      await onSubmitPost({ content, images });
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível publicar.', 'error');
    } finally { setSending(false); setProgress(null); }
  }
  async function publishPoll() {
    if (sending) return;
    const question = draft.question.trim();
    const options = draft.options.map(option => option.trim()).filter(Boolean);
    if (!question) { toast('Escreva a pergunta da enquete.', 'error'); return; }
    if (options.length < 2) { toast('Preencha pelo menos 2 opções.', 'error'); return; }
    setSending(true);
    try { await onSubmitPoll({ question, options }); onClose(); }
    catch (error) { toast(error instanceof Error ? error.message : 'Não foi possível publicar a enquete.', 'error'); }
    finally { setSending(false); }
  }
  const fraction = progress && progress.total > 0 ? Math.min(1, progress.current / progress.total) : 0;
  return <Sheet visible={visible} title={title} onClose={() => { if (!sending) onClose(); }}>
    <ScrollView style={{ maxHeight: height * 0.58 }} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
      {!editing ? <View style={styles.switch}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: draft.mode === 'post' }} onPress={() => setDraft(current => ({ ...current, mode: 'post' }))} style={[styles.switchItem, draft.mode === 'post' && styles.switchOn]}>
          <Text style={styles.switchLabel}>Foto ou relato</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: draft.mode === 'poll' }} onPress={() => setDraft(current => ({ ...current, mode: 'poll' }))} style={[styles.switchItem, draft.mode === 'poll' && styles.switchOn]}>
          <ChartColumn size={16} color={theme.colors.ivory} strokeWidth={1.7} />
          <Text style={styles.switchLabel}>Enquete</Text>
        </Pressable>
      </View> : null}
      {draft.mode === 'post' ? <>
        <Field label="Recado" value={draft.content} onChangeText={content => setDraft(current => ({ ...current, content }))} multiline maxLength={MURAL_POST_LIMIT} placeholder="O que está acontecendo nos preparativos?" style={styles.story} />
        <View style={styles.photoActions}>
          <Button variant="ghost" style={styles.flex} disabled={sending || draft.photos.length >= MURAL_MAX_PHOTOS} icon={<Camera size={16} color={theme.colors.ivory} />} onPress={() => { void addPhotos('camera'); }}>Câmera</Button>
          <Button variant="ghost" style={styles.flex} disabled={sending || draft.photos.length >= MURAL_MAX_PHOTOS} icon={<ImagePlus size={16} color={theme.colors.ivory} />} onPress={() => { void addPhotos('galeria'); }}>Galeria</Button>
        </View>
        <Text variant="muted">{draft.photos.length} de {MURAL_MAX_PHOTOS} fotos</Text>
        {draft.photos.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previews}>
          {draft.photos.map(photo => <View key={photo.key} style={styles.preview}>
            <Image source={{ uri: photo.uri }} contentFit="cover" cachePolicy="memory-disk" style={styles.previewImage} accessibilityLabel="Prévia da foto" />
            <Pressable accessibilityRole="button" accessibilityLabel="Remover foto" disabled={sending} hitSlop={8} onPress={() => setDraft(current => ({ ...current, photos: current.photos.filter(item => item.key !== photo.key) }))} style={styles.remove}>
              <X size={14} color={theme.colors.ivory} strokeWidth={1.8} />
            </Pressable>
          </View>)}
        </ScrollView> : null}
        {progress ? <View accessibilityRole="progressbar" accessibilityLabel="Envio das fotos" accessibilityValue={{ min: 0, max: progress.total, now: progress.current }}>
          <Text variant="muted">Enviando foto {progress.current} de {progress.total}</Text>
          <View style={styles.track}><View style={[styles.bar, { width: `${Math.round(fraction * 100)}%` }]} /></View>
        </View> : null}
        <Button loading={sending} onPress={() => { void publishPost(); }}>{editing ? 'Salvar' : 'Publicar'}</Button>
      </> : <>
        <Field label="Pergunta" value={draft.question} onChangeText={question => setDraft(current => ({ ...current, question }))} maxLength={MURAL_QUESTION_LIMIT} placeholder="Qual sobremesa não pode faltar?" />
        {draft.options.map((option, index) => <Field key={`opcao-${index}`} label={`Opção ${index + 1}`} value={option} maxLength={MURAL_OPTION_LIMIT} onChangeText={value => setDraft(current => ({ ...current, options: current.options.map((item, itemIndex) => itemIndex === index ? value : item) }))} trailing={draft.options.length > 2 ? <Pressable accessibilityRole="button" accessibilityLabel={`Remover opção ${index + 1}`} disabled={sending} onPress={() => setDraft(current => ({ ...current, options: current.options.filter((_, itemIndex) => itemIndex !== index) }))} style={styles.removeOption}><X size={16} color={theme.colors.secondary} /></Pressable> : null} />)}
        {draft.options.length < 5 ? <Button variant="ghost" disabled={sending} onPress={() => setDraft(current => current.options.length >= 5 ? current : { ...current, options: [...current.options, ''] })}>Adicionar opção</Button> : null}
        <Button loading={sending} onPress={() => { void publishPoll(); }}>Publicar enquete</Button>
      </>}
    </ScrollView>
  </Sheet>;
}

const styles = StyleSheet.create({
  form: { gap: 14, paddingBottom: 8 },
  switch: { flexDirection: 'row', backgroundColor: theme.colors.background, borderRadius: 24, borderWidth: 1, borderColor: theme.colors.line, padding: 4, gap: 4 },
  switchItem: { flex: 1, minHeight: 44, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  switchOn: { backgroundColor: theme.colors.cherry },
  switchLabel: { fontFamily: theme.fonts.medium, fontSize: 14 },
  story: { minHeight: 120, textAlignVertical: 'top' },
  photoActions: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  previews: { gap: 10, paddingVertical: 2 },
  preview: { width: 84, height: 104, borderRadius: 14, overflow: 'hidden', backgroundColor: theme.colors.field },
  previewImage: { width: 84, height: 104 },
  remove: { position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(23,27,24,0.72)' },
  track: { height: 3, borderRadius: 2, backgroundColor: theme.colors.field, overflow: 'hidden', marginTop: 8 },
  bar: { height: 3, backgroundColor: theme.colors.champagne },
  removeOption: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
