import { useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, sessionStore } from '../../api';
import { escolherFotos, enviarFoto, type FotoLocal } from '../../upload';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Sheet } from '../../ui/Sheet';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { useSession } from '../../session';
import { theme } from '../../theme';
import { ModerationActions } from '../moderacao/Actions';
import type { AlbumItem, AlbumMetadata, AlbumPerson } from './types';

export function PeoplePicker({ people, selected, onChange, disabled = false }: { people: AlbumPerson[]; selected: string[]; onChange: (keys: string[]) => void; disabled?: boolean }) {
  const [search, setSearch] = useState('');
  return <View style={{ gap: 8 }}><Field label="Buscar pessoa da família" value={search} onChangeText={setSearch} editable={!disabled} />
    {people.filter(p => p.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))).map(p => {
      const key = `${p.source}:${p.id}`; const checked = selected.includes(key);
      return <Button key={key} selected={checked} variant={checked ? 'primary' : 'ghost'} disabled={disabled} onPress={() => onChange(checked ? selected.filter(k => k !== key) : [...selected, key])}>{checked ? '✓ ' : ''}{p.name}</Button>;
    })}
  </View>;
}

export function UploadSheet({ metadata, onClose }: { metadata: AlbumMetadata; onClose: (year?: number) => void }) {
  const [year, setYear] = useState(String(metadata.currentYear)); const [date, setDate] = useState(`24/12/${metadata.currentYear}`);
  const [caption, setCaption] = useState(''); const [people, setPeople] = useState<string[]>([]);
  const [photos, setPhotos] = useState<(FotoLocal & { clientKey: string })[]>([]); const [saved, setSaved] = useState(0);
  const generation = useRef(0); const toast = useToast(); const client = useQueryClient();
  const upload = useMutation({
    mutationFn: async () => {
      const ano = Number(year); const [day, month, dateYear] = date.split('/');
      const taken = `${dateYear}-${month?.padStart(2, '0')}-${day?.padStart(2, '0')}`;
      if (!Number.isInteger(ano) || ano < 1900 || ano > metadata.currentYear || !/^\d{4}-\d{2}-\d{2}$/.test(taken)
        || Number(dateYear) !== ano || !Number.isFinite(Date.parse(taken)) || new Date(taken).toISOString().slice(0, 10) !== taken) throw new Error('Confira o ano e a data das fotos.');
      generation.current = sessionStore.getGeneration(); let count = 0; setSaved(0);
      try {
        for (const photo of photos) {
          if (sessionStore.getGeneration() !== generation.current || sessionStore.getSnapshot().status !== 'authenticated') throw new Error('A sessão mudou. Entre novamente antes de enviar.');
          const url = await enviarFoto(photo);
          if (sessionStore.getGeneration() !== generation.current) throw new Error('A sessão mudou.');
          await api('/api/album', { method: 'POST', json: { ano, taken_on: taken, caption, people,
            photos: [{ url, client_key: photo.clientKey }] } });
          count++; setSaved(count);
        }
      } catch (error) {
        if (sessionStore.getGeneration() === generation.current) { setPhotos(old => old.slice(count)); throw new Error(`${count} fotos salvas. ${(error as Error).message} Tente enviar as restantes.`); }
        throw error;
      }
    },
    onSuccess: () => { if (sessionStore.getGeneration() === generation.current) { toast(`Fotos guardadas no álbum de ${year}.`); onClose(Number(year)); } },
    onError: error => toast(error.message, 'error'),
    onSettled: async () => { if (sessionStore.getGeneration() === generation.current && sessionStore.getSnapshot().status === 'authenticated') await client.invalidateQueries({ queryKey: ['album'] }); },
  });
  async function choose() { try { const selected = await escolherFotos('galeria', 30); if (selected.length) { setPhotos(selected.map(p => ({ ...p, clientKey: `app-${Date.now()}-${Math.random().toString(36).slice(2)}` }))); setSaved(0); } } catch (e) { toast((e as Error).message, 'error'); } }
  return <Sheet visible title="Guardar fotos" onClose={() => { if (!upload.isPending) onClose(); }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
    <Text variant="muted">Até 30 fotos por envio. Elas ficam no álbum, sem publicação no mural nem aviso para a família.</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{metadata.years.map(y => <Button key={y} disabled={upload.isPending} variant={year === String(y) ? 'primary' : 'ghost'} onPress={() => { setYear(String(y)); setDate(`24/12/${y}`); }}>{y}</Button>)}</View>
    <Field label="Ano da edição" keyboardType="number-pad" value={year} maxLength={4} editable={!upload.isPending} onChangeText={value => { setYear(value); setDate(`24/12/${value}`); }} />
    <Field label="Data das fotos (dia/mês/ano)" value={date} onChangeText={setDate} editable={!upload.isPending} maxLength={10} keyboardType="numbers-and-punctuation" />
    <Field label="Legenda (opcional)" value={caption} onChangeText={setCaption} maxLength={500} multiline editable={!upload.isPending} />
    <Text variant="muted">Quem está nas fotos?</Text><PeoplePicker people={metadata.people} selected={people} onChange={setPeople} disabled={upload.isPending} />
    <Button variant="ghost" disabled={upload.isPending} onPress={() => { void choose(); }}>Escolher fotos ({photos.length}/30)</Button>
    {upload.isPending && <View style={{ gap: 8 }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: photos.length, now: saved }}><Text accessibilityLiveRegion="polite">{saved} de {photos.length} fotos salvas</Text><View style={{ height: 5, backgroundColor: theme.colors.lineStrong, borderRadius: 3 }}><View style={{ height: 5, backgroundColor: theme.colors.champagne, width: `${photos.length ? saved / photos.length * 100 : 0}%`, borderRadius: 3 }} /></View></View>}
    <Button loading={upload.isPending} disabled={!photos.length} onPress={() => upload.mutate()}>Guardar fotos</Button>
  </ScrollView></Sheet>;
}

