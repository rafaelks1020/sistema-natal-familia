// Roteiro da noite no telão: tipos, rótulos e cálculo do item ativo/próximo virando a meia-noite.
// Puro, sem React e sem banco, usável no servidor e no navegador.

export type ItemRoteiro = {
  id: number;
  hora: string;
  acao: string;
  texto: string | null;
};

export const ACOES_ROTEIRO = [
  'cena:fotos',
  'cena:tocando',
  'cena:contagem',
  'cena:recados',
  'cena:advento',
  'cena:virada',
  'cena:ceia',
  'cena:linha',
  'cena:lareira',
  'cena:papainoel',
  'cena:brinde',
  'cena:karaoke',
  'ciclo',
  'aviso',
] as const;

export const NOMES_ACAO_ROTEIRO: Record<string, string> = {
  'cena:fotos': 'Cena: Fotos ao vivo',
  'cena:tocando': 'Cena: Tocando agora',
  'cena:contagem': 'Cena: Contagem regressiva',
  'cena:recados': 'Cena: Recados do mural',
  'cena:advento': 'Cena: Advento do dia',
  'cena:virada': 'Cena: Virada de Natal',
  'cena:ceia': 'Cena: Cardápio da ceia',
  'cena:linha': 'Cena: Linha do tempo',
  'cena:lareira': 'Cena: Lareira de Natal',
  'cena:papainoel': 'Cena: Radar do Papai Noel',
  'cena:brinde': 'Cena: Hora do brinde',
  'cena:karaoke': 'Cena: Karaokê',
  ciclo: 'Voltar ao ciclo automático',
  aviso: 'Aviso na tela',
  'musica:recepcao': 'Música: Recepção',
  'musica:ceia': 'Música: Hora da ceia',
  'musica:meia-noite': 'Música: Meia-noite',
  'musica:festa': 'Música: Festa animada',
};

export const OPCOES_ACAO_ROTEIRO: ReadonlyArray<{ valor: string; rotulo: string }> = [
  { valor: 'cena:fotos', rotulo: NOMES_ACAO_ROTEIRO['cena:fotos'] },
  { valor: 'cena:tocando', rotulo: NOMES_ACAO_ROTEIRO['cena:tocando'] },
  { valor: 'cena:contagem', rotulo: NOMES_ACAO_ROTEIRO['cena:contagem'] },
  { valor: 'cena:recados', rotulo: NOMES_ACAO_ROTEIRO['cena:recados'] },
  { valor: 'cena:advento', rotulo: NOMES_ACAO_ROTEIRO['cena:advento'] },
  { valor: 'cena:virada', rotulo: NOMES_ACAO_ROTEIRO['cena:virada'] },
  { valor: 'cena:ceia', rotulo: NOMES_ACAO_ROTEIRO['cena:ceia'] },
  { valor: 'cena:linha', rotulo: NOMES_ACAO_ROTEIRO['cena:linha'] },
  { valor: 'cena:lareira', rotulo: NOMES_ACAO_ROTEIRO['cena:lareira'] },
  { valor: 'cena:papainoel', rotulo: NOMES_ACAO_ROTEIRO['cena:papainoel'] },
  { valor: 'cena:brinde', rotulo: NOMES_ACAO_ROTEIRO['cena:brinde'] },
  { valor: 'cena:karaoke', rotulo: NOMES_ACAO_ROTEIRO['cena:karaoke'] },
  { valor: 'ciclo', rotulo: NOMES_ACAO_ROTEIRO.ciclo },
  { valor: 'aviso', rotulo: NOMES_ACAO_ROTEIRO.aviso },
  { valor: 'musica:recepcao', rotulo: NOMES_ACAO_ROTEIRO['musica:recepcao'] },
  { valor: 'musica:ceia', rotulo: NOMES_ACAO_ROTEIRO['musica:ceia'] },
  { valor: 'musica:meia-noite', rotulo: NOMES_ACAO_ROTEIRO['musica:meia-noite'] },
  { valor: 'musica:festa', rotulo: NOMES_ACAO_ROTEIRO['musica:festa'] },
];

export const ROTEIRO_PADRAO_NATAL: ReadonlyArray<{ hora: string; acao: string; texto: string | null }> = [
  { hora: '19:00', acao: 'cena:fotos', texto: null },
  { hora: '20:00', acao: 'aviso', texto: 'Bem-vindos!' },
  { hora: '20:30', acao: 'cena:linha', texto: null },
  { hora: '21:00', acao: 'cena:ceia', texto: null },
  { hora: '22:30', acao: 'ciclo', texto: null },
  { hora: '23:00', acao: 'cena:papainoel', texto: null },
  { hora: '23:59', acao: 'cena:virada', texto: null },
  { hora: '00:05', acao: 'cena:brinde', texto: null },
  { hora: '00:15', acao: 'ciclo', texto: null },
];

