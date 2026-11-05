import { createContext, useContext, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { focusManager, useQuery } from '@tanstack/react-query';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { api, queryKeys, sessionStore } from './api';
import type { User } from './types';
import { theme } from './theme';
import { Text } from './ui/Text';
import { Button } from './ui/Button';
import { Sheet } from './ui/Sheet';
import { EmptyState } from './ui/EmptyState';
import { Skeleton } from './ui/Skeleton';
import { useToast } from './ui/Toast';
interface SessionContextValue {
  status: 'loading' | 'guest' | 'locked' | 'authenticated';
  biometric: boolean; user: User | null; signIn: (token: string) => Promise<void>;
  unlock: () => Promise<void>; signOut: () => Promise<void>;
}
const SessionContext = createContext<SessionContextValue | null>(null);
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('Sessão indisponível fora do SessionProvider.');
  return session;
}
export function SessionProvider({ children }: PropsWithChildren) {
  const state = useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot, sessionStore.getSnapshot);
  const [offer, setOffer] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const toast = useToast();
  const me = useQuery({ queryKey: queryKeys.me, queryFn: ({ signal }) => api<{ user: User | null }>('/api/auth', { signal }), enabled: state.status === 'authenticated' });
  useEffect(() => { void sessionStore.hydrate(); }, []);
  useEffect(() => {
    focusManager.setFocused(AppState.currentState === 'active' && state.status === 'authenticated');
    const listener = AppState.addEventListener('change', appState => {
      if (appState === 'background') sessionStore.lock();
      focusManager.setFocused(appState === 'active' && sessionStore.getSnapshot().status === 'authenticated');
    });
    return () => listener.remove();
  }, [state.status]);
  useEffect(() => {
    if (state.status === 'authenticated' && me.isSuccess && !me.data.user) {
      void sessionStore.signOut().catch(() => {});
      toast('Sua sessão expirou. Entre novamente.', 'error');
    }
  }, [state.status, me.isSuccess, me.data, toast]);
  async function signIn(token: string) {
    await sessionStore.save(token);
    try {
      const [hardware, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
      if (hardware && enrolled && SecureStore.canUseBiometricAuthentication()) setOffer(true);
    } catch { /* A oferta opcional não deve interromper um login já concluído. */ }
  }
  async function enable() {
    setEnabling(true);
    try { await sessionStore.enableBiometric(); setOffer(false); toast('Biometria ativada neste aparelho.'); }
    catch { setOffer(false); toast('Não foi possível ativar a biometria. Você pode continuar usando sua senha.', 'error'); }
    finally { setEnabling(false); }
  }
  const authenticated = state.status === 'authenticated';
  const loading = state.status === 'loading' || (authenticated && me.isPending);
  return <SessionContext.Provider value={{ ...state, user: authenticated ? me.data?.user ?? null : null,
    signIn, unlock: sessionStore.unlock, signOut: sessionStore.signOut }}>
    {loading ? <SessionLoading /> : authenticated && me.isError ? <View style={styles.full}>
      <EmptyState title="Vamos tentar de novo?" message={me.error.message} action="Tentar novamente" onAction={() => { void me.refetch(); }} />
      <Button variant="quiet" onPress={() => { void sessionStore.signOut().catch(() => {}); }}>Entrar com outra conta</Button>
    </View> : children}
    <Sheet visible={offer && authenticated && Boolean(me.data?.user)} title="Seu acesso, mais simples" onClose={() => { if (!enabling) setOffer(false); }}>
      <Text variant="muted">Entre com Face ID ou digital. Seu acesso ficará protegido neste aparelho e será bloqueado quando o app for para segundo plano.</Text>
      <Button loading={enabling} onPress={() => { void enable(); }}>Entrar com Face ID/digital</Button>
      <Button disabled={enabling} variant="quiet" onPress={() => setOffer(false)}>Agora não</Button>
    </Sheet>
  </SessionContext.Provider>;
}
export function SessionLoading() {
  return <View style={[styles.full, styles.loading]} accessibilityLabel="Preparando seu Natal">
    <Text variant="kicker">Natal em Família</Text><Skeleton style={{ height: 64, width: '80%' }} /><Skeleton style={{ height: 170 }} /><Skeleton style={{ height: 130 }} />
  </View>;
}
const styles = StyleSheet.create({ full: { flex: 1, backgroundColor: theme.colors.background, padding: 24 }, loading: { justifyContent: 'center', gap: 24 } });
