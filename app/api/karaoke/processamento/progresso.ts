import type { StatusCatalogo } from '@/app/telao/karaoke/tipos';

export const ROTULOS_ETAPA = {
  na_fila: 'Na fila de preparo',
  baixando: 'Baixando o áudio',
  separando_voz: 'Separando a voz',
  alinhando_letra: 'Alinhando a letra',
  gerando_notas: 'Gerando as notas',
  publicando: 'Publicando a música',
  pronta: 'Pronta para cantar!',
  falhou: 'Não foi possível preparar',
} as const;
export type EtapaProcessamento = keyof typeof ROTULOS_ETAPA;

const FASES = ['baixando', 'separando_voz', 'alinhando_letra', 'gerando_notas', 'publicando'] as const;
export type Fase = typeof FASES[number];
// Ponto de partida de 15 min até haver histórico real de cada etapa.
const DURACOES: Record<Fase, number> = { baixando: 120, separando_voz: 300, alinhando_letra: 240, gerando_notas: 180, publicando: 60 };
const MARCOS: Record<Fase, number> = { baixando: 5, separando_voz: 15, alinhando_letra: 45, gerando_notas: 70, publicando: 95 };

export interface LinhaProcessamento {
  id: number | string;
  slug: string;
  artista: string;
  faixa: string;
  status: StatusCatalogo;
  etapa: EtapaProcessamento;
  progresso: number;
  etapa_em: Date | string;
  created_at: Date | string;
  pedido_por: number | null;
}
export interface MusicaProcessamento {
  id: number;
  slug: string;
  artista: string;
  faixa: string;
  status: StatusCatalogo;
  etapa: EtapaProcessamento;
  progresso: number;
  etapa_em: string;
  posicao_fila: number | null;
  minutos_estimados: number | null;
  meu_pedido: boolean;
}

/** Único worker: o tempo dos pedidos à frente entra na previsão de quem espera. */
export function estimarProcessamento(linhas: LinhaProcessamento[], historico: Partial<Record<Fase, number>>, meuId: number, agora = Date.now()): MusicaProcessamento[] {
  const medias = { ...DURACOES };
  for (const fase of FASES) {
    const media = Number(historico[fase]);
    if (Number.isFinite(media) && media > 0) medias[fase] = media;
  }
  const total = FASES.reduce((s, fase) => s + medias[fase], 0);
  const ativos = linhas.filter((m) => m.status === 'baixando' || m.status === 'processando')
    .sort((a, b) => +new Date(a.etapa_em) - +new Date(b.etapa_em) || Number(a.id) - Number(b.id));
  const fila = linhas.filter((m) => m.status === 'na_fila')
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at) || Number(a.id) - Number(b.id));
  const previsoes = new Map<number, { segundos: number; posicao: number; progresso: number }>();
  const etapas = new Map<number, Fase>();
  let espera = 0;
  for (const m of ativos) {
    // Compatibilidade com registros anteriores ao primeiro reinício do worker.
    const indice = FASES.indexOf(m.etapa as Fase);
    const fase = m.status === 'baixando' ? 'baixando' : FASES[indice < 1 ? 1 : indice];
    etapas.set(Number(m.id), fase);
    const i = FASES.indexOf(fase);
    const decorrido = Math.max(0, (agora - +new Date(m.etapa_em)) / 1000);
    // Uma fase acima da média continua em execução: a previsão nunca vira zero.
    const restante = Math.max(30, medias[fase] - decorrido)
      + FASES.slice(i + 1).reduce((s, f) => s + medias[f], 0);
    espera += restante;
    const fim = i === FASES.length - 1 ? 100 : MARCOS[FASES[i + 1]];
    const progresso = Math.min(fim - 1, Math.floor(MARCOS[fase] + Math.min(1, decorrido / medias[fase]) * (fim - MARCOS[fase])));
    previsoes.set(Number(m.id), { segundos: espera, posicao: 0, progresso: Math.max(m.progresso, progresso) });
  }
  fila.forEach((m, i) => {
    espera += total;
    previsoes.set(Number(m.id), { segundos: espera, posicao: i + 1, progresso: 0 });
  });
  return linhas.map((m) => {
    const previsao = previsoes.get(Number(m.id));
    return {
      id: Number(m.id), slug: m.slug, artista: m.artista, faixa: m.faixa, status: m.status,
      etapa: m.status === 'pronta' || m.status === 'falhou' ? m.status : m.status === 'na_fila' ? 'na_fila' : etapas.get(Number(m.id)) ?? m.etapa,
      progresso: m.status === 'pronta' ? 100 : Math.max(0, Math.min(99, previsao?.progresso ?? m.progresso)),
      etapa_em: new Date(m.etapa_em).toISOString(), posicao_fila: previsao?.posicao ?? null,
      minutos_estimados: m.status === 'pronta' ? 0 : previsao ? Math.max(1, Math.ceil(previsao.segundos / 60)) : null,
      meu_pedido: m.pedido_por === meuId,
    };
  });
}
