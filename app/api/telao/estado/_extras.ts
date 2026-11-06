import 'server-only';
import { query } from '@/app/lib/db';
import { edicaoAtual, hojeSP } from '@/app/lib/edicao';

export interface PratoCeiaExtra {
  nome: string;
  categoria: string | null;
  quem: string;
}

export interface FotoOficialExtra {
  ano: number;
  url: string;
  legenda: string | null;
}

const semTabela = (e: unknown) => (e as { code?: string } | null)?.code === '42P01';

export async function lerPratosCeia(ano: number = edicaoAtual(), meId?: number): Promise<PratoCeiaExtra[]> {
  try {
    const { rows } = await query<{ nome: string; categoria: string | null; quem: string }>(
      `SELECT d.nome, d.categoria, COALESCE(resp.name, autor.name) AS quem
         FROM ceia_dishes d
         JOIN family_users autor ON autor.id = d.user_id
         LEFT JOIN family_users resp ON resp.id = d.responsavel_id
        WHERE d.ano = $1
          AND ($2::int IS NULL OR NOT EXISTS (
            SELECT 1 FROM user_blocks b
             WHERE (b.blocker_id = $2 AND b.blocked_id = d.user_id)
                OR (b.blocker_id = d.user_id AND b.blocked_id = $2)
          ))
        ORDER BY d.categoria, d.nome, d.id`,
      [ano, meId ?? null],
    );
    return rows.map((r) => ({
      nome: r.nome,
      categoria: r.categoria ?? null,
      quem: r.quem,
    }));
  } catch (e) {
    if (semTabela(e)) return [];
    throw e;
  }
}

export async function lerFotosOficiais(meId?: number): Promise<FotoOficialExtra[]> {
  try {
    const { rows } = await query<{ ano: number; image_url: string; legenda: string | null }>(
      `SELECT p.ano, p.image_url, NULLIF(btrim(p.legenda), '') AS legenda
         FROM family_official_photos p
        WHERE ($1::int IS NULL OR NOT EXISTS (
          SELECT 1 FROM user_blocks b
           WHERE (b.blocker_id = $1 AND b.blocked_id = p.user_id)
              OR (b.blocker_id = p.user_id AND b.blocked_id = $1)
        ))
        ORDER BY p.ano ASC`,
      [meId ?? null],
    );
    return rows.map((r) => ({
      ano: Number(r.ano),
      url: r.image_url,
      legenda: r.legenda ?? null,
    }));
  } catch (e) {
    if (semTabela(e)) return [];
    throw e;
  }
}

export async function lerNomesPresentes(ano: number = edicaoAtual(), meId?: number): Promise<string[]> {
  void ano;
  try {
    const { rows } = await query<{ nome: string }>(
      `SELECT u.name AS nome
         FROM family_daily_visits v
         JOIN family_users u ON u.id = v.user_id
        WHERE v.dia = $1::date
          AND ($2::int IS NULL OR NOT EXISTS (
            SELECT 1 FROM user_blocks b
             WHERE (b.blocker_id = $2 AND b.blocked_id = v.user_id)
                OR (b.blocker_id = v.user_id AND b.blocked_id = $2)
          ))
        ORDER BY v.primeira, u.name`,
      [hojeSP(), meId ?? null],
    );
    return rows.slice(0, 20).map((r) => r.nome);
  } catch (e) {
    if (semTabela(e)) return [];
    throw e;
  }
}
