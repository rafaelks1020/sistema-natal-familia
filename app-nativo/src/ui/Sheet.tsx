import { useEffect, type PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { useReduceMotion } from './motion';
import { Text } from './Text';
export function Sheet({ visible, onClose, title, children }: PropsWithChildren<{ visible: boolean; onClose: () => void; title: string }>) {
  const { height } = useWindowDimensions();
  const inset = useSafeAreaInsets();
  const reduced = useReduceMotion();
  const y = useSharedValue(height);
  useEffect(() => {
    y.set(visible ? (reduced ? 0 : height) : height);
    if (visible) y.set(withTiming(0, { duration: reduced ? 0 : 650, easing: Easing.out(Easing.cubic) }));
  }, [visible, height, reduced, y]);
  const pan = Gesture.Pan().onUpdate(event => { y.set(Math.max(0, event.translationY)); })
    .onEnd(event => { if (event.translationY > 100 || event.velocityY > 900) runOnJS(onClose)(); else y.set(withTiming(0, { duration: reduced ? 0 : 250 })); });
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
    <GestureHandlerRootView style={styles.root}>
      <Pressable accessibilityRole="button" accessibilityLabel="Fechar folha" onPress={onClose} style={[StyleSheet.absoluteFill, styles.backdrop]} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard} pointerEvents="box-none">
        <Animated.View accessibilityViewIsModal onAccessibilityEscape={onClose} style={[styles.sheet, { maxHeight: height * 0.86, paddingBottom: Math.max(inset.bottom, 24) }, style]}>
          <GestureDetector gesture={pan}><View style={styles.handleArea}><View style={styles.handle} /></View></GestureDetector>
          <Text variant="display" accessibilityRole="header" style={styles.title}>{title}</Text>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  </Modal>;
}
const styles = StyleSheet.create({
  root: { flex: 1 }, backdrop: { backgroundColor: theme.colors.scrim }, keyboard: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, borderColor: theme.colors.lineStrong, paddingHorizontal: 24, gap: 16 },
  handleArea: { height: 30, alignItems: 'center', justifyContent: 'center' }, handle: { width: 36, height: 3, backgroundColor: theme.colors.muted, borderRadius: 2 }, title: { fontSize: 29, lineHeight: 38 },
});
