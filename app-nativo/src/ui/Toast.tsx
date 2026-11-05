import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Text } from './Text';
import { Rise } from './motion';
import { theme } from '../theme';
type Notify = (message: string, kind?: 'success' | 'error') => void;
const ToastContext = createContext<Notify>(() => {});
export const useToast = () => useContext(ToastContext);
export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<{ message: string; kind: string; id: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const notify = useCallback<Notify>((message, kind = 'success') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, kind, id: Date.now() });
    AccessibilityInfo.announceForAccessibility(message);
    timer.current = setTimeout(() => setToast(null), 4200);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return <ToastContext.Provider value={notify}>{children}
    {toast ? <Rise key={toast.id} style={[styles.position, { top: insets.top + 12 }]}>
      <Pressable accessibilityRole="alert" accessibilityLabel={toast.message} onPress={() => setToast(null)} style={styles.card}>
        <BlurView tint="dark" intensity={35} style={StyleSheet.absoluteFill} />
        <Text style={{ fontSize: 13, color: toast.kind === 'error' ? theme.colors.error : theme.colors.ivory }}>{toast.message}</Text>
      </Pressable>
    </Rise> : null}
  </ToastContext.Provider>;
}
const styles = StyleSheet.create({ position: { position: 'absolute', left: 20, right: 20, zIndex: 100 }, card: { minHeight: 48, padding: 16, borderWidth: 1, borderColor: theme.colors.lineStrong, borderRadius: 16, overflow: 'hidden', backgroundColor: theme.colors.surface } });
