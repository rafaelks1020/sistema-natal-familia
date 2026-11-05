import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { Text } from './Text';
import { useReduceMotion } from './motion';
export function Button({ children, onPress, variant = 'primary', disabled, loading, selected, style, icon, accessibilityLabel }: {
  children: ReactNode; onPress: () => void; variant?: 'primary' | 'ghost' | 'quiet';
  disabled?: boolean; loading?: boolean; selected?: boolean; style?: StyleProp<ViewStyle>; icon?: ReactNode; accessibilityLabel?: string;
}) {
  const scale = useSharedValue(1);
  const reduced = useReduceMotion();
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const blocked = disabled || loading;
  return <Animated.View style={[style, animated]}><Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel}
    accessibilityState={{ disabled: Boolean(blocked), busy: Boolean(loading), selected }} disabled={blocked}
    onPressIn={() => { if (!reduced) scale.set(withTiming(0.97, { duration: 100 })); }}
    onPressOut={() => { scale.set(withTiming(1, { duration: reduced ? 0 : 220 })); }}
    onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress(); }}
    style={[styles.base, styles[variant], blocked && styles.disabled]}>
    {loading ? <ActivityIndicator color={theme.colors.ivory} /> : icon}
    <Text style={styles.label}>{children}</Text>
  </Pressable></Animated.View>;
}
const styles = StyleSheet.create({
  base: { minHeight: 50, borderRadius: theme.radius.button, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  primary: { backgroundColor: theme.colors.cherry, borderColor: theme.colors.cherry },
  ghost: { backgroundColor: 'transparent', borderColor: theme.colors.lineStrong },
  quiet: { borderColor: 'transparent' }, disabled: { opacity: 0.5 },
  label: { fontFamily: theme.fonts.medium, textAlign: 'center', fontSize: 14 },
});
