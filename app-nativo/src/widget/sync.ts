// Grava a data e o título da ceia no armazenamento compartilhado de cada plataforma e atualiza o widget.
import { Platform } from 'react-native';
import { APP_GROUP, CHAVE_DATA, CHAVE_TITULO } from './dados';

export async function syncWidget(settings: { event_date: string; event_title: string }): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      const SecureStore = await import('expo-secure-store');
      await SecureStore.setItemAsync(CHAVE_DATA, settings.event_date);
      await SecureStore.setItemAsync(CHAVE_TITULO, settings.event_title);
      const { requestWidgetUpdate } = await import('react-native-android-widget');
      const { desenhar, WIDGET_PEQUENO, WIDGET_GRANDE } = await import('./tarefa');
      for (const nome of [WIDGET_PEQUENO, WIDGET_GRANDE]) {
        await requestWidgetUpdate({ widgetName: nome, renderWidget: () => desenhar(nome) });
      }
    } else if (Platform.OS === 'ios') {
      const { ExtensionStorage } = await import('@bacons/apple-targets');
      const storage = new ExtensionStorage(APP_GROUP);
      storage.set(CHAVE_DATA, settings.event_date);
      storage.set(CHAVE_TITULO, settings.event_title);
      ExtensionStorage.reloadWidget();
    }
  } catch {
    // O widget é um extra: falhar aqui nunca deve atrapalhar a Início.
  }
}