export function acaoRoteiroValida(acao: unknown): acao is string {
  if (typeof acao !== 'string') return false;
  if ((ACOES_ROTEIRO as readonly string[]).includes(acao)) return true;
  if (acao.startsWith('musica:')) {
    const momento = acao.slice('musica:'.length).trim();
    return momento.length > 0 && momento.length <= 40 && /^[a-z0-9_-]+$/i.test(momento);
  }
  return false;
}

export function rotuloAcaoRoteiro(acao: string, texto?: string | null): string {
  if (acao === 'aviso') {
    return texto ? `Aviso: "${texto}"` : NOMES_ACAO_ROTEIRO.aviso;
  }
  if (NOMES_ACAO_ROTEIRO[acao]) return NOMES_ACAO_ROTEIRO[acao];
  if (acao.startsWith('musica:')) {
    const momento = acao.slice('musica:'.length);
    return `Música: ${momento}`;
  }
  return acao;
}

/**
 * Converte 'HH:MM' (ou 'HH:MM:SS') em minutos no eixo da noite:
 * horas entre 00:00 e 05:59 contam como continuação da noite iniciada no dia anterior (+24h).
 */
export function minutosDaNoite(hora: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(hora.trim());
  if (!m) return -1;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return -1;
  return (hh < 6 ? hh + 24 : hh) * 60 + mm;
}

function minutosAgora(agoraMs: number, fusoSP: boolean): number {
  const d = new Date(agoraMs);
  if (!fusoSP) {
    const hh = d.getUTCHours();
    const mm = d.getUTCMinutes();
    return (hh < 6 ? hh + 24 : hh) * 60 + mm;
  }
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(d);
  const hh = Number(partes.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const mm = Number(partes.find((p) => p.type === 'minute')?.value ?? 0);
  return (hh < 6 ? hh + 24 : hh) * 60 + mm;
}

function diaSP(ms: number): string {
  return new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/**
 * O roteiro só vale na noite do evento: o dia da ceia em São Paulo, ou a madrugada seguinte até 05:59.
 * Fora disso o telão ignora o roteiro (ensaios e outros dias seguem no ciclo automático).
 */
export function noiteDoEvento(ceiaIso: string, agoraMs: number): boolean {
  const ceia = Date.parse(ceiaIso);
  if (Number.isNaN(ceia)) return false;
  const dia = diaSP(ceia);
  const hoje = diaSP(agoraMs);
  if (hoje === dia) return true;
  const minutos = minutosAgora(agoraMs, true);
  return minutos >= 24 * 60 && minutos < 30 * 60 && hoje === diaSP(Date.parse(`${dia}T12:00:00-03:00`) + 86_400_000);
}

export function ordenarRoteiro(itens: readonly ItemRoteiro[]): ItemRoteiro[] {
  return [...itens]
    .filter((item) => minutosDaNoite(item.hora) >= 0)
    .sort((a, b) => minutosDaNoite(a.hora) - minutosDaNoite(b.hora) || a.id - b.id);
}

/**
 * Último item cuja hora em São Paulo já passou na noite atual
 * (considerando 00:00 a 05:59 como parte da mesma noite que começou no dia anterior).
 */
export function itemAtivo(itens: readonly ItemRoteiro[], agoraMs: number, fusoSP = true): ItemRoteiro | null {
  if (!itens.length) return null;
  const agoraMin = minutosAgora(agoraMs, fusoSP);
  const ordenados = ordenarRoteiro(itens);
  let ativo: ItemRoteiro | null = null;
  for (const item of ordenados) {
    if (minutosDaNoite(item.hora) <= agoraMin) ativo = item;
  }
  return ativo;
}

/** Próximo item a acontecer na noite atual (ou null quando todos já passaram). */
export function proximoItem(itens: readonly ItemRoteiro[], agoraMs: number, fusoSP = true): ItemRoteiro | null {
  if (!itens.length) return null;
  const agoraMin = minutosAgora(agoraMs, fusoSP);
  const ordenados = ordenarRoteiro(itens);
  for (const item of ordenados) {
    if (minutosDaNoite(item.hora) > agoraMin) return item;
  }
  return null;
}
