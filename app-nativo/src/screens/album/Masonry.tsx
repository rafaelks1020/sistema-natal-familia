import { memo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import ImageOff from 'lucide-react-native/icons/image-off';
import * as Haptics from 'expo-haptics';
import { theme } from '../../theme';
import type { AlbumItem } from '../../types/album';
import { Text } from '../../ui/Text';

export interface MasonryPhoto { photo: AlbumItem; height: number }
export interface MasonryBand { key: string; columns: [MasonryPhoto[], MasonryPhoto[]] }
const GAP = 10;
const RATIOS = [1.24, 0.9, 0.94, 1.32, 1.12, 1.06] as const;
const CHARCOAL_PLACEHOLDER = { uri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><path fill="${theme.colors.background}" d="M0 0h1v1H0z"/></svg>`)}` };

// Blocos pequenos permitem virtualizar a grade sem montar o álbum inteiro.
// As duas colunas têm a mesma altura total, sem espaços entre os blocos.
export function masonryBands(photos: AlbumItem[], width: number): MasonryBand[] {
  const result: MasonryBand[] = [];
  for (let start = 0; start < photos.length; start += 6) {
    const columns: [MasonryPhoto[], MasonryPhoto[]] = [[], []];
    const heights: [number, number] = [0, 0];
    photos.slice(start, start + 6).forEach((photo, index) => {
      const column = heights[0] <= heights[1] ? 0 : 1;
      const height = Math.round(width * (RATIOS[index] ?? 1));
      columns[column].push({ photo, height });
      heights[column] += height + GAP;
    });
    const shorter = heights[0] < heights[1] ? 0 : 1;
    const last = columns[shorter].at(-1);
    if (last) last.height += Math.abs(heights[0] - heights[1]);
    const first = photos[start];
    if (first) result.push({ key: first.key, columns });
  }
  return result;
}

export const Masonry = memo(function Masonry({ band, onOpen, reduced }: {
  band: MasonryBand; onOpen: (key: string) => void; reduced: boolean;
}) {
  return <View style={styles.band}>{band.columns.map((column, index) =>
    <View key={index} style={styles.column}>{column.map(({ photo, height }) =>
      <PhotoCard key={photo.key} photo={photo} height={height} onOpen={onOpen} reduced={reduced} />,
    )}</View>,
  )}</View>;
});

const PhotoCard = memo(function PhotoCard({ photo, height, onOpen, reduced }: {
  photo: AlbumItem; height: number; onOpen: (key: string) => void; reduced: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return <Pressable accessibilityRole="button"
    accessibilityLabel={failed ? 'Recarregar foto' : `${photo.caption || 'Foto da família'}. ${photo.author_name || 'Compras da ceia'}. Abrir foto`}
    onPress={() => {
      void Haptics.selectionAsync().catch(() => {});
      if (failed) { setFailed(false); setAttempt(value => value + 1); }
      else onOpen(photo.key);
    }} style={[styles.card, { height }]}>
    <Image key={attempt} source={{ uri: photo.url }} recyclingKey={`${photo.key}-${attempt}`}
      cachePolicy="memory-disk" contentFit="cover" transition={reduced ? 0 : 240}
      placeholder={CHARCOAL_PLACEHOLDER} placeholderContentFit="cover"
      onError={() => setFailed(true)} style={StyleSheet.absoluteFill} accessible={false} />
    {failed ? <View style={styles.failure}><ImageOff color={theme.colors.secondary} size={24} />
      <Text variant="muted" style={styles.retry}>Tentar de novo</Text></View> : null}
    <View style={styles.source}><Text style={styles.sourceLabel}>{photo.source === 'post' ? 'Mural' : 'Compras'}</Text></View>
  </Pressable>;
});

const styles = StyleSheet.create({
  band: { flexDirection: 'row', gap: GAP, paddingBottom: GAP },
  column: { flex: 1, gap: GAP },
  card: { minHeight: 88, borderRadius: theme.radius.card, overflow: 'hidden', backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.lineStrong },
  failure: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.surface },
  retry: { textAlign: 'center' },
  source: { position: 'absolute', bottom: 10, left: 10, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: theme.colors.scrim },
  sourceLabel: { fontSize: 10, lineHeight: 16, color: theme.colors.ivory },
});
