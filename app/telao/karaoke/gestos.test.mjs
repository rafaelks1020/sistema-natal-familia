import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Executar: node --test app/telao/karaoke/gestos.test.mjs. Sem navegador.
function carregar(nome) {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), nome);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', js)(mod, mod.exports);
  return mod.exports;
}
const { bracosAcimaDaCabeca, DetectorGestos, ControleEstrela, ESTRELA_SEGURAR_MS } = carregar('gestos.ts');

const pt = (x, y, v = 0.9) => ({ x, y, v });
/** Pessoa de pé: nariz em (0.5, 0.3), ombros em y 0.45. pulsos: [E, D]. */
const pessoa = (pulsoE, pulsoD, cx = 0.5) => ({ nariz: pt(cx, 0.3), ombroE: pt(cx - 0.1, 0.45), ombroD: pt(cx + 0.1, 0.45), pulsoE, pulsoD });
const baixos = (cx = 0.5) => pessoa(pt(cx - 0.12, 0.8), pt(cx + 0.12, 0.8), cx);
const parabens = (cx = 0.5) => pessoa(pt(cx - 0.12, 0.1), pt(cx + 0.12, 0.1), cx);

test('braços acima da cabeça: os dois pulsos acima do topo da cabeça', () => {
  assert.equal(bracosAcimaDaCabeca(parabens()), true);
  assert.equal(bracosAcimaDaCabeca(baixos()), false);
  assert.equal(bracosAcimaDaCabeca(pessoa(pt(0.38, 0.1), pt(0.62, 0.8))), false, 'só um braço');
  assert.equal(bracosAcimaDaCabeca(pessoa(pt(0.38, 0.1), pt(0.62, 0.1, 0.2))), false, 'pulso pouco visível');
  assert.equal(bracosAcimaDaCabeca(pessoa(pt(0.38, 0.29), pt(0.62, 0.29))), false, 'na altura do nariz não vale');
});

test('modo estrela: precisa segurar 0,5 s, dispara uma vez e só de novo depois de baixar os braços', () => {
  const d = new DetectorGestos();
  let t = 0;
  const passo = (p) => { const e = d.atualizar(t, p ? [p] : []); t += 100; return e; };
  assert.deepEqual(passo(baixos()), []);
  const disparos = [];
  for (let i = 0; i < 12; i++) disparos.push(...passo(parabens()));
  assert.deepEqual(disparos, ['estrela']);
  // baixou e levantou de novo
  for (let i = 0; i < 5; i++) passo(baixos());
  const de_novo = [];
  for (let i = 0; i < 12; i++) de_novo.push(...passo(parabens()));
  assert.deepEqual(de_novo, ['estrela']);
});

test('modo estrela: menos de 0,5 s não dispara; uma falha curta da detecção não zera a contagem', () => {
  const d = new DetectorGestos();
  let t = 0;
  const e1 = [];
  for (let i = 0; i < 4; i++) { e1.push(...d.atualizar(t, [parabens()])); t += 100; } // 0, 100, 200, 300
  assert.deepEqual(e1, []);
  for (let i = 0; i < 3; i++) { d.atualizar(t, [baixos()]); t += 100; } // baixou por 300 ms: zera
  const e2 = [];
  for (let i = 0; i < 4; i++) { e2.push(...d.atualizar(t, [parabens()])); t += 100; }
  assert.deepEqual(e2, [], 'recomeçou a contar');
  // falha de 1 quadro (sem pessoa) durante o gesto: segue contando
  const d2 = new DetectorGestos();
  const e3 = [];
  d2.atualizar(0, [parabens()]);
  d2.atualizar(100, [parabens()]);
  d2.atualizar(200, []);
  for (let tt = 300; tt <= 800; tt += 100) e3.push(...d2.atualizar(tt, [parabens()]));
  assert.deepEqual(e3, ['estrela']);
  assert.ok(ESTRELA_SEGURAR_MS === 500);
});

/** Pessoa acenando com o pulso direito: x oscila em torno de 0.65, acima do ombro. */
const acenando = (x, y = 0.3) => pessoa(pt(0.38, 0.8), pt(x, y));

