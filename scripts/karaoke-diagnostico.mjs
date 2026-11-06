// Diagnóstico determinístico da pontuação do modo estúdio, fora do navegador.
// Uso: node scripts/karaoke-diagnostico.mjs <pasta da música em karaoke-estudio/saida> [--latencia=0] [--offset=0] [--varrer]
//      node scripts/karaoke-diagnostico.mjs --sintetico <pasta> (silêncio e tom fixo de 440 Hz contra as notas da pasta)
// Decodifica vocals.wav com ffmpeg (PCM float 48k mono), roda o MESMO detector do telão (pitchy, janela de 2048 amostras a cada 33 ms,
// rms > 0,004 antes de detectar) e alimenta a PontuacaoAoVivo real (transpilada de app/telao/karaoke/pontuacao.ts) com o tempo exato.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(aqui, '..');
const { PitchDetector } = await import(pathToFileURL(path.join(raiz, 'node_modules/pitchy/index.js')).href);

const args = process.argv.slice(2);
const opc = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const pasta = args.find((a) => !a.startsWith('--')) ?? '/home/rafael/karaoke-estudio/saida/mariah-carey-all-i-want-for-christmas-is-you';
const SR = 48000;
/** Parâmetros opcionais do motor para experimentar: --cheio= --zero= --graca= */
const EXTRA = {};
const JANELA = 2048;
const PASSO_MS = 33;

function carregarPontuacao() {
  const js = ts.transpileModule(fs.readFileSync(path.join(raiz, 'app/telao/karaoke/pontuacao.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', js)(mod, mod.exports);
  return mod.exports;
}
const P = carregarPontuacao();

function decodificar(wav) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', wav, '-f', 'f32le', '-ac', '1', '-ar', String(SR), 'pipe:1'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr}`);
  return new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + r.stdout.byteLength));
}

/** Mesma medição do telão (_pitch.ts): rms da janela; só detecta altura se rms > 0,004. */
function medir(samples) {
  const detector = PitchDetector.forFloat32Array(JANELA);
  const buf = new Float32Array(JANELA);
  const quadros = [];
  for (let t = 0; ; t += PASSO_MS) {
    const fim = Math.round((t / 1000) * SR);
    if (fim > samples.length) break;
    const ini = fim - JANELA;
    for (let i = 0; i < JANELA; i++) buf[i] = ini + i >= 0 ? samples[ini + i] : 0;
    let soma = 0;
    for (let i = 0; i < JANELA; i++) soma += buf[i] * buf[i];
    const rms = Math.sqrt(soma / JANELA);
    let hz = 0;
    let clareza = 0;
    if (rms > 0.004) [hz, clareza] = detector.findPitch(buf, SR);
    quadros.push({ t, hz, clareza, rms });
  }
  return quadros;
}

function limiarDoRuido(quadros) {
  return P.limiarDeVozEstudio(P.medirRuido(quadros));
}

/** Roda o motor ao vivo com o tempo exato (m = t). */
function pontuar(quadros, notas, { latencia = 0, offset = 0, limiar, clareza, cobertura } = {}) {
  const motor = new P.PontuacaoAoVivo(notas, { latenciaMs: latencia, offsetMs: offset, limiar: limiar ?? limiarDoRuido(quadros), clarezaMinima: clareza, cobertura, ...EXTRA });
  for (const q of quadros) {
    const emFaixa = q.hz >= P.HZ_MIN && q.hz <= P.HZ_MAX;
    motor.adicionarQuadro(q.t, emFaixa ? P.hzParaMidi(q.hz) : null, q.clareza, q.rms, PASSO_MS);
  }
  return motor;
}

const mediana = (v) => { if (!v.length) return NaN; const o = [...v].sort((a, b) => a - b); return o[Math.floor(o.length / 2)]; };
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : 'n/d');

