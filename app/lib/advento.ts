import { cleanText, HttpError, isBlobUrl } from './api';
import { query, transaction } from './db';
import { edicaoAtual, hojeSP } from './edicao';

// Calendário do Advento. Componente cliente só pode usar `import type` daqui
// (este arquivo lê o banco).

export const TIPOS_ADVENTO = ['foto', 'receita', 'enquete', 'desafio', 'pergunta'] as const;
export type TipoAdvento = (typeof TIPOS_ADVENTO)[number];

export interface ConteudoJanela {
  dia: number;
  tipo: TipoAdvento;
  titulo: string;
  texto: string;
  image_url: string | null;
  opcoes: string[] | null;
  personalizada: boolean;
}

export interface JanelaGrade {
  dia: number;
  liberada: boolean;
  abriu: boolean;
  respondida: boolean;
  personalizada: boolean;
  tipo: TipoAdvento | null;
  titulo: string | null;
  texto: string | null;
  image_url: string | null;
  opcoes: string[] | null;
}

export interface CalendarioAdvento {
  ano: number;
  fase: 'antes' | 'aberto';
  dia_liberado: number;
  dia_de_hoje: number | null;
  abre_em: string;
  agora: string;
  organizador: boolean;
  janelas: JanelaGrade[];
}

export interface RespostaAdvento {
  id: number;
  user_id: number;
  user_name: string;
  avatar_url: string | null;
  texto: string;
  image_url: string | null;
  created_at: string;
  minha: boolean;
}

export interface DiaAdvento extends ConteudoJanela {
  ano: number;
  liberada: boolean;
  organizador: boolean;
  abriu: boolean;
  respondida: boolean;
  respostas: RespostaAdvento[];
  votos: { opcao: string; total: number }[];
  meu_voto: string | null;
  total_votos: number;
}

interface Pessoa {
  id: number;
  is_admin: boolean;
}

interface LinhaJanela {
  dia: number;
  tipo: string;
  titulo: string;
  texto: string | null;
  image_url: string | null;
  opcoes: unknown;
}

