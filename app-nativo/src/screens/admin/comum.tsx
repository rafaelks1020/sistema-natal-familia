import { useEffect } from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { API_BASE_URL } from '../../api';
import { brl } from '../../format';
import { useSession } from '../../session';
import type { TipoColuna } from './tipos';

/** Libera só organizador autenticado; quem não é admin volta para o início. */
export function useSomenteAdmin(): boolean {
  const { status, user } = useSession();
  const admin = status === 'authenticated' && Boolean(user?.is_admin);
  useEffect(() => {
    if (status === 'guest' || status === 'locked') router.replace('/entrar');
    else if (status === 'authenticated' && !user?.is_admin) router.replace('/');
  }, [status, user?.is_admin]);
  return admin;
}

export function voltar() { if (router.canGoBack()) router.back(); else router.navigate('/'); }

export function quandoBr(valor: unknown): string {
  if (typeof valor !== 'string' || !valor) return '-';
  const texto = /[zZ]|[+-]\d\d:\d\d$/.test(valor) || !valor.includes('T') ? valor : `${valor}Z`;
  const data = new Date(texto);
  if (Number.isNaN(data.getTime())) return valor;
  const soData = !valor.includes('T');
  return data.toLocaleString('pt-BR', soData
    ? { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }
    : { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

export function formatar(valor: unknown, tipo: TipoColuna): string {
  if (valor === null || valor === undefined || valor === '') return '-';
  switch (tipo) {
    case 'bool': return valor ? 'Sim' : 'Não';
    case 'data': return quandoBr(valor);
    case 'dinheiro': return typeof valor === 'number' ? brl(valor / 100) : String(valor);
    case 'numero': return typeof valor === 'number' ? valor.toLocaleString('pt-BR') : String(valor);
    default: return typeof valor === 'object' ? JSON.stringify(valor) : String(valor);
  }
}

/** Endereço absoluto para imagens e links que o servidor devolve relativos. */
export function urlAbsoluta(valor: unknown): string | null {
  if (typeof valor !== 'string' || !valor) return null;
  if (valor.startsWith('/')) return `${API_BASE_URL}${valor}`;
  return /^https?:\/\//i.test(valor) ? valor : null;
}

export function abrirLink(valor: unknown) {
  const url = urlAbsoluta(valor);
  if (url) void Linking.openURL(url).catch(() => {});
}
