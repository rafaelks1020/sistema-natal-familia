import { useEffect, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { theme } from '../theme';
export function useReduceMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live) setReduced(value); });
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { live = false; listener.remove(); };
  }, []);
  return reduced;
}
export function Rise({ children, index = 0, style }: PropsWithChildren<{ index?: number; style?: StyleProp<ViewStyle> }>) {
  const reduced = useReduceMotion();
  const progress = useSharedValue(1);
  useEffect(() => {
    if (reduced) { progress.set(1); return; }
    progress.set(0);
    progress.set(withDelay(index * theme.motion.stagger, withTiming(1, { duration: theme.motion.duration, easing: Easing.out(Easing.cubic) })));
  }, [index, progress, reduced]);
  const animated = useAnimatedStyle(() => ({ opacity: progress.get(), transform: [{ translateY: (1 - progress.get()) * 16 }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
