import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import type { AlbumItem } from '../../types/album';
import { theme } from '../../theme';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { useReduceMotion } from '../../ui/motion';

export function ZoomPhoto({ photo, previous, next, width, height, dismissY, onClose, onNavigate }: {
  photo: AlbumItem; previous?: AlbumItem; next?: AlbumItem; width: number; height: number;
  dismissY: SharedValue<number>; onClose: () => void; onNavigate: (direction: number) => void;
}) {
  const reduced = useReduceMotion();
  const duration = reduced ? 0 : 220;
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const swipeX = useSharedValue(0);
  const direction = useSharedValue(0);
  const pinching = useSharedValue(false);
  const leaving = useSharedValue(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [shape, setShape] = useState({ width, height });
  const fit = Math.min(width / shape.width, height / shape.height);
  const imageWidth = shape.width * fit;
  const imageHeight = shape.height * fit;

  const gesture = useMemo(() => {
    const reset = () => {
      'worklet';
      x.set(withTiming(0, { duration })); y.set(withTiming(0, { duration }));
      scale.set(withTiming(1, { duration }));
    };
    const pinch = Gesture.Pinch().onStart(event => {
      pinching.set(true); savedScale.set(scale.get());
      startX.set(x.get()); startY.set(y.get());
      focalX.set(event.focalX - width / 2); focalY.set(event.focalY - height / 2);
      swipeX.set(0); dismissY.set(0);
    }).onUpdate(event => {
      if (leaving.get()) return;
      const value = Math.max(1, Math.min(5, savedScale.get() * event.scale));
      const ratio = value / savedScale.get();
      const limitX = Math.max(0, (imageWidth * value - width) / 2);
      const limitY = Math.max(0, (imageHeight * value - height) / 2);
      scale.set(value);
      x.set(Math.max(-limitX, Math.min(limitX, focalX.get() - (focalX.get() - startX.get()) * ratio)));
      y.set(Math.max(-limitY, Math.min(limitY, focalY.get() - (focalY.get() - startY.get()) * ratio)));
    }).onFinalize(() => { pinching.set(false); if (scale.get() < 1.05) reset(); });

    const doubleTap = Gesture.Tap().numberOfTaps(2).maxDelay(280).onEnd((event, success) => {
      if (!success || leaving.get()) return;
      if (scale.get() > 1.05) reset();
      else {
        scale.set(withTiming(3, { duration }));
        const limitX = Math.max(0, (imageWidth * 3 - width) / 2);
        const limitY = Math.max(0, (imageHeight * 3 - height) / 2);
        x.set(withTiming(Math.max(-limitX, Math.min(limitX, (width / 2 - event.x) * 2)), { duration }));
        y.set(withTiming(Math.max(-limitY, Math.min(limitY, (height / 2 - event.y) * 2)), { duration }));
      }
    });

    const pan = Gesture.Pan().maxPointers(1).minDistance(12).onStart(() => {
      startX.set(x.get()); startY.set(y.get()); direction.set(0);
    }).onUpdate(event => {
      if (leaving.get() || pinching.get()) return;
      if (scale.get() > 1.05) {
        const limitX = Math.max(0, (imageWidth * scale.get() - width) / 2);
        const limitY = Math.max(0, (imageHeight * scale.get() - height) / 2);
        x.set(Math.max(-limitX, Math.min(limitX, startX.get() + event.translationX)));
        y.set(Math.max(-limitY, Math.min(limitY, startY.get() + event.translationY)));
      } else {
        if (direction.get() === 0) direction.set(Math.abs(event.translationX) > Math.abs(event.translationY) ? 1 : 2);
        if (direction.get() === 1) {
          const edge = event.translationX > 0 ? !previous : !next;
          swipeX.set(event.translationX * (edge ? 0.2 : 1));
        } else dismissY.set(Math.max(0, event.translationY));
      }
    }).onEnd(event => {
      if (leaving.get() || pinching.get() || scale.get() > 1.05) return;
      if (direction.get() === 2 && (dismissY.get() > Math.min(150, height * 0.22) || (event.velocityY > 1000 && dismissY.get() > 40))) {
        leaving.set(true);
        dismissY.set(withTiming(height, { duration }, done => { if (done) runOnJS(onClose)(); }));
      } else if (direction.get() === 1 && (Math.abs(event.translationX) > width * 0.2 || Math.abs(event.velocityX) > 750)) {
        const delta = event.translationX < 0 ? 1 : -1;
        if ((delta === 1 && next) || (delta === -1 && previous)) {
          leaving.set(true);
          swipeX.set(withTiming(-delta * width, { duration }, done => { if (done) runOnJS(onNavigate)(delta); }));
        }
      }
    }).onFinalize(() => {
      if (!leaving.get()) {
        swipeX.set(withTiming(0, { duration })); dismissY.set(withTiming(0, { duration }));
      }
    });
    return Gesture.Simultaneous(pinch, Gesture.Race(pan, doubleTap));
  }, [dismissY, direction, duration, focalX, focalY, height, imageHeight, imageWidth, leaving, next, onClose, onNavigate, pinching, previous, savedScale, scale, startX, startY, swipeX, width, x, y]);

  const stripStyle = useAnimatedStyle(() => ({ transform: [
    { translateX: swipeX.get() }, { translateY: dismissY.get() },
    { scale: Math.max(0.8, 1 - dismissY.get() / (height * 3)) },
  ] }));
  const zoomStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }] }));

  return <GestureDetector gesture={gesture}><View style={{ width, height, overflow: 'hidden' }} collapsable={false}>
    <Animated.View style={[styles.strip, { left: -width, width: width * 3, height }, stripStyle]}>
      <View style={{ width, height }}>{previous ? <Image source={{ uri: previous.url }} contentFit="contain" cachePolicy="memory-disk" recyclingKey={previous.key} style={StyleSheet.absoluteFill} accessible={false} /> : null}</View>
      <View style={{ width, height }}><Animated.View style={[StyleSheet.absoluteFill, zoomStyle]}>
        <Image key={attempt} source={{ uri: photo.url }} contentFit="contain" cachePolicy="memory-disk"
          recyclingKey={`${photo.key}-${attempt}`} transition={reduced ? 0 : 180} style={StyleSheet.absoluteFill}
          onLoad={event => { if (event.source.width > 0 && event.source.height > 0) setShape({ width: event.source.width, height: event.source.height }); }}
          onError={() => setFailed(true)} accessible accessibilityLabel={photo.caption || 'Foto da família'}
          accessibilityHint="Use dois dedos para ampliar. Deslize para baixo para fechar." />
      </Animated.View>{failed ? <View style={styles.error}>
        <Text style={styles.center}>Não foi possível carregar esta foto.</Text>
        <Button variant="ghost" onPress={() => { setFailed(false); setAttempt(value => value + 1); }}>Tentar de novo</Button>
      </View> : null}</View>
      <View style={{ width, height }}>{next ? <Image source={{ uri: next.url }} contentFit="contain" cachePolicy="memory-disk" recyclingKey={next.key} style={StyleSheet.absoluteFill} accessible={false} /> : null}</View>
    </Animated.View>
  </View></GestureDetector>;
}

const styles = StyleSheet.create({
  strip: { position: 'absolute', flexDirection: 'row' },
  error: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16, backgroundColor: theme.colors.background },
  center: { textAlign: 'center' },
});
