// Tipos e textos da ceia, sem acesso ao banco, para a página e as rotas usarem juntos.

export const CATEGORIAS = [
  { id: 'salgado', rotulo: 'Salgados' },
  { id: 'doce', rotulo: 'Doces' },
  { id: 'bebida', rotulo: 'Bebidas' },
  { id: 'descartavel', rotulo: 'Descartáveis' },
  { id: 'outro', rotulo: 'Outros' },
] as const;

export const TIPOS_VOTACAO = [
  { id: 'local', rotulo: 'Local' },
  { id: 'cardapio', rotulo: 'Cardápio' },
  { id: 'data', rotulo: 'Data' },
  { id: 'outro', rotulo: 'Outro' },
] as const;

export type CategoriaPrato = (typeof CATEGORIAS)[number]['id'];
export type TipoVotacao = (typeof TIPOS_VOTACAO)[number]['id'];
export type StatusPresenca = 'yes' | 'maybe' | 'no';

export interface CeiaEvento {
  event_title: string;
  event_date: string;
  event_place: string;
  contribution_value: number;
}

export interface CeiaPessoa {
  participant_id: number;
  name: string;
  avatar_url: string | null;
  status: StatusPresenca;
  adultos: number;
  criancas: number;
  restricao: string | null;
}

export interface CeiaTotais {
  confirmados: number;
  adultos: number;
  criancas: number;
  pessoas: number;
}

export interface CeiaPresenca {
  status: StatusPresenca | null;
  adultos: number;
  criancas: number;
  restricao: string | null;
  pessoas: CeiaPessoa[];
  totais: CeiaTotais;
}

export interface CeiaPrato {
  id: number;
  nome: string;
  categoria: CategoriaPrato;
  quantidade: string | null;
  user_id: number;
  autor_nome: string;
  responsavel_id: number | null;
  responsavel_nome: string | null;
  created_at: string;
}

export interface CeiaOpcao {
  id: number;
  texto: string;
  votos: number;
}

export interface CeiaVotacao {
  id: number;
  pergunta: string;
  tipo: TipoVotacao;
  aberta: boolean;
  criado_por: number;
  created_at: string;
  opcoes: CeiaOpcao[];
  meu_voto: number | null;
  total: number;
}

export interface CeiaDados {
  ano: number;
  evento: CeiaEvento;
  presenca: CeiaPresenca;
  pratos: CeiaPrato[];
  votacoes: CeiaVotacao[];
}

export function categoriaDe(valor: unknown): CategoriaPrato | null {
  return typeof valor === 'string' && CATEGORIAS.some((item) => item.id === valor) ? (valor as CategoriaPrato) : null;
}

export function tipoDe(valor: unknown): TipoVotacao | null {
  return typeof valor === 'string' && TIPOS_VOTACAO.some((item) => item.id === valor) ? (valor as TipoVotacao) : null;
}

export function rotuloCategoria(id: CategoriaPrato): string {
  return CATEGORIAS.find((item) => item.id === id)?.rotulo ?? 'Outros';
}

export function rotuloTipo(id: TipoVotacao): string {
  return TIPOS_VOTACAO.find((item) => item.id === id)?.rotulo ?? 'Outro';
}

export function chavePrato(nome: string): string {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function avisoPratos(lista: { nome: string; categoria: string }[], nome: string, categoria: string): string | null {
  const chave = chavePrato(nome);
  if (chave.length < 2) return null;
  const iguais = lista.filter((item) => {
    if (item.categoria !== categoria) return false;
    const outra = chavePrato(item.nome);
    if (!outra) return false;
    if (outra === chave) return true;
    return chave.length >= 3 && outra.length >= 3 && (outra.includes(chave) || chave.includes(outra));
  });
  if (!iguais.length) return null;
  const n = iguais.length;
  const exemplo = iguais[0]?.nome ?? nome.trim();
  if (iguais.every((item) => chavePrato(item.nome) === chave)) {
    return `Já tem ${n} ${exemplo} nesta categoria.`;
  }
  return n === 1
    ? `Já tem 1 parecido nesta categoria: ${exemplo}.`
    : `Já tem ${n} parecidos nesta categoria, como ${exemplo}.`;
}

export function formatarQuando(iso: string): { data: string; hora: string } {
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return { data: 'Data a combinar', hora: '' };
  const data = instante.toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo',
  });
  const hora = instante.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  return { data, hora };
}

