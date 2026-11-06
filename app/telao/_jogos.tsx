'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef } from 'react';
import { Check, Gift } from 'lucide-react';
import { thumb } from '@/app/ui/client';
import { Confete } from './_confete';
import type { Jogo, JogoAmigo, JogoBingo, JogoEnquete, JogoQuiz, PlacarItem } from './tipos';
import styles from './telao.module.css';

const LETRAS = ['A', 'B', 'C', 'D'];
export const SUSPENSE_MS = 5000;

function Placar({ itens, titulo }: { itens: PlacarItem[]; titulo: string }) {
  if (!itens.length) return null;
  return <aside className={styles.placar}>
    <p className={styles.kicker}>{titulo}</p>
    <ol>{itens.map((p, i) => <li key={`${p.nome}-${i}`}><span className={styles.placarPos}>{i + 1}</span><span className={styles.placarNome}>{p.nome}</span><span className={styles.placarPts}>{p.pontos}</span></li>)}</ol>
  </aside>;
}

function Quiz({ j, agora, recebidoEm }: { j: JogoQuiz; agora: number; recebidoEm: number }) {
  if (j.fase === 'podio') {
    const [p1, p2, p3] = j.placar;
    const degraus: [PlacarItem | undefined, string, string][] = [[p2, '2', styles.degrau2], [p1, '1', styles.degrau1], [p3, '3', styles.degrau3]];
    return <div className={styles.jogo}>
      <Confete modo="rajada" />
      <p className={styles.kicker}>Quiz da Família</p>
      <h2 className={styles.jogoTitulo}>Pódio</h2>
      <div className={styles.podio}>{degraus.map(([p, n, cls]) => <div key={n} className={`${styles.degrau} ${cls}`}><p className={styles.degrauNome}>{p?.nome ?? '-'}</p>{p && <p className={styles.degrauPts}>{p.pontos} pontos</p>}<div className={styles.degrauBloco}>{n}</div></div>)}</div>
      {j.placar.length > 3 && <p className={styles.texto}>{j.placar.slice(3).map((p, i) => `${i + 4}º ${p.nome} (${p.pontos})`).join('  ·  ')}</p>}
    </div>;
  }
  const restante = j.fase === 'aberta' ? Math.max(0, j.restante_ms - (agora - recebidoEm)) : 0;
  return <div className={styles.jogoLinha}>
    <div className={styles.jogo}>
      <p className={styles.kicker}>Quiz da Família{j.numero ? ` · Pergunta ${j.numero} de ${j.total}` : ''}{j.modelo ? ` · ${j.modelo}` : ''}</p>
      <h2 className={styles.jogoPergunta}>{j.pergunta}</h2>
      {j.image_url && <img src={thumb(j.image_url, 640, 75)} alt="" className={styles.quizImagem} />}
      <div className={styles.opcoes}>{j.opcoes.map((o, i) => {
        const certa = j.fase === 'revelada' && j.correta === i;
        const apagada = j.fase === 'revelada' && j.correta !== i;
        return <div key={i} className={`${styles.opcao} ${certa ? styles.opcaoCerta : ''} ${apagada ? styles.opcaoApagada : ''}`}>
          <span className={styles.opcaoLetra}>{certa ? <Check strokeWidth={3} /> : LETRAS[i]}</span><span>{o}</span>
        </div>;
      })}</div>
      {j.fase === 'aberta' ? <>
        <div className={styles.tempo} role="timer"><div className={styles.tempoPreench} style={{ transform: `scaleX(${restante / j.duracao_ms})` }} /></div>
        <p className={styles.texto}>{Math.ceil(restante / 1000)} s · {j.total_respostas} {j.total_respostas === 1 ? 'resposta' : 'respostas'}</p>
      </> : <p className={styles.texto}>Resposta certa: {j.correta != null ? `${LETRAS[j.correta]}, ${j.opcoes[j.correta]}` : '-'}</p>}
    </div>
    {j.fase === 'revelada' && <Placar itens={j.placar} titulo="Placar" />}
  </div>;
}

function Enquete({ j }: { j: JogoEnquete }) {
  return <div className={styles.jogo}>
    <p className={styles.kicker}>{j.aberta ? 'Enquete ao vivo · vote no celular' : 'Resultado da enquete'}</p>
    <h2 className={styles.jogoPergunta}>{j.pergunta}</h2>
    <div className={styles.barras}>{j.opcoes.map((o, i) => <div key={i} className={`${styles.barraLinha} ${o.vencedora ? styles.barraVence : ''}`}>
      <div className={styles.barraRotulo}><span>{o.texto}</span><span className={styles.barraPct}>{o.percentual}%</span></div>
      <div className={styles.barraTrilho}><div className={styles.barraValor} style={{ transform: `scaleX(${o.percentual / 100})` }} /></div>
    </div>)}</div>
    <p className={styles.texto}>{j.total_votos} {j.total_votos === 1 ? 'voto' : 'votos'}</p>
  </div>;
}

