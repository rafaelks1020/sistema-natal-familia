import { query, transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { calcularContas } from './_calculo';
import type { AcertoCeia, ContasData, DenunciaCeia, DespesaCeia, PessoaCeia } from './_types';

export async function lerContas(q: typeof query, userId: number, ano: number, admin = false): Promise<ContasData> {
  const { rows: pessoas } = await q<PessoaCeia>(`SELECT u.id, u.name, u.pix_key,
    EXISTS (SELECT 1 FROM family_attendance a JOIN participants p ON p.id = a.participant_id
      WHERE (p.user_id = u.id OR a.user_id = u.id) AND a.status = 'yes') AS confirmou
    FROM family_users u ORDER BY u.id`);
  const { rows: despesas } = await q<DespesaCeia>(`SELECT d.id, d.user_id, d.descricao, d.valor_centavos, d.comprovante_url,
    d.created_at, COALESCE((SELECT array_agg(p.user_id ORDER BY p.user_id)
      FROM ceia_despesa_partes p WHERE p.despesa_id = d.id), ARRAY[]::int[]) AS partes
    FROM ceia_despesas d WHERE d.ano = $1 ORDER BY d.created_at DESC, d.id DESC`, [ano]);
  const { rows: acertos } = await q<AcertoCeia>(`SELECT id, de_user_id, para_user_id, valor_centavos, confirmado_em
    FROM ceia_acertos WHERE ano = $1 ORDER BY confirmado_em DESC, id DESC`, [ano]);
  const { rows: bloqueios } = await q<{ blocked_id: number }>('SELECT blocked_id FROM user_blocks WHERE blocker_id = $1', [userId]);
  const bloqueados = new Set(bloqueios.map(b => b.blocked_id));
  const denuncias = admin ? (await q<DenunciaCeia>(`SELECT r.id, r.alvo_id, r.autor_id, r.trecho, r.motivo FROM content_reports r
    JOIN ceia_despesas d ON d.id = r.alvo_id WHERE r.alvo_tipo = 'ceia_despesa' AND r.resolved_at IS NULL AND d.ano = $1
    ORDER BY r.created_at, r.id`, [ano])).rows : [];
  const { saldos, transferencias } = calcularContas(pessoas.map(p => p.id), despesas, acertos);
  return {
    ano, denuncias, pessoas: pessoas.map(p => ({ ...p, saldo_centavos: saldos.get(p.id) ?? 0 })),
    // O rateio inclui todas as despesas; só o conteúdo do autor bloqueado fica oculto.
    despesas: despesas.filter(d => !bloqueados.has(d.user_id)).map(d => ({ ...d, created_at: new Date(d.created_at).toISOString() })),
    acertos: acertos.map(a => ({ ...a, confirmado_em: new Date(a.confirmado_em).toISOString() })), transferencias,
    minha_chave: pessoas.find(p => p.id === userId)?.pix_key ?? '',
    total_centavos: despesas.reduce((s, d) => s + d.valor_centavos, 0),
  };
}
export async function getContas(userId: number, admin = false) {
  return transaction(async q => {
    await q('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    return lerContas(q, userId, edicaoAtual(), admin);
  });
}

// Todos os lançamentos da edição usam a mesma trava, inclusive confirmação e exclusão.
export async function travarContas(q: typeof query, ano: number) {
  await q('SELECT pg_advisory_xact_lock($1::int, $2::int)', [15015, ano]);
}
