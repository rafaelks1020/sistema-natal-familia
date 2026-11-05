import * as SecureStore from 'expo-secure-store';
import { QueryClient } from '@tanstack/react-query';

// Reserva ativa durante a propagação. Altere somente esta constante quando o domínio estiver pronto.
export const API_BASE_URL = 'https://sistema-natal-familia.vercel.app';
export const PRIMARY_API_URL = 'https://natalemfamilia.com.br';
const TOKEN_KEY = 'natal.session.v1';
const BIO_TOKEN_KEY = 'natal.session.biometric.v1';
const BIO_KEY = 'natal.biometric.v1';
const storeOptions: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const bioOptions: SecureStore.SecureStoreOptions = { ...storeOptions, requireAuthentication: true, authenticationPrompt: 'Desbloqueie seu Natal em Família' };
type SessionSnapshot = { status: 'loading' | 'guest' | 'locked' | 'authenticated'; biometric: boolean };
let snapshot: SessionSnapshot = { status: 'loading', biometric: false };
let token: string | null = null;
let generation = 0;
const subscribers = new Set<() => void>();
function emit(next: SessionSnapshot) { snapshot = next; subscribers.forEach(listener => listener()); }
export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); this.name = 'ApiError'; }
}
export const queryKeys = { me: ['session', 'me'] as const, home: ['home'] as const, attendance: ['attendance'] as const };
export const queryClient = new QueryClient({ defaultOptions: {
  queries: { staleTime: 60_000, gcTime: 15 * 60_000, refetchOnWindowFocus: true,
    retry: (count, error) => count < 1 && !(error instanceof ApiError && error.status >= 400 && error.status < 500) },
  mutations: { retry: false },
} });
export const sessionStore = {
  subscribe(listener: () => void) { subscribers.add(listener); return () => { subscribers.delete(listener); }; },
  getSnapshot: () => snapshot,
  getGeneration: () => generation,
  async contentChanged() {
    generation++;
    const filters = { predicate: (entry: { queryKey: readonly unknown[] }) => ['mural', 'album', 'familia', 'home', 'moderacao'].includes(String(entry.queryKey[0])) };
    await queryClient.cancelQueries(filters);
    await queryClient.resetQueries(filters);
  },
  async hydrate() {
    try {
      const biometric = await SecureStore.getItemAsync(BIO_KEY) === 'true';
      if (biometric) { emit({ status: 'locked', biometric }); return; }
      token = await SecureStore.getItemAsync(TOKEN_KEY, storeOptions);
      emit({ status: token ? 'authenticated' : 'guest', biometric: false });
    } catch { token = null; emit({ status: 'guest', biometric: false }); }
  },
  async save(value: string) {
    // Um novo login por senha substitui a sessão anterior e exige nova adesão biométrica.
    await SecureStore.setItemAsync(TOKEN_KEY, value, storeOptions);
    await SecureStore.deleteItemAsync(BIO_KEY);
    await SecureStore.deleteItemAsync(BIO_TOKEN_KEY);
    generation++; token = value; queryClient.clear(); emit({ status: 'authenticated', biometric: false });
  },
  async enableBiometric() {
    if (!token) throw new Error('Entre novamente para ativar a biometria.');
    await SecureStore.setItemAsync(BIO_TOKEN_KEY, token, bioOptions);
    await SecureStore.setItemAsync(BIO_KEY, 'true');
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    emit({ status: 'authenticated', biometric: true });
  },
  async unlock() {
    const value = await SecureStore.getItemAsync(BIO_TOKEN_KEY, bioOptions);
    if (!value) throw new Error('A biometria mudou ou a sessão não está disponível. Entre com sua senha.');
    token = value; generation++; emit({ status: 'authenticated', biometric: true });
  },
  lock() {
    if (snapshot.biometric && snapshot.status === 'authenticated') {
      token = null; generation++; void queryClient.cancelQueries(); queryClient.clear(); emit({ status: 'locked', biometric: true });
    }
  },
  async signOut() {
    // Antes de esquecer o token da sessão, pede ao servidor para parar os avisos neste aparelho.
    if (token && pushToken) {
      const sessao = token, aparelho = pushToken;
      await Promise.race([
        fetch(`${API_BASE_URL}/api/push`, { method: 'DELETE', credentials: 'omit',
          headers: { Authorization: `Bearer ${sessao}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ token: aparelho }) }).catch(() => null),
        new Promise((r) => setTimeout(r, 3000)),
      ]);
    }
    pushToken = null;
    token = null; generation++; void queryClient.cancelQueries(); queryClient.clear(); emit({ status: 'guest', biometric: false });
    await Promise.all([TOKEN_KEY, BIO_TOKEN_KEY, BIO_KEY].map(key => SecureStore.deleteItemAsync(key)));
  },
};
let pushToken: string | null = null;
/** Guardado por src/push.ts para o aparelho deixar de receber avisos ao sair da conta. */
export function definirTokenPush(t: string | null) { pushToken = t; }

type ApiInit = Omit<RequestInit, 'body'> & { json?: unknown; body?: BodyInit; public?: boolean; timeoutMs?: number };
export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  if (!path.startsWith('/api/')) throw new Error('Caminho de API inválido.');
  const { json, public: isPublic = false, timeoutMs = 15000, signal, headers, ...rest } = init;
  const requestGeneration = generation;
  if (!isPublic && !token) throw new ApiError('Entre com seu usuário para continuar.', 401);
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort);
  const timeout = setTimeout(abort, timeoutMs);
  try {
    const requestHeaders = new Headers(headers);
    requestHeaders.set('Accept', 'application/json');
    if (json !== undefined) requestHeaders.set('Content-Type', 'application/json');
    if (!isPublic && token) requestHeaders.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${API_BASE_URL}${path}`, { ...rest, headers: requestHeaders,
      credentials: 'omit', signal: controller.signal, body: json !== undefined ? JSON.stringify(json) : rest.body });
    const data: unknown = await response.json().catch(() => null);
    if (response.status === 401 && !isPublic && requestGeneration === generation) await sessionStore.signOut().catch(() => {});
    if (!response.ok) {
      const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'Não deu certo. Tente novamente.';
      throw new ApiError(message, response.status);
    }
    if (!isPublic && requestGeneration !== generation) throw new ApiError('A sessão mudou. Entre novamente.', 401);
    if (data === null) throw new ApiError('O servidor enviou uma resposta vazia. Tente novamente.', 502);
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) throw new ApiError(signal?.aborted ? 'Solicitação cancelada.' : 'A conexão demorou demais. Tente novamente.', 0);
    throw new ApiError('Não foi possível conectar. Confira sua internet e tente novamente.', 0);
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}

/**
 * Baixa um arquivo autenticado (ex.: PDF do boleto) para o cache do app e devolve o File.
 * Único ponto além de api() que usa o token; ele vai só no cabeçalho, nunca na URL.
 */
export async function baixarArquivo(path: string, nome: string): Promise<import('expo-file-system').File> {
  if (!path.startsWith('/api/')) throw new Error('Caminho de API inválido.');
  if (!token) throw new ApiError('Entre com seu usuário para continuar.', 401);
  const { File, Paths } = await import('expo-file-system');
  const destino = new File(Paths.cache, nome);
  if (destino.exists) destino.delete();
  try {
    return await File.downloadFileAsync(`${API_BASE_URL}${path}`, destino, {
      headers: { Authorization: `Bearer ${token}`, Accept: '*/*' },
      idempotent: true,
    });
  } catch {
    throw new ApiError('Não deu para baixar o arquivo agora. Tente novamente.', 0);
  }
}
