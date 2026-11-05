import { useCallback, useState } from 'react';
import { Alert, FlatList, Linking, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
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
type Track = Song & { id: number; user_id: number; autor: string };
type Data = { ano: number; connected: boolean; configured: boolean; playlist_url: string | null; minhas: number; limite: number; tracks: Track[] };
const key = ['playlist', 'spotify'] as const;
const current = (generation: number) => sessionStore.getGeneration() === generation && sessionStore.getSnapshot().status === 'authenticated';

export default function Playlist() {
  const { user, status } = useSession();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [searchText, setSearchText] = useState('');
  const fund = useQuery({ queryKey: key, enabled: status === 'authenticated', queryFn: ({ signal }) => api<Data>('/api/spotify', { signal }) });
  const search = useQuery({ queryKey: ['playlist', 'busca', searchText], enabled: status === 'authenticated' && Boolean(searchText) && Boolean(fund.data?.connected), queryFn: ({ signal }) => api<{ tracks: Song[] }>(`/api/spotify/buscar?q=${encodeURIComponent(searchText)}`, { signal }) });
  useFocusEffect(useCallback(() => { if (sessionStore.getSnapshot().status === 'authenticated') void queryClient.invalidateQueries({ queryKey: key }); }, []));
  const mutation = useMutation({
    mutationFn: async ({ song, remove, generation }: { song: Song; remove: boolean; generation: number }) => {
      if (!current(generation)) throw new Error('A sessão mudou.');
      return api(`/api/spotify/${remove ? 'remover' : 'adicionar'}`, { method: remove ? 'DELETE' : 'POST', json: { track_uri: song.track_uri } });
    },
    onMutate: async () => { await queryClient.cancelQueries({ queryKey: key }); },
    onSuccess: (_result, action) => { if (!current(action.generation)) return; toast(action.remove ? 'Música removida.' : 'Música adicionada.'); },
    onError: (error, action) => { if (current(action.generation)) toast(error.message, 'error'); },
    onSettled: (_result, _error, action) => { if (current(action.generation)) void queryClient.invalidateQueries({ queryKey: key }); },
  });
  async function open(url: string) {
    try { await Linking.openURL(url); }
    catch { toast('Não foi possível abrir o Spotify neste aparelho.', 'error'); }
  }
  function remove(song: Song) {
    Alert.alert('Remover música?', song.nome, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Remover', style: 'destructive', onPress: () => mutation.mutate({ song, remove: true, generation: sessionStore.getGeneration() }) }]);
  }
  if (!user) return null;
  if (fund.isPending) return <View style={[styles.page, { paddingTop: insets.top + 24 }]}><Skeleton style={{ height: 100 }} /><Skeleton style={{ height: 200 }} /></View>;
  if (!fund.data) return <View style={[styles.page, { paddingTop: insets.top + 24 }]}><EmptyState title="A playlist já volta" message={fund.error?.message || 'Não conseguimos carregar as músicas.'} action="Tentar novamente" onAction={() => { void fund.refetch(); }} />{user.is_admin ? <Button variant="ghost" onPress={() => { void open('https://natalemfamilia.com.br/playlist'); }}>Conectar Spotify pelo site</Button> : null}</View>;
  const data = fund.data;
  return <FlatList style={styles.background} data={data.tracks} keyExtractor={song => String(song.id)} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
    refreshControl={<RefreshControl refreshing={fund.isRefetching} onRefresh={() => { void fund.refetch(); }} tintColor={theme.colors.champagne} />}
    ListHeaderComponent={<View style={styles.gap}>
      <Text variant="kicker">O som da nossa festa</Text><Text variant="display" accessibilityRole="header">Playlist da família</Text>
      {!data.connected ? <Surface style={styles.gap}><Text variant="display" style={styles.title}>Playlist ainda não conectada</Text><Text variant="muted">Quem organiza conecta o Spotify uma vez. Depois, todos podem escolher músicas.</Text>{user.is_admin ? <><Text variant="muted">Abra o site, entre como organizador e conecte sua conta. Se necessário, configure SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no servidor e o retorno https://natalemfamilia.com.br/api/spotify/callback no painel do Spotify.</Text><Button variant="ghost" onPress={() => { void open('https://natalemfamilia.com.br/playlist'); }}>Conectar Spotify pelo site</Button></> : null}</Surface> : <>
        <Surface style={styles.gap}><Text variant="kicker">Natal em Família {data.ano}</Text><Text>Você escolheu {data.minhas} de {data.limite} músicas.</Text><Button onPress={() => { if (data.playlist_url) void open(data.playlist_url); }}>Ouvir no Spotify</Button></Surface>
        <Field label="Nome da música ou artista" value={text} maxLength={100} onChangeText={value => { setText(value); setSearchText(''); }} returnKeyType="search" onSubmitEditing={() => setSearchText(text.trim())} />
        <Button disabled={!text.trim()} loading={search.isFetching} onPress={() => { const next = text.trim(); if (next === searchText) void search.refetch(); else setSearchText(next); }}>Buscar música</Button>
        {searchText && search.error ? <Text accessibilityRole="alert">{search.error.message}</Text> : null}
        {searchText && search.data ? <View style={styles.gap}><Text variant="display" style={styles.title}>Resultado da busca</Text>{!search.data.tracks.length ? <Text variant="muted">Nenhuma música encontrada. Tente outro nome.</Text> : search.data.tracks.map(song => <Surface key={song.track_uri} style={styles.gap}><SongInfo song={song} onOpen={() => { void open(`https://open.spotify.com/track/${song.track_uri.split(':')[2]}`); }} /><Button variant="ghost" disabled={mutation.isPending || data.minhas >= 15 || data.tracks.some(t => t.track_uri === song.track_uri)} onPress={() => mutation.mutate({ song, remove: false, generation: sessionStore.getGeneration() })}>{data.tracks.some(t => t.track_uri === song.track_uri) ? 'Já está na playlist' : 'Adicionar música'}</Button></Surface>)}</View> : null}
        <Text variant="display" style={styles.title}>Escolhas da família</Text><Text variant="muted">Músicas e capas fornecidas pelo Spotify.</Text>
      </>}
    </View>}
    ListEmptyComponent={data.connected ? <EmptyState title="A primeira música pode ser a sua" message="Busque uma música para entrar no clima da ceia." /> : undefined}
    renderItem={({ item }) => <Surface style={styles.song}><SongInfo song={item} onOpen={() => { void open(`https://open.spotify.com/track/${item.track_uri.split(':')[2]}`); }} /><Text variant="muted">Adicionada por {item.autor}</Text>{item.user_id === user.id || user.is_admin ? <Button variant="quiet" disabled={mutation.isPending} onPress={() => remove(item)}>Remover música</Button> : null}</Surface>} />;
}

function SongInfo({ song, onOpen }: { song: Song; onOpen: () => void }) {
  return <View style={styles.gap}><View style={styles.row}>{song.capa_url ? <Image source={{ uri: song.capa_url }} style={styles.cover} contentFit="cover" accessibilityLabel={`Capa de ${song.nome}`} /> : null}<View style={styles.flex}><Text>{song.nome}</Text><Text variant="muted">{song.artista}</Text></View></View><Button variant="quiet" onPress={onOpen}>Abrir música no Spotify</Button></View>;
}
const styles = StyleSheet.create({ background: { flex: 1, backgroundColor: theme.colors.background }, page: { paddingHorizontal: 24, gap: 16, backgroundColor: theme.colors.background, flexGrow: 1 }, gap: { gap: 12 }, title: { fontSize: 27 }, song: { gap: 12, marginTop: 16 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, flex: { flex: 1, minWidth: 0 }, cover: { width: 60, height: 60, borderRadius: 12 } });
