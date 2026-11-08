import { route, ok, requireUser, readJson, HttpError, toInt } from '@/app/lib/api';
import { transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { tentativaPermitida } from '@/app/telao/karaoke/prova';
import { pontuarEstudio, prepararNotas, estrelasEstudio, type NotaEstudio, type Quadro } from '@/app/telao/karaoke/pontuacao';
import type { FaseProva } from '@/app/telao/karaoke/prova-tipos';
import { processarLote } from '@/app/telao/karaoke/prova-seguranca';
import { carregarTentativas, classificacaoProva, comMigracao, configProva, detalhesPublicos, encerrarTentativa, recuperarInterrompidas, semCache, travar } from '../_dados';
export const dynamic = 'force-dynamic';

export const POST = route(comMigracao(async (req) => {
  const me = await requireUser();
  const body = await readJson<Record<string, unknown>>(req);
  const ano = edicaoAtual();
  return semCache(ok(await transaction(async (q) => {
    await travar(q, ano);
    await recuperarInterrompidas(q, ano);
    if (body.acao === 'iniciar') {
      const c = await configProva(q, ano);
      if (!c || (c.status !== 'eliminatoria' && c.status !== 'final')) throw new HttpError(409, 'A Prova não está recebendo tentativas.');
      const fase: FaseProva = c.status;
      if (fase === 'eliminatoria' && Date.now() >= +new Date(c.eliminatoria_ate)) throw new HttpError(409, 'O prazo da eliminatória terminou.');
      if (fase === 'final' && Date.now() < +new Date(c.final_em)) throw new HttpError(409, 'A final ainda não começou.');
      // A final só é conduzida por quem organiza, como a fila livre: nada de tentativa de final por familiar.
      if (fase === 'final' && !me.is_admin) throw new HttpError(403, 'A final ao vivo é conduzida por quem organiza.');
      const userId = me.is_admin && body.user_id != null ? toInt(body.user_id, 'participante') : me.id;
      const musica = toInt(body.catalogo_id, 'música');
      if (!c.musicas.includes(musica)) throw new HttpError(400, 'Escolha uma das 5 músicas oficiais.');
      const tentativas = await carregarTentativas(q, ano);
      if (!tentativaPermitida(tentativas, userId, musica, fase)) throw new HttpError(409, 'Você já usou a tentativa oficial desta música nesta fase. Não há segunda chance, inclusive após abandono.');
      if (fase === 'final') {
        if (!c.final_musica || c.final_musica !== musica) throw new HttpError(409, 'Cante a música sorteada para a final.');
        const { finalistas } = await classificacaoProva(q, c);
        const proximo = finalistas.find((p) => !tentativas.some((t) => t.user_id === p.user_id && t.fase === 'final'));
        if (proximo?.user_id !== userId) throw new HttpError(409, 'Siga a sequência dos finalistas exibida no telão.');
      }
      // A fila livre pode estar cantando em outra tela: só outra tentativa oficial em andamento impede o início.
      const { rows: ocupada } = await q(`SELECT id FROM karaoke_prova_tentativas WHERE ano = $1 AND status = 'cantando' LIMIT 1`, [ano]);
      if (ocupada.length) throw new HttpError(409, 'Já existe uma tentativa oficial em andamento. Aguarde o encerramento.');
      const { rows: usuarios } = await q('SELECT id FROM family_users WHERE id = $1', [userId]);
      if (!usuarios.length) throw new HttpError(404, 'Participante não encontrado.');
      const { rows: catalogo } = await q<{ faixa: string; artista: string; duracao_ms: number; capa_url: string | null; notas: NotaEstudio[] }>(
        `SELECT faixa,artista,duracao_ms,capa_url,notas FROM karaoke_catalogo WHERE id = $1 AND status = 'pronta' AND audio_url IS NOT NULL AND palavras IS NOT NULL`, [musica]);
      const m = catalogo[0];
      if (!m || !prepararNotas(m.notas).length) throw new HttpError(409, 'A música precisa estar pronta, com áudio, letra e notas.');
      const { rows: filas } = await q<{ id: string }>(`INSERT INTO karaoke_fila
        (ano,user_id,catalogo_id,video_id,titulo,canal,duracao_s,miniatura,faixa,artista,modo,status,iniciado_em)
        VALUES ($1,$2,$3,$4,$5,'Prova oficial',$6,$7,$8,$9,'estudio','cantando',NOW()) RETURNING id`,
      [ano, userId, musica, `estudio-${musica}`, `${m.faixa} - ${m.artista}`, Math.round(m.duracao_ms / 1000), m.capa_url, m.faixa, m.artista]);
      const vazio = pontuarEstudio([], m.notas, 140, 0, { nivel: 'dificil', limiar: 0.008, explicar: true });
      const { rows } = await q<{ id: string }>(`INSERT INTO karaoke_prova_tentativas
        (ano,user_id,catalogo_id,fase,fila_id,controlador_id,nota,detalhes)
        VALUES ($1,$2,$3,$4,$5,$6,0,$7::jsonb) RETURNING id`,
      [ano, userId, musica, fase, filas[0].id, me.id, JSON.stringify({ ...vazio.detalhes, resumo: vazio.resumo, linhas: vazio.linhas, prova: true, fase, nivel: 'dificil', _quadros: [] })]);
      return { id: Number(rows[0].id), fila_id: Number(filas[0].id), fase };
    }
    if (!['parcial','terminar','abandonar'].includes(String(body.acao))) throw new HttpError(400, 'Ação inválida.');
    const id = toInt(body.id);
    const { rows } = await q<{ id: string; fila_id: string; fase: FaseProva; status: string; fila_status: string; controlador_id: number; iniciada_em: Date; nota: number; detalhes: Record<string, unknown>; notas: NotaEstudio[]; duracao_ms: number }>(
      `SELECT t.*,c.notas,c.duracao_ms,f.status AS fila_status FROM karaoke_prova_tentativas t JOIN karaoke_catalogo c ON c.id = t.catalogo_id JOIN karaoke_fila f ON f.id = t.fila_id
       WHERE t.id = $1 AND t.ano = $2 FOR UPDATE OF t`, [id, ano]);
    const t = rows[0];
    if (!t) throw new HttpError(404, 'Tentativa não encontrada.');
    if (t.controlador_id !== me.id && !me.is_admin) throw new HttpError(403, 'Esta tentativa está sendo conduzida por outro aparelho.');
    // Fim idempotente: uma resposta perdida não transforma tentativa válida em abandono.
    if (t.status !== 'cantando') return { id, status: t.status, resultado: { nota: t.nota, estrelas: estrelasEstudio(t.nota), detalhes: me.is_admin ? t.detalhes : detalhesPublicos(t.detalhes), total: t.detalhes.total, resumo: t.detalhes.resumo, linhas: t.detalhes.linhas } };
    if (!Array.isArray(body.quadros) || body.quadros.length > 1000) throw new HttpError(400, 'Envie até 1000 medições por vez.');
    const anteriores = (t.detalhes._quadros ?? []) as Quadro[];
    // Quadro inválido é descartado e o lote segue. 400 só para salto de posição impossível.
    const lote = processarLote(body.quadros, { ultimo: anteriores.at(-1)?.t ?? -1, posicao: anteriores.at(-1)?.m ?? 0, duracaoMs: t.duracao_ms, decorridoMs: Date.now() - +new Date(t.iniciada_em) + 3000 });
    if (lote.salto) throw new HttpError(400, 'Não é permitido pular ou recomeçar uma tentativa oficial.');
    const { novos, ultimo, posicao } = lote;
    const quadros = [...anteriores,...novos];
    if (quadros.length > 60000) throw new HttpError(400, 'Limite de duração da tentativa excedido.');
    // Sempre usa TODAS as notas, inclusive as ainda não cantadas. Sem bônus por gestos.
    const resultado = pontuarEstudio(quadros, t.notas, 140, 0, { nivel: 'dificil', limiar: 0.008, explicar: true });
    const detalhes = { ...resultado.detalhes, resumo: resultado.resumo, linhas: resultado.linhas, prova: true, fase: t.fase, nivel: 'dificil', _quadros: quadros };
    await q(`UPDATE karaoke_prova_tentativas SET nota = $2,detalhes = $3::jsonb,ultima_atividade_em = NOW() WHERE id = $1`, [id, resultado.nota, JSON.stringify(detalhes)]);
    await q('UPDATE karaoke_fila SET parcial = $2 WHERE id = $1', [t.fila_id, resultado.resumo.pontos]);
    const interrompida = t.fila_status !== 'cantando';
    const terminou = body.acao !== 'parcial' || interrompida;
    const abandonada = interrompida || body.acao === 'abandonar' || (terminou && posicao < t.duracao_ms - 1500);
    if (terminou) await encerrarTentativa(q, id, abandonada);
    return { id, status: terminou ? abandonada ? 'abandonada' : 'valida' : 'cantando', resultado, ultimo_t: ultimo, lote_ate_t: lote.loteAteT, descartados: lote.descartados };
  })));
}));
