import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Plus from 'lucide-react-native/icons/plus';
import { api } from '../../api';
import { theme } from '../../theme';
import type { AlbumFilter, AlbumMetadata, AlbumResponse } from './types';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';
import { useReduceMotion } from '../../ui/motion';
import { AlbumMedia } from './AlbumMedia';
import { PhotoViewer } from './PhotoViewer';
import { Sheet } from '../../ui/Sheet';
import { AlbumReports, UploadSheet } from './AlbumTools';
import { Masonry, masonryBands, type MasonryBand } from './Masonry';

const FILTERS: { value: AlbumFilter; label: string }[] = [
  { value: 'tudo', label: 'Tudo' }, { value: 'album', label: 'Álbum' }, { value: 'post', label: 'Mural' }, { value: 'compra', label: 'Compras' },
];

export default function AlbumScreen() {
  const inset = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReduceMotion();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const metadata = useQuery({ queryKey: ['album', 'metadata'], queryFn: ({ signal }) => api<AlbumMetadata>('/api/album?meta=1', { signal }) });
  const params = useLocalSearchParams<{ ano?: string }>();
  const activeYear = params.ano && metadata.data?.years.includes(Number(params.ano)) ? Number(params.ano) : metadata.data?.currentYear;
  const [person, setPerson] = useState('');
  const [showPeople, setShowPeople] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const goToUpload = () => setShowUpload(true);
  const [filter, setFilter] = useState<AlbumFilter>('tudo');
  const [selected, setSelected] = useState<string | null>(null);
  const [heroVisible, setHeroVisible] = useState(true);
  const list = useRef<FlatList<MasonryBand>>(null);
  const pageWidth = Math.min(width, 720);
  const columnWidth = (pageWidth - 48 - 10) / 2;
  const album = useInfiniteQuery({
    queryKey: ['album', 'pages', activeYear, person],
    enabled: activeYear !== undefined,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      const cursor = pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : '';
      return api<AlbumResponse>(`/api/album?limit=24&ano=${activeYear}&pessoa=${encodeURIComponent(person)}${cursor}`, { signal });
    },
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
  });
  const photos = useMemo(() => {
    const unique = new Map((album.data?.pages ?? []).flatMap(page => page.items).map(item => [item.key, item]));
    return [...unique.values()];
  }, [album.data]);
  const filtered = useMemo(() => photos.filter(photo => filter === 'tudo' || photo.source === filter), [photos, filter]);
  const bands = useMemo(() => masonryBands(filtered, columnWidth), [filtered, columnWidth]);
  const open = useCallback((key: string) => setSelected(key), []);
  const loadMore = () => {
    if (album.hasNextPage && !album.isFetching && !album.isError) void album.fetchNextPage();
  };
  const error = album.isError || metadata.isError;
  const canLoad = album.hasNextPage && !error;

  return <View style={styles.page}>
    <FlatList ref={list} data={bands} keyExtractor={band => band.key}
      renderItem={({ item }) => <Masonry band={item} onOpen={open} reduced={reduced} />}
      contentContainerStyle={[styles.content, { width: pageWidth, paddingTop: inset.top + 20, paddingBottom: 96 }]}
      initialNumToRender={1} maxToRenderPerBatch={2} windowSize={3} removeClippedSubviews={false}
      onEndReached={loadMore} onEndReachedThreshold={0.7}
      scrollEventThrottle={160} onScroll={event => setHeroVisible(event.nativeEvent.contentOffset.y < pageWidth * 0.65)}
      refreshControl={<RefreshControl refreshing={album.isRefetching && !album.isFetchingNextPage}
        onRefresh={() => { if (!album.isFetching) { void metadata.refetch(); void album.refetch(); } }}
        tintColor={theme.colors.champagne} colors={[theme.colors.cherry]} progressBackgroundColor={theme.colors.surface} />}
      ListHeaderComponent={<View style={styles.header}>
        <View style={styles.titleRow}><View style={styles.flex}>
          <Text variant="kicker">Memórias que ficam</Text>
          <Text variant="display" accessibilityRole="header">Álbum da <Text variant="displayItalic">família</Text></Text>
        </View><Button accessibilityLabel="Adicionar fotos ao álbum" onPress={goToUpload} style={styles.add}
          icon={<Plus size={24} color={theme.colors.ivory} />}>{null}</Button></View>
        <View style={styles.hero}><AlbumMedia name="mn-album" visible={focused && heroVisible && selected === null} style={StyleSheet.absoluteFill} /></View>
        <View style={styles.countRow}>
          {album.isPending ? <Skeleton style={{ width: 62, height: 50 }} /> : <Text variant="numeral">{filtered.length.toLocaleString('pt-BR')}</Text>}
          <Text variant="muted">{filtered.length === 1 ? 'foto' : 'fotos'}{album.hasNextPage ? ' carregadas' : ''}{filter === 'post' ? ' do mural' : filter === 'compra' ? ' das compras' : ' para guardar'}</Text>
        </View>
        <Button variant="ghost" onPress={() => router.push('/memorias')}>Memórias e linha do tempo</Button>
        {metadata.data?.isAdmin && <Button variant="quiet" onPress={() => setShowReports(true)}>Analisar denúncias do álbum</Button>}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityLabel="Edição do álbum">
          {metadata.data?.years.map(y => <Button key={y} variant={activeYear === y ? 'primary' : 'ghost'} selected={activeYear === y} onPress={() => { router.setParams({ ano: String(y) }); setSelected(null); }}>{y}</Button>)}
        </ScrollView>
        <Button variant="ghost" onPress={() => setShowPeople(true)}>{metadata.data?.people.find(p => `${p.source}:${p.id}` === person)?.name ?? 'Fotos de uma pessoa'}</Button>
        <View accessibilityRole="tablist" style={styles.filters}>{FILTERS.map(item => <Button key={item.value}
          variant={filter === item.value ? 'primary' : 'ghost'} selected={filter === item.value}
          style={styles.pill} onPress={() => { setFilter(item.value); list.current?.scrollToOffset({ offset: 0, animated: false }); }}>
          {item.label}</Button>)}</View>
      </View>}
      ListEmptyComponent={error ? undefined : album.isPending ? <AlbumSkeleton /> : <View>
        <AlbumMedia name="mn-vazio" visible={focused && selected === null} style={styles.emptyVideo} />
        <EmptyState title={canLoad ? 'Há mais memórias por aqui' : 'O álbum espera por vocês'}
          message={canLoad ? 'Continue carregando para encontrar fotos deste filtro.' : filter === 'tudo' ? 'Guarde aqui as fotos desta edição, incluindo os Natais anteriores.' : 'Ainda não há fotos nesta categoria.'}
          action={canLoad ? 'Carregar mais fotos' : 'Adicionar fotos'} onAction={canLoad ? () => { void album.fetchNextPage(); } : goToUpload} />
      </View>}
      ListFooterComponent={<View style={styles.footer}>
        {error ? <EmptyState title="As fotos não chegaram" message={metadata.error?.message ?? album.error?.message ?? 'Tente novamente.'} action="Tentar de novo"
          onAction={() => { if (metadata.isError) void metadata.refetch(); else if (album.isFetchNextPageError) void album.fetchNextPage(); else void album.refetch(); }} />
          : album.isFetchingNextPage ? <ActivityIndicator accessibilityLabel="Carregando mais fotos" color={theme.colors.champagne} />
            : canLoad && filtered.length > 0 ? <Button variant="ghost" onPress={() => { void album.fetchNextPage(); }}>Carregar mais fotos</Button>
              : filtered.length > 0 ? <Text variant="muted" style={styles.center}>Todas as memórias, até a próxima foto.</Text> : null}
      </View>} />
    {/* Com o álbum vazio o próprio estado vazio já convida a postar: o botão flutuante cobriria o texto. */}
    {filtered.length > 0 ? <View style={[styles.floating, { bottom: Math.max(inset.bottom, 12) + 12 }]}>
      <Button accessibilityLabel="Adicionar fotos ao álbum" onPress={goToUpload}
        icon={<Plus size={23} color={theme.colors.ivory} />}>Nova memória</Button>
    </View> : null}
    {showReports && metadata.data?.isAdmin ? <AlbumReports onClose={() => setShowReports(false)} /> : null}
    {showUpload && metadata.data ? <UploadSheet metadata={metadata.data} onClose={year => { setShowUpload(false); if (year) router.setParams({ ano: String(year) }); }} /> : null}
    <Sheet visible={showPeople} onClose={() => setShowPeople(false)} title="Fotos de uma pessoa"><ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 24 }}>
      <Button variant={!person ? 'primary' : 'ghost'} onPress={() => { setPerson(''); setShowPeople(false); }}>Todas as pessoas</Button>
      {metadata.data?.people.map(p => <Button key={`${p.source}:${p.id}`} variant={person === `${p.source}:${p.id}` ? 'primary' : 'ghost'} onPress={() => { setPerson(`${p.source}:${p.id}`); setShowPeople(false); setSelected(null); }}>{p.name}</Button>)}
    </ScrollView></Sheet>
    {selected ? <PhotoViewer initialKey={selected} photos={filtered} hasMore={Boolean(album.hasNextPage)}
      loadingMore={album.isFetchingNextPage} error={album.isError ? album.error.message : null}
      onLoadMore={() => { if (!album.isFetching) void album.fetchNextPage(); }} onClose={() => setSelected(null)} /> : null}
  </View>;
}

function AlbumSkeleton() {
  return <View style={styles.skeleton} accessibilityLabel="Carregando fotos do álbum">{[0, 1].map(column =>
    <View key={column} style={styles.flex}>{[0, 1, 2].map(row =>
      <Skeleton key={row} style={{ height: (row + column) % 2 ? 170 : 220, marginBottom: 10, borderRadius: theme.radius.card }} />,
    )}</View>,
  )}</View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 24, alignSelf: 'center' },
  header: { gap: 20, paddingBottom: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, flex: { flex: 1, minWidth: 0 },
  add: { width: 64 }, hero: { width: '100%', aspectRatio: 16 / 9, borderRadius: theme.radius.card, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.lineStrong },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, pill: { flexGrow: 1, minWidth: 64, borderRadius: 999, overflow: 'hidden' },
  emptyVideo: { width: 144, height: 112, alignSelf: 'center', borderRadius: theme.radius.card, marginTop: 16 },
  footer: { paddingTop: 18, paddingBottom: 16 }, center: { textAlign: 'center' },
  floating: { position: 'absolute', right: 24 }, skeleton: { flexDirection: 'row', gap: 10 },
});