const PADRAO: readonly ConteudoJanela[] = [
  { dia: 1, tipo: 'foto', titulo: 'A foto mais antiga', texto: 'Poste a foto mais antiga do Natal que você tiver. Pode ser torta e pode ser antiga. A família quer ver.', image_url: null, opcoes: null, personalizada: false },
  { dia: 2, tipo: 'enquete', titulo: 'O prato da ceia', texto: 'Qual prato não pode faltar na ceia?', image_url: null, opcoes: ['Peru', 'Tender', 'Lasanha', 'Rabanada', 'Outro prato da casa'], personalizada: false },
  { dia: 3, tipo: 'pergunta', titulo: 'O presente engraçado', texto: 'Conte o presente mais engraçado que já ganhou.', image_url: null, opcoes: null, personalizada: false },
  { dia: 4, tipo: 'desafio', titulo: 'A casa enfeitada', texto: 'Desafio de hoje: uma foto da decoração de Natal da casa. Árvore, presépio ou a janela com pisca-pisca.', image_url: null, opcoes: null, personalizada: false },
  { dia: 5, tipo: 'receita', titulo: 'Receita que não se perde', texto: 'Escreva uma receita de família que não pode se perder. O modo de fazer, do jeito que a casa faz.', image_url: null, opcoes: null, personalizada: false },
  { dia: 6, tipo: 'foto', titulo: 'Natal de criança', texto: 'Uma foto sua de Natal quando era criança. Se não achar, vale a foto de um filho ou de um neto.', image_url: null, opcoes: null, personalizada: false },
  { dia: 7, tipo: 'enquete', titulo: 'Quem chora mais', texto: 'Quem chora mais no Natal?', image_url: null, opcoes: ['A vovó', 'O vovô', 'A titia', 'Eu mesmo', 'Ninguém chora'], personalizada: false },
  { dia: 8, tipo: 'pergunta', titulo: 'O presente que você deu', texto: 'Qual foi o melhor presente que você já deu para alguém da família?', image_url: null, opcoes: null, personalizada: false },
  { dia: 9, tipo: 'desafio', titulo: 'O look da noite', texto: 'Desafio de hoje: uma foto do seu look de Natal, ou do pijama da ceia.', image_url: null, opcoes: null, personalizada: false },
  { dia: 10, tipo: 'receita', titulo: 'O doce da casa', texto: 'Compartilhe o doce que só a nossa família faz do jeito certo. Pode ser rabanada, pudim ou o bolo da vovó.', image_url: null, opcoes: null, personalizada: false },
  { dia: 11, tipo: 'foto', titulo: 'Árvore, presépio ou mesa', texto: 'Foto da árvore, do presépio ou da mesa posta. O que estiver mais bonito aí na sua casa.', image_url: null, opcoes: null, personalizada: false },
  { dia: 12, tipo: 'enquete', titulo: 'Depois da ceia', texto: 'O que não pode faltar depois da ceia?', image_url: null, opcoes: ['Panetone', 'Rabanada', 'Frutas', 'Nozes', 'Cafezinho'], personalizada: false },
  { dia: 13, tipo: 'pergunta', titulo: 'Traquinagem de Natal', texto: 'Conte uma traquinagem de Natal da infância. A família aguenta ouvir de novo.', image_url: null, opcoes: null, personalizada: false },
  { dia: 14, tipo: 'desafio', titulo: 'Feito à mão', texto: 'Desafio de hoje: uma foto de um enfeite feito à mão. Se não tiver, vale um desenho de Natal.', image_url: null, opcoes: null, personalizada: false },
  { dia: 15, tipo: 'receita', titulo: 'O acompanhamento', texto: 'A salada, o arroz ou o acompanhamento que a família pede todo ano. Escreva como faz.', image_url: null, opcoes: null, personalizada: false },
  { dia: 16, tipo: 'foto', titulo: 'Selfie em família', texto: 'Uma selfie com alguém da família. Quanto mais gente couber no quadro, melhor.', image_url: null, opcoes: null, personalizada: false },
  { dia: 17, tipo: 'enquete', titulo: 'Que horas é a ceia', texto: 'Que horas a ceia deve começar?', image_url: null, opcoes: ['19h', '20h', '21h', 'Depois da missa', 'Quando o último chegar'], personalizada: false },
  { dia: 18, tipo: 'pergunta', titulo: 'Um desejo', texto: 'O que você deseja para a família no ano que vem? Uma frase já vale.', image_url: null, opcoes: null, personalizada: false },
  { dia: 19, tipo: 'desafio', titulo: 'Presente embrulhado', texto: 'Desafio de hoje: uma foto do presente embrulhado, sem mostrar o que tem dentro.', image_url: null, opcoes: null, personalizada: false },
  { dia: 20, tipo: 'receita', titulo: 'A bebida da ceia', texto: 'Suco, ponche ou o cafezinho. Escreva como você faz a bebida da ceia.', image_url: null, opcoes: null, personalizada: false },
  { dia: 21, tipo: 'foto', titulo: 'A mais engraçada', texto: 'A foto mais engraçada de um Natal antigo. A gargalhada também conta como presente.', image_url: null, opcoes: null, personalizada: false },
  { dia: 22, tipo: 'enquete', titulo: 'Surpresa ou lista', texto: 'Presente surpresa ou presente da lista?', image_url: null, opcoes: ['Surpresa', 'Lista de desejos', 'Os dois', 'Dinheiro no envelope'], personalizada: false },
  { dia: 23, tipo: 'pergunta', titulo: 'A música da casa', texto: 'Qual música de Natal a família canta junta? Se ninguém canta, vale a que toca na sala.', image_url: null, opcoes: null, personalizada: false },
  { dia: 24, tipo: 'desafio', titulo: 'Todo mundo junto', texto: 'Desafio de hoje: uma foto de todo mundo junto, do jeito que der. O importante é estar na mesma foto.', image_url: null, opcoes: null, personalizada: false },
];

function conferirPadrao(): void {
  if (PADRAO.length !== 24) throw new Error('Advento precisa de 24 dias.');
  for (let i = 0; i < PADRAO.length; i++) {
    const item = PADRAO[i];
    if (!item || item.dia !== i + 1) throw new Error('Dia do Advento fora de ordem.');
    if (i > 0 && item.tipo === PADRAO[i - 1]?.tipo) throw new Error('Tipo do Advento repetido em dias seguidos.');
    if (item.tipo === 'enquete' && (!item.opcoes || item.opcoes.length < 2)) throw new Error('Enquete do Advento sem opções.');
    if (item.tipo !== 'enquete' && item.opcoes) throw new Error('Opções só na enquete.');
  }
}
conferirPadrao();

