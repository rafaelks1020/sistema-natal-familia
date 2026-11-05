import { useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { theme } from '../theme';
import { useReduceMotion } from './motion';
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const opacity = useSharedValue(0.6);
  const reduced = useReduceMotion();
  useEffect(() => {
    if (!reduced) opacity.set(withRepeat(withTiming(1, { duration: 900 }), -1, true));
    else { cancelAnimation(opacity); opacity.set(0.75); }
    return () => cancelAnimation(opacity);
  }, [reduced, opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View accessibilityLabel="Carregamento em andamento" style={[{ height: 24, borderRadius: 14, backgroundColor: theme.colors.field }, style, animated]} />;
}
