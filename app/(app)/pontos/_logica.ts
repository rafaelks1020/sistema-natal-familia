// Lógica pura das telas de gamificação (pontos, conquistas, missões e admin).
// Sem dependências de servidor ou DOM para permitir testes diretos com node:test.

import type {
  CategoriaConquista,
  ConquistaVista,
  DiaExtrato,
  LinhaRanking,
  Missao,
  NivelConquista,
  Origem,
  TipoMissao,
} from '@/app/lib/gamificacao/tipos';

export const ORDEM_ORIGENS: Origem[] = ['uso', 'brincadeira', 'karaoke', 'conquista', 'missao', 'ajuste'];

export const ROTULOS_ORIGEM: Record<Origem, string> = {
  uso: 'Uso do app',
  brincadeira: 'Brincadeiras',
  karaoke: 'Karaokê',
  conquista: 'Conquistas',
  missao: 'Missões',
  ajuste: 'Ajustes',
};

export const ORDEM_CATEGORIAS: CategoriaConquista[] = [
  'familia',
  'fotografo',
  'prosa',
  'advento',
  'ceia',
  'festa',
  'karaoke',
  'generoso',
  'memorias',
  'secretas',
];

export const ROTULOS_CATEGORIA: Record<CategoriaConquista, string> = {
  familia: 'Família',
  fotografo: 'Fotógrafo',
  prosa: 'Prosa e mural',
  advento: 'Advento',
  ceia: 'A ceia',
  festa: 'Noite de festa',
  karaoke: 'Karaokê',
  generoso: 'Generosidade',
  memorias: 'Memórias',
  secretas: 'Secretas',
};

export const ROTULOS_NIVEL: Record<NivelConquista, string> = {
  bronze: 'Bronze',
  prata: 'Prata',
  ouro: 'Ouro',
  lendaria: 'Lendária',
};

export const ESTILO_NIVEL: Record<
  NivelConquista,
  { borda: string; selo: string; texto: string; iconeFundo: string }
> = {
  bronze: {
    borda: 'border-amber-700/60',
    selo: 'border-amber-700/60 bg-amber-950/50 text-amber-300',
    texto: 'text-amber-300',
    iconeFundo: 'border-amber-700/60 bg-amber-950/60 text-amber-300',
  },
  prata: {
    borda: 'border-slate-400/60',
    selo: 'border-slate-400/60 bg-slate-800/60 text-slate-200',
    texto: 'text-slate-200',
    iconeFundo: 'border-slate-400/60 bg-slate-800/70 text-slate-200',
  },
  ouro: {
    borda: 'border-yellow-500/70',
    selo: 'border-yellow-500/70 bg-yellow-950/50 text-yellow-300',
    texto: 'text-yellow-300',
    iconeFundo: 'border-yellow-500/70 bg-yellow-950/60 text-yellow-300',
  },
  lendaria: {
    borda: 'border-cereja/80',
    selo: 'border-champagne/80 bg-cereja/25 text-champagne',
    texto: 'text-champagne',
    iconeFundo: 'border-champagne/80 bg-cereja/30 text-champagne',
  },
};

export const ROTULOS_TIPO_MISSAO: Record<TipoMissao, string> = {
  foto: 'Foto',
  texto: 'Texto',
  foto_texto: 'Foto e texto',
};

export function filtrarExtratoPorOrigem(
  extrato: DiaExtrato[],
  origem: Origem | 'todas',
): DiaExtrato[] {
  if (origem === 'todas') return extrato;
  const resultado: DiaExtrato[] = [];
  for (const dia of extrato) {
    const lancamentos = dia.lancamentos.filter((l) => l.origem === origem);
    if (lancamentos.length > 0) {
      const total = lancamentos.reduce((acc, l) => acc + l.pontos, 0);
      resultado.push({ dia: dia.dia, total, lancamentos });
    }
  }
  return resultado;
}

export function separarPodioEResto(ranking: LinhaRanking[]): {
  podio: LinhaRanking[];
  resto: LinhaRanking[];
} {
  const ordenado = [...ranking].sort((a, b) => a.posicao - b.posicao || b.total - a.total);
  return {
    podio: ordenado.slice(0, 3),
    resto: ordenado.slice(3),
  };
}

