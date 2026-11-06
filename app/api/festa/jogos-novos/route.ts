import { randomInt } from 'crypto';
import {
  cleanText, HttpError, isBlobUrl, ok, readJson, requireAdmin, requireUser, route, toInt,
} from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import type { SessionUser } from '@/app/lib/session';
import { limparCacheTelao } from '@/app/api/telao/estado/_data';
import {
  ativoDe, CHAVE_PRENDAS, carregarPainel, lerPrendas, lerTimes, listarPresentes, marcarAtivo,
} from './_data';
import { PALAVRAS, PRENDA_MAX } from './_palavras';

// GET: painel do celular. POST { acao, ... }: ações. Só quem organiza inicia, sorteia, revela, pontua e encerra.
// A palavra da mímica só volta para quem está jogando (e só enquanto o tempo corre).

const sortear = <T,>(lista: readonly T[]): T => lista[randomInt(lista.length)];
function embaralhar<T>(lista: readonly T[]): T[] {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SEM_TABELA = '42P01';
const COR_TIMES = ['#C5292D', '#607568'];
const NOME_TIMES = ['Time Cereja', 'Time Sálvia'];
const MAX_NA_RODA = 24;

async function palavraNova(ano: number, evitar?: string): Promise<string> {
  const { rows } = await query<{ palavra: string }>('SELECT DISTINCT palavra FROM party_mimica WHERE ano = $1', [ano]);
  const usadas = new Set(rows.map((r) => r.palavra));
  if (evitar) usadas.add(evitar);
  const livres = PALAVRAS.filter((p) => !usadas.has(p));
  return sortear(livres.length ? livres : PALAVRAS.filter((p) => p !== evitar));
}

async function tocarAtivo(ano: number) {
  await query('UPDATE party_jogo_ativo SET updated_at = NOW() WHERE ano = $1', [ano]);
}

async function criarTimes(ano: number, nomes: unknown) {
  const presentes = await listarPresentes();
  if (presentes.length < 2) throw new HttpError(400, 'Precisa de pelo menos 2 pessoas para formar times.');
  const nomesFinais = [0, 1].map((i) => {
    const bruto = Array.isArray(nomes) ? nomes[i] : undefined;
    return typeof bruto === 'string' && bruto.trim() ? cleanText(bruto, `Nome do time ${i + 1}`, 40) : NOME_TIMES[i];
  });
  const sorteados = embaralhar(presentes);
  await transaction(async (q) => {
    await q('DELETE FROM party_teams WHERE ano = $1', [ano]);
    const ids: number[] = [];
    for (let i = 0; i < 2; i++) {
      const r = await q<{ id: number }>(
        'INSERT INTO party_teams (ano, nome, cor) VALUES ($1, $2, $3) RETURNING id', [ano, nomesFinais[i], COR_TIMES[i]]);
      ids.push(r.rows[0].id);
    }
    for (let i = 0; i < sorteados.length; i++) {
      await q('INSERT INTO party_team_members (ano, team_id, user_id) VALUES ($1, $2, $3)', [ano, ids[i % 2], sorteados[i].id]);
    }
  });
}

async function iniciarMimica(ano: number, body: Record<string, unknown>) {
  const modo = body.modo === 'desenho' ? 'desenho' : 'mimica';
  const duracao = Math.min(300, Math.max(20, Number.isInteger(Number(body.duracao_s)) && Number(body.duracao_s) > 0 ? Number(body.duracao_s) : 60));
  const times = await lerTimes(ano);
  if (!times.length) throw new HttpError(400, 'Crie os times antes de começar.');
  let time = body.team_id != null ? times.find((t) => t.id === toInt(body.team_id, 'time')) : undefined;
  if (body.team_id != null && !time) throw new HttpError(404, 'Time não encontrado.');
  if (!time) {
    // Alterna: o time da vez é o seguinte ao da última rodada.
    const ultima = await query<{ team_id: number | null }>('SELECT team_id FROM party_mimica WHERE ano = $1 ORDER BY id DESC LIMIT 1', [ano]);
    const idx = times.findIndex((t) => t.id === ultima.rows[0]?.team_id);
    time = times[(idx + 1) % times.length];
  }
  if (!time.membros.length) throw new HttpError(400, 'Esse time está sem ninguém.');
  // Quem jogou menos vezes tem a vez; empate no sorteio.
  const contagem = await query<{ quem_joga: number; n: number }>(
    'SELECT quem_joga, COUNT(*)::int AS n FROM party_mimica WHERE ano = $1 AND team_id = $2 GROUP BY quem_joga', [ano, time.id]);
  const vezes = (id: number) => contagem.rows.find((c) => c.quem_joga === id)?.n ?? 0;
  const minimo = Math.min(...time.membros.map((m) => vezes(m.id)));
  const jogador = sortear(time.membros.filter((m) => vezes(m.id) === minimo));
  const palavra = await palavraNova(ano);
  await query("UPDATE party_mimica SET status = 'tempo', encerrado_em = NOW() WHERE ano = $1 AND status = 'jogando'", [ano]);
  const nova = await query<{ id: string }>(
    `INSERT INTO party_mimica (ano, palavra, modo, quem_joga, team_id, duracao_s) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [ano, palavra, modo, jogador.id, time.id, duracao]);
  await marcarAtivo(ano, 'mimica', Number(nova.rows[0].id));
}

interface MimicaLinha { id: string; quem_joga: number | null; team_id: number | null; status: string; vivo: boolean; palavra: string; folga: boolean }

async function carregarMimicaParaAcao(me: SessionUser, ano: number, id: number): Promise<MimicaLinha> {
  const { rows } = await query<MimicaLinha>(
    `SELECT id, quem_joga, team_id, status, palavra,
            (NOW() < inicio + duracao_s * interval '1 second') AS vivo,
            (NOW() <= inicio + (duracao_s + 3) * interval '1 second') AS folga
       FROM party_mimica WHERE id = $1 AND ano = $2`, [id, ano]);
  const m = rows[0];
  if (!m) throw new HttpError(404, 'Rodada não encontrada.');
  if (!me.is_admin && m.quem_joga !== me.id) throw new HttpError(403, 'Só quem está jogando pode fazer isso.');
  return m;
}

export const GET = route(async () => {
  const me = await requireUser();
  try {
    return ok(await carregarPainel(me, true));
  } catch (e) {
    if ((e as { code?: string } | null)?.code === SEM_TABELA) throw new HttpError(503, 'Os jogos novos ainda não foram ativados no servidor.');
    throw e;
  }
});

export const POST = route(async (req) => {
  const body = await readJson<Record<string, unknown>>(req);
  const acao = typeof body.acao === 'string' ? body.acao : '';
  const ano = edicaoAtual();

  // ---- Ações de qualquer pessoa logada ----
  if (acao === 'bebe_votar') {
    const me = await requireUser();
    const bebeId = toInt(body.bebe_id, 'bebê');
    const palpite = toInt(body.palpite_user_id, 'palpite');
    const bebe = await query<{ status: string }>('SELECT status FROM party_bebe WHERE id = $1 AND ano = $2', [bebeId, ano]);
    if (!bebe.rows[0]) throw new HttpError(404, 'Rodada não encontrada.');
    if (bebe.rows[0].status !== 'aberta') throw new HttpError(400, 'A votação desta foto já terminou.');
    const existe = await query('SELECT 1 FROM family_users WHERE id = $1', [palpite]);
    if (!existe.rows.length) throw new HttpError(400, 'Pessoa inválida.');
    await query(
      `INSERT INTO party_bebe_votos (bebe_id, user_id, palpite_user_id, updated_at) VALUES ($1, $2, $3, NOW())
       ON CONFLICT (bebe_id, user_id) DO UPDATE SET palpite_user_id = EXCLUDED.palpite_user_id, updated_at = NOW()`,
      [bebeId, me.id, palpite]);
    limparCacheTelao();
    return ok(await carregarPainel(me));
  }

  if (acao === 'mimica_resultado' || acao === 'mimica_passar') {
    const me = await requireUser();
    const m = await carregarMimicaParaAcao(me, ano, toInt(body.mimica_id, 'rodada'));
    if (m.status !== 'jogando') throw new HttpError(400, 'Esta rodada já terminou.');
    if (acao === 'mimica_passar') {
      if (!m.vivo) throw new HttpError(400, 'O tempo acabou.');
      await query('UPDATE party_mimica SET palavra = $2 WHERE id = $1', [m.id, await palavraNova(ano, m.palavra)]);
    } else if (body.resultado === 'acertou') {
      if (!m.folga) {
        await query("UPDATE party_mimica SET status = 'tempo', encerrado_em = inicio + duracao_s * interval '1 second' WHERE id = $1 AND status = 'jogando'", [m.id]);
        limparCacheTelao();
        throw new HttpError(400, 'O tempo já tinha acabado.');
      }
      const feito = await query<{ team_id: number | null }>(
        "UPDATE party_mimica SET status = 'acertou', encerrado_em = LEAST(NOW(), inicio + duracao_s * interval '1 second') WHERE id = $1 AND status = 'jogando' RETURNING team_id", [m.id]);
      const time = feito.rows[0]?.team_id;
      if (time) await query('UPDATE party_teams SET pontos = pontos + 1 WHERE id = $1 AND ano = $2', [time, ano]);
    } else {
      await query("UPDATE party_mimica SET status = 'tempo', encerrado_em = LEAST(NOW(), inicio + duracao_s * interval '1 second') WHERE id = $1 AND status = 'jogando'", [m.id]);
    }
    limparCacheTelao();
    return ok(await carregarPainel(me));
  }

  // ---- Ações de quem organiza ----
  const admin = await requireAdmin();

  if (acao === 'times_criar') {
    await criarTimes(ano, body.nomes);
    await marcarAtivo(ano, 'times', null);
  } else if (acao === 'times_mostrar') {
    if (!(await lerTimes(ano)).length) throw new HttpError(400, 'Crie os times antes.');
    await marcarAtivo(ano, 'times', null);
  } else if (acao === 'pontos') {
    const delta = Number(body.pontos);
    if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100) throw new HttpError(400, 'Pontos inválidos.');
    const up = await query('UPDATE party_teams SET pontos = pontos + $3 WHERE id = $1 AND ano = $2', [toInt(body.team_id, 'time'), ano, delta]);
    if (!up.rowCount) throw new HttpError(404, 'Time não encontrado.');
    const ativo = await ativoDe(ano);
    if (ativo?.jogo === 'times') await tocarAtivo(ano);
  } else if (acao === 'mimica_iniciar') {
    await iniciarMimica(ano, body);
  } else if (acao === 'bebe_criar') {
    if (!isBlobUrl(body.foto_url)) throw new HttpError(400, 'Envie a foto pelo botão de foto.');
    const quem = toInt(body.resposta_user_id, 'resposta');
    const existe = await query('SELECT 1 FROM family_users WHERE id = $1', [quem]);
    if (!existe.rows.length) throw new HttpError(400, 'Pessoa inválida.');
    const nova = await query<{ id: string }>(
      'INSERT INTO party_bebe (ano, foto_url, resposta_user_id) VALUES ($1, $2, $3) RETURNING id', [ano, body.foto_url, quem]);
    await marcarAtivo(ano, 'bebe', Number(nova.rows[0].id));
  } else if (acao === 'bebe_revelar') {
    const up = await query("UPDATE party_bebe SET status = 'revelada', revelada_em = NOW() WHERE id = $1 AND ano = $2", [toInt(body.bebe_id, 'bebê'), ano]);
    if (!up.rowCount) throw new HttpError(404, 'Rodada não encontrada.');
    await tocarAtivo(ano);
  } else if (acao === 'roleta_iniciar') {
    const nova = await query<{ id: string }>('INSERT INTO party_roleta (ano, itens) VALUES ($1, $2::jsonb) RETURNING id', [ano, JSON.stringify(await lerPrendas())]);
    await marcarAtivo(ano, 'roleta', Number(nova.rows[0].id));
  } else if (acao === 'roleta_girar') {
    let ativo = await ativoDe(ano);
    if (ativo?.jogo !== 'roleta' || !ativo.ref_id) {
      const nova = await query<{ id: string }>('INSERT INTO party_roleta (ano, itens) VALUES ($1, $2::jsonb) RETURNING id', [ano, JSON.stringify(await lerPrendas())]);
      await marcarAtivo(ano, 'roleta', Number(nova.rows[0].id));
      ativo = await ativoDe(ano);
    }
    const roletaId = ativo?.ref_id;
    if (!roletaId) throw new HttpError(500, 'Não foi possível abrir a roleta.');
    const presentes = await listarPresentes();
    if (presentes.length < 2) throw new HttpError(400, 'Precisa de pelo menos 2 pessoas na roda.');
    const roda = embaralhar(presentes).slice(0, MAX_NA_RODA);
    const anterior = await query<{ sorteado_user_id: number | null }>('SELECT sorteado_user_id FROM party_roleta WHERE id = $1', [roletaId]);
    let sorteado = sortear(roda);
    if (sorteado.id === anterior.rows[0]?.sorteado_user_id) sorteado = sortear(roda);
    const prendas = await lerPrendas();
    await query(
      `UPDATE party_roleta SET itens = $2::jsonb, participantes = $3::jsonb, sorteado_user_id = $4, prenda = $5, girado_em = NOW() WHERE id = $1`,
      [roletaId, JSON.stringify(prendas), JSON.stringify(roda.map((p) => p.id)), sorteado.id, sortear(prendas)]);
    await tocarAtivo(ano);
  } else if (acao === 'prendas_salvar') {
    const bruto = Array.isArray(body.prendas) ? body.prendas : [];
    if (bruto.length === 0) {
      await query('DELETE FROM app_settings WHERE key = $1', [CHAVE_PRENDAS]);
    } else {
      if (bruto.length > 40) throw new HttpError(400, 'No máximo 40 prendas.');
      const lista = [...new Set(bruto.map((p, i) => cleanText(p, `Prenda ${i + 1}`, PRENDA_MAX)))];
      if (lista.length < 3) throw new HttpError(400, 'Informe pelo menos 3 prendas.');
      await query(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [CHAVE_PRENDAS, JSON.stringify(lista)]);
    }
  } else if (acao === 'encerrar') {
    await query("UPDATE party_mimica SET status = 'tempo', encerrado_em = NOW() WHERE ano = $1 AND status = 'jogando'", [ano]);
    await query('DELETE FROM party_jogo_ativo WHERE ano = $1', [ano]);
  } else {
    throw new HttpError(400, 'Ação desconhecida.');
  }

  limparCacheTelao();
  return ok(await carregarPainel(admin));
});
