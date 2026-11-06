export type TipoColuna = 'texto' | 'longo' | 'data' | 'imagem' | 'dinheiro' | 'bool' | 'numero' | 'link';
export type TipoEditavel = 'texto' | 'longo' | 'bool' | 'numero' | 'dinheiro' | 'opcao';

export interface Coluna { campo: string; rotulo: string; tipo: TipoColuna }
export interface Editavel { campo: string; rotulo: string; tipo: TipoEditavel; opcoes?: string[] }
export interface Acao { id: string; rotulo: string; perigosa: boolean }
export interface RecursoMeta {
  id: string; nome: string; colunas: Coluna[]; editaveis: Editavel[]; pode_apagar: boolean; acoes: Acao[];
}
export type ItemAdmin = { id: number | string } & Record<string, unknown>;
export interface PaginaRecurso { recurso: RecursoMeta; itens: ItemAdmin[]; proximo: string | null }

export interface ResumoRecurso { id: string; nome: string; total: number; novos7d: number }
export interface Resumo {
  grupos: { titulo: string; recursos: ResumoRecurso[] }[];
  ferramentas: { titulo: string; texto: string; rota_site: string; rota_app: string }[];
  pendencias: { denuncias: number; pedidos_convite: number; bingo_pendentes: number };
}

export interface RespostaAcao { ok: boolean; mensagem?: string; senha_temporaria?: string }
export interface LogItem { id: number | string; quando: string; quem: string; acao: string; recurso: string; alvo_id: string | null; detalhe: string | null }
export interface PaginaLog { itens: LogItem[]; proximo: string | null }

export const adminKeys = {
  resumo: ['admin', 'resumo'] as const,
  lista: (recurso: string, q: string) => ['admin', 'lista', recurso, q] as const,
  listaRaiz: (recurso: string) => ['admin', 'lista', recurso] as const,
  log: ['admin', 'log'] as const,
};
