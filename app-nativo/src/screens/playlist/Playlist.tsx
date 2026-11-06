import { useCallback, useState } from 'react';
import { Alert, FlatList, Linking, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Heart } from 'lucide-react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, queryClient, sessionStore } from '../../api';
import { useSession } from '../../session';
import { theme } from '../../theme';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Surface } from '../../ui/Surface';
import { EmptyState } from '../../ui/EmptyState';
import { Skeleton } from '../../ui/Skeleton';
import { useToast } from '../../ui/Toast';

type Song = { track_uri: string; nome: string; artista: string; capa_url: string | null };
type Momento = 'jantar' | 'festa' | 'amigo_oculto';
type Track = Song & { id: number; user_id: number; autor: string; created_at: string; momento: Momento; votos: number; votei: boolean };
type MomentoInfo = { id: Momento; nome: string; descricao: string; total: number };
type Retro = { ano: number; destaque: boolean; total: number; artista_mais_pedido: { nome: string; total: number } | null;
  mais_votadas: { track_uri: string; nome: string; artista: string; votos: number }[]; quem_mais_adicionou: { nome: string; total: number }[];
  por_momento: { id: Momento; nome: string; total: number }[] };
const MOMENTOS_PADRAO: { id: Momento; nome: string }[] = [{ id: 'jantar', nome: 'Jantar' }, { id: 'festa', nome: 'Festa' }, { id: 'amigo_oculto', nome: 'Amigo oculto' }];
type Data = { ano: number; momento: Momento; momentos: MomentoInfo[]; connected: boolean; api: boolean; configured: boolean; playlist_url: string | null; link: string | null; embed_id: string | null; minhas: number; limite: number; tracks: Track[]; pedidos: Track[] };
const key = ['playlist', 'spotify'] as const;
const retroKey = ['playlist', 'retrospectiva'] as const;
const porVotos = (a: Track, b: Track) => b.votos - a.votos || a.created_at.localeCompare(b.created_at) || a.id - b.id;
const current = (generation: number) => sessionStore.getGeneration() === generation && sessionStore.getSnapshot().status === 'authenticated';

