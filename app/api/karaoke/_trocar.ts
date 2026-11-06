import { HttpError } from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import { lerFaixa } from './_lrclib';
import { buscarTermo, juntarVideos, melhorKaraoke, ordenarPorDuracao, TOLERANCIA_DURACAO_S, type VideoKaraoke } from './_youtube';

// Troca automática de vídeo quando o YouTube não deixa tocar embutido (erros 100, 101, 150 e 153 do IFrame).

/** Erros em que o vídeo nunca vai tocar no telão: o id entra na lista de bloqueados para sempre. */
export const CODIGOS_BLOQUEIO = [100, 101, 150, 153];
export const MAX_CANDIDATOS = 8;
const VIDEO_ID = /^[\w-]{11}$/;

/** Ids que já deram erro de embed (qualquer escolha futura ignora). */
export async function listarBloqueados(): Promise<Set<string>> {
  const { rows } = await query<{ video_id: string }>('SELECT video_id FROM karaoke_videos_bloqueados LIMIT 5000');
  return new Set(rows.map((r) => r.video_id));
}

/** Aceita só candidatos bem formados vindos do cliente (ou do banco) e limita a lista. */
export function candidatosValidos(valor: unknown): VideoKaraoke[] {
  if (!Array.isArray(valor)) return [];
  const saida: VideoKaraoke[] = [];
  for (const v of valor as Partial<VideoKaraoke>[]) {
    if (!v || typeof v.video_id !== 'string' || !VIDEO_ID.test(v.video_id)) continue;
    const dur = Number(v.duracao_s);
    saida.push({
      video_id: v.video_id,
      titulo: String(v.titulo ?? '').slice(0, 200),
      canal: String(v.canal ?? '').slice(0, 120),
      duracao_s: Number.isFinite(dur) && dur > 0 && dur <= 3 * 3600 ? Math.round(dur) : null,
      miniatura: `https://i.ytimg.com/vi/${v.video_id}/mqdefault.jpg`,
    });
    if (saida.length >= MAX_CANDIDATOS) break;
  }
  return saida;
}

async function buscarVarios(termos: string[]): Promise<VideoKaraoke[]> {
  const r = await Promise.allSettled(termos.map((t) => buscarTermo(t)));
  const ok = r.flatMap((b) => (b.status === 'fulfilled' ? [b.value] : []));
  if (!ok.length) {
    console.error('[karaoke] youtube (troca):', r.map((b) => (b.status === 'rejected' ? b.reason : null)).find(Boolean));
    throw new HttpError(502, 'Não consegui buscar outra versão no YouTube agora.');
  }
  return juntarVideos(ok);
}

interface LinhaTroca {
  video_id: string;
  titulo: string;
  modo: 'letra' | 'video';
  lrclib_id: number | string | null;
  faixa: string | null;
  artista: string | null;
  candidatos: unknown;
  videos_falhos: string[] | null;
  status: string;
}

interface Proximo { video: VideoKaraoke; resto: VideoKaraoke[]; modo: 'letra' | 'video' }