export function formatarCurto(iso: string): string | null {
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return null;
  const data = instante.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo' });
  const hora = instante.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  return `${data}, ${hora}`;
}

export function textoOpcao(tipo: TipoVotacao, texto: string): string {
  if (tipo !== 'data') return texto;
  return formatarCurto(texto) ?? texto;
}

export function camposEvento(iso: string): { data: string; hora: string } {
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return { data: '', hora: '' };
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instante);
  const pegar = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((parte) => parte.type === tipo)?.value ?? '';
  const hora = pegar('hour') === '24' ? '00' : pegar('hour');
  return { data: `${pegar('year')}-${pegar('month')}-${pegar('day')}`, hora: `${hora}:${pegar('minute')}` };
}

/** Data (AAAA-MM-DD) e hora de Brasília no formato que PUT /api/settings aceita. */
export function isoDeBrasilia(data: string, hora: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return null;
  const instante = new Date(`${data}T${hora}:00-03:00`);
  if (Number.isNaN(instante.getTime())) return null;
  const deVolta = camposEvento(instante.toISOString());
  if (deVolta.data !== data || deVolta.hora !== hora) return null;
  return instante.toISOString();
}

export function diasAte(iso: string, agora: number): number | null {
  const alvo = new Date(iso).getTime();
  if (!Number.isFinite(alvo)) return null;
  return Math.floor((alvo - agora) / 86_400_000);
}

export function textoDias(dias: number | null): string {
  if (dias === null) return 'A data da ceia será anunciada em breve.';
  if (dias > 1) return `Faltam ${dias} dias.`;
  if (dias === 1) return 'Falta 1 dia.';
  if (dias === 0) return 'É hoje.';
  return 'A ceia já passou.';
}

export function textoGrupo(adultos: number, criancas: number): string {
  const pessoas = adultos + criancas;
  const partes: string[] = [];
  if (adultos) partes.push(`${adultos} ${adultos === 1 ? 'adulto' : 'adultos'}`);
  if (criancas) partes.push(`${criancas} ${criancas === 1 ? 'criança' : 'crianças'}`);
  if (!pessoas || !partes.length) return 'Sem contagem de pessoas';
  return `${pessoas} ${pessoas === 1 ? 'pessoa' : 'pessoas'}: ${partes.join(' e ')}`;
}

export function textoTotais(totais: CeiaTotais): string {
  if (!totais.confirmados) return 'A mesa ainda está esperando pela família.';
  const confirmacao = `${totais.confirmados} ${totais.confirmados === 1 ? 'confirmação' : 'confirmações'}`;
  const partes: string[] = [];
  if (totais.adultos) partes.push(`${totais.adultos} ${totais.adultos === 1 ? 'adulto' : 'adultos'}`);
  if (totais.criancas) partes.push(`${totais.criancas} ${totais.criancas === 1 ? 'criança' : 'crianças'}`);
  return partes.length ? `${confirmacao}. ${partes.join(' e ')}.` : `${confirmacao}.`;
}

export function percentual(votos: number, total: number): number {
  if (votos <= 0 || total <= 0) return 0;
  return Math.min(100, Math.max(8, Math.round((votos / total) * 100)));
}

export function situacaoVotos(opcoes: { votos: number }[]): 'vazia' | 'empate' | 'lider' {
  const total = opcoes.reduce((soma, opcao) => soma + opcao.votos, 0);
  if (!total) return 'vazia';
  const maximo = Math.max(...opcoes.map((opcao) => opcao.votos));
  return opcoes.filter((opcao) => opcao.votos === maximo).length === 1 ? 'lider' : 'empate';
}

export function quemLeva(prato: Pick<CeiaPrato, 'responsavel_id' | 'responsavel_nome'>, meuId: number): string {
  if (!prato.responsavel_id) return 'Ninguém levou ainda.';
  if (prato.responsavel_id === meuId) return 'Você leva.';
  return `${prato.responsavel_nome ?? 'Alguém da família'} leva.`;
}
