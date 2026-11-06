'use client';
/* eslint-disable @next/next/no-img-element */
import { Check } from 'lucide-react';
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

function Amigo({ j, agora, desde }: { j: JogoAmigo; agora: number; desde: number }) {
  if (j.encerrado) {
    return <div className={styles.jogo}><Confete modo="rajada" /><p className={styles.kicker}>Amigo Oculto</p><h2 className={styles.jogoTitulo}>Revelação completa!</h2><p className={styles.texto}>Todos os segredos foram revelados. Hora dos presentes.</p></div>;
  }
  const par = j.par;
  const suspense = !par || agora - desde < SUSPENSE_MS;
  return <div className={styles.jogo}>
    <p className={styles.kicker}>Amigo Oculto ao vivo{par ? ` · ${j.atual + 1} de ${j.total}` : ''}</p>
    {!par ? <>
      <h2 className={styles.suspense}>Quem será?</h2>
      <p className={styles.texto}>A revelação vai começar. O segredo está prestes a acabar...</p>
    </> : <>
      <p className={styles.amigoNome}>{par.giver}</p>
      <p className={styles.amigoTirou}>tirou{suspense ? '' : ':'}</p>
      {suspense
        ? <h2 key={`s-${j.atual}`} className={styles.suspense}>Quem será<span className={styles.pontos}><i>.</i><i>.</i><i>.</i></span></h2>
        : <h2 key={`r-${j.atual}`} className={styles.amigoRevela}>{par.receiver}</h2>}
      {!suspense && <><Confete modo="rajada" /><p className={styles.texto}>{par.acertos.length ? `Acertou o palpite: ${par.acertos.join(', ')}` : 'Esse segredo foi bem guardado!'}</p></>}
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
