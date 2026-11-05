import { cleanText, HttpError, isBlobUrl } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { edicaoAtual, hojeSP } from '@/app/lib/edicao';

export interface PessoaResumo { id: number; name: string }
export interface CapsulaMinha {
  id: number;
  para_user_id: number | null;
  para_nome: string;
  tem_foto: boolean;
  abre_em_texto: string;
  pode_editar: boolean;
}
export interface CapsulaAberta {
  id: number;
  user_id: number;
  author_name: string;
  avatar_url: string | null;
  para_nome: string;
  texto: string;
  image_url: string | null;
  pode_apagar: boolean;
}
export interface CapsulaDados {
  ano: number;
  eu: { id: number; admin: boolean };
  familia: PessoaResumo[];
  abertura_texto: string;
  frase: string;
  total_lacradas: number;
  minhas: CapsulaMinha[];
  aguardando: { total: number; abre_em_texto: string } | null;
  abertas: CapsulaAberta[];
}

const SEM_BLOQUEIO = `NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $1 AND b.blocked_id = c.user_id)`;

export function quando(value: string | Date): string {
  const data = value instanceof Date ? value : new Date(value);
  return data.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function anoEmSP(data: Date): number {
  return Number(data.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric' }));
}

/** Ceia da edição seguinte, no mesmo dia e hora do event_date, em America/Sao_Paulo. */
export function aberturaDaProximaEdicao(eventDate: string | null, ano: number): Date {
  const reserva = `${ano + 1}-12-24T20:00:00-03:00`;
  const bruto = eventDate && Number.isFinite(Date.parse(eventDate)) ? eventDate : reserva;
  const partes = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.exec(bruto);
  if (!partes) return new Date(reserva);
  const anoAbre = ano + 1;
  const mes = Number(partes[2]);
  const diaPedido = Number(partes[3]);
  const ultimo = new Date(Date.UTC(anoAbre, mes, 0)).getUTCDate();
  const dia = String(Math.min(diaPedido, ultimo)).padStart(2, '0');
  const fuso = partes[7] ?? '-03:00';
  const iso = `${anoAbre}-${partes[2]}-${dia}T${partes[4]}:${partes[5]}:${partes[6] ?? '00'}${fuso}`;
  const data = new Date(iso);
  return Number.isFinite(data.getTime()) ? data : new Date(reserva);
}

export async function proximaAbertura(ano: number): Promise<Date> {
  const { rows } = await query<{ value: string }>('SELECT value FROM app_settings WHERE key = $1', ['event_date']);
  return aberturaDaProximaEdicao(rows[0]?.value ?? null, ano);
}

/** Copia o texto lacrado para a coluna pública só depois de abre_em. Idempotente. */
export async function revelarAbertas(): Promise<number> {
  const result = await query(
    `UPDATE time_capsules SET texto = texto_lacrado
     WHERE abre_em <= NOW() AND texto IS DISTINCT FROM texto_lacrado`,
  );
  return result.rowCount ?? 0;
}

function frase(total: number, anoAbre: number): string {
  if (total === 0) return `Nenhuma mensagem guardada para ${anoAbre}.`;
  if (total === 1) return `A família guardou 1 mensagem para ${anoAbre}.`;
  return `A família guardou ${total} mensagens para ${anoAbre}.`;
}

export function fotoOpcional(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (!isBlobUrl(value)) throw new HttpError(400, 'A foto precisa ser enviada por aqui.');
  return value;
}

export async function exigirParente(id: number | null): Promise<void> {
  if (id == null) return;
  const { rows } = await query('SELECT id FROM family_users WHERE id = $1', [id]);
  if (!rows.length) throw new HttpError(400, 'Escolha alguém da família.');
}

export async function carregarCapsula(me: { id: number; is_admin: boolean }): Promise<CapsulaDados> {
  const ano = edicaoAtual();
  const hoje = hojeSP();
  await revelarAbertas();
  const abertura = await proximaAbertura(ano);
  const [familia, contagem, minhas, espera, abertas] = await Promise.all([
    query<PessoaResumo>('SELECT id, name FROM family_users ORDER BY name, id'),
    query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM time_capsules c
       WHERE c.ano = $2 AND c.abre_em > NOW() AND ${SEM_BLOQUEIO}`,
      [me.id, ano],
    ),
    query<{ id: number; para_user_id: number | null; para_nome: string; tem_foto: boolean; abre_em: string | Date; pode_editar: boolean }>(
      `SELECT c.id, c.para_user_id, COALESCE(p.name, 'a família toda') AS para_nome,
         (c.image_url IS NOT NULL) AS tem_foto, c.abre_em,
         (c.abre_em > NOW() AND $3::date <= make_date(c.ano, 12, 31)) AS pode_editar
       FROM time_capsules c
       LEFT JOIN family_users p ON p.id = c.para_user_id
       WHERE c.user_id = $1 AND c.abre_em > NOW() AND c.ano IN ($2, $2 - 1)
       ORDER BY c.abre_em, c.id`,
      [me.id, ano, hoje],
    ),
    query<{ total: number; abre_em: string | Date | null }>(
      `SELECT COUNT(*)::int AS total, MIN(c.abre_em) AS abre_em
       FROM time_capsules c
       WHERE c.ano = $2 - 1 AND c.abre_em > NOW() AND ${SEM_BLOQUEIO}`,
      [me.id, ano],
    ),
    query<{ id: number; user_id: number; author_name: string; avatar_url: string | null; para_nome: string; texto: string; image_url: string | null }>(
      `SELECT c.id, c.user_id, u.name AS author_name, u.avatar_url,
         COALESCE(p.name, 'a família toda') AS para_nome,
         CASE WHEN c.abre_em <= NOW() THEN c.texto_lacrado ELSE '' END AS texto,
         CASE WHEN c.abre_em <= NOW() THEN c.image_url ELSE NULL END AS image_url
       FROM time_capsules c
       JOIN family_users u ON u.id = c.user_id
       LEFT JOIN family_users p ON p.id = c.para_user_id
       WHERE c.ano = $2 - 1 AND c.abre_em <= NOW()
         AND (c.para_user_id IS NULL OR c.para_user_id = $1 OR c.user_id = $1)
         AND ${SEM_BLOQUEIO}
       ORDER BY c.created_at, c.id`,
      [me.id, ano],
    ),
  ]);
  const total = contagem.rows[0]?.total ?? 0;
  const esperaRow = espera.rows[0];
  return {
    ano,
    eu: { id: me.id, admin: me.is_admin },
    familia: familia.rows,
    abertura_texto: quando(abertura),
    frase: frase(total, anoEmSP(abertura)),
    total_lacradas: total,
    minhas: minhas.rows.map((row) => ({
      id: row.id,
      para_user_id: row.para_user_id,
      para_nome: row.para_nome,
      tem_foto: row.tem_foto,
      abre_em_texto: quando(row.abre_em),
      pode_editar: row.pode_editar,
    })),
    aguardando: esperaRow && esperaRow.total > 0 && esperaRow.abre_em
      ? { total: esperaRow.total, abre_em_texto: quando(esperaRow.abre_em) }
      : null,
    abertas: abertas.rows.map((row) => ({
      ...row,
      pode_apagar: me.is_admin,
    })),
  };
}

export function textoCapsula(value: unknown): string {
  return cleanText(value, 'a mensagem', 4000);
}