export function PhotoActions({ photo, onDone }: { photo: AlbumItem; onDone: () => void }) {
  const { user } = useSession();
  const toast = useToast(); const client = useQueryClient();
  const [edit, setEdit] = useState(false); const [selected, setSelected] = useState(photo.tags.map(p => `${p.source}:${p.id}`));
  const [reason, setReason] = useState(''); const [report, setReport] = useState(false);
  const metadata = useQuery({ queryKey: ['album', 'metadata'], queryFn: ({ signal }) => api<AlbumMetadata>('/api/album?meta=1', { signal }) });
  const mutation = useMutation({
    mutationFn: async ({ path, method, json }: { path: string; method: string; json: unknown }) => {
      const generation = sessionStore.getGeneration(); await api(path, { method, json });
      if (path === '/api/blocks' && sessionStore.getGeneration() === generation && sessionStore.getSnapshot().status === 'authenticated') {
        await sessionStore.contentChanged(); return sessionStore.getGeneration();
      }
      return generation;
    },
    onSuccess: async generation => {
      if (sessionStore.getGeneration() !== generation || sessionStore.getSnapshot().status !== 'authenticated') return;
      await client.invalidateQueries({ queryKey: ['album'] }); toast('Pronto. Alteração salva.'); onDone();
    }, onError: error => toast(error.message, 'error'),
  });
  function send(path: string, method: string, json: unknown) { if (!mutation.isPending) mutation.mutate({ path, method, json }); }
  return <View style={{ gap: 12 }}>
    <Text variant="muted">{photo.tags.length ? photo.tags.map(p => p.name).join(', ') : 'Sem pessoas marcadas'}</Text>
    {photo.source === 'post' && photo.user_id && photo.user_id !== user?.id ? <ModerationActions userId={photo.user_id} name={photo.author_name} postId={photo.post_id} onDone={onDone} /> : null}
    {photo.source === 'album' ? <>
      <Button variant="ghost" disabled={mutation.isPending} onPress={() => send('/api/album/likes', 'PUT', { key: photo.key, liked: !photo.liked })}>{photo.liked ? 'Descurtir' : 'Curtir'} · {photo.likes}</Button>
      {photo.user_id !== user?.id && <>      <Button variant="quiet" onPress={() => setReport(v => !v)}>Denunciar foto</Button>
      {report && <><Field label="Motivo da denúncia" value={reason} onChangeText={setReason} maxLength={1000} multiline /><Button disabled={mutation.isPending || !reason.trim()} onPress={() => send('/api/album/reports', 'POST', { key: photo.key, motivo: reason })}>Enviar denúncia</Button></>}
      <Button variant="quiet" disabled={mutation.isPending} onPress={() => Alert.alert(`Bloquear ${photo.author_name}?`, 'Você deixará de ver as publicações, fotos e comentários dessa pessoa.', [
        { text: 'Cancelar', style: 'cancel' }, { text: 'Bloquear', style: 'destructive', onPress: () => send('/api/blocks', 'POST', { user_id: photo.user_id }) },
      ])}>Bloquear {photo.author_name}</Button></>}
      {photo.can_edit && <Button variant="quiet" disabled={mutation.isPending} onPress={() => Alert.alert('Apagar esta foto?', 'A foto será removida do álbum.', [
        { text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: () => send('/api/album', 'DELETE', { key: photo.key }) },
      ])}>Apagar foto</Button>}
    </> : null}
    {photo.can_edit && <><Button variant="ghost" onPress={() => setEdit(v => !v)}>Marcar pessoas</Button>{edit && <>
      {metadata.isPending ? <Text variant="muted">Carregando pessoas...</Text> : metadata.isError ? <Button variant="ghost" onPress={() => { void metadata.refetch(); }}>Tentar carregar pessoas</Button> : <PeoplePicker people={metadata.data.people} selected={selected} onChange={setSelected} disabled={mutation.isPending} />}
      <Button loading={mutation.isPending} disabled={!metadata.data} onPress={() => send('/api/album/tags', 'PUT', { key: photo.key, people: selected })}>Salvar marcações</Button>
    </>}</>}
  </View>;
}

