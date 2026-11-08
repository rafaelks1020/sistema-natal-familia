import { randomInt } from 'node:crypto';
import { route, ok, readJson, requireUser, requireAdmin, HttpError, toInt } from '@/app/lib/api';
import { transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { prepararNotas } from '@/app/telao/karaoke/pontuacao';
import type { ConfigProva, StatusProva } from '@/app/telao/karaoke/prova-tipos';
import { classificacaoProva, comMigracao, configProva, painelProva, recuperarInterrompidas, semCache, travar } from './_dados';
export const dynamic = 'force-dynamic';

export const GET = route(comMigracao(async () => {
  const me = await requireUser();
  return semCache(ok(await transaction(async (q) => {
    await travar(q, edicaoAtual());
    await recuperarInterrompidas(q, edicaoAtual());
    return painelProva(q, me);
  })));
}));

export const POST = route(comMigracao(async (req) => {
  const me = await requireAdmin();
  const body = await readJson<Record<string, unknown>>(req);
  const ano = edicaoAtual();
  return semCache(ok(await transaction(async (q) => {
    await travar(q, ano);
    await recuperarInterrompidas(q, ano);
    const atual = await configProva(q, ano);
    if (body.acao === 'sortear') {
      if (!atual || atual.status !== 'final' || Date.now() < new Date(atual.final_em).getTime()) throw new HttpError(409, 'O sorteio acontece na hora da final.');
      if (atual.final_musica == null) await q('UPDATE karaoke_prova SET final_musica = $2 WHERE ano = $1', [ano, atual.musicas[randomInt(atual.musicas.length)]]);
      return painelProva(q, me);
    }
    const musicas = body.musicas === undefined ? atual?.musicas : Array.isArray(body.musicas) ? body.musicas.map((id) => toInt(id, 'música')) : [];
    if (!musicas || musicas.length !== 5 || new Set(musicas).size !== 5) throw new HttpError(400, 'Escolha exatamente 5 músicas diferentes.');
    const status = (body.status ?? atual?.status ?? 'preparando') as StatusProva;
    const estados: StatusProva[] = ['preparando','eliminatoria','final','encerrada'];
    if (!estados.includes(status)) throw new HttpError(400, 'Status da Prova inválido.');
    const eliminatoria = new Date(String(body.eliminatoria_ate ?? atual?.eliminatoria_ate ?? ''));
    const final = new Date(String(body.final_em ?? atual?.final_em ?? ''));
    if (!Number.isFinite(+eliminatoria) || !Number.isFinite(+final) || +final < +eliminatoria) throw new HttpError(400, 'Informe datas válidas. A final deve ser depois da eliminatória.');
    const { rows: feitas } = await q<{ total: number; cantando: number }>(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE status = 'cantando')::int AS cantando FROM karaoke_prova_tentativas WHERE ano = $1`, [ano]);
    if (feitas[0].cantando && status !== atual?.status) throw new HttpError(409, 'Espere a tentativa em andamento terminar antes de mudar a fase.');
    if (atual && feitas[0].total && (musicas.join(',') !== atual.musicas.join(',') || +eliminatoria !== +new Date(atual.eliminatoria_ate) || +final !== +new Date(atual.final_em))) throw new HttpError(409, 'As músicas e datas ficam travadas depois da primeira tentativa oficial.');
    if (atual && (estados.indexOf(status) < estados.indexOf(atual.status) || estados.indexOf(status) > estados.indexOf(atual.status) + 1)) throw new HttpError(409, 'Avance uma fase por vez. Uma fase encerrada não pode ser reaberta.');
    if (!atual && status !== 'preparando') throw new HttpError(400, 'Comece configurando a fase de preparação.');
    if (status === 'final' && atual?.status !== 'final' && Date.now() < +eliminatoria) throw new HttpError(409, 'A eliminatória ainda está aberta.');
    if (status === 'encerrada' && atual?.status === 'final') {
      const dados = await classificacaoProva(q, atual);
      if (!atual.final_musica || !dados.finalistas.length || dados.resultado.some((p) => p.nota_final === null)) throw new HttpError(409, 'Sorteie a música e espere todos os finalistas concluírem suas tentativas antes de encerrar.');
    }
    const { rows: prontas } = await q<{ notas: Parameters<typeof prepararNotas>[0] }>(`SELECT notas FROM karaoke_catalogo WHERE id = ANY($1::bigint[]) AND status = 'pronta' AND audio_url IS NOT NULL AND palavras IS NOT NULL`, [musicas]);
    if (prontas.length !== 5 || prontas.some((m) => !prepararNotas(m.notas).length)) throw new HttpError(400, 'As 5 músicas precisam estar prontas, com áudio, letra e notas.');
    const c: ConfigProva = { ano, musicas, eliminatoria_ate: eliminatoria.toISOString(), final_em: final.toISOString(), status, final_musica: atual?.final_musica ?? null };
    await q(`INSERT INTO karaoke_prova (ano,musicas,eliminatoria_ate,final_em,status) VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (ano) DO UPDATE SET musicas = EXCLUDED.musicas,eliminatoria_ate = EXCLUDED.eliminatoria_ate,final_em = EXCLUDED.final_em,status = EXCLUDED.status`,
    [ano, c.musicas, c.eliminatoria_ate, c.final_em, c.status]);
    return painelProva(q, me);
  })));
}));
