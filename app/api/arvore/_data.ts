import { cleanText, HttpError, isBlobUrl } from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';

export type TipoVinculo = 'pai_mae' | 'conjuge';
export interface PessoaArvore {
  id: number;
  nome: string;
  apelido: string | null;
  foto_url: string | null;
  nascimento_ano: number | null;
  falecimento_ano: number | null;
  user_id: number | null;
  pode_editar: boolean;
}
export interface VinculoArvore {
  pessoa_id: number;
  parente_id: number;
  tipo: TipoVinculo;
  pode_apagar: boolean;
}
export interface ArvoreDados {
  ano: number;
  eu: { id: number; admin: boolean };
  familia: { id: number; name: string }[];
  pessoas: PessoaArvore[];
  vinculos: VinculoArvore[];
}

export function tipoVinculo(value: unknown): TipoVinculo {
  if (value === 'pai_mae' || value === 'conjuge') return value;
  throw new HttpError(400, 'Escolha se é pai, mãe ou casal.');
}

export function fotoOpcional(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (!isBlobUrl(value)) throw new HttpError(400, 'A foto precisa ser enviada por aqui.');
  return value;
}

export function anoOpcional(value: unknown, campo: string): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1800 || n > 2100) throw new HttpError(400, `${campo} inválido.`);
  return n;
}

function unico(erro: unknown): boolean {
  return typeof erro === 'object' && erro !== null && 'code' in erro && (erro as { code?: string }).code === '23505';
}

export async function carregarArvore(me: { id: number; is_admin: boolean }): Promise<ArvoreDados> {
  const ano = edicaoAtual();
  const [familia, pessoas, vinculos] = await Promise.all([
    query<{ id: number; name: string }>('SELECT id, name FROM family_users ORDER BY name, id'),
    query<Omit<PessoaArvore, 'pode_editar'> & { criado_por: number | null }>(
      `SELECT id, nome, apelido, foto_url, nascimento_ano, falecimento_ano, user_id, criado_por
       FROM family_tree_people ORDER BY nome, id`,
    ),
    query<Omit<VinculoArvore, 'pode_apagar'> & { criado_por: number | null }>(
      `SELECT pessoa_id, parente_id, tipo, criado_por
       FROM family_tree_links ORDER BY id`,
    ),
  ]);
  const pode = (criadoPor: number | null) => me.is_admin || criadoPor === me.id;
  return {
    ano,
    eu: { id: me.id, admin: me.is_admin },
    familia: familia.rows,
    pessoas: pessoas.rows.map(({ criado_por, ...pessoa }) => ({ ...pessoa, pode_editar: pode(criado_por) })),
    vinculos: vinculos.rows.map(({ criado_por, ...vinculo }) => ({ ...vinculo, pode_apagar: pode(criado_por) })),
  };
}

export interface PessoaInput {
  nome: string;
  apelido: string | null;
  foto_url: string | null;
  nascimento_ano: number | null;
  falecimento_ano: number | null;
  user_id: number | null;
}

export function lerPessoa(body: Record<string, unknown>, foto: string | null): PessoaInput {
  const nome = cleanText(body.nome, 'o nome', 120);
  const apelido = cleanText(body.apelido, 'o apelido', 60, false) || null;
  const nascimento_ano = anoOpcional(body.nascimento_ano, 'O ano de nascimento');
  const falecimento_ano = anoOpcional(body.falecimento_ano, 'O ano de falecimento');
  if (nascimento_ano != null && falecimento_ano != null && falecimento_ano < nascimento_ano) {
    throw new HttpError(400, 'O ano de falecimento fica depois do nascimento.');
  }
  let user_id: number | null = null;
  if (body.user_id != null && body.user_id !== '' && body.user_id !== 0) {
    const n = Number(body.user_id);
    if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Escolha uma conta da família.');
    user_id = n;
  }
  return { nome, apelido, foto_url: foto, nascimento_ano, falecimento_ano, user_id };
}

async function exigirConta(userId: number | null): Promise<void> {
  if (userId == null) return;
  const { rows } = await query('SELECT id FROM family_users WHERE id = $1', [userId]);
  if (!rows.length) throw new HttpError(400, 'Escolha uma conta da família.');
}

