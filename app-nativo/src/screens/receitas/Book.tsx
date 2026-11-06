import { useRef, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, sessionStore } from '../../api';
import { useSession } from '../../session';
import { theme } from '../../theme';
import { escolherFotos, enviarFoto } from '../../upload';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { Cabecalho } from '../familia/Cabecalho';
import { EmptyState } from '../../ui/EmptyState';
import { Field } from '../../ui/Field';
import { Sheet } from '../../ui/Sheet';
import { Skeleton } from '../../ui/Skeleton';
import { Surface } from '../../ui/Surface';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { ModerationActions } from '../moderacao/Actions';
import { AudioPlayer, tempo } from '../audio/Player';
import { AudioRecorder } from '../audio/Recorder';
import { categories, draftFrom, empty, type Draft, type Entry, type Kind } from './types';

export default function Book({ kind }: { kind: Kind }) {
  const list = useRef<FlatList<Entry>>(null);
  function select(id: number | null) { setSelected(id); list.current?.scrollToOffset({ offset: 0, animated: false }); }
  const recipe = kind === 'receitas'; const router = useRouter(); const toast = useToast();
  const { user } = useSession(); const client = useQueryClient(); const key = ['livro-familia', kind];
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => api<{ items: Entry[]; ano: number }>(`/api/${kind}`, { signal }) });
  const [search, setSearch] = useState(''); const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null | undefined>();
  const [draft, setDraft] = useState<Draft>({ ...empty }); const [audioBusy, setAudioBusy] = useState(false);
  const validSession = (generation: number | undefined) => generation === sessionStore.getGeneration() && sessionStore.getSnapshot().status === 'authenticated';
  const save = useMutation({
    mutationFn: async ({ id, values }: { id: number | null; values: Draft }) => {
      if (!values.titulo.trim()) throw new Error('Preencha o título.');
      if (recipe && (!values.de_quem.trim() || !values.categoria.trim() || !values.ingredientes.trim() || !values.modo_preparo.trim())) throw new Error('Preencha de quem é, a categoria, os ingredientes e o preparo.');
      if (!recipe && (!values.quem_conta.trim() || !values.epoca.trim() || !values.audio_url)) throw new Error('Preencha quem conta, a época e use um áudio antes de salvar.');
      return api<{ id: number }>(`/api/${kind}${id ? `/${id}` : ''}`, { method: id ? 'PATCH' : 'POST', json: values });
    },
    onMutate: async () => { const generation = sessionStore.getGeneration(); await client.cancelQueries({ queryKey: key }); return { generation }; },
    onSuccess: async (_data, _vars, context) => {
      if (!validSession(context?.generation)) return;
      setEditing(undefined); toast('Guardado no livro da família.'); await client.invalidateQueries({ queryKey: key });
    },
    onError: error => toast(error.message, 'error'),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api(`/api/${kind}/${id}`, { method: 'DELETE' }),
    onMutate: async () => { const generation = sessionStore.getGeneration(); await client.cancelQueries({ queryKey: key }); return { generation }; },
    onSuccess: async (_data, _vars, context) => {
      if (!validSession(context?.generation)) return;
      setSelected(null); toast('Conteúdo apagado.'); await client.invalidateQueries({ queryKey: key });
    },
    onError: error => toast(error.message, 'error'),
  });
  const photo = useMutation({
    mutationFn: async () => { const files = await escolherFotos('galeria', 1); return files[0] ? enviarFoto(files[0]) : null; },
    onSuccess: url => { if (url) setDraft(d => ({ ...d, foto_url: url })); },
    onError: error => toast(error.message, 'error'),
  });
  const busy = save.isPending || remove.isPending || photo.isPending || audioBusy;
  function open(item?: Entry) { setDraft(draftFrom(item)); setEditing(item?.id ?? null); }
  function field(name: keyof Draft, value: string) { setDraft(d => ({ ...d, [name]: value })); }
  const current = query.data?.items.find(item => item.id === selected);
  const visible = current ? [current] : (query.data?.items ?? []).filter(item =>
    `${item.titulo} ${'de_quem' in item ? item.de_quem : item.quem_conta}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')) && (!category || ('categoria' in item && item.categoria === category)));
  return <SafeAreaView edges={['left', 'right']} style={styles.screen}>
    <FlatList ref={list} data={visible} keyExtractor={item => String(item.id)} contentContainerStyle={styles.content}
      refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }} keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<View style={styles.header}>
        <View style={styles.cabecalho}><Cabecalho kicker={`Memórias da família${query.data ? ` · Natal ${query.data.ano}` : ''}`} titulo={recipe ? 'Livro de receitas' : 'Histórias em áudio'}
          aoVoltar={() => { if (selected !== null) select(null); else router.back(); }} rotuloVoltar={selected !== null ? (recipe ? 'Voltar às receitas' : 'Voltar às histórias') : 'Voltar'} /></View>
        <Text variant="muted">{recipe ? 'O sabor que atravessa gerações. Guarde a receita e o segredo de quem faz.' : 'Como era o Natal antigamente? Sente com quem viveu e guarde essa voz para a família.'}</Text>
        {!current ? <>
          <Button disabled={busy} onPress={() => open()}>{recipe ? 'Guardar uma receita' : 'Contar uma história'}</Button>
          <Field label={recipe ? 'Buscar receita ou pessoa' : 'Buscar história ou pessoa'} value={search} onChangeText={setSearch} returnKeyType="search" />
          {recipe ? <View style={styles.categories}>{['', ...Array.from(new Set([...categories, ...(query.data?.items ?? []).flatMap(item => 'categoria' in item ? [item.categoria] : [])]))].map(c => <Button key={c} variant={category === c ? 'ghost' : 'quiet'} selected={category === c} onPress={() => setCategory(c)}>{c || 'Todas'}</Button>)}</View> : null}
        </> : null}
      </View>}
      ListEmptyComponent={query.isPending ? <Skeleton style={{ height: 240 }} /> : query.isError ? <EmptyState title="Não foi possível abrir" message={query.error.message} action="Tentar de novo" onAction={() => { void query.refetch(); }} /> : <EmptyState title={search || category ? 'Nenhum resultado' : 'As memórias começam aqui'} message={search || category ? 'Experimente outro nome ou categoria.' : recipe ? 'Guarde a primeira receita da família.' : 'Que tal contar qual foi o Natal mais marcante?'} />}
      renderItem={({ item }) => <Surface style={styles.card}>
        {item.foto_url ? <Image source={{ uri: item.foto_url }} contentFit="cover" accessibilityLabel={item.titulo} style={styles.image} /> : null}
        <Text variant="kicker">{'categoria' in item ? item.categoria : item.epoca}</Text>
        <Text variant="display" style={styles.title}>{item.titulo}</Text>
        <Text style={styles.accent}>{'de_quem' in item ? `Da cozinha de ${item.de_quem}` : `Na voz de ${item.quem_conta}`}</Text>
        {!current ? <>
          {'duracao_s' in item && item.duracao_s > 0 ? <Text variant="muted">Áudio de {tempo(item.duracao_s)}</Text> : null}
          <Button variant="ghost" onPress={() => select(item.id)}>{recipe ? 'Ver receita' : 'Ouvir história'}</Button>
        </> : <>
          {item.audio_url && editing === undefined ? <AudioPlayer key={item.audio_url} url={item.audio_url} /> : null}
          {'ingredientes' in item ? <>
            <Text variant="kicker">Ingredientes</Text><Text selectable>{item.ingredientes}</Text>
            <Text variant="kicker">Modo de preparo</Text><Text selectable>{item.modo_preparo}</Text>
            {item.segredo ? <View style={styles.secret}><Text variant="display" style={styles.accent}>O segredo</Text><Text selectable>{item.segredo}</Text></View> : null}
          </> : item.transcricao ? <><Text variant="kicker">A lembrança por escrito</Text><Text selectable>{item.transcricao}</Text></> : null}
        </>}
        <View style={styles.author}><Avatar name={item.author_name} src={item.avatar_url} size={32} /><Text variant="muted" style={styles.authorName}>Guardado por {item.author_name}</Text></View>
        {user && (user.id === item.user_id || user.is_admin) ? <>
          <Button variant="quiet" disabled={busy} onPress={() => open(item)}>Editar</Button>
          <Button variant="quiet" disabled={busy} onPress={() => Alert.alert(`Apagar ${recipe ? 'receita' : 'história'}?`, 'Esse conteúdo será removido do livro da família.', [{ text: 'Manter', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: () => remove.mutate(item.id) }])}>Apagar</Button>
        </> : null}
        {user && user.id !== item.user_id ? <ModerationActions userId={item.user_id} name={item.author_name} alvoTipo={recipe ? 'receita' : 'historia'} alvoId={item.id} onDone={() => { setSelected(null); void client.invalidateQueries({ queryKey: key }); }} /> : null}
      </Surface>} />
    <Sheet visible={editing !== undefined} title={`${editing ? 'Editar' : 'Nova'} ${recipe ? 'receita' : 'história'}`} onClose={() => { if (!busy) setEditing(undefined); }}>
      {editing !== undefined ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
        <Field label={recipe ? 'Nome da receita' : 'Título da história'} value={draft.titulo} maxLength={160} onChangeText={v => field('titulo', v)} />
        <Field label={recipe ? 'De quem é? Ex.: Vó Maria' : 'Quem conta?'} value={recipe ? draft.de_quem : draft.quem_conta} maxLength={100} onChangeText={v => field(recipe ? 'de_quem' : 'quem_conta', v)} />
        {recipe ? <>
          <Field label="Categoria" value={draft.categoria} maxLength={60} onChangeText={v => field('categoria', v)} />
          <View style={styles.categories}>{categories.map(c => <Button key={c} variant={draft.categoria === c ? 'ghost' : 'quiet'} selected={draft.categoria === c} onPress={() => field('categoria', c)}>{c}</Button>)}</View>
          <Field label="Ingredientes" multiline style={styles.multiline} value={draft.ingredientes} maxLength={12000} onChangeText={v => field('ingredientes', v)} />
          <Field label="Modo de preparo" multiline style={styles.multiline} value={draft.modo_preparo} maxLength={16000} onChangeText={v => field('modo_preparo', v)} />
          <Field label="O segredo (opcional)" multiline style={styles.multiline} value={draft.segredo} maxLength={4000} onChangeText={v => field('segredo', v)} />
        </> : <>
          <Field label="Época. Ex.: Natal de 1985" value={draft.epoca} maxLength={100} onChangeText={v => field('epoca', v)} />
          <Field label="Transcrição ou lembrança por escrito (opcional)" multiline style={styles.multiline} value={draft.transcricao} maxLength={30000} onChangeText={v => field('transcricao', v)} />
        </>}
        <Button variant="ghost" loading={photo.isPending} disabled={save.isPending || audioBusy} onPress={() => photo.mutate()}>Escolher foto (opcional)</Button>
        {draft.foto_url ? <><Image source={{ uri: draft.foto_url }} contentFit="cover" accessibilityLabel="Foto escolhida" style={styles.image} /><Button variant="quiet" disabled={busy} onPress={() => field('foto_url', '')}>Remover foto</Button></> : null}
        <AudioRecorder key={editing ?? 'new'} value={draft.audio_url} onChange={(url, seconds) => setDraft(d => ({ ...d, audio_url: url, duracao_s: seconds }))} onBusy={setAudioBusy} />
        <Button loading={save.isPending} disabled={busy} onPress={() => save.mutate({ id: editing ?? null, values: draft })}>{recipe ? 'Salvar receita' : 'Salvar história'}</Button>
        <Button variant="quiet" disabled={busy} onPress={() => setEditing(undefined)}>Cancelar</Button>
      </ScrollView> : null}
    </Sheet>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background }, content: { paddingHorizontal: 24, paddingTop: 0, gap: 20, paddingBottom: 80 }, cabecalho: { marginHorizontal: -24 },
  header: { gap: 18, paddingBottom: 12 }, card: { gap: 16, padding: 18 }, title: { fontSize: 28, lineHeight: 36 },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: 14 }, accent: { color: theme.colors.champagne },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 }, form: { gap: 18, paddingBottom: 30 },
  multiline: { minHeight: 120, textAlignVertical: 'top' }, author: { flexDirection: 'row', gap: 10, alignItems: 'center' }, authorName: { flex: 1 },
  secret: { borderWidth: 1, borderColor: theme.colors.champagne, borderRadius: 14, padding: 16, gap: 12, backgroundColor: theme.colors.field },
});
