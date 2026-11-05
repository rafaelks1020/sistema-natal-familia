import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { api, definirTokenPush } from './api';

// Notificações push nativas (APNs no iPhone, FCM no Android), sem serviço da Expo.
// O servidor (/api/push) guarda o token do aparelho; o envio é feito pelo site.

let configurado = false;

/** Chamar uma vez ao abrir o app: como mostrar com o app aberto e o canal do Android. */
export function configurarPush(): void {
  if (configurado) return;
  configurado = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync('familia', {
      name: 'Família',
      importance: AndroidImportance.HIGH,
      lightColor: '#C5292D',
      vibrationPattern: [0, 180, 120, 180],
    });
  }
}

async function registrarNoServidor(): Promise<boolean> {
  const { data } = await Notifications.getDevicePushTokenAsync();
  const token = typeof data === 'string' ? data : String(data);
  await api('/api/push', { method: 'POST', json: { platform: Platform.OS === 'ios' ? 'ios' : 'android', token } });
  definirTokenPush(token);
  return true;
}

/** Situação da permissão: 'granted' | 'denied' | 'undetermined'. */
export async function situacaoPush(): Promise<'granted' | 'denied' | 'undetermined'> {
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return 'granted';
  return p.canAskAgain ? 'undetermined' : 'denied';
}

/** Pede a permissão (só quando a pessoa toca em "Ativar avisos") e registra o aparelho. */
export async function ativarPush(): Promise<boolean> {
  const atual = await Notifications.getPermissionsAsync();
  const final = atual.granted
    ? atual
    : await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
  if (!final.granted) return false;
  return registrarNoServidor();
}

/** Se a permissão já foi dada, renova o registro (o token pode mudar). Nunca pede permissão. */
export async function sincronizarPush(): Promise<void> {
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted) await registrarNoServidor();
  } catch {
    /* sem rede ou sem chave configurada: tenta de novo na próxima abertura */
  }
}

/** Rota que veio na notificação tocada (o servidor manda data.rota: /mural, /amigo-oculto, /vaquinha). */
export function rotaDaNotificacao(resposta: Notifications.NotificationResponse | null): string | null {
  const rota = resposta?.notification.request.content.data?.rota;
  return typeof rota === 'string' && /^\/[a-z0-9/_-]*$/i.test(rota) ? rota : null;
}
