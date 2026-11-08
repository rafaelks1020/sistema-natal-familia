import { route, ok, requireUser } from '@/app/lib/api';
import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { ocultarNotasDaProva } from '../_oculto';
import { montarPlacar, type Apresentacao } from '@/app/telao/karaoke/premios';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const me = await requireUser();
  const ano = edicaoAtual();
  // Entre ranking_oculto_em e a revelação, as apresentações da Prova (e suas notas) ficam fora do placar da família.
  const ocultar = await ocultarNotasDaProva(query, ano, me.is_admin);
  const { rows } = await query<Omit<Apresentacao, 'id' | 'iniciado_em'> & { id: string | number; iniciado_em: Date | string | null }>(
    `SELECT f.id, f.user_id, u.name AS nome, f.dueto_user_id, d.name AS dueto_nome,
            CASE WHEN f.lrclib_id IS NOT NULL THEN 'lrclib:' || f.lrclib_id
                 WHEN f.catalogo_id IS NOT NULL THEN 'catalogo:' || f.catalogo_id
                 ELSE 'video:' || f.video_id END AS musica_id,
            f.titulo, f.iniciado_em, n.nota, n.detalhes
       FROM karaoke_fila f
       JOIN karaoke_notas n ON n.fila_id = f.id
       JOIN family_users u ON u.id = f.user_id
       LEFT JOIN family_users d ON d.id = f.dueto_user_id
      WHERE f.ano = $1 AND f.status = 'feita'
        AND NOT ($2::boolean AND EXISTS (SELECT 1 FROM karaoke_prova_tentativas pt WHERE pt.fila_id = f.id))
      ORDER BY f.iniciado_em NULLS LAST, f.id`,
    [ano, ocultar],
  );
  // Dos detalhes da nota o placar só usa o combo, a dificuldade e o nível (o resto é pesado e fica no banco).
  const apresentacoes: Apresentacao[] = rows.map((a) => ({
    ...a, id: Number(a.id),
    detalhes: a.detalhes ? { maiorCombo: a.detalhes.maiorCombo, dificuldade: a.detalhes.dificuldade, nivel: a.detalhes.nivel } : null,
    iniciado_em: a.iniciado_em instanceof Date ? a.iniciado_em.toISOString() : a.iniciado_em,
  }));
  const resposta = ok(montarPlacar(apresentacoes, ano));
  resposta.headers.set('Cache-Control', 'private, no-store');
  return resposta;
});