export async function criarPessoa(meId: number, input: PessoaInput): Promise<number> {
  await exigirConta(input.user_id);
  try {
    const { rows } = await query<{ id: number }>(
      `INSERT INTO family_tree_people
        (ano, nome, apelido, foto_url, nascimento_ano, falecimento_ano, user_id, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [edicaoAtual(), input.nome, input.apelido, input.foto_url, input.nascimento_ano, input.falecimento_ano, input.user_id, meId],
    );
    const id = rows[0]?.id;
    if (!id) throw new HttpError(500, 'Não deu para guardar a pessoa.');
    return id;
  } catch (erro) {
    if (unico(erro)) throw new HttpError(400, 'Essa conta já está ligada a alguém na árvore.');
    throw erro;
  }
}

export async function editarPessoa(me: { id: number; is_admin: boolean }, id: number, input: PessoaInput): Promise<void> {
  await exigirConta(input.user_id);
  try {
    const result = await query(
      `UPDATE family_tree_people
       SET nome = $2, apelido = $3, foto_url = $4, nascimento_ano = $5, falecimento_ano = $6, user_id = $7
       WHERE id = $1 AND ($8::boolean OR criado_por = $9)
       RETURNING id`,
      [id, input.nome, input.apelido, input.foto_url, input.nascimento_ano, input.falecimento_ano, input.user_id, me.is_admin, me.id],
    );
    if (!result.rowCount) throw new HttpError(404, 'Pessoa não encontrada ou sem permissão para editar.');
  } catch (erro) {
    if (unico(erro)) throw new HttpError(400, 'Essa conta já está ligada a alguém na árvore.');
    throw erro;
  }
}

export async function apagarPessoa(me: { id: number; is_admin: boolean }, id: number): Promise<void> {
  const result = await query(
    `DELETE FROM family_tree_people
     WHERE id = $1 AND ($2::boolean OR criado_por = $3) RETURNING id`,
    [id, me.is_admin, me.id],
  );
  if (!result.rowCount) throw new HttpError(404, 'Pessoa não encontrada ou sem permissão para apagar.');
}

export async function ligar(meId: number, pessoaId: number, parenteId: number, tipo: TipoVinculo): Promise<void> {
  if (pessoaId === parenteId) throw new HttpError(400, 'Escolha duas pessoas diferentes.');
  const ano = edicaoAtual();
  const filho = pessoaId;
  const pai = parenteId;
  const [menor, maior] = pessoaId < parenteId ? [pessoaId, parenteId] : [parenteId, pessoaId];
  const a = tipo === 'conjuge' ? menor : filho;
  const b = tipo === 'conjuge' ? maior : pai;
  try {
    await transaction(async (q) => {
      const pessoas = await q(
        `SELECT id FROM family_tree_people WHERE id IN ($1, $2) ORDER BY id FOR UPDATE`,
        [a, b],
      );
      if (pessoas.rows.length !== 2) throw new HttpError(400, 'Escolha duas pessoas da árvore.');
      const cruzado = await q(
        `SELECT 1 FROM family_tree_links
         WHERE tipo <> $3
           AND ((pessoa_id = $1 AND parente_id = $2) OR (pessoa_id = $2 AND parente_id = $1))
         LIMIT 1`,
        [a, b, tipo],
      );
      if (cruzado.rows.length) throw new HttpError(400, 'Essas duas pessoas já têm outro tipo de ligação.');
      if (tipo === 'pai_mae') {
        const pais = await q<{ n: number }>(
          `SELECT COUNT(*)::int AS n FROM family_tree_links
           WHERE pessoa_id = $1 AND tipo = 'pai_mae'`,
          [a],
        );
        if ((pais.rows[0]?.n ?? 0) >= 2) throw new HttpError(400, 'Cada pessoa pode ter até dois pais ou mães.');
        const ciclo = await q(
          `WITH RECURSIVE antepassados AS (
             SELECT parente_id AS id, ARRAY[pessoa_id, parente_id] AS caminho
             FROM family_tree_links
             WHERE tipo = 'pai_mae' AND pessoa_id = $1
             UNION ALL
             SELECT l.parente_id, antepassados.caminho || l.parente_id
             FROM family_tree_links l
             JOIN antepassados ON l.pessoa_id = antepassados.id
             WHERE l.tipo = 'pai_mae' AND NOT l.parente_id = ANY(antepassados.caminho)
           )
           SELECT 1 FROM antepassados WHERE id = $2 LIMIT 1`,
          [b, a],
        );
        if (ciclo.rows.length) throw new HttpError(400, 'Essa ligação fecharia um ciclo na árvore.');
      }
      await q(
        `INSERT INTO family_tree_links (ano, pessoa_id, parente_id, tipo, criado_por)
         VALUES ($1, $2, $3, $4, $5)`,
        [ano, a, b, tipo, meId],
      );
    });
  } catch (erro) {
    if (erro instanceof HttpError) throw erro;
    if (unico(erro)) throw new HttpError(400, 'Essa ligação já existe.');
    throw erro;
  }
}

export async function desligar(me: { id: number; is_admin: boolean }, pessoaId: number, parenteId: number, tipo: TipoVinculo): Promise<void> {
  const [menor, maior] = pessoaId < parenteId ? [pessoaId, parenteId] : [parenteId, pessoaId];
  const a = tipo === 'conjuge' ? menor : pessoaId;
  const b = tipo === 'conjuge' ? maior : parenteId;
  const result = await query(
    `DELETE FROM family_tree_links
     WHERE pessoa_id = $1 AND parente_id = $2 AND tipo = $3
       AND ($4::boolean OR criado_por = $5)
     RETURNING id`,
    [a, b, tipo, me.is_admin, me.id],
  );
  if (!result.rowCount) throw new HttpError(404, 'Ligação não encontrada ou sem permissão para desfazer.');
}