test('acenar: pulso acima do ombro indo e voltando 3 vezes chama o gesto', () => {
  const d = new DetectorGestos();
  const eventos = [];
  // ida e volta (10 quadros por segundo): 3 ciclos completos de 0,4 s com 0,10 de curso.
  for (let i = 0; i <= 14; i++) {
    const x = 0.65 + 0.05 * Math.sin((i * 2 * Math.PI) / 4);
    eventos.push(...d.atualizar(i * 100, [acenando(x)]));
  }
  assert.deepEqual(eventos, ['aceno']);
});

test('acenar: sem ir e voltar, abaixo do ombro, ou com tremor pequeno, não vale', () => {
  // mão parada acima do ombro
  let d = new DetectorGestos();
  let ev = [];
  for (let i = 0; i < 40; i++) ev.push(...d.atualizar(i * 100, [acenando(0.65)]));
  assert.deepEqual(ev, []);
  // tremor de 0,01 (menor que o curso mínimo)
  d = new DetectorGestos(); ev = [];
  for (let i = 0; i < 40; i++) ev.push(...d.atualizar(i * 100, [acenando(0.65 + (i % 2 ? 0.005 : -0.005))]));
  assert.deepEqual(ev, []);
  // oscilando, mas com o pulso abaixo do ombro (y 0.8 > ombro 0.45)
  d = new DetectorGestos(); ev = [];
  for (let i = 0; i < 40; i++) ev.push(...d.atualizar(i * 100, [acenando(0.65 + 0.05 * Math.sin((i * 2 * Math.PI) / 4), 0.8)]));
  assert.deepEqual(ev, []);
  // só 1 ida e volta (2 inversões) e depois pára
  d = new DetectorGestos(); ev = [];
  [0.6, 0.7, 0.6, 0.7].forEach((x, i) => ev.push(...d.atualizar(i * 200, [acenando(x)])));
  for (let i = 0; i < 20; i++) ev.push(...d.atualizar(1000 + i * 100, [acenando(0.7)]));
  assert.deepEqual(ev, []);
});

test('acenar: idas e voltas muito espaçadas (fora da janela de 2,5 s) não somam; o gesto tem pausa de 3 s', () => {
  const d = new DetectorGestos();
  const ev = [];
  [0.6, 0.7, 0.6, 0.7, 0.6, 0.7].forEach((x, i) => ev.push(...d.atualizar(i * 1500, [acenando(x)])));
  assert.deepEqual(ev, []);
  // acena duas vezes seguidas: só o primeiro conta
  const d2 = new DetectorGestos();
  const ev2 = [];
  for (let i = 0; i <= 30; i++) ev2.push(...d2.atualizar(i * 100, [acenando(0.65 + 0.05 * Math.sin((i * 2 * Math.PI) / 4))]));
  assert.equal(ev2.filter((e) => e === 'aceno').length, 1);
});

test('controle do modo estrela: libera no x3, dura 8 s e só reativa 45 s depois do início', () => {
  const c = new ControleEstrela();
  assert.equal(c.disponivel(1000), false, 'antes do x3');
  c.registrarCombo(2);
  assert.equal(c.disponivel(1000), false);
  c.registrarCombo(3);
  assert.equal(c.disponivel(1000), true);
  assert.equal(c.ativar(1000), true);
  assert.equal(c.ativa(1000), true);
  assert.equal(c.ativa(8999), true);
  assert.equal(c.ativa(9000), false);
  assert.equal(c.restanteMs(4000), 5000);
  assert.equal(c.ativar(5000), false, 'ainda ativo');
  assert.equal(c.ativar(30000), false, 'intervalo de 45 s não passou');
  assert.equal(c.disponivel(45999), false);
  assert.equal(c.ativar(46000), true);
  // nova música: precisa do x3 de novo, mas o intervalo continua valendo
  c.novaMusica();
  assert.equal(c.disponivel(100000), false);
  c.registrarCombo(4);
  assert.equal(c.disponivel(100000), true);
  c.ativar(100000);
  c.novaMusica(); c.registrarCombo(3);
  assert.equal(c.disponivel(120000), false, 'só 20 s desde o último');
});
