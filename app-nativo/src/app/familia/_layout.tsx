import { Stack } from 'expo-router';
import { theme } from '../../theme';
import { useReduceMotion } from '../../ui/motion';

export default function LayoutFamilia() {
  const reduced = useReduceMotion();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background }, animation: reduced ? 'none' : 'fade' }} />;
}
