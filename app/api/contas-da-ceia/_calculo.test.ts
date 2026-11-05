import assert from 'node:assert/strict';
import test from 'node:test';
import { calcularContas } from './_calculo';

test('divide R$ 100,01 entre três pessoas sem perder centavos', () => {
  const resultado = calcularContas([1, 2, 3], [{ user_id: 1, valor_centavos: 10001, partes: [3, 1, 2] }], []);
  assert.deepEqual([...resultado.saldos], [[1, 6667], [2, -3334], [3, -3333]]);
  assert.deepEqual(resultado.transferencias, [
    { de_user_id: 2, para_user_id: 1, valor_centavos: 3334 },
    { de_user_id: 3, para_user_id: 1, valor_centavos: 3333 },
  ]);
});

test('um centavo entre três pessoas continua sendo um centavo', () => {
  const resultado = calcularContas([1, 2, 3], [{ user_id: 3, valor_centavos: 1, partes: [3, 2, 1] }], []);
  assert.deepEqual([...resultado.saldos], [[1, -1], [2, 0], [3, 1]]);
  assert.equal(resultado.transferencias.length, 1);
});

test('pagador fora do rateio recebe o total e acertos confirmados zeram a dívida', () => {
  const despesas = [{ user_id: 1, valor_centavos: 701, partes: [2, 3] }];
  const antes = calcularContas([1, 2, 3], despesas, []);
  assert.equal(antes.saldos.get(1), 701);
  const depois = calcularContas([1, 2, 3], despesas, antes.transferencias);
  assert.ok([...depois.saldos.values()].every(v => v === 0));
  assert.deepEqual(depois.transferencias, []);
});

test('excluir despesa após recebimento conserva o saldo e sugere devolver o acerto', () => {
  const resultado = calcularContas([1, 2], [], [{ de_user_id: 2, para_user_id: 1, valor_centavos: 123 }]);
  assert.deepEqual(resultado.transferencias, [{ de_user_id: 1, para_user_id: 2, valor_centavos: 123 }]);
});

test('mil cenários conservam dinheiro, zeram após acertos e limitam transferências', () => {
  let seed = 15015;
  const random = (max: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
  for (let i = 0; i < 1000; i++) {
    const ids = Array.from({ length: 2 + random(18) }, (_, index) => index + 1);
    const despesas = Array.from({ length: 1 + random(20) }, () => ({
      user_id: ids[random(ids.length)], valor_centavos: 1 + random(100000000),
      partes: ids.filter(() => random(2) === 0),
    })).map(d => ({ ...d, partes: d.partes.length ? d.partes : [ids[0]] }));
    const antes = calcularContas(ids, despesas, []);
    assert.equal([...antes.saldos.values()].reduce((s, v) => s + v, 0), 0);
    assert.ok([...antes.saldos.values()].every(Number.isSafeInteger));
    const ativos = [...antes.saldos.values()].filter(Boolean).length;
    assert.ok(antes.transferencias.length <= Math.max(0, ativos - 1));
    assert.ok(antes.transferencias.every(t => Number.isSafeInteger(t.valor_centavos) && t.valor_centavos > 0 && t.de_user_id !== t.para_user_id));
    const depois = calcularContas(ids, despesas, antes.transferencias);
    assert.ok([...depois.saldos.values()].every(v => v === 0));
    assert.equal(depois.transferencias.length, 0);
    const reordenadas = despesas.map(d => ({ ...d, partes: [...d.partes].reverse() }));
    assert.deepEqual(calcularContas(ids, reordenadas, []).transferencias, antes.transferencias);
  }
});