function Bingo({ j }: { j: JogoBingo }) {
  return <div className={styles.jogo}>
    {j.confirmado && <Confete modo="explosao" />}
    <p className={styles.kicker}>{j.confirmado ? 'Bingo confirmado' : 'Alguém gritou'}</p>
    <h2 className={styles.bingoGrito}>BINGO!</h2>
    <p className={styles.bingoNome}>{j.confirmado ? `${j.nome} fez bingo!` : `BINGO de ${j.nome}!`}</p>
    <p className={styles.texto}>{j.padrao}{j.confirmado ? '' : ' · conferindo a cartela...'}</p>
    {j.outros.length > 0 && <p className={styles.texto}>Também gritaram: {j.outros.join(', ')}</p>}
  </div>;
}

/** Rufar de tambor sintetizado via WebAudio por 3 segundos antes da revelação. */
function tocarRufarTambor(duracaoSeg = 3): () => void {
  if (typeof window === 'undefined') return () => {};
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return () => {};
  let ctx: AudioContext | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    ctx = new Ctx();
    const t0 = ctx.currentTime + 0.02;
    const taxa = ctx.sampleRate;
    const tamRuido = Math.floor(taxa * 0.06);
    const buffer = ctx.createBuffer(1, tamRuido, taxa);
    const canal = buffer.getChannelData(0);
    for (let i = 0; i < tamRuido; i++) {
      canal[i] = (Math.random() * 2 - 1) * Math.exp(-i / (taxa * 0.018));
    }

    let t = 0;
    let passo = 0.055;
    while (t < duracaoSeg) {
      const instante = t0 + t;
      const progresso = t / duracaoSeg;
      const volume = 0.035 + progresso * progresso * 0.18;

      const fonte = ctx.createBufferSource();
      fonte.buffer = buffer;
      const filtro = ctx.createBiquadFilter();
      filtro.type = 'bandpass';
      filtro.frequency.setValueAtTime(220 + progresso * 140, instante);
      filtro.Q.setValueAtTime(1.8, instante);

      const ganho = ctx.createGain();
      ganho.gain.setValueAtTime(volume, instante);
      ganho.gain.exponentialRampToValueAtTime(0.001, instante + 0.055);

      fonte.connect(filtro);
      filtro.connect(ganho);
      ganho.connect(ctx.destination);
      fonte.start(instante);

      const tambor = ctx.createOscillator();
      const ganhoTambor = ctx.createGain();
      tambor.type = 'triangle';
      tambor.frequency.setValueAtTime(118 + ( Math.round(t * 20) % 2 ) * 14, instante);
      tambor.frequency.exponentialRampToValueAtTime(68, instante + 0.045);
      ganhoTambor.gain.setValueAtTime(volume * 0.7, instante);
      ganhoTambor.gain.exponentialRampToValueAtTime(0.001, instante + 0.048);
      tambor.connect(ganhoTambor);
      ganhoTambor.connect(ctx.destination);
      tambor.start(instante);
      tambor.stop(instante + 0.05);

      passo = Math.max(0.026, 0.055 - progresso * 0.027);
      t += passo;
    }

    // Prato suave no fim do rufar (aos 3 s) marcando a abertura da carta.
    const fim = t0 + duracaoSeg;
    const acorde = [523.25, 659.25, 783.99];
    for (const freq of acorde) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, fim);
      g.gain.setValueAtTime(0.08, fim);
      g.gain.exponentialRampToValueAtTime(0.0008, fim + 0.85);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(fim);
      osc.stop(fim + 0.9);
    }

    timer = setTimeout(() => {
      void ctx?.close().catch(() => undefined);
      ctx = null;
    }, (duracaoSeg + 1.2) * 1000);
  } catch {
    // Caso o navegador bloqueie áudio automático, segue em silêncio sem quebrar a cerimônia.
  }
  return () => {
    if (timer) clearTimeout(timer);
    if (ctx) void ctx.close().catch(() => undefined);
  };
}

