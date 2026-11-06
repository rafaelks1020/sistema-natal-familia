'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { thumb } from '@/app/ui/client';
import type { JogoNovo, PlacarTime } from '@/app/api/telao/estado/_jogos_novos';
import { Confete } from './_confete';
import s from './_jogos_novos.module.css';

// Jogos novos em tela grande. Uso: <JogoNovoTela jogo={jogoNovo} agora={agora} />, com `agora` o relógio do telão (ms).
// A palavra da mímica nunca chega aqui.

const SPIN_MS = 9000;
const PERIMETRO = 2 * Math.PI * 45;
const cor = (c: string) => ({ '--cor': c }) as CSSProperties;

/** Número que sobe/desce suavemente (0,9 s) quando o valor muda. */
function Pontos({ valor, className }: { valor: number; className: string }) {
  const [v, setV] = useState(valor);
  const atual = useRef(valor);
  useEffect(() => {
    const de = atual.current;
    if (de === valor) return;
    const t0 = performance.now();
    let raf = 0;
    const passo = (t: number) => {
      const p = Math.min(1, (t - t0) / 900);
      atual.current = de + (valor - de) * (1 - Math.pow(1 - p, 3));
      setV(Math.round(atual.current));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [valor]);
  return <span className={className}>{v}</span>;
}

function MiniPlacar({ itens }: { itens: PlacarTime[] }) {
  if (!itens.length) return null;
  return <div className={s.mini}>{itens.map((t, i) => <div key={`${t.nome}-${i}`} className={s.miniItem} style={cor(t.cor)}><span>{t.nome}</span><Pontos valor={t.pontos} className={s.miniPts} /></div>)}</div>;
}

function Mimica({ j, agora }: { j: Extract<JogoNovo, { tipo: 'mimica' }>; agora: number }) {
  // Cada leitura nova do servidor reinicia a contagem local (o cronômetro anda entre uma leitura e outra).
  const [rec, setRec] = useState({ j, em: agora });
  if (rec.j !== j) setRec({ j, em: agora });
  const jogando = j.status === 'jogando';
  const restante = jogando ? Math.max(0, j.restante_ms - (agora - rec.em)) : 0;
  const frac = j.duracao_ms > 0 ? Math.min(1, restante / j.duracao_ms) : 0;
  const urgente = jogando && restante <= 10_000;
  const desenho = j.modo === 'desenho';
  return <div className={s.tela}>
    {j.status === 'acertou' && <Confete modo="rajada" />}
    <div className={s.palco}>
      <div className={s.relogio} role="timer" aria-label="Tempo restante">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className={s.trilho} cx="50" cy="50" r="45" />
          <circle className={s.arco} cx="50" cy="50" r="45" stroke={urgente ? '#C5292D' : j.time_cor}
            strokeDasharray={PERIMETRO} strokeDashoffset={PERIMETRO * (1 - frac)} />
        </svg>
        <div className={s.relogioCentro}>
          {jogando
            ? <><span className={s.segundos} style={{ color: urgente ? '#C5292D' : '#F3EBDC' }}>{Math.ceil(restante / 1000)}</span><span className={s.rotulo}>segundos</span></>
            : j.status === 'acertou'
              ? <span className={s.fim} style={{ color: '#BFA577' }}>Acertaram!</span>
              : <span className={s.fim}>Acabou o tempo!</span>}
        </div>
      </div>
      <div className={s.coluna}>
        <p className={s.kicker}>{desenho ? 'Desenho' : 'Mímica'}</p>
        <h2 className={s.titulo}>{j.quem}</h2>
        <p className={s.texto}>{desenho ? 'desenha sem escrever nem falar!' : 'faz mímica sem falar nada!'}</p>
        {j.time && <span className={s.chipTime} style={cor(j.time_cor)}><i className={s.chipPonto} />{j.time}</span>}
        <MiniPlacar itens={j.placar_times} />
      </div>
    </div>
  </div>;
}

function Bebe({ j }: { j: Extract<JogoNovo, { tipo: 'bebe' }> }) {
  const revelada = j.status === 'revelada';
  const votos = (j.votos_por_pessoa ?? []).slice(0, 5);
  const total = Math.max(1, j.total_votos);
  return <div className={s.tela}>
    {revelada && <Confete modo="rajada" />}
    <div className={s.palco}>
      <div className={s.moldura}><img src={thumb(j.foto_url, 1280, 85)} alt="Foto de bebê misteriosa" className={s.fotoBebe} /></div>
      <div className={s.coluna}>
        <p className={s.kicker}>Quem é o bebê?</p>
        {revelada ? <>
          <p className={s.texto}>Era...</p>
          <h2 className={s.respostaNome}>{j.resposta ?? '-'}</h2>
          {votos.length > 0 && <div className={s.votos}>{votos.map((v, i) => <div key={`${v.nome}-${i}`} className={`${s.votoLinha} ${v.nome === j.resposta ? s.votoCerto : ''}`}>
            <span>{v.nome}</span><span className={s.votoNum}>{v.votos}</span>
            <div className={s.votoTrilho}><div className={s.votoValor} style={{ transform: `scaleX(${v.votos / total})` }} /></div>
          </div>)}</div>}
          <p className={s.texto}>{j.total_votos} {j.total_votos === 1 ? 'palpite' : 'palpites'}</p>
        </> : <>
          <span className={s.contador}>{j.total_votos}</span>
          <p className={s.texto}>{j.total_votos === 1 ? 'palpite' : 'palpites'} até agora</p>
          <p className={s.texto}>Dê o seu palpite no celular.</p>
        </>}
      </div>
    </div>
  </div>;
}

const PALETA = ['#C5292D', '#607568', '#BFA577', '#3D4D43'];
const TEXTO_NA_FATIA = ['#F3EBDC', '#F3EBDC', '#171B18', '#F3EBDC'];
const ponto = (graus: number, r: number): [number, number] => {
  const a = (graus * Math.PI) / 180;
  return [r * Math.sin(a), -r * Math.cos(a)];
};
const corDaFatia = (i: number, n: number) => (i === n - 1 && n > 1 && i % PALETA.length === 0 ? 1 : i % PALETA.length);
function hash01(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

function Roleta({ j }: { j: Extract<JogoNovo, { tipo: 'roleta' }> }) {
  const roda = useRef<SVGGElement>(null);
  const [fim, setFim] = useState<string | null>(null);
  const nomes = j.nomes;
  const n = nomes.length;
  const seg = n > 0 ? 360 / n : 360;
  const chave = j.girado_em ?? 'parada';
  const nomesChave = nomes.join('|');

  useEffect(() => {
    const g = roda.current;
    if (!g) return;
    if (!j.girado_em || n === 0) {
      g.setAttribute('transform', 'rotate(0)');
      return;
    }
    const achado = j.sorteado ? nomes.indexOf(j.sorteado) : -1;
    const idx = achado >= 0 ? achado : 0;
    // Para com o ponteiro dentro da fatia sorteada, sem cair sempre no centro.
    const folga = (hash01(chave) - 0.5) * 0.6 * seg;
    const alvo = 360 * 7 - ((idx + 0.5) * seg - folga);
    const ha0 = j.girou_ha_ms ?? SPIN_MS;
    const t0 = performance.now();
    let raf = 0;
    const quadro = (t: number) => {
      const p = Math.min(1, (ha0 + (t - t0)) / SPIN_MS);
      g.setAttribute('transform', `rotate(${alvo * (1 - Math.pow(1 - p, 3.4))})`);
      if (p < 1) raf = requestAnimationFrame(quadro);
      else setFim(chave);
    };
    raf = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(raf);
    // girou_ha_ms muda a cada leitura: vale só o do início do giro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, nomesChave, j.sorteado]);

  const fs = n <= 6 ? 9 : n <= 12 ? 7.5 : n <= 18 ? 6 : 5;
  const girando = Boolean(j.girado_em) && fim !== chave;
  const terminou = Boolean(j.girado_em) && fim === chave;
  return <div className={s.tela}>
    {terminou && <Confete modo="rajada" />}
    <div className={s.palco}>
      <div className={s.roleta}>
        <svg viewBox="-112 -116 224 228" aria-hidden="true">
          <circle r="104" fill="#171B18" stroke="#BFA577" strokeWidth="1.6" />
          {Array.from({ length: 24 }, (_, i) => { const [x, y] = ponto(i * 15, 102); return <circle key={i} cx={x} cy={y} r="1.5" fill="#BFA577" />; })}
          <g ref={roda}>
            {n === 1 && <circle r="98" fill={PALETA[0]} />}
            {n > 1 && nomes.map((nome, i) => {
              const [x1, y1] = ponto(i * seg, 98);
              const [x2, y2] = ponto((i + 1) * seg, 98);
              const c = corDaFatia(i, n);
              return <path key={`${nome}-${i}`} d={`M0 0 L${x1.toFixed(3)} ${y1.toFixed(3)} A98 98 0 ${seg > 180 ? 1 : 0} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`} fill={PALETA[c]} stroke="#171B18" strokeWidth="0.8" />;
            })}
            {nomes.map((nome, i) => {
              const c = corDaFatia(i, n);
              return <text key={`t-${nome}-${i}`} className={s.roletaNome} transform={`rotate(${(i + 0.5) * seg - 90})`} x="90" y="0" textAnchor="end"
                dominantBaseline="central" fontSize={fs} fill={TEXTO_NA_FATIA[c]}>{nome.length > 16 ? `${nome.slice(0, 15)}…` : nome}</text>;
            })}
            <circle r="11" fill="#BFA577" stroke="#171B18" strokeWidth="1.2" />
          </g>
          <polygon points="0,-88 -9,-114 9,-114" fill="#C5292D" stroke="#F3EBDC" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </div>
      <div className={s.coluna}>
        <p className={s.kicker}>Roleta de prendas</p>
        {terminou && j.sorteado ? <>
          <p className={s.texto}>A roleta escolheu</p>
          <h2 className={s.destaque}>{j.sorteado}</h2>
          {j.prenda && <div className={s.prendaCaixa}><p className={s.kicker}>Prenda</p><p className={s.prenda}>{j.prenda}</p></div>}
        </> : girando ? <h2 className={s.suspense}>Girando...</h2>
          : <><h2 className={s.titulo}>Quem será?</h2><p className={s.texto}>{n} {n === 1 ? 'pessoa na roda' : 'pessoas na roda'}</p></>}
      </div>
    </div>
  </div>;
}

function Times({ j }: { j: Extract<JogoNovo, { tipo: 'times' }> }) {
  const maior = Math.max(...j.times.map((t) => t.pontos));
  const lider = maior > 0 && j.times.filter((t) => t.pontos === maior).length === 1 ? maior : null;
  return <div className={s.tela}>
    <div className={s.palco} style={{ flexDirection: 'column' }}>
      <p className={s.kicker}>Batalha de times</p>
      <div className={s.times}>{j.times.map((t, i) => <div key={`${t.nome}-${i}`} className={`${s.time} ${t.pontos === lider ? s.timeLider : ''}`} style={cor(t.cor)}>
        <h2 className={s.timeNome}>{t.nome}</h2>
        <Pontos valor={t.pontos} className={s.timePontos} />
        <span className={s.timePts}>{t.pontos === 1 ? 'ponto' : 'pontos'}</span>
        {t.membros.length > 0 && <p className={s.membros}>{t.membros.slice(0, 14).join(', ')}{t.membros.length > 14 ? ` e mais ${t.membros.length - 14}` : ''}</p>}
      </div>)}</div>
    </div>
  </div>;
}

export function JogoNovoTela({ jogo, agora }: { jogo: JogoNovo; agora: number }) {
  if (jogo.tipo === 'mimica') return <Mimica j={jogo} agora={agora} />;
  if (jogo.tipo === 'bebe') return <Bebe j={jogo} />;
  if (jogo.tipo === 'roleta') return <Roleta j={jogo} />;
  return <Times j={jogo} />;
}