export function situacaoAdvento(agora = new Date()): {
  ano: number;
  hoje: string;
  fase: 'antes' | 'aberto';
  diaLiberado: number;
  diaDeHoje: number | null;
  abreEm: string;
} {
  const ano = edicaoAtual(agora);
  const hoje = hojeSP(agora);
  const inicio = `${ano}-12-01`;
  const fim = `${ano}-12-24`;
  const abreEm = new Date(`${ano}-12-01T00:00:00-03:00`).toISOString();
  if (hoje < inicio) {
    return { ano, hoje, fase: 'antes', diaLiberado: 0, diaDeHoje: null, abreEm };
  }
  if (hoje > fim) {
    return { ano, hoje, fase: 'aberto', diaLiberado: 24, diaDeHoje: null, abreEm };
  }
  const dia = Number(hoje.slice(8, 10));
  return { ano, hoje, fase: 'aberto', diaLiberado: dia, diaDeHoje: dia, abreEm };
}

export function padraoDoDia(dia: number): ConteudoJanela {
  const item = PADRAO[dia - 1];
  if (!item) throw new HttpError(400, 'O calendário vai do dia 1 ao dia 24.');
  return { ...item, opcoes: item.opcoes ? [...item.opcoes] : null };
}

export function diaParam(value: string): number {
  const dia = Number(value);
  if (!Number.isInteger(dia) || dia < 1 || dia > 24) throw new HttpError(400, 'O calendário vai do dia 1 ao dia 24.');
  return dia;
}

function ehTipo(value: string): value is TipoAdvento {
  return (TIPOS_ADVENTO as readonly string[]).includes(value);
}

export function tipoAdvento(value: unknown): TipoAdvento {
  if (typeof value === 'string' && ehTipo(value)) return value;
  throw new HttpError(400, 'Escolha foto, receita, enquete, desafio ou pergunta.');
}

function lerOpcoes(value: unknown): string[] | null {
  let bruto = value;
  if (typeof bruto === 'string') {
    try { bruto = JSON.parse(bruto) as unknown; } catch { return null; }
  }
  if (!Array.isArray(bruto)) return null;
  const lista = bruto
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
  return lista.length ? lista : null;
}

export function opcoesDaEnquete(value: unknown): string[] {
  const brutas = Array.isArray(value) ? value : typeof value === 'string' ? value.split('\n') : null;
  if (!brutas) throw new HttpError(400, 'Informe as opções da enquete, uma por linha.');
  const opcoes = brutas.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
  if (opcoes.length < 2 || opcoes.length > 6) throw new HttpError(400, 'A enquete precisa de 2 a 6 opções.');
  if (opcoes.some((item) => item.length > 80)) throw new HttpError(400, 'Cada opção pode ter até 80 caracteres.');
  if (new Set(opcoes).size !== opcoes.length) throw new HttpError(400, 'As opções não podem se repetir.');
  return opcoes;
}

function imagemOpcional(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (!isBlobUrl(value)) throw new HttpError(400, 'A foto precisa ser enviada por aqui.');
  return value;
}

function efetivo(dia: number, row: LinhaJanela | undefined): ConteudoJanela {
  const base = padraoDoDia(dia);
  if (!row) return base;
  const tipo = ehTipo(row.tipo) ? row.tipo : base.tipo;
  const opcoes = tipo === 'enquete' ? lerOpcoes(row.opcoes) ?? base.opcoes : null;
  return {
    dia,
    tipo,
    titulo: row.titulo.trim() || base.titulo,
    texto: row.texto == null ? base.texto : row.texto.trim(),
    image_url: row.image_url || null,
    opcoes,
    personalizada: true,
  };
}