function Amigo({ j, agora, desde }: { j: JogoAmigo; agora: number; desde: number }) {
  const par = j.par;
  const suspense = !par || agora - desde < SUSPENSE_MS;
  const ultimoRufarRef = useRef<number>(-1);

  useEffect(() => {
    if (j.encerrado || !par || !suspense) return;
    if (ultimoRufarRef.current === j.atual) return;
    ultimoRufarRef.current = j.atual;
    return tocarRufarTambor(3);
  }, [j.atual, j.encerrado, par, suspense]);

  if (j.encerrado) {
    return <div className={styles.jogo}>
      <Confete modo="rajada" />
      <p className={styles.kicker}>Amigo Oculto · {j.total} de {j.total} revelados</p>
      <h2 className={styles.jogoTitulo}>Revelação completa!</h2>
      <p className={styles.texto}>Todos os segredos foram revelados. Hora dos presentes.</p>
    </div>;
  }

  const revelados = par ? j.atual + 1 : 0;

  return <div className={styles.jogo}>
    <style>{`
      @keyframes telaoCartaGira {
        0% { transform: perspective(90vmin) rotateY(0deg) translateY(0); }
        50% { transform: perspective(90vmin) rotateY(180deg) translateY(-1.2vmin); }
        100% { transform: perspective(90vmin) rotateY(360deg) translateY(0); }
      }
      @keyframes telaoCartaAbre {
        0% { transform: perspective(90vmin) rotateY(90deg) scale(0.92); opacity: 0; }
        100% { transform: perspective(90vmin) rotateY(0deg) scale(1); opacity: 1; }
      }
    `}</style>
    <p className={styles.kicker}>Amigo Oculto ao vivo · {revelados} de {j.total} revelados</p>
    {!par ? <>
      <h2 className={styles.suspense}>Quem será?</h2>
      <p className={styles.texto}>A revelação vai começar. O segredo está prestes a acabar...</p>
    </> : <>
      <p className={styles.amigoTirou}>Quem tirou: <strong style={{ color: '#f3ebdc' }}>{par.giver}</strong></p>
      <p className={styles.amigoNome}>{par.giver}</p>
      {suspense ? (
        <>
          <div
            aria-label="Cartas virando em suspense"
            style={{
              display: 'flex',
              gap: '2.8vmin',
              justifyContent: 'center',
              alignItems: 'center',
              margin: '1.5vmin 0',
            }}
          >
            {[0, 1, 2].map((idx) => (
              <div
                key={idx}
                style={{
                  width: '18vmin',
                  height: '25vmin',
                  borderRadius: '2vmin',
                  background: idx === 1
                    ? 'linear-gradient(160deg, #c5292d, #8e1a1e)'
                    : 'linear-gradient(160deg, #252b27, #171b18)',
                  border: '0.35vmin solid #bfa577',
                  boxShadow: '0 2vmin 5vmin rgba(0, 0, 0, 0.55)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1.2vmin',
                  color: '#f3ebdc',
                  animation: `telaoCartaGira 1.5s ease-in-out ${idx * 0.25}s infinite`,
                }}
              >
                <Gift style={{ width: '6.5vmin', height: '6.5vmin', color: '#bfa577' }} strokeWidth={1.6} />
                <span style={{ fontFamily: 'var(--font-bodoni), Georgia, serif', fontSize: '4.5vmin', fontWeight: 800, color: '#bfa577' }}>?</span>
              </div>
            ))}
          </div>
          <h2 key={`s-${j.atual}`} className={styles.suspense}>
            Rufem os tambores<span className={styles.pontos}><i>.</i><i>.</i><i>.</i></span>
          </h2>
        </>
      ) : (
        <>
          <Confete modo="rajada" />
          <div
            key={`c-${j.atual}`}
            style={{
              padding: '2.8vmin 6vmin',
              borderRadius: '2.6vmin',
              background: 'linear-gradient(165deg, rgba(197, 41, 45, 0.28), rgba(29, 34, 31, 0.95))',
              border: '0.35vmin solid #bfa577',
              boxShadow: '0 2.5vmin 8vmin rgba(0, 0, 0, 0.6)',
              animation: 'telaoCartaAbre 0.8s cubic-bezier(0.22, 1, 0.36, 1) both',
            }}
          >
            <p className={styles.kicker} style={{ marginBottom: '1vmin' }}>Tirou</p>
            <h2 key={`r-${j.atual}`} className={styles.amigoRevela}>{par.receiver}</h2>
          </div>
          <p className={styles.texto}>
            {par.acertos.length ? `Acertou o palpite: ${par.acertos.join(', ')}` : 'Esse segredo foi bem guardado!'}
          </p>
        </>
      )}
    </>}
  </div>;
}

export function JogoTela({ jogo, agora, recebidoEm, amigoDesde }: { jogo: Jogo; agora: number; recebidoEm: number; amigoDesde: number }) {
  return <div className={styles.jogoTela}>
    {jogo.tipo === 'quiz' && <Quiz j={jogo} agora={agora} recebidoEm={recebidoEm} />}
    {jogo.tipo === 'enquete' && <Enquete j={jogo} />}
    {jogo.tipo === 'bingo' && <Bingo j={jogo} />}
    {jogo.tipo === 'amigo' && <Amigo j={jogo} agora={agora} desde={amigoDesde} />}
  </div>;
}
