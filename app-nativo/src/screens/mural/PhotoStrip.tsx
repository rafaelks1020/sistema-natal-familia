import { useRef, useState, type ReactNode } from 'react';
import { FlatList, Pressable, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '../../ui/Text';
import { theme } from '../../theme';

const PLACEHOLDER = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

export function PhotoStrip({ images, width, author, onDoubleTap, children }: {
  images: string[];
  width: number;
  author: string;
  onDoubleTap: () => void;
  children?: ReactNode;
}) {
  const height = Math.round(width * 1.25);
  const signature = images.join('|');
  const [frame, setFrame] = useState({ signature, index: 0 });
  if (frame.signature !== signature) setFrame({ signature, index: 0 });
  const index = frame.signature === signature ? frame.index : 0;
  const lastTap = useRef(0);
  function settle(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (width <= 0) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    const clamped = Math.min(images.length - 1, Math.max(0, next));
    setFrame(current => current.index === clamped && current.signature === signature ? current : { signature, index: clamped });
  }
  function onPress() {
    const now = Date.now();
    if (now - lastTap.current < 320) {
      lastTap.current = 0;
      onDoubleTap();
    } else lastTap.current = now;
  }
  return <View>
    <View style={{ width, height }}>
      <FlatList
        key={`${signature}:${width}`}
        data={images}
        initialScrollIndex={width > 0 ? index : undefined}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        directionalLockEnabled
        bounces={images.length > 1}
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        keyExtractor={(uri, itemIndex) => `${uri}:${itemIndex}`}
        getItemLayout={(_data, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        style={{ width, height }}
        renderItem={({ item, index: itemIndex }) => <Pressable accessibilityRole="image" accessibilityLabel={`Foto ${itemIndex + 1} de ${images.length}, publicada por ${author}`} onPress={onPress} style={{ width, height }}>
          <Image
            source={{ uri: item }}
            recyclingKey={item}
            cachePolicy="memory-disk"
            contentFit="cover"
            placeholder={{ blurhash: PLACEHOLDER }}
            placeholderContentFit="cover"
            transition={280}
            style={{ width, height, backgroundColor: theme.colors.field }}
          />
        </Pressable>}
      />
      {children}
      {images.length > 1 ? <View pointerEvents="none" style={styles.badge} accessibilityLabel={`Foto ${index + 1} de ${images.length}`}>
        <Text style={styles.badgeText}>{index + 1}/{images.length}</Text>
      </View> : null}
    </View>
    {images.length > 1 ? <View pointerEvents="none" style={styles.dots}>
      {images.map((uri, itemIndex) => <View key={`${uri}:${itemIndex}`} style={[styles.dot, itemIndex === index && styles.dotOn]} />)}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(23,27,24,0.72)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: theme.fonts.display, fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(143,136,124,0.45)' },
  dotOn: { width: 16, backgroundColor: theme.colors.champagne },
});
