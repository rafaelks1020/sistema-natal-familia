import type { AcertoCeia, DespesaCeia, Transferencia } from './_types';

// A ordem por id torna a distribuição dos centavos restantes estável.
export function calcularContas(ids: number[], despesas: Pick<DespesaCeia, 'user_id' | 'valor_centavos' | 'partes'>[], acertos: Pick<AcertoCeia, 'de_user_id' | 'para_user_id' | 'valor_centavos'>[]) {
  const saldos = new Map(ids.map(id => [id, 0]));
  const somar = (id: number, valor: number) => saldos.set(id, (saldos.get(id) ?? 0) + valor);
  for (const despesa of despesas) {
    const partes = [...new Set(despesa.partes)].sort((a, b) => a - b);
    // Exclusão de uma conta pode remover sua participação. Sem partes, não há rateio.
    if (!partes.length) continue;
    somar(despesa.user_id, despesa.valor_centavos);
    const cota = Math.floor(despesa.valor_centavos / partes.length);
    const resto = despesa.valor_centavos % partes.length;
    partes.forEach((id, index) => somar(id, -(cota + (index < resto ? 1 : 0))));
  }
  for (const acerto of acertos) {
    somar(acerto.de_user_id, acerto.valor_centavos);
    somar(acerto.para_user_id, -acerto.valor_centavos);
  }
  const ordenar = (a: { id: number; valor: number }, b: { id: number; valor: number }) => b.valor - a.valor || a.id - b.id;
  const credores = [...saldos].filter(([, v]) => v > 0).map(([id, valor]) => ({ id, valor })).sort(ordenar);
  const devedores = [...saldos].filter(([, v]) => v < 0).map(([id, valor]) => ({ id, valor: -valor })).sort(ordenar);
  const transferencias: Transferencia[] = [];
  let c = 0, d = 0;
  while (c < credores.length && d < devedores.length) {
    const valor = Math.min(credores[c].valor, devedores[d].valor);
    transferencias.push({ de_user_id: devedores[d].id, para_user_id: credores[c].id, valor_centavos: valor });
    credores[c].valor -= valor; devedores[d].valor -= valor;
    if (!credores[c].valor) c++;
    if (!devedores[d].valor) d++;
  }
  return { saldos, transferencias };
}
