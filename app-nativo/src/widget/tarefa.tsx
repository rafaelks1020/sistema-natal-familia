// Tarefa em segundo plano do widget Android: desenha a contagem a partir da data salva.
import React from 'react';
import * as SecureStore from 'expo-secure-store';
import { registerWidgetTaskHandler, type WidgetTaskHandlerProps } from 'react-native-android-widget';
import { calcularContagem, CHAVE_DATA, CHAVE_TITULO } from './dados';
import { NatalWidget } from './NatalWidget';

export const WIDGET_PEQUENO = 'NatalPequeno';
export const WIDGET_GRANDE = 'NatalGrande';

export async function lerContagem() {
  const [data, titulo] = await Promise.all([SecureStore.getItemAsync(CHAVE_DATA), SecureStore.getItemAsync(CHAVE_TITULO)]);
  return calcularContagem(data, titulo);
}

export async function desenhar(nome: string) {
  return <NatalWidget contagem={await lerContagem()} grande={nome === WIDGET_GRANDE} />;
}

async function tratar({ widgetInfo, widgetAction, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  renderWidget(await desenhar(widgetInfo.widgetName));
}

export function registrarTarefaDoWidget() {
  registerWidgetTaskHandler(tratar);
}
