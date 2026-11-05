import { query } from '@/app/lib/db';
import { HttpError, requireUser, route } from '@/app/lib/api';
import { pdfBoleto } from '@/app/lib/c6';

// GET /api/pagamento/pdf -> PDF do meu boleto em aberto (só o dono baixa).
export const GET = route(async () => {
  const me = await requireUser();
  const { rows } = await query(
    `SELECT reference FROM payments WHERE participant_id = $1 AND user_id = $2
      ORDER BY created_at DESC LIMIT 1`,
    [me.participant_id, me.id],
  );
  if (!rows[0]) throw new HttpError(404, 'Nenhum boleto gerado ainda.');
  const pdf = await pdfBoleto(rows[0].reference);
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="boleto-vaquinha-natal.pdf"',
      'Cache-Control': 'private, no-store',
    },
  });
});
