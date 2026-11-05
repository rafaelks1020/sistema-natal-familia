import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Gift from 'lucide-react-native/icons/gift';
import LockKeyhole from 'lucide-react-native/icons/lock-keyhole';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { theme } from '../../theme';
import { Button } from '../../ui/Button';
import { useReduceMotion } from '../../ui/motion';
import { Surface } from '../../ui/Surface';
import { Text } from '../../ui/Text';
import { revealDateLabel } from './data';

function pulse(level: number) {
  const style = level >= 3 ? Haptics.ImpactFeedbackStyle.Heavy : level === 2 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
  void Haptics.impactAsync(style).catch(() => {});
}

export function Ticket({ canReveal, opensAt, busy, onReveal }: {
  canReveal: boolean; opensAt: string | null; busy: boolean; onReveal: () => void;
}) {
  const reduced = useReduceMotion();
  const [trackWidth, setTrackWidth] = useState(260);
  const distance = Math.max(1, trackWidth - 82);
  const x = useSharedValue(0);
  const level = useSharedValue(0);
  const committed = useSharedValue(false);
  useEffect(() => {
    if (!busy) {
      x.set(reduced ? 0 : withSpring(0, { damping: 22, stiffness: 170, mass: 0.8 }));
      committed.set(false);
    }
  }, [busy, canReveal, reduced, x, committed]);
  const pan = Gesture.Pan().enabled(canReveal && !busy).activeOffsetX([-8, 8]).failOffsetY([-16, 16])
    .onBegin(() => { level.set(0); committed.set(false); })
    .onUpdate(event => {
      x.set(Math.max(0, Math.min(distance, event.translationX)));
      const progress = x.get() / distance;
      const next = progress >= 0.8 ? 3 : progress >= 0.5 ? 2 : progress >= 0.15 ? 1 : 0;
      if (next > level.get()) { level.set(next); runOnJS(pulse)(next); }
    })
    .onEnd(() => {
      if (x.get() >= distance * 0.85) {
        committed.set(true);
        x.set(reduced ? distance : withSpring(distance, { damping: 24, stiffness: 180 }));
        runOnJS(onReveal)();
      }
    })
    .onFinalize(() => {
      if (!committed.get()) x.set(reduced ? 0 : withSpring(0, { damping: 22, stiffness: 170, mass: 0.8 }));
    });
  const sealStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { rotate: `${reduced ? 0 : x.get() / distance * 16}deg` }],
  }));
  const hintStyle = useAnimatedStyle(() => ({ opacity: 1 - x.get() / distance }));

  return <Surface style={styles.ticket}>
    <View style={styles.top}><Text variant="kicker">Edição em família</Text><Text variant="kicker" style={styles.vip}>VIP</Text></View>
    <Text variant="muted" style={styles.reserved}>Convite reservado para você</Text>
    <Text variant="display" style={styles.title}>Um segredo.{ '\n' }Só seu.</Text>
    <View style={styles.rule} />
    <Text variant="muted" style={styles.subtitle}>Um nome guardado. Um presente escolhido com carinho.</Text>
    <View style={styles.perforation}><View style={[styles.notch, styles.left]} /><View style={[styles.notch, styles.right]} /></View>
    {canReveal ? <>
      <View style={styles.track} onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}>
        <Animated.View pointerEvents="none" style={[styles.dragHint, hintStyle]} accessible={false} importantForAccessibility="no-hide-descendants">
          <Text variant="muted" style={styles.dragText}>Arraste o selo</Text><ChevronRight size={18} color={theme.colors.champagne} />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.seal, sealStyle]} accessible={false} importantForAccessibility="no-hide-descendants">
            <View style={styles.sealInset}><Gift size={27} strokeWidth={1.3} color={theme.colors.background} /></View>
          </Animated.View>
        </GestureDetector>
      </View>
      <Button variant="ghost" onPress={onReveal} loading={busy} accessibilityLabel="Revelar meu amigo oculto">Revelar</Button>
      <Text variant="muted" style={styles.footnote}>Arraste o selo ou toque em Revelar.</Text>
    </> : <View style={styles.locked}>
      <LockKeyhole color={theme.colors.champagne} size={27} strokeWidth={1.3} />
      <Text variant="displayItalic" style={styles.opening}>Abre em {revealDateLabel(opensAt)}</Text>
      <Text variant="muted" style={styles.center}>Algumas surpresas merecem o momento certo.</Text>
      <Button variant="ghost" disabled onPress={onReveal}>Revelar</Button>
    </View>}
  </Surface>;
}

const styles = StyleSheet.create({
  ticket: { padding: 24, borderColor: theme.colors.champagne, gap: 14 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  vip: { borderWidth: 1, borderColor: theme.colors.champagne, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 4 },
  reserved: { fontSize: 11, marginTop: 16, color: theme.colors.muted },
  title: { fontSize: 49, lineHeight: 57 }, rule: { width: 44, height: 1, backgroundColor: theme.colors.cherry, marginVertical: 4 },
  subtitle: { maxWidth: 260 }, perforation: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.lineStrong, marginVertical: 14, marginHorizontal: -24 },
  notch: { position: 'absolute', top: -12, width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.champagne, backgroundColor: theme.colors.background },
  left: { left: -12 }, right: { right: -12 }, track: { height: 82, backgroundColor: theme.colors.background, borderRadius: 44, borderWidth: 1, borderColor: theme.colors.line, justifyContent: 'center' },
  seal: { width: 74, height: 74, marginLeft: 3, borderRadius: 37, backgroundColor: theme.colors.champagne, alignItems: 'center', justifyContent: 'center' },
  sealInset: { width: 62, height: 62, borderRadius: 31, borderWidth: 1, borderColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
  dragHint: { position: 'absolute', left: 83, right: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  dragText: { fontSize: 11, color: theme.colors.champagne }, footnote: { textAlign: 'center', fontSize: 11, color: theme.colors.muted },
  locked: { gap: 18, alignItems: 'center', paddingBottom: 10 }, opening: { fontSize: 28, lineHeight: 36, textAlign: 'center', color: theme.colors.champagne }, center: { textAlign: 'center' },
});
