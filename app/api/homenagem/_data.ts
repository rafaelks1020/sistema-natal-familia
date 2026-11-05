import { cleanText, HttpError, isBlobUrl, toInt } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';

export interface Lembranca {
  id: number;
  user_id: number;
  name: string;
  avatar_url: string | null;
  texto: string;
  image_url: string | null;
  pode_apagar: boolean;
}
export interface Memorial {
  id: number;
  nome: string;
  foto_url: string | null;
  anos: string;
  texto: string;
  pessoa_arvore_id: number | null;
  autor_nome: string;
  velas: number;
  acendi: boolean;
  pode_editar: boolean;
  lembrancas: Lembranca[];
}
export interface HomenagemDados {
  ano: number;
  eu: { id: number; admin: boolean };
  pessoas: { id: number; nome: string }[];
  memoriais: Memorial[];
}

export function fotoOpcional(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (!isBlobUrl(value)) throw new HttpError(400, 'A foto precisa ser enviada por aqui.');
  return value;
}

export interface MemorialInput {
  nome: string;
  anos: string;
  texto: string;
  foto_url: string | null;
  pessoa_arvore_id: number | null;
}

export function lerMemorial(body: Record<string, unknown>, foto: string | null): MemorialInput {
  const nome = cleanText(body.nome, 'o nome', 120);
  const anos = cleanText(body.anos, 'os anos', 40);
  const texto = cleanText(body.texto, 'o texto', 4000, false);
  let pessoa_arvore_id: number | null = null;
  if (body.pessoa_arvore_id != null && body.pessoa_arvore_id !== '' && body.pessoa_arvore_id !== 0) {
    pessoa_arvore_id = toInt(body.pessoa_arvore_id, 'a pessoa da árvore');
  }
  return { nome, anos, texto, foto_url: foto, pessoa_arvore_id };
}

async function exigirPessoaArvore(id: number | null): Promise<void> {
  if (id == null) return;
  const { rows } = await query('SELECT id FROM family_tree_people WHERE id = $1', [id]);
  if (!rows.length) throw new HttpError(400, 'Escolha alguém da árvore.');
}

export async function carregarHomenagem(me: { id: number; is_admin: boolean }): Promise<HomenagemDados> {
  const ano = edicaoAtual();
  const [pessoas, memoriais, lembrancas, velas] = await Promise.all([
    query<{ id: number; nome: string }>(
      'SELECT id, nome FROM family_tree_people ORDER BY nome, id',
    ),
    query<{ id: number; nome: string; foto_url: string | null; anos: string; texto: string; pessoa_arvore_id: number | null; criado_por: number | null; autor_nome: string | null }>(
      `SELECT m.id, m.nome, m.foto_url, m.anos, m.texto, m.pessoa_arvore_id, m.criado_por, u.name AS autor_nome
       FROM family_memorials m
       LEFT JOIN family_users u ON u.id = m.criado_por
       ORDER BY m.created_at DESC, m.id DESC`,
    ),
    query<{ id: number; memorial_id: number; user_id: number; name: string; avatar_url: string | null; texto: string; image_url: string | null }>(
      `SELECT t.id, t.memorial_id, t.user_id, u.name, u.avatar_url, t.texto, t.image_url
       FROM family_tributes t
       JOIN family_users u ON u.id = t.user_id
       JOIN family_memorials m ON m.id = t.memorial_id
       WHERE NOT EXISTS (SELECT 1 FROM user_blocks b WHERE b.blocker_id = $1 AND b.blocked_id = t.user_id)
       ORDER BY t.created_at, t.id`,
      [me.id],
    ),
    query<{ memorial_id: number; velas: number; acendi: boolean }>(
      `SELECT c.memorial_id, COUNT(*)::int AS velas, BOOL_OR(c.user_id = $1 AND c.ano = $2) AS acendi
       FROM family_memorial_candles c
       JOIN family_memorials m ON m.id = c.memorial_id
       GROUP BY c.memorial_id`,
      [me.id, ano],
    ),
  ]);
  const porMemorial = new Map<number, Lembranca[]>();
  for (const item of lembrancas.rows) {
    const lista = porMemorial.get(item.memorial_id) ?? [];
    lista.push({
      id: item.id,
      user_id: item.user_id,
      name: item.name,
      avatar_url: item.avatar_url,
      texto: item.texto,
      image_url: item.image_url,
      pode_apagar: me.is_admin || item.user_id === me.id,
    });
    porMemorial.set(item.memorial_id, lista);
  }
  const velasPor = new Map(velas.rows.map((row) => [row.memorial_id, row]));
  return {
    ano,
    eu: { id: me.id, admin: me.is_admin },
    pessoas: pessoas.rows,
    memoriais: memoriais.rows.map((row) => {
      const vela = velasPor.get(row.id);
      return {
        id: row.id,
        nome: row.nome,
        foto_url: row.foto_url,
        anos: row.anos,
        texto: row.texto,
        pessoa_arvore_id: row.pessoa_arvore_id,
        autor_nome: row.autor_nome ?? 'Alguém da família',
        velas: vela?.velas ?? 0,
        acendi: Boolean(vela?.acendi),
        pode_editar: me.is_admin || row.criado_por === me.id,
        lembrancas: porMemorial.get(row.id) ?? [],
      };
    }),
  };
}

