'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { Music2 } from 'lucide-react';
import { thumb } from '@/app/ui/client';
import { Confete } from './_confete';
import type { AdventoHoje, EventoTelao, Recado, Slide, TocandoTelao } from './tipos';
import styles from './telao.module.css';

export const FRESCA_MS = 10 * 60 * 1000;
export const EXPLOSAO_MS = 3 * 60 * 1000;

const dois = (n: number) => String(n).padStart(2, '0');
const minSeg = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${dois(s % 60)}`; };

// ---------- Fotos ao vivo ----------

function Quadro({ foto, agora, indice, saindo }: { foto: Slide; agora: number; indice: number; saindo?: boolean }) {
  const fresca = agora - Date.parse(foto.created_at) < FRESCA_MS;
  const url = thumb(foto.url, 1280, 80);
  return <div className={saindo ? styles.quadroSai : styles.quadro}>
    <img src={url} alt="" className={styles.fotoFundo} aria-hidden="true" />
    <img src={url} alt={foto.legenda || `Foto de ${foto.nome}`} className={`${styles.fotoFrente} ${indice % 2 ? styles.kbB : styles.kbA}`} />
    <div className={styles.fotoLegenda}>
      {fresca && !saindo && <p className={styles.selo}><span className={styles.seloPonto} />Agora mesmo</p>}
      <p className={styles.fotoNome}>{foto.nome}</p>
      {foto.legenda && <p className={styles.fotoTexto}>{foto.legenda}</p>}
    </div>
  </div>;
}

export function FotosCena({ fotos, agora, inicial, forcar, proxima, aoMostrar }: {
  fotos: Slide[]; agora: number; inicial: string; forcar: { n: number; key: string };
  proxima: (atual: string) => string; aoMostrar: (key: string) => void;
}) {
  const [s, setS] = useState({ atual: inicial, anterior: '', n: 0 });
  const [vistoN, setVistoN] = useState(forcar.n);
  if (forcar.n !== vistoN) { setVistoN(forcar.n); setS((p) => ({ atual: forcar.key, anterior: p.atual, n: p.n + 1 })); }
  const atualRef = useRef(s.atual);
  useEffect(() => { atualRef.current = s.atual; aoMostrar(s.atual); }, [s.atual, aoMostrar]);
  useEffect(() => {
    const t = setInterval(() => {
      const prox = proxima(atualRef.current);
      if (prox) setS((p) => ({ atual: prox, anterior: p.atual, n: p.n + 1 }));
    }, 8000);
    return () => clearInterval(t);
  }, [proxima]);
  const foto = fotos.find((f) => f.key === s.atual) ?? fotos[0];
  const ant = fotos.find((f) => f.key === s.anterior);
  if (!foto) return <VaziaCena />;
  return <div className={styles.fill}>
    {ant && ant.key !== foto.key && <Quadro key={`s-${ant.key}-${s.n}`} foto={ant} agora={agora} indice={s.n - 1} saindo />}
    <Quadro key={`${foto.key}-${s.n}`} foto={foto} agora={agora} indice={s.n} />
  </div>;
}

export function VaziaCena() {
  return <div className={styles.centro}>
    <p className={styles.kicker}>Natal em Família</p>
    <h2 className={styles.tituloGrande}>Nossa noite, nossas lembranças.</h2>
    <p className={styles.texto}>Mande uma foto pelo celular e ela aparece aqui na hora.</p>
  </div>;
}

// ---------- Tocando agora ----------

export function TocandoCena({ t, agora, recebidoEm }: { t: TocandoTelao | null; agora: number; recebidoEm: number }) {
  if (!t || !t.tocando || !t.nome) {
    return <div className={styles.centro}><Music2 className={styles.iconeGrande} strokeWidth={1.2} /><h2 className={styles.tituloGrande}>Nada tocando agora</h2><p className={styles.texto}>Quando a música começar, ela aparece aqui.</p></div>;
  }
  const decorrido = t.progresso_ms + Math.max(0, agora - recebidoEm);
  const prog = t.duracao_ms > 0 ? Math.min(1, decorrido / t.duracao_ms) : 0;
  return <div className={styles.fill}>
    {t.capa_url && <div key={`f-${t.capa_url}`} className={styles.tocFundo} style={{ backgroundImage: `url("${t.capa_url}")` }} />}
    <div className={styles.tocVeu} />
    <div className={styles.tocConteudo}>
      <div key={`c-${t.capa_url}`} className={styles.tocCapaBox}>
        {t.capa_url ? <img src={t.capa_url} alt={`Capa de ${t.nome}`} className={styles.tocCapa} /> : <div className={styles.tocCapaVazia}><Music2 className={styles.iconeGrande} strokeWidth={1.2} /></div>}
      </div>
      <div className={styles.tocTexto}>
        <p className={styles.kicker}><span className={styles.eq} aria-hidden="true"><i /><i /><i /><i /><i /></span>Tocando agora</p>
        <h2 className={styles.tocNome}>{t.nome}</h2>
        {t.artista && <p className={styles.tocArtista}>{t.artista}</p>}
        {t.adicionada_por && <p className={styles.tocPedida}>Pedida por {t.adicionada_por}</p>}
        <div className={styles.barra} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(prog * 100)}><div className={styles.barraPreench} style={{ transform: `scaleX(${prog})` }} /></div>
        <div className={styles.tempos}><span>{minSeg(decorrido)}</span><span>{minSeg(t.duracao_ms)}</span></div>
      </div>
    </div>
  </div>;
}

// ---------- Contagem regressiva ----------

export function ContagemCena({ agora, evento }: { agora: number; evento: EventoTelao }) {
  const troca = Date.parse(evento.troca), ceia = Date.parse(evento.ceia), meiaNoite = Date.parse(evento.meiaNoite);
  if (agora >= meiaNoite) return <FelizNatal explosao={agora - meiaNoite < EXPLOSAO_MS} />;
  const paraCeia = agora < troca;
  const resto = Math.max(0, (paraCeia ? ceia : meiaNoite) - agora);
  const total = Math.floor(resto / 1000);
  const dias = Math.floor(total / 86400);
  const caixas: [string, string][] = [
    ...(dias > 0 ? [[String(dias), dias === 1 ? 'dia' : 'dias']] as [string, string][] : []),
    [dois(Math.floor((total % 86400) / 3600)), 'horas'], [dois(Math.floor((total % 3600) / 60)), 'minutos'], [dois(total % 60), 'segundos'],
  ];
  const quando = new Date(ceia).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  return <div className={styles.centro}>
    <p className={styles.kicker}>{paraCeia ? 'Falta pouco para a nossa ceia' : 'Falta pouco para o Natal'}</p>
    <h2 className={styles.tituloGrande}>{paraCeia ? 'Contagem para a ceia' : 'Contagem para a meia-noite'}</h2>
    <div className={styles.caixas} role="timer" aria-label={paraCeia ? 'Tempo para a ceia' : 'Tempo para a meia-noite'}>
      {caixas.map(([valor, rotulo]) => <div key={rotulo} className={styles.caixa}><span className={styles.caixaNum}>{valor}</span><span className={styles.caixaRot}>{rotulo}</span></div>)}
    </div>
    <p className={styles.texto}>{paraCeia ? quando : 'Quando o relógio bater 00:00, é Natal.'}</p>
  </div>;
}

function FelizNatal({ explosao }: { explosao: boolean }) {
  return <div className={styles.centro}>
    <Confete modo={explosao ? 'explosao' : 'chuva'} />
    <div className={styles.aneis} aria-hidden="true"><i /><i /><i /></div>
    <p className={styles.kicker}>Meia-noite</p>
    <h2 className={styles.felizNatal}>Feliz Natal!</h2>
    <p className={styles.texto}>Que esta noite seja linda para a família inteira.</p>
  </div>;
}

// ---------- Recados do mural ----------

const POR_PAGINA = 4;

export function RecadosCena({ recados }: { recados: Recado[] }) {
  const paginas = Math.max(1, Math.ceil(recados.length / POR_PAGINA));
  const [pagina, setPagina] = useState(0);
  useEffect(() => {
    if (paginas < 2) return;
    const t = setInterval(() => setPagina((p) => (p + 1) % paginas), 14000);
    return () => clearInterval(t);
  }, [paginas]);
  const atuais = recados.slice((pagina % paginas) * POR_PAGINA, (pagina % paginas) * POR_PAGINA + POR_PAGINA);
  return <div className={styles.recados}>
    <p className={styles.kicker}>Recados da família</p>
    <div key={pagina} className={styles.recadoGrade}>
      {atuais.map((r, i) => <article key={r.id} className={styles.recado} style={{ animationDelay: `${0.5 + i * 0.8}s` }}>
        {r.foto && <img src={thumb(r.foto, 640, 75)} alt="" className={styles.recadoFoto} />}
        <div className={styles.recadoCorpo}>
          {r.texto && <p className={r.texto.length > 110 ? styles.recadoTextoLongo : styles.recadoTexto}>{r.texto}</p>}
          <p className={styles.recadoNome}>{r.nome}</p>
        </div>
      </article>)}
    </div>
  </div>;
}

// ---------- Advento do dia ----------

const ROTULO_ADVENTO: Record<string, string> = { foto: 'Foto do dia', receita: 'Receita do dia', enquete: 'Enquete do dia', desafio: 'Desafio do dia', pergunta: 'Pergunta do dia' };

export function AdventoCena({ a }: { a: AdventoHoje | null }) {
  if (!a) return <div className={styles.centro}><h2 className={styles.tituloGrande}>O Advento chega em dezembro</h2><p className={styles.texto}>De 1 a 24, uma janela nova por dia.</p></div>;
  return <div className={styles.advento}>
    <div className={styles.advPorta}><span className={styles.advDia}>{a.dia}</span><span className={styles.advMes}>de dezembro</span></div>
    <div className={styles.advTexto}>
      <p className={styles.kicker}>Advento · {ROTULO_ADVENTO[a.tipo] ?? 'Janela do dia'}</p>
      <h2 className={styles.tituloGrande}>{a.titulo}</h2>
      {a.texto && <p className={styles.advCorpo}>{a.texto}</p>}
      {a.opcoes && <ul className={styles.advOpcoes}>{a.opcoes.map((o) => <li key={o}>{o}</li>)}</ul>}
      {a.image_url && <img src={thumb(a.image_url, 640, 75)} alt="" className={styles.advImagem} />}
    </div>
  </div>;
}
