import { cleanText, HttpError, ok, readJson, requireAdmin, route } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { ehCena, FRASE_BRINDE_PADRAO } from '@/app/telao/tipos';
import { limparCacheTelao } from '../estado/_data';

export const dynamic = 'force-dynamic';

// Controle do telão pelo celular de quem organiza. Uma linha por edição em telao_state.
// cena: fixa uma cena (ou null volta ao ciclo). proxima e anterior soltam a cena fixa e viram comando para o telão.
export const POST = route(async (req) => {
  await requireAdmin();
  const body = await readJson<Record<string, unknown>>(req);
  const ano = edicaoAtual();
  const acao = typeof body.acao === 'string' ? body.acao : '';
  try {
    if (acao === 'cena') {
      if (body.cena !== null && !ehCena(body.cena)) throw new HttpError(400, 'Cena inválida.');
      await query(
        `INSERT INTO telao_state (ano, cena_fixa, pausado, updated_at) VALUES ($1, $2, false, NOW())
         ON CONFLICT (ano) DO UPDATE SET cena_fixa = EXCLUDED.cena_fixa, pausado = false, updated_at = NOW()`, [ano, body.cena]);
    } else if (acao === 'pausar' || acao === 'continuar') {
      await query(
        `INSERT INTO telao_state (ano, pausado, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (ano) DO UPDATE SET pausado = EXCLUDED.pausado, updated_at = NOW()`, [ano, acao === 'pausar']);
    } else if (acao === 'proxima' || acao === 'anterior') {
      await query(
        `INSERT INTO telao_state (ano, cena_fixa, comando, comando_em, updated_at) VALUES ($1, NULL, $2, NOW(), NOW())
         ON CONFLICT (ano) DO UPDATE SET cena_fixa = NULL, comando = EXCLUDED.comando, comando_em = NOW(), updated_at = NOW()`, [ano, acao]);
    } else if (acao === 'aviso') {
      const texto = cleanText(body.texto, 'o aviso', 120).replace(/\s+/g, ' ');
      await query(
        `INSERT INTO telao_state (ano, comando, comando_em, updated_at) VALUES ($1, $2, NOW(), NOW())
         ON CONFLICT (ano) DO UPDATE SET comando = EXCLUDED.comando, comando_em = NOW(), updated_at = NOW()`, [ano, `aviso:${texto}`]);
    } else if (acao === 'brinde') {
      // Como o aviso, vira comando. Solta a cena fixa para o brinde aparecer.
      const frase = cleanText(body.frase, 'a frase do brinde', 120, false).replace(/\s+/g, ' ') || FRASE_BRINDE_PADRAO;
      await query(
        `INSERT INTO telao_state (ano, cena_fixa, comando, comando_em, updated_at) VALUES ($1, NULL, $2, NOW(), NOW())
         ON CONFLICT (ano) DO UPDATE SET cena_fixa = NULL, comando = EXCLUDED.comando, comando_em = NOW(), updated_at = NOW()`, [ano, `brinde:${frase}`]);
    } else {
      throw new HttpError(400, 'Ação inválida.');
    }
  } catch (e) {
    if ((e as { code?: string } | null)?.code === '42P01') throw new HttpError(503, 'O telão ainda não foi preparado no banco (migração 032).');
    throw e;
  }
  limparCacheTelao();
  return ok({ ok: true });
});
