import { query, transaction } from '@/app/lib/db';
import { HttpError, cleanText, ok, readJson, requireUser, route } from '@/app/lib/api';
import { c6Configurado, cpfValido, diaSP, emitirBolePix, ErroC6, novaReferencia } from '@/app/lib/c6';
import { atualizarPagamento, FINAIS, PaymentRow } from '@/app/lib/pagamentos';

// GET  /api/pagamento -> situação do meu pagamento da vaquinha (consulta o C6 se estiver em aberto)
// POST /api/pagamento { cpf, cep, logradouro, numero, bairro, cidade, uf } -> gera o Pix (BolePIX)

const CONSULTA_MIN_SEG = 15;

async function valorContribuicao(): Promise<number> {
  const { rows } = await query(`SELECT value FROM app_settings WHERE key = 'contribution_value'`);
  const v = Number(rows[0]?.value);
  // Sempre 2 casas: o mesmo valor vai ao C6, ao banco e à conferência da baixa.
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 0;
}

function publico(p: PaymentRow | undefined) {
  if (!p) return null;
  return {
    reference: p.reference,
    amount: Number(p.amount),
    status: p.status,
    paid: p.status === 'PAID',
    pix_copia_cola: p.pix_copia_cola,
    linha_digitavel: p.linha_digitavel,
    // DATE chega como Date à meia-noite local; os 10 primeiros caracteres são o dia certo em UTC ou -03.
    due_date: p.due_date ? new Date(p.due_date).toISOString().slice(0, 10) : null,
    created_at: p.created_at,
    paid_at: p.paid_at,
  };
}

function mascaraCpf(cpf: string | null): string | null {
  return cpf ? `***.${cpf.slice(3, 6)}.***-${cpf.slice(9)}` : null;
}