function relatorio(nome, quadros, notasBrutas, { latencia, offset, clareza, cobertura } = {}) {
  const notas = P.prepararNotas(notasBrutas);
  const limiar = limiarDoRuido(quadros);
  const motor = pontuar(quadros, notasBrutas, { latencia, offset, limiar, clareza, cobertura });
  const r = motor.resultado();
  const e = motor.estado();
  // Quadros dentro das notas (tempo exato, sem latência nem offset).
  let dentro = 0;
  let validos = 0;
  const erros = [];
  const porNota = notas.map(() => []);
  for (const q of quadros) {
    const i = P.notaEm(notas, q.t - (offset ?? 0) - (latencia ?? 0));
    if (i < 0) continue;
    dentro++;
    const cl = clareza ?? P.CLAREZA_ESTUDIO;
    if (q.clareza >= cl && q.rms > limiar && q.hz >= P.HZ_MIN && q.hz <= P.HZ_MAX) {
      validos++;
      const m = P.hzParaMidi(q.hz);
      erros.push(P.erroEmSemitons(m, notas[i].midi));
      porNota[i].push(m);
    }
  }
  const totalVoz = quadros.filter((q) => q.clareza >= (clareza ?? P.CLAREZA_ESTUDIO) && q.rms > limiar && q.hz >= P.HZ_MIN && q.hz <= P.HZ_MAX).length;
  console.log(`\n=== ${nome} ===`);
  console.log(`quadros: ${quadros.length} (${f(quadros.length * PASSO_MS / 1000, 1)} s), notas: ${notas.length}, limiar de voz: ${f(limiar, 4)}`);
  console.log(`NOTA FINAL: ${r.nota} (${e.pontos} pontos; notas ${f(e.pontosNotas, 0)} + linhas ${f(e.pontosLinhas, 0)} + sequência ${f(e.pontosSequencia, 0)}), estrelas ${r.estrelas}`);
  console.log(`maior sequência: ${e.maiorSequencia} notas, maior combo x${e.maiorCombo}, notas perfeitas ${f(e.perfeitasPct * 100, 0)}%`);
  console.log(`quadros com tom válido: ${f((validos / Math.max(1, dentro)) * 100, 1)}% dos quadros dentro das notas (${validos}/${dentro}); no total da faixa ${totalVoz} quadros válidos`);
  console.log(`erro médio dentro das notas (oitava ignorada): ${f(media(erros), 2)} st, mediana ${f(mediana(erros), 2)} st, <=0,5 st: ${f((erros.filter((x) => x <= 0.5).length / Math.max(1, erros.length)) * 100, 0)}%, <=1,5 st: ${f((erros.filter((x) => x <= 1.5).length / Math.max(1, erros.length)) * 100, 0)}%`);
  // Mediana medida contra o midi do notas.json (sem dobrar oitava e dobrada).
  const difs = [];
  porNota.forEach((v, i) => { if (v.length >= 3) difs.push(mediana(v) - notas[i].midi); });
  const dobrada = difs.map((d) => ((((d + 6) % 12) + 12) % 12) - 6);
  const oit = {};
  difs.forEach((d) => { const k = Math.round(d / 12); oit[k] = (oit[k] ?? 0) + 1; });
  console.log(`mediana medida x midi do notas.json (${difs.length} notas com >=3 quadros): diferença média ${f(media(difs), 2)} st, dobrada ${f(media(dobrada), 2)} st, |dobrada| média ${f(media(dobrada.map(Math.abs)), 2)} st; oitavas de diferença: ${JSON.stringify(oit)}`);
  return { r, e };
}