function paraGrade(conteudo: ConteudoJanela, liberada: boolean, visivel: boolean, abriu: boolean, respondida: boolean): JanelaGrade {
  if (!visivel) {
    return {
      dia: conteudo.dia,
      liberada,
      abriu,
      respondida,
      personalizada: false,
      tipo: null,
      titulo: null,
      texto: null,
      image_url: null,
      opcoes: null,
    };
  }
  return { ...conteudo, liberada, abriu, respondida };
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const texto = String(value ?? '');
  const data = new Date(texto);
  return Number.isNaN(data.getTime()) ? texto : data.toISOString();
}

async function linhasDoAno(ano: number, q: typeof query = query): Promise<Map<number, LinhaJanela>> {
  const { rows } = await q<LinhaJanela>(
    `SELECT dia, tipo, titulo, texto, image_url, opcoes
       FROM advent_windows WHERE ano = $1`,
    [ano],
  );
  const mapa = new Map<number, LinhaJanela>();
  for (const row of rows) mapa.set(Number(row.dia), row);
  return mapa;
}

async function marcas(ano: number, userId: number, q: typeof query = query): Promise<Map<number, { abriu: boolean; respondida: boolean }>> {
  const { rows } = await q<{ dia: number; abriu: boolean; respondeu: boolean; votou: boolean }>(
    `SELECT d.dia::int AS dia,
            EXISTS (SELECT 1 FROM advent_opens o WHERE o.ano = $1 AND o.dia = d.dia AND o.user_id = $2) AS abriu,
            EXISTS (SELECT 1 FROM advent_responses r WHERE r.ano = $1 AND r.dia = d.dia AND r.user_id = $2) AS respondeu,
            EXISTS (SELECT 1 FROM advent_votes v WHERE v.ano = $1 AND v.dia = d.dia AND v.user_id = $2) AS votou
       FROM generate_series(1, 24) AS d(dia)`,
    [ano, userId],
  );
  const mapa = new Map<number, { abriu: boolean; respondida: boolean }>();
  for (const row of rows) {
    const respondida = Boolean(row.respondeu) || Boolean(row.votou);
    mapa.set(Number(row.dia), { abriu: Boolean(row.abriu) || respondida, respondida });
  }
  return mapa;
}

export async function carregarCalendario(me: Pessoa, agora = new Date()): Promise<CalendarioAdvento> {
  const s = situacaoAdvento(agora);
  const [salvas, feitas] = await Promise.all([linhasDoAno(s.ano), marcas(s.ano, me.id)]);
  const janelas: JanelaGrade[] = [];
  for (let dia = 1; dia <= 24; dia++) {
    const conteudo = efetivo(dia, salvas.get(dia));
    const marca = feitas.get(dia) ?? { abriu: false, respondida: false };
    const liberada = dia <= s.diaLiberado;
    const visivel = liberada || me.is_admin;
    janelas.push(paraGrade(conteudo, liberada, visivel, marca.abriu, marca.respondida));
  }
  return {
    ano: s.ano,
    fase: s.fase,
    dia_liberado: s.diaLiberado,
    dia_de_hoje: s.diaDeHoje,
    abre_em: s.abreEm,
    agora: agora.toISOString(),
    organizador: me.is_admin,
    janelas,
  };
}