export const GET = route(async () => {
  const me = await requireUser();
  if (!me.participant_id) throw new HttpError(400, 'Seu acesso ainda não está ligado a um participante.');

  const [{ rows: part }, { rows: pays }, { rows: billing }, valor, { rows: substituidos }] = await Promise.all([
    query('SELECT paid, paid_date FROM participants WHERE id = $1', [me.participant_id]),
    query<PaymentRow & { recente: boolean }>(
      `SELECT *, COALESCE(checked_at > NOW() - make_interval(secs => $2), false) AS recente
         FROM payments WHERE participant_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [me.participant_id, CONSULTA_MIN_SEG],
    ),
    query('SELECT billing_cpf, billing_address FROM family_users WHERE id = $1', [me.id]),
    valorContribuicao(),
    query<PaymentRow>(
      `SELECT * FROM payments WHERE participant_id = $1 AND status = 'SUBSTITUIDO'
        AND created_at >= NOW() - INTERVAL '5 days'
        AND (checked_at IS NULL OR checked_at <= NOW() - INTERVAL '60 seconds')`,
      [me.participant_id],
    ),
  ]);

  let pay: PaymentRow | undefined = pays[0];
  if (pay && !FINAIS.has(pay.status) && !pays[0].recente && c6Configurado()) {
    pay = await atualizarPagamento(pay).catch((e) => {
      console.error('[pagamento] consulta C6:', (e as Error).message);
      return pay;
    });
  }

  let substituidoPago = false;
  if (c6Configurado()) {
    for (const antigo of substituidos) {
      if (antigo.id === pay?.id) continue;
      const atualizado = await atualizarPagamento(antigo).catch((e) => {
        console.error('[pagamento] consulta C6 substituído:', (e as Error).message);
        return antigo;
      });
      if (atualizado.status === 'PAID') substituidoPago = true;
      if (pay?.id === atualizado.id) pay = atualizado;
    }
  }

  return ok({
    enabled: c6Configurado(),
    amount: valor,
    participant_paid: substituidoPago || pay?.status === 'PAID' || Boolean(part[0]?.paid),
    paid_date: part[0]?.paid_date ?? null,
    payment: publico(pay),
    billing: {
      cpf_masked: mascaraCpf(billing[0]?.billing_cpf ?? null),
      has_cpf: Boolean(billing[0]?.billing_cpf),
      address: billing[0]?.billing_address ?? null,
    },
  });
});

export const POST = route(async (req) => {
  const me = await requireUser();
  const participantId = me.participant_id;
  if (!participantId) throw new HttpError(400, 'Seu acesso ainda não está ligado a um participante.');
  if (!c6Configurado()) throw new HttpError(503, 'Pagamento pelo app ainda não está ligado.');

  const minimo = await valorContribuicao();
  if (minimo <= 0) throw new HttpError(400, 'O valor da contribuição ainda não foi definido.');

  // 1) Valida tudo antes de tocar no banco ou no C6.
  const body = await readJson<Record<string, unknown>>(req);
  // A pessoa escolhe quanto dar, a partir do mínimo da contribuição.
  const pedido = body.valor === undefined || body.valor === null || body.valor === ''
    ? minimo
    : Number(String(body.valor).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  if (!Number.isFinite(pedido)) throw new HttpError(400, 'Valor inválido.');
  const valor = Math.round(pedido * 100) / 100;
  if (valor < minimo) throw new HttpError(400, `O valor mínimo é ${minimo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`);
  if (valor > 5000) throw new HttpError(400, 'Para valores acima de R$ 5.000,00, combine com quem organiza.');
  const { rows: salvo } = await query('SELECT billing_cpf FROM family_users WHERE id = $1', [me.id]);
  const cpfInformado = typeof body.cpf === 'string' && body.cpf.trim() ? body.cpf : null;
  const cpf = cpfInformado ? cpfValido(cpfInformado) : salvo[0]?.billing_cpf ?? null;
  if (!cpf) throw new HttpError(400, 'CPF inválido. Confira os números.');

  const cep = String(body.cep ?? '').replace(/\D/g, '');
  if (!/^\d{8}$/.test(cep)) throw new HttpError(400, 'CEP precisa ter 8 números.');
  const uf = cleanText(body.uf, 'o estado (UF)', 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(uf)) throw new HttpError(400, 'Estado (UF) com 2 letras.');
  const numero = cleanText(body.numero, 'o número', 10);
  const rua = cleanText(body.logradouro, 'a rua', 60);
  const logradouro = `${rua}, ${numero}`;
  if (logradouro.length > 40) throw new HttpError(400, 'Rua e número passam de 40 caracteres: abrevie (ex.: "R." ou "Av.").');
  const endereco = {
    logradouro,
    bairro: cleanText(body.bairro, 'o bairro', 40),
    cidade: cleanText(body.cidade, 'a cidade', 40),
    uf,
    cep,
  };

  // 2) Trava por participante: dois cliques ou duas abas esperam um ao outro e o segundo
  //    reaproveita o Pix do primeiro. Nunca saem dois Pix em aberto para a mesma pessoa.
  return transaction(async (q) => {
    await q('SELECT pg_advisory_xact_lock(7212, $1)', [participantId]);

    const { rows: part } = await q('SELECT paid FROM participants WHERE id = $1', [participantId]);
    if (part[0]?.paid) throw new HttpError(409, 'Sua contribuição já está paga. Obrigado!');

    const { rows: abertos } = await q<PaymentRow>(
      `SELECT * FROM payments
        WHERE participant_id = $1 AND status NOT IN ('PAID','CANCELED','CANCELLED','EXPIRED','SUBSTITUIDO')
          AND amount = $2 AND due_date >= $3::date
        ORDER BY created_at DESC LIMIT 1`,
      [participantId, valor, diaSP(0)],
    );
    if (abertos[0]) return ok({ payment: publico(abertos[0]), reused: true });

    // Mudou o valor: o Pix anterior em aberto fica marcado como substituído aqui. No banco ele
    // continua pagável; se alguém pagar mesmo assim, a conciliação baixa normalmente.
    await q(
      `UPDATE payments SET status = 'SUBSTITUIDO'
        WHERE participant_id = $1 AND status NOT IN ('PAID','CANCELED','CANCELLED','EXPIRED','SUBSTITUIDO')`,
      [participantId],
    );

    const referencia = novaReferencia();
    const vencimento = diaSP(3);
    let boleto;
    try {
      boleto = await emitirBolePix({
        referencia,
        valor,
        vencimento,
        descricao: 'Vaquinha Natal em Familia',
        pagador: { nome: me.name, cpf, endereco },
      });
    } catch (e) {
      console.error('[pagamento] emissão C6:', (e as Error).message);
      if (e instanceof ErroC6 && e.status >= 400 && e.status < 500) {
        throw new HttpError(400, 'O banco recusou os dados. Confira CPF e endereço e tente de novo.');
      }
      throw new HttpError(502, 'O banco não respondeu agora. Tente de novo em instantes.');
    }

    await q('UPDATE family_users SET billing_cpf = $2, billing_address = $3 WHERE id = $1', [
      me.id,
      cpf,
      JSON.stringify({ ...endereco, logradouro: rua, numero }),
    ]);
    const { rows } = await q<PaymentRow>(
      `INSERT INTO payments (participant_id, user_id, reference, amount, status, pix_copia_cola, linha_digitavel, due_date, checked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING *`,
      [participantId, me.id, boleto.referencia || referencia, valor, boleto.status, boleto.pixCopiaCola, boleto.linhaDigitavel, vencimento],
    );
    return ok({ payment: publico(rows[0]), reused: false }, 201);
  });
});
