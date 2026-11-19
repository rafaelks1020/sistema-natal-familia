import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { BodoniModa_500Medium } from '@expo-google-fonts/bodoni-moda/500Medium';
import { BodoniModa_400Regular_Italic } from '@expo-google-fonts/bodoni-moda/400Regular_Italic';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { queryClient } from '../api';
import { SessionProvider, useSession, SessionLoading } from '../session';
import { ToastProvider } from '../ui/Toast';
import { EmptyState } from '../ui/EmptyState';
import { theme } from '../theme';
import { useReduceMotion } from '../ui/motion';
import { configurarPush, rotaDaNotificacao, sincronizarPush } from '../push';
void SplashScreen.preventAutoHideAsync().catch(() => {});
configurarPush();
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ BodoniModa_500Medium, BodoniModa_400Regular_Italic, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold });
  useEffect(() => { if (fontsLoaded || fontError) void SplashScreen.hideAsync(); }, [fontsLoaded, fontError]);
  return <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
    <SafeAreaProvider><StatusBar style="light" />
      {fontError ? <EmptyState title="Não foi possível abrir" message="As fontes locais não puderam ser carregadas. Feche e abra o app novamente." />
        : !fontsLoaded ? <SessionLoading /> : <QueryClientProvider client={queryClient}>
          <ToastProvider><SessionProvider><Routes /></SessionProvider></ToastProvider>
        </QueryClientProvider>}
      <FaixaDaBarraDeStatus />
    </SafeAreaProvider>
  </GestureHandlerRootView>;
}
// No Android o app desenha por baixo da barra de status: ao rolar, o texto passava por trás do relógio e dos ícones
// e ficava ilegível. Esta faixa da cor do fundo cobre só a altura da barra, em todas as telas. Não recebe toque.
function FaixaDaBarraDeStatus() {
  const { top } = useSafeAreaInsets();
  if (Platform.OS !== 'android' || top <= 0) return null;
  return <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: top, backgroundColor: theme.colors.background, zIndex: 100, elevation: 100 }} />;
}
function Routes() {
  const { status } = useSession();
  const reduced = useReduceMotion();
  // Logado: renova o registro do aparelho (só se a permissão já foi dada; nunca pede aqui).
  useEffect(() => { if (status === 'authenticated') void sincronizarPush(); }, [status]);
  // Toque na notificação abre a tela certa (também quando o app estava fechado).
  const ultima = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (status !== 'authenticated') return;
    const rota = rotaDaNotificacao(ultima ?? null);
    if (!rota) return;
    // Só o Hoje fica dentro de (tabs); mural, amigo oculto, vaquinha, álbum e as demais telas são rotas do Stack.
    if (rota === '/') router.push('/(tabs)');
    else router.push(rota as never);
    void Notifications.clearLastNotificationResponseAsync();
  }, [ultima, status]);
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background }, animation: reduced ? 'none' : 'fade' }}>
    <Stack.Protected guard={status === 'guest' || status === 'locked'}><Stack.Screen name="entrar" /></Stack.Protected>
    <Stack.Protected guard={status === 'authenticated'}><Stack.Screen name="(tabs)" /></Stack.Protected>
    <Stack.Screen name="termos" />
    <Stack.Screen name="privacidade" />
    <Stack.Screen name="+not-found" />
  </Stack>;
}