export function calcularContagemRegressiva(alvoIso: string, agoraMs: number): {
  encerrado: boolean;
  totalSegundos: number;
  dias: number;
  horas: number;
  minutos: number;
  segundos: number;
  textoCurto: string;
} {
  const alvoMs = new Date(alvoIso).getTime();
  if (Number.isNaN(alvoMs) || alvoMs <= agoraMs) {
    return {
      encerrado: true,
      totalSegundos: 0,
      dias: 0,
      horas: 0,
      minutos: 0,
      segundos: 0,
      textoCurto: 'Prazo encerrado',
    };
  }
  const totalSegundos = Math.floor((alvoMs - agoraMs) / 1000);
  const dias = Math.floor(totalSegundos / 86400);
  const horas = Math.floor((totalSegundos % 86400) / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;

  let textoCurto = '';
  if (dias > 0) {
    textoCurto = `${dias}d ${String(horas).padStart(2, '0')}h ${String(minutos).padStart(2, '0')}min`;
  } else if (horas > 0) {
    textoCurto = `${horas}h ${String(minutos).padStart(2, '0')}min ${String(segundos).padStart(2, '0')}s`;
  } else {
    textoCurto = `${minutos}min ${String(segundos).padStart(2, '0')}s`;
  }

  return {
    encerrado: false,
    totalSegundos,
    dias,
    horas,
    minutos,
    segundos,
    textoCurto,
  };
}

export function formatarDiaExtrato(diaIso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(diaIso.trim());
  if (!m) return diaIso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

const fmtDataHoraSP = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const fmtHoraSP = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function formatarDataHoraSP(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return fmtDataHoraSP.format(d);
}

export function formatarHoraSP(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return fmtHoraSP.format(d);
}

export function isoParaDatetimeLocalSP(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const mapa: Record<string, string> = {};
  for (const p of partes) mapa[p.type] = p.value;
  if (!mapa.year || !mapa.month || !mapa.day || !mapa.hour || !mapa.minute) return '';
  const hora = mapa.hour === '24' ? '00' : mapa.hour;
  return `${mapa.year}-${mapa.month}-${mapa.day}T${hora}:${mapa.minute}`;
}

export function datetimeLocalSPParaIso(valor: string): string {
  const limpo = valor.trim();
  if (!limpo) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(limpo)) {
    return `${limpo}:00-03:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(limpo)) {
    return `${limpo}-03:00`;
  }
  return limpo;
}

export function ehConquistaSecretaOculta(c: ConquistaVista): boolean {
  return Boolean(c.secreta && !c.ganha_em && (c.nome === '???' || c.quantos_ganharam === 0));
}

export function textoExibicaoConquista(c: ConquistaVista): {
  nome: string;
  descricao: string;
  oculta: boolean;
} {
  if (ehConquistaSecretaOculta(c)) {
    return {
      nome: '???',
      descricao: c.descricao && c.descricao !== '???' ? c.descricao : '???',
      oculta: true,
    };
  }
  return {
    nome: c.nome || '???',
    descricao: c.descricao || '???',
    oculta: false,
  };
}

export function progressoConquistaPct(c: ConquistaVista): number | null {
  if (!c.progresso || c.progresso.meta <= 0) return null;
  if (c.ganha_em) return 100;
  return Math.min(100, Math.max(0, Math.round((c.progresso.atual / c.progresso.meta) * 100)));
}

export interface GrupoCategoriaConquista {
  categoria: CategoriaConquista;
  titulo: string;
  ganhas: number;
  total: number;
  itens: ConquistaVista[];
}

export function agruparConquistasPorCategoria(
  conquistas: ConquistaVista[],
  categoriaFiltro: CategoriaConquista | 'todas' = 'todas',
  estadoFiltro: 'todas' | 'ganhas' | 'faltam' = 'todas',
): GrupoCategoriaConquista[] {
  const categorias =
    categoriaFiltro === 'todas' ? ORDEM_CATEGORIAS : [categoriaFiltro];
  const grupos: GrupoCategoriaConquista[] = [];

  for (const cat of categorias) {
    const daCategoria = conquistas.filter((c) => c.categoria === cat);
    if (daCategoria.length === 0) continue;
    const ganhas = daCategoria.filter((c) => Boolean(c.ganha_em)).length;
    const filtradas = daCategoria.filter((c) => {
      if (estadoFiltro === 'ganhas') return Boolean(c.ganha_em);
      if (estadoFiltro === 'faltam') return !c.ganha_em;
      return true;
    });
    if (filtradas.length === 0) continue;
    grupos.push({
      categoria: cat,
      titulo: ROTULOS_CATEGORIA[cat] ?? cat,
      ganhas,
      total: daCategoria.length,
      itens: filtradas,
    });
  }
  return grupos;
}

export function filtrarConquistasNovas(
  conquistas: ConquistaVista[],
  jaMostradas: Iterable<string>,
): ConquistaVista[] {
  const vistas = new Set(jaMostradas);
  return conquistas
    .filter((c) => Boolean(c.ganha_em) && !vistas.has(c.id))
    .sort((a, b) => {
      const ta = a.ganha_em ? new Date(a.ganha_em).getTime() : 0;
      const tb = b.ganha_em ? new Date(b.ganha_em).getTime() : 0;
      return ta - tb;
    });
}

export function validarRespostaMissao(
  tipo: TipoMissao,
  texto: string,
  imageUrl: string,
): { ok: boolean; erro?: string } {
  const t = texto.trim();
  const img = imageUrl.trim();
  if (tipo === 'foto') {
    if (!img) return { ok: false, erro: 'Escolha uma foto para responder a missão.' };
    return { ok: true };
  }
  if (tipo === 'texto') {
    if (t.length < 3) return { ok: false, erro: 'Escreva pelo menos 3 letras na sua resposta.' };
    return { ok: true };
  }
  if (!img) return { ok: false, erro: 'Escolha uma foto para acompanhar a sua resposta.' };
  if (t.length < 3) return { ok: false, erro: 'Escreva também um texto com pelo menos 3 letras.' };
  return { ok: true };
}

export function ordenarMissoesAdmin(missoes: Missao[]): Missao[] {
  const peso: Record<Missao['estado'], number> = { ativa: 0, agendada: 1, encerrada: 2 };
  return [...missoes].sort((a, b) => {
    const diff = (peso[a.estado] ?? 3) - (peso[b.estado] ?? 3);
    if (diff !== 0) return diff;
    return new Date(b.inicia_em).getTime() - new Date(a.inicia_em).getTime();
  });
}