interface AlbumReport { id: number; key: string; motivo: string; author_name: string; image_url: string }
export function AlbumReports({ onClose }: { onClose: () => void }) {
  const client = useQueryClient(); const toast = useToast();
  const reports = useQuery({ queryKey: ['album', 'reports'], queryFn: ({ signal }) => api<{ reports: AlbumReport[] }>('/api/album/reports', { signal }) });
  const mutation = useMutation({
    mutationFn: async ({ report, remove }: { report: AlbumReport; remove: boolean }) => {
      const generation = sessionStore.getGeneration();
      await api(remove ? '/api/album' : '/api/album/reports', { method: remove ? 'DELETE' : 'PATCH', json: remove ? { key: report.key } : { id: report.id } });
      return generation;
    },
    onSuccess: async generation => { if (sessionStore.getGeneration() === generation && sessionStore.getSnapshot().status === 'authenticated') { await client.invalidateQueries({ queryKey: ['album'] }); toast('Análise atualizada.'); } },
    onError: error => toast(error.message, 'error'),
  });
  return <Sheet visible title="Denúncias do álbum" onClose={onClose}><ScrollView contentContainerStyle={{ gap: 20, paddingBottom: 24 }}>
    {reports.isPending ? <Text variant="muted">Carregando denúncias...</Text> : reports.isError ? <><Text>{reports.error.message}</Text><Button variant="ghost" onPress={() => { void reports.refetch(); }}>Tentar novamente</Button></> : reports.data.reports.length === 0 ? <Text variant="muted">Nenhuma denúncia pendente.</Text> : reports.data.reports.map(report => <View key={report.id} style={{ gap: 12 }}>
      <Image source={{ uri: report.image_url }} contentFit="contain" style={{ width: '100%', height: 180 }} accessibilityLabel={`Foto denunciada de ${report.author_name}`} />
      <Text>{report.author_name}: {report.motivo}</Text>
      <Button variant="ghost" disabled={mutation.isPending} onPress={() => mutation.mutate({ report, remove: false })}>Encerrar análise</Button>
      <Button disabled={mutation.isPending} onPress={() => Alert.alert('Apagar esta foto denunciada?', 'A foto será removida do álbum.', [
        { text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: () => mutation.mutate({ report, remove: true }) },
      ])}>Apagar foto</Button>
    </View>)}
  </ScrollView></Sheet>;
}
