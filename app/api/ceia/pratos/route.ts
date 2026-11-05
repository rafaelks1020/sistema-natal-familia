import { cleanText, HttpError, ok, readJson, requireUser, route } from '@/app/lib/api';
import { transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { avisoPratos, categoriaDe, type CeiaPrato } from '../tipos';

export const POST = route(async (req) => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);
  const nome = cleanText(body.nome, 'o nome do prato', 80);
  const categoria = categoriaDe(body.categoria);
  if (!categoria) throw new HttpError(400, 'Escolha a categoria: salgado, doce, bebida, descartável ou outro.');
  const quantidadeTexto = cleanText(body.quantidade, 'a quantidade', 40, false);
  const quantidade = quantidadeTexto || null;
  const preciso = body.preciso === true;
  if (preciso && !me.is_admin) throw new HttpError(403, 'Só quem organiza anuncia o que ainda falta.');
  const ano = edicaoAtual();
  const responsavelId = preciso ? null : me.id;

  const criado = await transaction(async (q) => {
    const existentes = await q<{ nome: string; categoria: string }>(
      `SELECT nome, categoria FROM ceia_dishes
        WHERE ano = $1 AND categoria = $2
          AND NOT EXISTS (
            SELECT 1 FROM user_blocks b WHERE b.blocker_id = $3 AND b.blocked_id = ceia_dishes.user_id
          )`,
      [ano, categoria, me.id],
    );
    const aviso = avisoPratos(existentes.rows, nome, categoria);
    const inserido = await q<{ id: number; created_at: Date }>(
      `INSERT INTO ceia_dishes (ano, user_id, responsavel_id, nome, categoria, quantidade)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [ano, me.id, responsavelId, nome, categoria, quantidade],
    );
    const linha = inserido.rows[0];
    if (!linha) throw new HttpError(500, 'Não foi possível anotar o prato.');
    return { linha, aviso };
  });

  const prato: CeiaPrato = {
    id: criado.linha.id,
    nome,
    categoria,
    quantidade,
    user_id: me.id,
    autor_nome: me.name,
    responsavel_id: responsavelId,
    responsavel_nome: responsavelId ? me.name : null,
    created_at: criado.linha.created_at instanceof Date ? criado.linha.created_at.toISOString() : new Date(criado.linha.created_at).toISOString(),
  };
  return ok({ prato, aviso: criado.aviso }, 201);
});
