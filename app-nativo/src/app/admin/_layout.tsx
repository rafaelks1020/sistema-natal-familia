import { Stack } from 'expo-router';
import { theme } from '../../theme';
import { useReduceMotion } from '../../ui/motion';
import { useSomenteAdmin } from '../../screens/admin/comum';

export default function LayoutAdmin() {
  const reduced = useReduceMotion();
  const admin = useSomenteAdmin();
  if (!admin) return null;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background }, animation: reduced ? 'none' : 'fade' }} />;
}
