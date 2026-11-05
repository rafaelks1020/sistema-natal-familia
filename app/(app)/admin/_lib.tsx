'use client';

import { brl, thumb } from '@/app/ui/client';
import type { TipoColuna } from '@/app/lib/admin/tipos';

const OPCOES: Record<string, string> = {
  yes: 'Vai', maybe: 'Talvez', no: 'Não vai',
  salgado: 'Salgado', doce: 'Doce', bebida: 'Bebida', descartavel: 'Descartável', outro: 'Outro',
  local: 'Local', cardapio: 'Cardápio', data: 'Data',
};
export const rotuloOpcao = (v: string) => OPCOES[v] ?? v;

const dataHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export function formatarData(valor: unknown): string {
  if (typeof valor !== 'string' || !valor) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return `${valor.slice(8, 10)}/${valor.slice(5, 7)}/${valor.slice(0, 4)}`;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? valor : dataHora.format(d);
}

/** Texto simples do valor (usado em título, tabela e cartão). */
export function formatar(valor: unknown, tipo: TipoColuna): string {
  if (valor === null || valor === undefined || valor === '') return '-';
  switch (tipo) {
    case 'data': return formatarData(valor);
    case 'dinheiro': return brl(Number(valor) / 100);
    case 'bool': return valor ? 'Sim' : 'Não';
    case 'imagem': return 'Foto';
    case 'link': return String(valor).replace(/^https?:\/\//, '').slice(0, 40);
    default: return typeof valor === 'string' ? rotuloOpcao(valor) : String(valor);
  }
}

/** Valor completo para a tela de detalhe: foto aparece, link abre em outra aba. */
export function Valor({ valor, tipo }: { valor: unknown; tipo: TipoColuna }) {
  if (valor === null || valor === undefined || valor === '') return <span className="text-marfim-3">-</span>;
  if (tipo === 'imagem' && typeof valor === 'string') {
    return (
      <a href={valor} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb(valor, 384)} alt="" loading="lazy" className="max-h-56 rounded-xl border border-linha object-cover" />
      </a>
    );
  }
  if (tipo === 'link' && typeof valor === 'string') {
    return <a href={valor} target="_blank" rel="noopener noreferrer" className="break-all text-champagne underline">Abrir link</a>;
  }
  if (tipo === 'longo') return <span className="whitespace-pre-wrap break-words">{String(valor)}</span>;
  return <span className="break-words">{formatar(valor, tipo)}</span>;
}

export function Miniatura({ url }: { url: unknown }) {
  if (typeof url !== 'string' || !url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={thumb(url, 96)} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg border border-linha object-cover" />;
}