export async function carregarDia(me: Pessoa, dia: number): Promise<DiaAdvento> {
  const s = situacaoAdvento();
  const liberada = dia <= s.diaLiberado;
  if (!liberada && !me.is_admin) throw new HttpError(403, 'Essa janela ainda não abriu.');

  const salvas = await linhasDoAno(s.ano);
  const conteudo = efetivo(dia, salvas.get(dia));
  const [respostasRes, votosRes, meuRes, abriuRes] = await Promise.all([
    query<{ id: number; user_id: number; user_name: string; avatar_url: string | null; texto: string; image_url: string | null; created_at: Date | string }>(
      `SELECT r.id, r.user_id, u.name AS user_name, u.avatar_url, r.texto, r.image_url, r.created_at
         FROM advent_responses r
         JOIN family_users u ON u.id = r.user_id
        WHERE r.ano = $1 AND r.dia = $2
          AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $3 AND b.blocked_id = r.user_id)
        ORDER BY r.created_at ASC, r.id ASC`,
      [s.ano, dia, me.id],
    ),
    query<{ opcao: string; total: number }>(
      `SELECT opcao, COUNT(*)::int AS total FROM advent_votes WHERE ano = $1 AND dia = $2 GROUP BY opcao`,
      [s.ano, dia],
    ),
    query<{ opcao: string }>(
      `SELECT opcao FROM advent_votes WHERE ano = $1 AND dia = $2 AND user_id = $3`,
      [s.ano, dia, me.id],
    ),
    query<{ ok: number }>(
      `SELECT 1 AS ok FROM advent_opens WHERE ano = $1 AND dia = $2 AND user_id = $3`,
      [s.ano, dia, me.id],
    ),
  ]);

  const respostas: RespostaAdvento[] = respostasRes.rows.map((row) => ({
    id: Number(row.id),
    user_id: Number(row.user_id),
    user_name: row.user_name,
    avatar_url: row.avatar_url,
    texto: row.texto,
    image_url: row.image_url,
    created_at: iso(row.created_at),
    minha: Number(row.user_id) === me.id,
  }));
  const votoBruto = meuRes.rows[0]?.opcao ?? null;
  const meuVoto = votoBruto && (conteudo.opcoes ?? []).includes(votoBruto) ? votoBruto : null;
  const totais = new Map(votosRes.rows.map((row) => [row.opcao, Number(row.total)]));
  const opcoes = conteudo.opcoes ?? [];
  const votos = opcoes.map((opcao) => ({ opcao, total: totais.get(opcao) ?? 0 }));
  const respondida = respostas.some((item) => item.minha) || (conteudo.tipo === 'enquete' && meuVoto != null);
  return {
    ...conteudo,
    ano: s.ano,
    liberada,
    organizador: me.is_admin,
    abriu: abriuRes.rows.length > 0 || respondida,
    respondida,
    respostas,
    votos,
    meu_voto: conteudo.tipo === 'enquete' ? meuVoto : null,
    total_votos: votos.reduce((soma, item) => soma + item.total, 0),
  };
}

async function registrarAbertura(ano: number, dia: number, userId: number, q: typeof query = query): Promise<void> {
  await q(
    `INSERT INTO advent_opens (ano, dia, user_id) VALUES ($1, $2, $3)
     ON CONFLICT (ano, dia, user_id) DO NOTHING`,
    [ano, dia, userId],
  );
}

export async function marcarAberta(me: Pessoa, dia: number): Promise<{ dia: number; abriu: true }> {
  const s = situacaoAdvento();
  if (dia > s.diaLiberado && !me.is_admin) throw new HttpError(403, 'Essa janela ainda não abriu.');
  await registrarAbertura(s.ano, dia, me.id);
  return { dia, abriu: true };
}

export async function salvarResposta(me: Pessoa, dia: number, body: { texto?: unknown; image_url?: unknown }): Promise<DiaAdvento> {
  const s = situacaoAdvento();
  if (dia > s.diaLiberado) throw new HttpError(403, 'Essa janela ainda não abriu.');
  const salvas = await linhasDoAno(s.ano);
  const conteudo = efetivo(dia, salvas.get(dia));
  if (conteudo.tipo === 'enquete') throw new HttpError(400, 'Nesta janela a família escolhe uma opção.');
  const texto = cleanText(body.texto, 'a sua resposta', 2000);
  const image = imagemOpcional(body.image_url);
  if ((conteudo.tipo === 'foto' || conteudo.tipo === 'desafio') && !image) {
    throw new HttpError(400, 'Esta janela pede uma foto.');
  }
  await transaction(async (q) => {
    const inserida = await q(
      `INSERT INTO advent_responses (ano, dia, user_id, texto, image_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (ano, dia, user_id) DO NOTHING
       RETURNING id`,
      [s.ano, dia, me.id, texto, image],
    );
    if (!inserida.rows[0]) throw new HttpError(400, 'Você já respondeu esta janela. Apague a sua resposta se quiser mandar outra.');
    await registrarAbertura(s.ano, dia, me.id, q);
  });
  return carregarDia(me, dia);
}

