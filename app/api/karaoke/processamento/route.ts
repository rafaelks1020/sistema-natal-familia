import { HttpError, ok, requireUser, route } from '@/app/lib/api';
import { transaction } from '@/app/lib/db';
import { estimarProcessamento, type Fase, type LinhaProcessamento } from './progresso';

export const dynamic = 'force-dynamic';

/** Todos os pedidos ativos e os finais acompanhados. Não depende do filtro do catálogo. */
export const GET = route(async (req) => {
  const me = await requireUser();
  const ids = [...new Set((new URL(req.url).searchParams.get('ids') ?? '').split(',').filter(Boolean))];
  if (ids.length > 100 || ids.some((id) => !/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0)) {
    throw new HttpError(400, 'Lista de músicas inválida.');
  }
  try {
    // Um mesmo retrato do banco impede misturar a conclusão com a fila anterior.
    const dados = await transaction(async (q) => {
      await q('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
      const { rows: musicas } = await q<LinhaProcessamento>(
        `SELECT id, slug, artista, faixa, status, etapa, progresso, etapa_em, created_at, pedido_por
           FROM karaoke_catalogo
          WHERE status IN ('na_fila', 'baixando', 'processando') OR id = ANY($1::bigint[])
             OR id IN (SELECT id FROM karaoke_catalogo WHERE pedido_por = $2
                         AND status IN ('pronta', 'falhou') AND atualizado_em > now() - interval '1 day'
                       ORDER BY atualizado_em DESC LIMIT 20)
          ORDER BY created_at, id`, [ids.map(Number), me.id],
      );
      const { rows: medias } = await q<{ etapa: Fase; media_s: number | string }>(
        `SELECT fases.etapa, AVG(amostras.duracao_s) AS media_s
           FROM (VALUES ('baixando'), ('separando_voz'), ('alinhando_letra'), ('gerando_notas'), ('publicando')) fases(etapa)
           CROSS JOIN LATERAL (
             SELECT duracao_s FROM karaoke_processamento_etapas h WHERE h.etapa = fases.etapa
              ORDER BY finalizado_em DESC, id DESC LIMIT 30
           ) amostras GROUP BY fases.etapa`,
      );
      return { musicas, medias };
    });
    const medias: Partial<Record<Fase, number>> = {};
    for (const m of dados.medias) medias[m.etapa] = Number(m.media_s);
    const resposta = ok({ musicas: estimarProcessamento(dados.musicas, medias, me.id) });
    resposta.headers.set('Cache-Control', 'private, no-store');
    return resposta;
  } catch (err) {
    const codigo = typeof err === 'object' && err !== null ? (err as { code?: string }).code : undefined;
    if (codigo === '42P01' || codigo === '42703') throw new HttpError(503, 'O acompanhamento do estúdio estará disponível em breve.');
    throw err;
  }
});
