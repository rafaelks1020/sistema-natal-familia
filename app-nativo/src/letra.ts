import { useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';

export type NivelLetra = 'normal' | 'grande' | 'maior';

const ESCALAS: Record<NivelLetra, number> = { normal: 1, grande: 1.12, maior: 1.25 };
const CHAVE = 'natal.letra.v1';
const CHAVE_PERGUNTOU = 'natal.letra.perguntou.v1';

let nivel: NivelLetra = 'normal';
let perguntou = false;
let carregada = false;
let geracao = 0;
const ouvintes = new Set<() => void>();

function emitir() {
  ouvintes.forEach((ouvinte) => ouvinte());
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => { ouvintes.delete(ouvinte); };
}

function ehNivel(valor: string | null): valor is NivelLetra {
  return valor === 'normal' || valor === 'grande' || valor === 'maior';
}

export function useEscalaLetra(): number {
  return useSyncExternalStore(assinar, () => ESCALAS[nivel], () => 1);
}

export function useNivelLetra(): NivelLetra {
  return useSyncExternalStore(assinar, () => nivel, () => 'normal');
}

export function usePerguntouLetra(): boolean {
  return useSyncExternalStore(assinar, () => perguntou, () => false);
}

export function useLetraCarregada(): boolean {
  return useSyncExternalStore(assinar, () => carregada, () => false);
}

export async function definirLetra(proximo: NivelLetra): Promise<void> {
  geracao += 1;
  nivel = proximo;
  emitir();
  try {
    await SecureStore.setItemAsync(CHAVE, proximo);
  } catch {
    // se o aparelho recusar gravar, a escolha vale só nesta sessão
  }
}

export async function carregarLetra(): Promise<void> {
  const visto = geracao;
  try {
    const [salvo, marca] = await Promise.all([
      SecureStore.getItemAsync(CHAVE),
      SecureStore.getItemAsync(CHAVE_PERGUNTOU),
    ]);
    if (visto !== geracao) return;
    if (ehNivel(salvo)) nivel = salvo;
    perguntou = marca === '1';
  } catch {
    // sem leitura no aparelho, segue o padrão desta sessão
  }
  if (visto !== geracao) return;
  carregada = true;
  emitir();
}

export function jaPerguntouLetra(): boolean {
  return perguntou;
}

export function marcarPerguntaLetra(): void {
  geracao += 1;
  perguntou = true;
  emitir();
  void SecureStore.setItemAsync(CHAVE_PERGUNTOU, '1').catch(() => {});
}

void carregarLetra();
