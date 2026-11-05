import { useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, API_BASE_URL } from '../../api';
import { theme } from '../../theme';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { Surface } from '../../ui/Surface';
import { Skeleton } from '../../ui/Skeleton';
import { EmptyState } from '../../ui/EmptyState';
import { useToast } from '../../ui/Toast';
import { PhotoViewer } from '../album/PhotoViewer';
import { Masonry, masonryBands } from '../album/Masonry';
import type { AlbumItem } from '../album/types';
import { useReduceMotion } from '../../ui/motion';
import type { MemoriesHome } from './types';

export default function MemoriesScreen() {
  const inset = useSafeAreaInsets(); const toast = useToast(); const reduced = useReduceMotion();
  const [viewer, setViewer] = useState<{ key: string; photos: AlbumItem[] } | null>(null);
  const [timeline, setTimeline] = useState(false);
  const memories = useQuery({ queryKey: ['album', 'memorias'], queryFn: ({ signal }) => api<MemoriesHome>('/api/memorias', { signal }) });
  function open(photos: AlbumItem[], key: string) { setViewer({ key, photos }); }
  async function book(ano: number) { try { await Linking.openURL(`${API_BASE_URL}/memorias/livro/${ano}`); } catch { toast('Não foi possível abrir o livro no navegador.', 'error'); } }
  return <View style={styles.root}><ScrollView contentContainerStyle={[styles.content, { paddingTop: inset.top + 20, paddingBottom: inset.bottom + 32 }]}
    refreshControl={<RefreshControl refreshing={memories.isRefetching} onRefresh={() => { void memories.refetch(); }} tintColor={theme.colors.champagne} />}>
    <Button variant="quiet" onPress={() => router.back()}>Voltar</Button><Text variant="kicker">Cada Natal tem uma história</Text><Text variant="display" accessibilityRole="header">Nossas memórias</Text>
    {memories.isPending ? <Skeleton style={{ height: 240 }} /> : memories.isError ? <EmptyState title="As memórias não chegaram" message={memories.error.message} action="Tentar de novo" onAction={() => { void memories.refetch(); }} /> : <>
      <View style={styles.buttons}><Button style={styles.flex} variant={!timeline ? 'primary' : 'ghost'} onPress={() => setTimeline(false)}>Neste dia</Button><Button style={styles.flex} variant={timeline ? 'primary' : 'ghost'} onPress={() => setTimeline(true)}>Linha do tempo</Button></View>
      {!timeline && <Surface><Text variant="kicker">Neste dia</Text><Text variant="display" style={{ fontSize: 28 }}>Lembra deste momento?</Text>
        {memories.data.today.length ? masonryBands(memories.data.today, 145).map(band => <Masonry key={band.key} band={band} reduced={reduced} onOpen={key => open(memories.data.today, key)} />) : <Text variant="muted">Ainda não temos fotos de outros Natais tiradas neste mesmo dia e mês.</Text>}
      </Surface>}
      {memories.data.editions.length === 0 && <EmptyState title="Vamos guardar a nossa história" message="Adicione as fotos do Natal de 2025 ao álbum." action="Abrir álbum" onAction={() => router.navigate('/(tabs)/album')} />}
      {memories.data.editions.map(edition => <Surface key={edition.ano} style={styles.card}>
        {edition.cover && <Image source={{ uri: edition.cover }} contentFit="cover" style={styles.cover} accessibilityLabel={`Capa do Natal de ${edition.ano}`} />}
        <Text variant="kicker">Natal em família</Text><Text variant="display">{edition.ano}</Text>
        <Text variant="muted">{edition.photos} fotos · {edition.comments} comentários · {edition.people} pessoas</Text>
        {edition.topPoster && <Text variant="muted">Quem mais compartilhou: {edition.topPoster.name}</Text>}
        {masonryBands(edition.highlights, 135).map(band => <Masonry key={band.key} band={band} reduced={reduced} onOpen={key => open(edition.highlights, key)} />)}
        <Button variant="ghost" onPress={() => router.navigate({ pathname: '/(tabs)/album', params: { ano: String(edition.ano) } })}>Ver álbum de {edition.ano}</Button>
        {edition.available ? <Button onPress={() => router.push({ pathname: '/retrospectiva', params: { ano: String(edition.ano) } })}>Reviver este Natal</Button> : <Text variant="muted">Retrospectiva em 25/12/{edition.ano}</Text>}
        <Button variant="ghost" onPress={() => { void book(edition.ano); }}>Abrir livro de fotos no navegador</Button>
      </Surface>)}
    </>}
  </ScrollView>{viewer && <PhotoViewer initialKey={viewer.key} photos={viewer.photos} hasMore={false} loadingMore={false} error={null} onLoadMore={() => {}} onClose={() => setViewer(null)} />}</View>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: theme.colors.background }, content: { paddingHorizontal: 24, gap: 20, maxWidth: 720, width: '100%', alignSelf: 'center' }, buttons: { flexDirection: 'row', gap: 8 }, flex: { flex: 1 }, card: { gap: 16 }, cover: { width: '100%', aspectRatio: 4 / 3, borderRadius: theme.radius.card } });