export async function criarMemorial(meId: number, input: MemorialInput): Promise<number> {
  await exigirPessoaArvore(input.pessoa_arvore_id);
  const { rows } = await query<{ id: number }>(
    `INSERT INTO family_memorials (ano, nome, foto_url, anos, texto, pessoa_arvore_id, criado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [edicaoAtual(), input.nome, input.foto_url, input.anos, input.texto, input.pessoa_arvore_id, meId],
  );
  const id = rows[0]?.id;
  if (!id) throw new HttpError(500, 'Não deu para guardar a homenagem.');
  return id;
}

export async function editarMemorial(me: { id: number; is_admin: boolean }, id: number, input: MemorialInput): Promise<void> {
  await exigirPessoaArvore(input.pessoa_arvore_id);
  const result = await query(
    `UPDATE family_memorials
     SET nome = $2, foto_url = $3, anos = $4, texto = $5, pessoa_arvore_id = $6
     WHERE id = $1 AND ($7::boolean OR criado_por = $8)
     RETURNING id`,
    [id, input.nome, input.foto_url, input.anos, input.texto, input.pessoa_arvore_id, me.is_admin, me.id],
  );
  if (!result.rowCount) throw new HttpError(404, 'Homenagem não encontrada ou sem permissão para editar.');
}

export async function apagarMemorial(me: { id: number; is_admin: boolean }, id: number): Promise<void> {
  const result = await query(
    `DELETE FROM family_memorials
     WHERE id = $1 AND ($2::boolean OR criado_por = $3) RETURNING id`,
    [id, me.is_admin, me.id],
  );
  if (!result.rowCount) throw new HttpError(404, 'Homenagem não encontrada ou sem permissão para apagar.');
}

export async function criarLembranca(meId: number, memorialId: number, texto: string, foto: string | null): Promise<number> {
  const memorial = await query('SELECT id FROM family_memorials WHERE id = $1', [memorialId]);
  if (!memorial.rows.length) throw new HttpError(404, 'Homenagem não encontrada.');
  const { rows } = await query<{ id: number }>(
    `INSERT INTO family_tributes (ano, memorial_id, user_id, texto, image_url)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [edicaoAtual(), memorialId, meId, texto, foto],
  );
  const id = rows[0]?.id;
  if (!id) throw new HttpError(500, 'Não deu para guardar a lembrança.');
  return id;
}

export async function apagarLembranca(me: { id: number; is_admin: boolean }, memorialId: number, id: number): Promise<void> {
  const result = await query(
    `DELETE FROM family_tributes
     WHERE id = $1 AND memorial_id = $2 AND ($3::boolean OR user_id = $4)
     RETURNING id`,
    [id, memorialId, me.is_admin, me.id],
  );
  if (!result.rowCount) throw new HttpError(404, 'Lembrança não encontrada ou sem permissão para apagar.');
}

export async function acenderVela(meId: number, memorialId: number): Promise<void> {
  const memorial = await query('SELECT id FROM family_memorials WHERE id = $1', [memorialId]);
  if (!memorial.rows.length) throw new HttpError(404, 'Homenagem não encontrada.');
  await query(
    `INSERT INTO family_memorial_candles (ano, memorial_id, user_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (memorial_id, user_id, ano) DO NOTHING`,
    [edicaoAtual(), memorialId, meId],
  );
}