export default function Playlist() {
  const { user, status } = useSession();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [searchText, setSearchText] = useState('');
  const [pedido, setPedido] = useState('');
  const [momento, setMomento] = useState<Momento>('festa');
  const fund = useQuery({ queryKey: [...key, momento], enabled: status === 'authenticated', queryFn: ({ signal }) => api<Data>(`/api/spotify?momento=${momento}`, { signal }) });
  const retro = useQuery({ queryKey: retroKey, enabled: status === 'authenticated', queryFn: ({ signal }) => api<Retro>('/api/spotify/retrospectiva', { signal }) });
  const search = useQuery({ queryKey: ['playlist', 'busca', searchText], enabled: status === 'authenticated' && Boolean(searchText) && Boolean(fund.data?.api), queryFn: ({ signal }) => api<{ tracks: Song[] }>(`/api/spotify/buscar?q=${encodeURIComponent(searchText)}`, { signal }) });
  useFocusEffect(useCallback(() => { if (sessionStore.getSnapshot().status === 'authenticated') void queryClient.invalidateQueries({ queryKey: key }); }, []));
  const mutation = useMutation({
    mutationFn: async ({ song, remove, generation }: { song: Song; remove: boolean; generation: number }) => {
      if (!current(generation)) throw new Error('A sessão mudou.');
      return api(`/api/spotify/${remove ? 'remover' : 'adicionar'}`, { method: remove ? 'DELETE' : 'POST', json: { track_uri: song.track_uri, momento } });
    },
    onMutate: async () => { await queryClient.cancelQueries({ queryKey: key }); },
    onSuccess: (_result, action) => { if (!current(action.generation)) return; toast(action.remove ? 'Música removida.' : 'Música adicionada.'); },
    onError: (error, action) => { if (current(action.generation)) toast(error.message, 'error'); },
    onSettled: (_result, _error, action) => { if (current(action.generation)) { void queryClient.invalidateQueries({ queryKey: key }); void queryClient.invalidateQueries({ queryKey: retroKey }); } },
  });
  const pedir = useMutation({
    mutationFn: async ({ texto, generation }: { texto: string; generation: number }) => {
      if (!current(generation)) throw new Error('A sessão mudou.');
      return api('/api/spotify/pedido', { method: 'POST', json: { texto, momento } });
    },
    onSuccess: (_result, action) => { if (!current(action.generation)) return; setPedido(''); toast('Pedido enviado.'); },
    onError: (error, action) => { if (current(action.generation)) toast(error.message, 'error'); },
    onSettled: (_result, _error, action) => { if (current(action.generation)) { void queryClient.invalidateQueries({ queryKey: key }); void queryClient.invalidateQueries({ queryKey: retroKey }); } },
  });
  const votar = useMutation({
    mutationFn: async ({ song, generation }: { song: Track; generation: number }) => {
      if (!current(generation)) throw new Error('A sessão mudou.');
      return api<{ votou: boolean; votos: number }>('/api/spotify/votar', { method: 'POST', json: { track_id: song.id } });
    },
    onSuccess: (result, action) => {
      if (!current(action.generation)) return;
      queryClient.setQueryData<Data>([...key, momento], old => old ? { ...old, tracks: old.tracks.map(t => t.id === action.song.id ? { ...t, votei: result.votou, votos: result.votos } : t).sort(porVotos) } : old);
    },
    onError: (error, action) => { if (current(action.generation)) toast(error.message, 'error'); },
    onSettled: (_result, _error, action) => { if (current(action.generation)) void queryClient.invalidateQueries({ queryKey: retroKey }); },
  });
  const apagar = useMutation({
    mutationFn: async ({ id, generation }: { id: number; generation: number }) => {
      if (!current(generation)) throw new Error('A sessão mudou.');
      return api('/api/spotify/pedido', { method: 'DELETE', json: { id } });
    },
    onSuccess: (_result, action) => { if (current(action.generation)) toast('Pedido removido.'); },
    onError: (error, action) => { if (current(action.generation)) toast(error.message, 'error'); },
    onSettled: (_result, _error, action) => { if (current(action.generation)) { void queryClient.invalidateQueries({ queryKey: key }); void queryClient.invalidateQueries({ queryKey: retroKey }); } },
  });
  async function open(url: string) {
    try { await Linking.openURL(url); }
    catch { toast('Não foi possível abrir o Spotify neste aparelho.', 'error'); }
  }
  function remove(song: Song) {
    Alert.alert('Remover música?', song.nome, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Remover', style: 'destructive', onPress: () => mutation.mutate({ song, remove: true, generation: sessionStore.getGeneration() }) }]);
  }
  function removerPedido(item: Track) {
    Alert.alert('Remover pedido?', item.nome, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Remover', style: 'destructive', onPress: () => apagar.mutate({ id: item.id, generation: sessionStore.getGeneration() }) }]);
  }
  if (!user) return null;
  if (fund.isPending) return <View style={[styles.page, { paddingTop: insets.top + 24 }]}><Skeleton style={{ height: 100 }} /><Skeleton style={{ height: 200 }} /></View>;
  if (!fund.data) return <View style={[styles.page, { paddingTop: insets.top + 24 }]}><EmptyState title="A playlist já volta" message={fund.error?.message || 'Não conseguimos carregar as músicas.'} action="Tentar novamente" onAction={() => { void fund.refetch(); }} />{user.is_admin ? <Button variant="ghost" onPress={() => { void open('https://natalemfamilia.com.br/playlist'); }}>Conectar Spotify pelo site</Button> : null}</View>;
  const data = fund.data;
  return <FlatList style={styles.background} data={data.tracks} keyExtractor={song => String(song.id)} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
    refreshControl={<RefreshControl refreshing={fund.isRefetching} onRefresh={() => { void fund.refetch(); }} tintColor={theme.colors.champagne} />}
    ListHeaderComponent={<View style={styles.gap}>
      <Text variant="kicker">O som da nossa festa</Text><Text variant="display" accessibilityRole="header">Playlist da família</Text>
      {retro.data?.destaque ? <RetroSecao r={retro.data} /> : null}
      <View style={styles.abas} accessibilityRole="tablist">{(data.momentos?.length ? data.momentos : MOMENTOS_PADRAO).map(m => <Button key={m.id} style={styles.aba} variant={momento === m.id ? 'primary' : 'ghost'} selected={momento === m.id} onPress={() => { setMomento(m.id); setText(''); setSearchText(''); setPedido(''); }}>{m.nome}</Button>)}</View>
      <Text variant="muted">{data.momentos.find(m => m.id === momento)?.descricao}</Text>
      <Surface style={styles.gap}><Text variant="kicker">Natal em Família {data.ano}</Text><Text>Você escolheu {data.minhas} de {data.limite} músicas neste momento.</Text>
        {data.link ? <Button onPress={() => { void open(data.link!); }}>Abrir no Spotify</Button> : <Text variant="muted">{user.is_admin ? 'Abra o site, entre como organizador e cole o link da playlist do Spotify.' : 'Quem organiza vai colocar a playlist aqui em breve. Enquanto isso, você já pode pedir músicas.'}</Text>}
        {!data.link && user.is_admin ? <Button variant="ghost" onPress={() => { void open('https://natalemfamilia.com.br/playlist'); }}>Abrir o site para colar o link</Button> : null}</Surface>
      {data.api ? <>
        <Text variant="display" style={styles.title}>Pedir uma música</Text>
        <Text variant="muted">Busque, ouça e adicione na playlist.</Text>
        <Field label="Nome da música ou artista" value={text} maxLength={100} onChangeText={value => { setText(value); setSearchText(''); }} returnKeyType="search" onSubmitEditing={() => setSearchText(text.trim())} />
        <Button disabled={!text.trim()} loading={search.isFetching} onPress={() => { const next = text.trim(); if (next === searchText) void search.refetch(); else setSearchText(next); }}>Buscar música</Button>
        {searchText && search.error ? <Text accessibilityRole="alert">{search.error.message}</Text> : null}
        {searchText && search.data ? <View style={styles.gap}><Text variant="display" style={styles.title}>Resultado da busca</Text>{!search.data.tracks.length ? <Text variant="muted">Nenhuma música encontrada. Tente outro nome.</Text> : search.data.tracks.map(song => <Surface key={song.track_uri} style={styles.gap}><SongInfo song={song} onOpen={() => { void open(`https://open.spotify.com/track/${song.track_uri.split(':')[2]}`); }} /><Button variant="quiet" onPress={() => { void open(`https://open.spotify.com/track/${song.track_uri.split(':')[2]}`); }}>Ouvir no Spotify</Button><Button variant="ghost" disabled={mutation.isPending || data.minhas >= data.limite || data.tracks.some(t => t.track_uri === song.track_uri)} onPress={() => mutation.mutate({ song, remove: false, generation: sessionStore.getGeneration() })}>{data.tracks.some(t => t.track_uri === song.track_uri) ? 'Já está na playlist' : 'Adicionar música'}</Button></Surface>)}</View> : null}
      {data.pedidos.length ? <>
        <Text variant="display" style={styles.title}>Pedidos da família</Text>
        {data.pedidos.map(item => <Surface key={item.id} style={styles.gap}><View style={styles.flex}><Text>{item.nome}</Text>{item.artista ? <Text variant="muted">{item.artista}</Text> : null}<Text variant="muted">Pedida por {item.autor}</Text></View>{item.user_id === user.id || user.is_admin ? <Button variant="quiet" disabled={apagar.isPending} onPress={() => removerPedido(item)}>Remover pedido</Button> : null}</Surface>)}
      </> : null}
        {data.tracks.length ? <><Text variant="display" style={styles.title}>Escolhas da família</Text><Text variant="muted">As mais votadas ficam no topo, na lista e no Spotify. Músicas e capas fornecidas pelo Spotify.</Text></> : null}
      </> : <>
        <Text variant="display" style={styles.title}>Pedir uma música</Text>
        <Field label="Música e artista" value={pedido} maxLength={120} onChangeText={setPedido} returnKeyType="send" onSubmitEditing={() => { if (pedido.trim() && !pedir.isPending && data.minhas < data.limite) pedir.mutate({ texto: pedido.trim(), generation: sessionStore.getGeneration() }); }} />
        <Button disabled={!pedido.trim() || data.minhas >= data.limite} loading={pedir.isPending} onPress={() => pedir.mutate({ texto: pedido.trim(), generation: sessionStore.getGeneration() })}>Pedir música</Button>
        <Text variant="display" style={styles.title}>Pedidos da família</Text>
        {!data.pedidos.length ? <Text variant="muted">Ainda não há pedidos. Que tal o primeiro?</Text> : data.pedidos.map(item => <Surface key={item.id} style={styles.gap}><View style={styles.flex}><Text>{item.nome}</Text>{item.artista ? <Text variant="muted">{item.artista}</Text> : null}<Text variant="muted">Pedida por {item.autor}</Text></View>{item.user_id === user.id || user.is_admin ? <Button variant="quiet" disabled={apagar.isPending} onPress={() => removerPedido(item)}>Remover pedido</Button> : null}</Surface>)}
      </>}
    </View>}
    renderItem={({ item }) => <Surface style={styles.song}><SongInfo song={item} onOpen={() => { void open(`https://open.spotify.com/track/${item.track_uri.split(':')[2]}`); }} /><Text variant="muted">Adicionada por {item.autor}</Text><Button variant="quiet" selected={item.votei} accessibilityLabel={`${item.votei ? 'Tirar o voto de' : 'Votar em'} ${item.nome}`} disabled={votar.isPending} onPress={() => votar.mutate({ song: item, generation: sessionStore.getGeneration() })} icon={<Heart size={18} color={item.votei ? theme.colors.cherry : theme.colors.ivory} fill={item.votei ? theme.colors.cherry : 'none'} strokeWidth={1.6} />}>{item.votos} {item.votos === 1 ? 'voto' : 'votos'}</Button>{item.user_id === user.id || user.is_admin ? <Button variant="quiet" disabled={mutation.isPending} onPress={() => remove(item)}>Remover música</Button> : null}</Surface>}
    ListFooterComponent={retro.data && !retro.data.destaque ? <RetroSecao r={retro.data} /> : undefined} />;
}

function RetroSecao({ r }: { r: Retro }) {
  if (!r.total) return null;
  return <Surface style={[styles.gap, r.destaque && styles.destaque]}>
    <Text variant="kicker">{r.destaque ? `O som do Natal de ${r.ano}` : `Edição ${r.ano}`}</Text>
    <Text variant="display" accessibilityRole="header" style={styles.title}>Retrospectiva musical</Text>
    <Text variant="muted">Músicas mais votadas</Text>
    {r.mais_votadas.length ? r.mais_votadas.map((m, i) => <View key={m.track_uri} style={styles.row}><Text variant="display" style={styles.posicao}>{i + 1}</Text><View style={styles.flex}><Text>{m.nome}</Text><Text variant="muted">{m.artista}</Text></View><Text variant="muted">{m.votos} {m.votos === 1 ? 'voto' : 'votos'}</Text></View>) : <Text variant="muted">Ainda não há músicas votadas.</Text>}
    {r.artista_mais_pedido ? <Text>Artista mais pedido: {r.artista_mais_pedido.nome} ({r.artista_mais_pedido.total})</Text> : null}
    {r.quem_mais_adicionou.length ? <><Text variant="muted">Quem mais adicionou</Text>{r.quem_mais_adicionou.map(a => <View key={a.nome} style={styles.linha}><Text style={styles.flex}>{a.nome}</Text><Text variant="muted">{a.total}</Text></View>)}</> : null}
    <Text variant="muted">Músicas por momento</Text>
    {r.por_momento.map(m => <View key={m.id} style={styles.linha}><Text style={styles.flex}>{m.nome}</Text><Text variant="muted">{m.total}</Text></View>)}
  </Surface>;
}

function SongInfo({ song, onOpen }: { song: Song; onOpen: () => void }) {
  return <View style={styles.gap}><View style={styles.row}>{song.capa_url ? <Image source={{ uri: song.capa_url }} style={styles.cover} contentFit="cover" accessibilityLabel={`Capa de ${song.nome}`} /> : null}<View style={styles.flex}><Text>{song.nome}</Text><Text variant="muted">{song.artista}</Text></View></View><Button variant="quiet" onPress={onOpen}>Abrir música no Spotify</Button></View>;
}
const styles = StyleSheet.create({ background: { flex: 1, backgroundColor: theme.colors.background }, page: { paddingHorizontal: 24, gap: 16, backgroundColor: theme.colors.background, flexGrow: 1 }, gap: { gap: 12 }, title: { fontSize: 27 }, song: { gap: 12, marginTop: 16 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, flex: { flex: 1, minWidth: 0 }, cover: { width: 60, height: 60, borderRadius: 12 }, abas: { flexDirection: 'row', gap: 8 }, aba: { flex: 1 }, destaque: { borderColor: theme.colors.champagne }, posicao: { fontSize: 22, lineHeight: 30, width: 28, color: theme.colors.champagne }, linha: { flexDirection: 'row', alignItems: 'center', gap: 12 } });
