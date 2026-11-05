import { api, ApiError, queryClient, queryKeys, sessionStore } from '../../api';
import type { VaquinhaData as BaseData, Purchase as BasePurchase, PurchaseInput as BaseInput } from '../../types/vaquinha';

export interface Purchase extends BasePurchase { receipt_url: string | null }
export interface PurchaseInput extends BaseInput { receipt_url?: string | null; images?: string[] }
export interface VaquinhaData extends Omit<BaseData, 'purchases'> { purchases: Purchase[]; ano: number; meta_centavos: number; arrecadado_centavos: number; destino: string; contribuintes: number }

export const vaquinhaKeys = { all: ['vaquinha'] as const, payment: ['vaquinha', 'payment'] as const };
export const sessionIsCurrent = (generation: number) => generation === sessionStore.getGeneration() && sessionStore.getSnapshot().status === 'authenticated';
export function requireCurrentSession(generation: number) {
  if (!sessionIsCurrent(generation)) throw new ApiError('A sessão mudou. Entre novamente.', 401);
}
export const getVaquinha = (signal: AbortSignal) => api<VaquinhaData>('/api/vaquinha', { signal });
export function refreshVaquinha(generation: number) {
  if (!sessionIsCurrent(generation)) return;
  void queryClient.invalidateQueries({ queryKey: vaquinhaKeys.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.home });
}
export function parseValue(text: string) {
  const value = text.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) return NaN;
  return Math.round(Number(value.replace(',', '.')) * 100) / 100;
}
export function dateLabel(value: string | null) {
  if (!value || value.startsWith('1970-')) return 'Data não informada';
  const date = new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo' }) : 'Data não informada';
}