async function proximoVideo(it: LinhaTroca, fora: Set<string>): Promise<Proximo | null> {
  const modoLetra = it.modo === 'letra';
  let faixaLrc = null;
  if (modoLetra && it.lrclib_id != null) {
    try { faixaLrc = await lerFaixa(Number(it.lrclib_id)); } catch { /* sem a duração, vale a lista guardada */ }
  }
  const durLrc = faixaLrc?.duracao_s ?? null;
  const livres = (vs: readonly VideoKaraoke[]) => vs.filter((v) => !fora.has(v.video_id));
  const compativel = (v: VideoKaraoke) => !modoLetra || !durLrc || (v.duracao_s !== null && Math.abs(v.duracao_s - durLrc) <= TOLERANCIA_DURACAO_S);

  const guardados = livres(candidatosValidos(it.candidatos)).filter(compativel);
  if (guardados.length) return { video: guardados[0], resto: guardados.slice(1), modo: it.modo };

  const nome = it.faixa ?? faixaLrc?.faixa ?? it.titulo;
  const artista = it.artista ?? faixaLrc?.artista ?? '';
  const base = `${nome} ${artista}`.trim();
  if (modoLetra && durLrc) {
    const extras = await buscarVarios([`${artista} ${nome} karaoke versão`.trim(), `${nome} playback com letra`]);
    const ordenados = livres(ordenarPorDuracao(extras, durLrc));
    if (ordenados.length) return { video: ordenados[0], resto: ordenados.slice(1, MAX_CANDIDATOS), modo: 'letra' };
  }
  // Sem versão compatível com a letra (ou já era vídeo): o melhor vídeo de karaokê que ainda não falhou.
  const achados = livres(await buscarVarios([`${base} karaokê`, ...(modoLetra ? [] : [`${nome} playback com letra`])]));
  const melhor = melhorKaraoke(achados);
  if (!melhor) return null;
  return { video: melhor, resto: achados.filter((v) => v.video_id !== melhor.video_id).slice(0, MAX_CANDIDATOS - 1), modo: 'video' };
}

/**
 * O vídeo da fila falhou no telão: marca como falho e bloqueado e põe o próximo candidato no lugar.
 * Idempotente: se o vídeo atual da fila já não é o falho (outra chamada trocou antes), só registra o bloqueio.
 * Lança 404 quando não há mais nenhuma versão (o telão então pula a música).
 */
export async function trocarVideo(ano: number, id: number, falho: string, codigo: number): Promise<void> {
  if (!VIDEO_ID.test(falho)) throw new HttpError(400, 'Vídeo inválido.');
  if (!CODIGOS_BLOQUEIO.includes(codigo)) throw new HttpError(400, 'Código de erro inválido.');
  const { rows } = await query<LinhaTroca>(
    `SELECT video_id, titulo, modo, lrclib_id, faixa, artista, candidatos, videos_falhos, status
       FROM karaoke_fila WHERE id = $1 AND ano = $2`,
    [id, ano],
  );
  if (!rows.length) throw new HttpError(404, 'Música não encontrada.');
  const it = rows[0];
  await query(
    `INSERT INTO karaoke_videos_bloqueados (video_id, codigo) VALUES ($1, $2)
     ON CONFLICT (video_id) DO UPDATE SET codigo = EXCLUDED.codigo`,
    [falho, codigo],
  );
  if (it.video_id !== falho || (it.status !== 'fila' && it.status !== 'cantando')) return;

  const falhos = [...new Set([...(it.videos_falhos ?? []), falho])];
  const fora = new Set([...falhos, ...(await listarBloqueados())]);
  const prox = await proximoVideo(it, fora);
  if (!prox) throw new HttpError(404, 'Não achei outra versão desse vídeo.');

  await transaction(async (q) => {
    await q('SELECT pg_advisory_xact_lock(hashtext($1))', [`karaoke:${ano}`]);
    const { rows: aj } = await q<{ offset_ms: number }>('SELECT offset_ms FROM karaoke_ajustes WHERE video_id = $1', [prox.video.video_id]);
    const offset = prox.modo === 'letra' ? (aj[0]?.offset_ms ?? 0) : 0;
    // Vídeo colado pelo link (sem faixa): o título acompanha o vídeo novo. Com faixa, o título é o da música.
    const titulo = it.faixa ? it.titulo : (prox.video.titulo || it.titulo).slice(0, 200);
    await q(
      `UPDATE karaoke_fila
          SET video_id = $1, titulo = $2, canal = $3, duracao_s = COALESCE($4, duracao_s), miniatura = $5,
              videos_falhos = $6::text[], candidatos = $7::jsonb, modo = $8, offset_ms = $9,
              letra = CASE WHEN $8 = 'letra' THEN letra ELSE NULL END
        WHERE id = $10 AND ano = $11 AND video_id = $12`,
      [prox.video.video_id, titulo, prox.video.canal.slice(0, 120), prox.video.duracao_s, prox.video.miniatura, falhos, JSON.stringify(prox.resto), prox.modo, offset, id, ano, falho],
    );
  });
}
