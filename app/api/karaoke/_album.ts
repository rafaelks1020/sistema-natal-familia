import { query } from '@/app/lib/db';
import { hojeSP } from '@/app/lib/edicao';

// Publicação de uma foto do karaokê no álbum da família (album_photos). Usada por /api/karaoke/foto e /api/karaoke/momentos.

export interface FilaParaAlbum {
  ano: number;
  titulo: string;
  faixa: string | null;
  nome: string;
  dueto_nome: string | null;
  nota: number | null;
}

/** "Maria e João cantando Então é Natal no karaokê, nota 87". */
export function legendaDoKaraoke(fila: FilaParaAlbum, nota: number | null): string {
  const quem = fila.dueto_nome ? `${fila.nome} e ${fila.dueto_nome}` : fila.nome;
  const musica = (fila.faixa || fila.titulo).slice(0, 200);
  return `${quem} cantando ${musica} no karaokê${nota !== null ? `, nota ${nota}` : ''}`.slice(0, 500);
}

/** Dados da música (com a nota, se já gravada) para a legenda. */
export async function lerFilaParaAlbum(filaId: number): Promise<FilaParaAlbum | null> {
  const { rows } = await query<FilaParaAlbum>(
    `SELECT f.ano, f.titulo, f.faixa, u.name AS nome, d.name AS dueto_nome, n.nota
       FROM karaoke_fila f
       JOIN family_users u ON u.id = f.user_id
       LEFT JOIN family_users d ON d.id = f.dueto_user_id
       LEFT JOIN karaoke_notas n ON n.fila_id = f.id
      WHERE f.id = $1`,
    [filaId],
  );
  return rows[0] ?? null;
}

/** Cria a foto no álbum. A data precisa cair no ano da edição (CHECK da tabela); em janeiro/fevereiro usa 25/12 da edição. */
export async function publicarNoAlbum(fila: FilaParaAlbum, autorId: number, filaId: number, url: string, nota: number | null): Promise<void> {
  const hoje = hojeSP();
  const tiradaEm = Number(hoje.slice(0, 4)) === fila.ano ? hoje : `${fila.ano}-12-25`;
  await query(
    `INSERT INTO album_photos(ano, user_id, image_url, caption, taken_on, client_key) VALUES($1,$2,$3,$4,$5,$6)`,
    [fila.ano, autorId, url, legendaDoKaraoke(fila, nota), tiradaEm, `karaoke-${filaId}-${Date.now()}`],
  );
}