export async function votar(me: Pessoa, dia: number, opcaoBruta: unknown): Promise<DiaAdvento> {
  const s = situacaoAdvento();
  if (dia > s.diaLiberado) throw new HttpError(403, 'Essa janela ainda não abriu.');
  const salvas = await linhasDoAno(s.ano);
  const conteudo = efetivo(dia, salvas.get(dia));
  if (conteudo.tipo !== 'enquete' || !conteudo.opcoes) throw new HttpError(400, 'Esta janela não é uma enquete.');
  const opcao = typeof opcaoBruta === 'string' ? opcaoBruta.trim() : '';
  if (!conteudo.opcoes.includes(opcao)) throw new HttpError(400, 'Escolha uma das opções da enquete.');
  await transaction(async (q) => {
    await q(
      `INSERT INTO advent_votes (ano, dia, user_id, opcao) VALUES ($1, $2, $3, $4)
       ON CONFLICT (ano, dia, user_id) DO UPDATE SET opcao = EXCLUDED.opcao`,
      [s.ano, dia, me.id, opcao],
    );
    await registrarAbertura(s.ano, dia, me.id, q);
  });
  return carregarDia(me, dia);
}

export async function apagarResposta(me: Pessoa, id: number): Promise<DiaAdvento> {
  const s = situacaoAdvento();
  const achada = await query<{ id: number; user_id: number; dia: number }>(
    `SELECT id, user_id, dia FROM advent_responses WHERE id = $1 AND ano = $2`,
    [id, s.ano],
  );
  const atual = achada.rows[0];
  if (!atual) throw new HttpError(404, 'Resposta não encontrada.');
  if (Number(atual.user_id) !== me.id && !me.is_admin) throw new HttpError(403, 'Só quem escreveu, ou quem organiza, pode apagar.');
  await query(`DELETE FROM advent_responses WHERE id = $1 AND ano = $2`, [id, s.ano]);
  return carregarDia(me, Number(atual.dia));
}

async function tiposEfetivos(ano: number, q: typeof query = query): Promise<Map<number, TipoAdvento>> {
  const salvas = await linhasDoAno(ano, q);
  const mapa = new Map<number, TipoAdvento>();
  for (let dia = 1; dia <= 24; dia++) mapa.set(dia, efetivo(dia, salvas.get(dia)).tipo);
  return mapa;
}

export async function salvarJanela(me: Pessoa, dia: number, body: Record<string, unknown>): Promise<DiaAdvento> {
  if (!me.is_admin) throw new HttpError(403, 'Só quem organiza pode preparar as janelas.');
  const s = situacaoAdvento();
  const tipo = tipoAdvento(body.tipo);
  const titulo = cleanText(body.titulo, 'o título', 120);
  const texto = cleanText(body.texto, 'o texto', 2000, false);
  const image = imagemOpcional(body.image_url);
  const opcoes = tipo === 'enquete' ? opcoesDaEnquete(body.opcoes) : null;
  await transaction(async (q) => {
    const mapa = await tiposEfetivos(s.ano, q);
    mapa.set(dia, tipo);
    if (mapa.get(dia - 1) === tipo || mapa.get(dia + 1) === tipo) {
      throw new HttpError(400, 'Escolha outro tipo: ele não pode repetir no dia ao lado.');
    }
    await q(
      `INSERT INTO advent_windows (ano, dia, tipo, titulo, texto, image_url, opcoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (ano, dia) DO UPDATE SET
         tipo = EXCLUDED.tipo,
         titulo = EXCLUDED.titulo,
         texto = EXCLUDED.texto,
         image_url = EXCLUDED.image_url,
         opcoes = EXCLUDED.opcoes`,
      [s.ano, dia, tipo, titulo, texto, image, opcoes ? JSON.stringify(opcoes) : null],
    );
  });
  return carregarDia(me, dia);
}

export async function restaurarJanela(me: Pessoa, dia: number): Promise<DiaAdvento> {
  if (!me.is_admin) throw new HttpError(403, 'Só quem organiza pode preparar as janelas.');
  const s = situacaoAdvento();
  const mapa = await tiposEfetivos(s.ano);
  const tipo = padraoDoDia(dia).tipo;
  mapa.set(dia, tipo);
  if (mapa.get(dia - 1) === tipo || mapa.get(dia + 1) === tipo) {
    throw new HttpError(400, 'O texto padrão repetiria o tipo do dia ao lado. Escolha um tipo diferente e salve.');
  }
  await query(`DELETE FROM advent_windows WHERE ano = $1 AND dia = $2`, [s.ano, dia]);
  return carregarDia(me, dia);
}
