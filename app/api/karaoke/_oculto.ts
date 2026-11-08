import type { query } from '@/app/lib/db';
import { rankingEscondido } from '@/app/telao/karaoke/prova';

/**
 * A família não pode ver notas da Prova (fila livre, ranking da noite, placar) entre ranking_oculto_em e revelado_em
 * (gami_config; sem linha vale 24/12 22h de São Paulo menos 48 h). Admin vê sempre.
 */
export async function ocultarNotasDaProva(q: typeof query, ano: number, admin: boolean): Promise<boolean> {
  if (admin) return false;
  try {
    const { rows } = await q<{ ranking_oculto_em: Date | null; revelado_em: Date | null }>('SELECT ranking_oculto_em, revelado_em FROM gami_config WHERE ano = $1', [ano]);
    return rankingEscondido(Date.now(), rows[0]?.ranking_oculto_em, rows[0]?.revelado_em, ano);
  } catch (erro) {
    // Sem a tabela da gamificação, vale a janela padrão.
    if (typeof erro === 'object' && erro && 'code' in erro && (erro.code === '42P01' || erro.code === '42703')) return rankingEscondido(Date.now(), null, null, ano);
    throw erro;
  }
}