/** Desvio de tempo: nota da música para vários offsets, e melhor desvio por nota. */
function varrerTempo(quadros, notasBrutas, { clareza, cobertura } = {}) {
  const notas = P.prepararNotas(notasBrutas);
  const limiar = limiarDoRuido(quadros);
  console.log('\nnota final conforme o desvio entre a voz e as notas (offset positivo = notas mais tarde):');
  let melhor = { off: 0, nota: -1 };
  const linha = [];
  for (let off = -1000; off <= 1000; off += 100) {
    const nota = pontuar(quadros, notasBrutas, { offset: off, limiar, clareza, cobertura }).resultado().nota;
    linha.push(`${off}:${nota}`);
    if (nota > melhor.nota) melhor = { off, nota };
  }
  console.log(linha.join('  '));
  console.log(`melhor desvio global: ${melhor.off} ms (nota ${melhor.nota})`);
  // Por nota: desvio que mais quadros válidos acertam (erro <= 1 st) em passos de 33 ms.
  const hist = {};
  let contadas = 0;
  for (const n of notas) {
    if (n.dur_ms < 250) continue;
    let melhorLag = null;
    let melhorQtd = 0;
    for (let lag = -990; lag <= 990; lag += PASSO_MS) {
      let ok = 0;
      for (const q of quadros) {
        const t = q.t - lag;
        if (t < n.inicio_ms || t >= n.inicio_ms + n.dur_ms) continue;
        if (q.clareza >= (clareza ?? P.CLAREZA_ESTUDIO) && q.rms > limiar && q.hz >= P.HZ_MIN && q.hz <= P.HZ_MAX && P.erroEmSemitons(P.hzParaMidi(q.hz), n.midi) <= 1) ok++;
      }
      if (ok > melhorQtd) { melhorQtd = ok; melhorLag = lag; }
    }
    if (melhorLag !== null && melhorQtd >= 3) { const b = Math.round(melhorLag / 200) * 200; hist[b] = (hist[b] ?? 0) + 1; contadas++; }
  }
  console.log(`desvio de tempo que melhor casa cada nota longa (>=250 ms, ${contadas} notas), em faixas de 200 ms (voz atrasada em relação à nota = positivo):`);
  console.log(Object.keys(hist).map(Number).sort((a, b) => a - b).map((k) => `${k}: ${hist[k]}`).join('  '));
}

function sintetico(nome, quadrosFn, notasBrutas, opcoes) {
  const notas = P.prepararNotas(notasBrutas);
  const fim = notas[notas.length - 1].inicio_ms + notas[notas.length - 1].dur_ms + 2000;
  return relatorio(nome, quadrosFn(fim), notasBrutas, opcoes);
}

const notasBrutas = JSON.parse(fs.readFileSync(path.join(pasta, 'notas.json'), 'utf8'));
const palavras = JSON.parse(fs.readFileSync(path.join(pasta, 'palavras.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(pasta, 'meta.json'), 'utf8'));
if (opc.cheio !== undefined) EXTRA.erroCheio = Number(opc.cheio);
if (opc.zero !== undefined) EXTRA.erroZero = Number(opc.zero);
if (opc.graca !== undefined) EXTRA.gracaMs = Number(opc.graca);
const clareza = opc.clareza !== undefined ? Number(opc.clareza) : undefined;
const cobertura = opc.cobertura !== undefined ? Number(opc.cobertura) : undefined;
console.log(`música: ${meta.artista} - ${meta.faixa}; ${palavras.linhas.length} linhas, ${notasBrutas.length} notas; primeira nota em ${notasBrutas[0].inicio_ms} ms`);

const amostras = decodificar(path.join(pasta, 'vocals.wav'));
const quadros = medir(amostras);
const ajuste = { latencia: Number(opc.latencia ?? 0), offset: Number(opc.offset ?? 0), clareza, cobertura };
relatorio('voz original (vocals.wav), tempo exato', quadros, notasBrutas, ajuste);
if (opc.varrer) varrerTempo(quadros, notasBrutas, { clareza, cobertura });

if (!opc['sem-sinteticos']) {
  const sil = (fim) => { const q = []; for (let t = 0; t < fim; t += PASSO_MS) q.push({ t, hz: 0, clareza: 0, rms: 0 }); return q; };
  const tom = (fim) => { const q = []; for (let t = 0; t < fim; t += PASSO_MS) q.push(t < 2500 ? { t, hz: 0, clareza: 0, rms: 0 } : { t, hz: 440, clareza: 0.99, rms: 0.1 }); return q; };
  sintetico('silêncio', sil, notasBrutas, ajuste);
  sintetico('tom fixo de 440 Hz', tom, notasBrutas, ajuste);
}
