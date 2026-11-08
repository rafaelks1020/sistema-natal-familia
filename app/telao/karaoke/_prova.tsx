'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/app/ui/client';
import { useAfinacao } from './_pitch';
import { PalcoEstudio } from './_estudio';
import TentativasAdmin from './_prova-admin';
import { Confete } from '../_confete';
import { HZ_MAX, HZ_MIN, PontuacaoAoVivo, hzParaMidi, type EventoAoVivo, type Quadro, type ResultadoEstudio } from './pontuacao';
import type { DadosEstudio, MusicaCatalogo } from './tipos';
import type { ConfigProva, MusicaProva, PainelProva, StatusProva } from './prova-tipos';
import styles from './_prova.module.css';

type Musica = DadosEstudio & MusicaProva & { duracao_ms: number };
type Etapa = 'escolha' | 'regras' | 'abrindo' | 'cantando' | 'nota';
/** ultimo_t: último quadro aceito pelo servidor. lote_ate_t: maior instante já tratado (aceito ou descartado por inválido). */
type RespostaNota = { status: string; ultimo_t?: number; lote_ate_t?: number; descartados?: number; resultado?: ResultadoEstudio };
const dataSP = (s: string) => new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const valorDataSP = (s: string) => {
  const p = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(s));
  return p.replace(' ', 'T');
};

function Configuracao({ config, aoSalvar }: { config: ConfigProva | null; aoSalvar: (p: PainelProva) => void }) {
  const [catalogo, setCatalogo] = useState<MusicaCatalogo[]>([]);
  const [ids, setIds] = useState<number[]>(config?.musicas ?? []);
  const [eliminatoria, setEliminatoria] = useState(config ? valorDataSP(config.eliminatoria_ate) : '');
  const [final, setFinal] = useState(config ? valorDataSP(config.final_em) : '');
  const [status, setStatus] = useState<StatusProva>(config?.status ?? 'preparando');
  const [erro, setErro] = useState('');
  const [medida, setMedida] = useState('');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { let vivo = true; api<{ musicas: MusicaCatalogo[] }>('/api/karaoke/catalogo').then((d) => { if (vivo) setCatalogo(d.musicas.filter((m) => m.status === 'pronta')); }).catch((e: Error) => { if (vivo) setErro(e.message); }); return () => { vivo = false; }; }, []);
  const sugerir = async () => {
    setOcupado(true); setErro('');
    try {
      const d = await api<{ musicas: (MusicaProva & { dificuldade: { indice: number } })[]; medida: string }>('/api/karaoke/prova/sugestoes');
      setIds(d.musicas.map((m) => m.id));
      setCatalogo((lista) => [...lista, ...d.musicas.filter((m) => !lista.some((c) => c.id === m.id)).map((m): MusicaCatalogo => ({ ...m, status: 'pronta', slug: '', capa_url: null, duracao_ms: null, lrclib_id: null }))]);
      setMedida(`${d.medida} ${d.musicas.map((m) => `${m.faixa}: ${m.dificuldade.indice}/100`).join('; ')}`);
    } catch (e) { setErro((e as Error).message); }
    finally { setOcupado(false); }
  };
  const salvar = async () => {
    setOcupado(true); setErro('');
    try { aoSalvar(await api<PainelProva>('/api/karaoke/prova', { method: 'POST', json: { musicas: ids, eliminatoria_ate: `${eliminatoria}:00-03:00`, final_em: `${final}:00-03:00`, status } })); }
    catch (e) { setErro((e as Error).message); }
    finally { setOcupado(false); }
  };
  return <details className={styles.card}><summary>Configurar a Prova (organização)</summary>
    <p>Escolha 5 músicas prontas. Músicas e datas ficam travadas após a primeira tentativa. Horários de São Paulo.</p>
    <button type="button" onClick={() => void sugerir()} disabled={ocupado}>Sugerir as 5 mais difíceis</button>
    {medida ? <p>{medida}</p> : null}
    <div className={styles.controles}>{Array.from({ length: 5 }, (_, i) => <label key={i}>Música {i + 1}<select value={ids[i] ?? ''} onChange={(e) => setIds((p) => { const n = [...p]; n[i] = Number(e.target.value); return n; })}>
      <option value="">Escolha</option>{catalogo.map((m) => <option value={m.id} key={m.id}>{m.faixa} ({m.artista})</option>)}
    </select></label>)}</div>
    <div className={styles.controles}>
      <label>Eliminatória até<input type="datetime-local" value={eliminatoria} onChange={(e) => setEliminatoria(e.target.value)} /></label>
      <label>Final ao vivo<input type="datetime-local" value={final} onChange={(e) => setFinal(e.target.value)} /></label>
      <label>Fase<select value={status} onChange={(e) => setStatus(e.target.value as StatusProva)}>{(['preparando','eliminatoria','final','encerrada'] as const).map((s) => <option key={s} value={s}>{{ preparando: 'Preparação', eliminatoria: 'Eliminatória', final: 'Final ao vivo', encerrada: 'Encerrada' }[s]}</option>)}</select></label>
      <button type="button" onClick={() => void salvar()} disabled={ocupado || ids.filter(Boolean).length !== 5 || !eliminatoria || !final}>Salvar configuração</button>
    </div>{erro ? <p role="alert">{erro}</p> : null}
  </details>;
}

export default function ProvaTelao({ admin }: { admin: boolean }) {
  const [painel, setPainel] = useState<PainelProva | null>(null);
  const [erro, setErro] = useState('');
  const [etapa, setEtapa] = useState<Etapa>('escolha');
  const etapaRef = useRef<Etapa>('escolha');
  const [pessoa, setPessoa] = useState('');
  const [musicaId, setMusicaId] = useState('');
  const [musica, setMusica] = useState<Musica | null>(null);
  const [nota, setNota] = useState<ResultadoEstudio | null>(null);
  const [abandonada, setAbandonada] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [pontos, setPontos] = useState(0);
  const [placar, setPlacar] = useState(false);
  const [sorteando, setSorteando] = useState(false);
  const [sorteioNome, setSorteioNome] = useState('');
  const [carregando, setCarregando] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const motor = useRef<PontuacaoAoVivo | null>(null);
  const eventos = useRef<EventoAoVivo[]>([]);
  const latencia = useRef(140);
  const offset = useRef(0);
  const tentativa = useRef<{ id: number } | null>(null);
  const abrindo = useRef(false);
  const quadros = useRef<Quadro[]>([]);
  const ultimoEnviado = useRef(-1);
  const requisicao = useRef<Promise<RespostaNota> | null>(null);
  const pitch = useAfinacao(null, { cancelarEco: true });
  const { definirOuvinte, definirModoEstudio, iniciarGravacao, pararGravacao } = pitch;
  const carregar = useCallback(async () => { const d = await api<PainelProva>('/api/karaoke/prova'); setPainel(d); return d; }, []);
  const mudarEtapa = useCallback((e: Etapa) => { etapaRef.current = e; setEtapa(e); }, []);
  const lerMs = useCallback(() => (audio.current?.currentTime ?? 0) * 1000, []);
  const rodando = useCallback(() => Boolean(audio.current && !audio.current.paused && !audio.current.ended), []);
  const micAtivo = useRef(false);
  const ocultoEm = painel?.ranking_oculto_em;
  const souAdmin = painel?.admin;
  useEffect(() => {
    if (!ocultoEm || souAdmin) return;
    let timer: number;
    const verificar = () => {
      const falta = Date.parse(ocultoEm) - Date.now();
      if (falta <= 0) { setPainel((p) => p?.classificacao ? { ...p, classificacao: null } : p); return; }
      timer = window.setTimeout(verificar, Math.min(falta, 2147483647));
    };
    timer = window.setTimeout(verificar, 0);
    return () => window.clearTimeout(timer);
  }, [ocultoEm, souAdmin]);

  useEffect(() => { micAtivo.current = pitch.status === 'ativo'; }, [pitch.status]);
  const lerMic = useCallback(() => micAtivo.current, []);

  useEffect(() => {
    let vivo = true;
    const atualizar = () => { void carregar().catch((e: Error) => { if (vivo) setErro(e.message); }); };
    atualizar(); const timer = window.setInterval(atualizar, 10000);
    return () => { vivo = false; window.clearInterval(timer); };
  }, [carregar]);

  useEffect(() => {
    definirModoEstudio(true);
    definirOuvinte((q) => {
      if (etapaRef.current !== 'cantando') return;
      quadros.current.push(q);
      const m = motor.current;
      if (m) eventos.current.push(...m.adicionarQuadro(q.m ?? 0, q.hz >= HZ_MIN && q.hz <= HZ_MAX ? hzParaMidi(q.hz) : null, q.clareza, q.rms));
    });
    return () => { definirOuvinte(null); definirModoEstudio(false); };
  }, [definirOuvinte, definirModoEstudio]);

  const enviar = useCallback(async (acao: 'parcial' | 'terminar' | 'abandonar'): Promise<RespostaNota | null> => {
    if (!tentativa.current) return null;
    if (requisicao.current) {
      if (acao === 'parcial') return null;
      await requisicao.current.catch(() => undefined);
    }
    const id = tentativa.current?.id;
    if (!id) return null;
    const lote = quadros.current.filter((q) => q.t > ultimoEnviado.current).slice(0, 1000);
    const promessa = api<RespostaNota>('/api/karaoke/prova/tentativas', { method: 'POST', json: { acao, id, quadros: lote }, signal: AbortSignal.timeout(12000) });
    requisicao.current = promessa;
    try {
      const r = await promessa;
      // Retoma de onde o servidor parou: nunca reenvia o que ele já aceitou nem fica preso a um quadro descartado.
      ultimoEnviado.current = Math.max(ultimoEnviado.current, r.ultimo_t ?? -1, r.lote_ate_t ?? -1);
      if (r.status !== 'cantando') tentativa.current = null;
      return r;
    } finally { if (requisicao.current === promessa) requisicao.current = null; }
  }, []);

  const finalizar = useCallback(async (parcial: boolean) => {
    if (etapaRef.current !== 'cantando' && etapaRef.current !== 'nota') return;
    mudarEtapa('nota'); audio.current?.pause(); pararGravacao();
    setNota(motor.current?.resultado(0, true) ?? null); setAbandonada(parcial); setSalvando(true); setErro('');
    try {
      // Espera o lote em voo antes de esvaziar o restante.
      await requisicao.current?.catch(() => undefined);
      while (tentativa.current && quadros.current.filter((q) => q.t > ultimoEnviado.current).length > 1000) await enviar('parcial');
      const r = await enviar(parcial ? 'abandonar' : 'terminar');
      if (r?.resultado) setNota(r.resultado);
      if (r) setAbandonada(r.status === 'abandonada');
      await carregar();
    } catch (e) { setErro(`A nota ainda não foi confirmada: ${(e as Error).message}`); }
    finally { setSalvando(false); }
  }, [carregar, enviar, mudarEtapa, pararGravacao]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (etapaRef.current !== 'cantando') return;
      setPontos(motor.current?.estado().pontos ?? 0);
      void enviar('parcial').then((r) => {
        if (r && r.status !== 'cantando') { setErro('A tentativa foi encerrada por perda de conexão. O último parcial salvo ficou valendo.'); mudarEtapa('nota'); audio.current?.pause(); pararGravacao(); setNota(r.resultado ?? motor.current?.resultado(0, true) ?? null); setAbandonada(r.status === 'abandonada'); void carregar(); }
      }).catch((e: Error) => setErro(`Sem confirmação do telão: ${e.message}`));
    }, 3000);
    const abandonar = () => {
      if (!tentativa.current) return;
      audio.current?.pause();
      const lote = quadros.current.filter((q) => q.t > ultimoEnviado.current).slice(0, 300);
      navigator.sendBeacon('/api/karaoke/prova/tentativas', new Blob([JSON.stringify({ acao: 'abandonar', id: tentativa.current.id, quadros: lote })], { type: 'application/json' }));
    };
    window.addEventListener('pagehide', abandonar);
    return () => { window.clearInterval(timer); window.removeEventListener('pagehide', abandonar); abandonar(); };
  }, [enviar, carregar, mudarEtapa, pararGravacao]);

  const c = painel?.config;
  const proximo = painel?.finalistas?.find((p) => !painel.resultado_final?.some((r) => r.user_id === p.user_id && r.nota_final !== null));
  const userId = c?.status === 'final' ? proximo?.user_id : admin ? Number(pessoa || painel?.eu) : painel?.eu;
  const selecionada = c?.status === 'final' ? c.final_musica : Number(musicaId);
  const nome = painel?.pessoas.find((p) => p.id === userId)?.nome ?? painel?.finalistas?.find((p) => p.user_id === userId)?.nome ?? 'Você';

  const preparar = async () => {
    if (!selecionada || !userId) return;
    setCarregando(true); setErro('');
    try { setMusica(await api<Musica>(`/api/karaoke/prova/musicas/${selecionada}`)); setNota(null); mudarEtapa('regras'); }
    catch (e) { setErro((e as Error).message); }
    finally { setCarregando(false); }
  };
  const comecar = async () => {
    if (!musica || pitch.status !== 'ativo') return;
    quadros.current = []; ultimoEnviado.current = -1; eventos.current = []; setPontos(0); setErro('');
    motor.current = new PontuacaoAoVivo(musica.notas, { nivel: 'dificil', latenciaMs: 140, offsetMs: 0, limiar: 0.008 });
    mudarEtapa('abrindo');
    const a = audio.current;
    if (!a) return;
    a.src = musica.audio_url; a.currentTime = 0;
    try { await a.play(); } catch { mudarEtapa('regras'); setErro('O navegador bloqueou o som. Toque em Começar novamente.'); }
  };
  const aoTocar = async () => {
    if (etapaRef.current !== 'abrindo' || abrindo.current) return;
    abrindo.current = true; audio.current?.pause();
    try {
      const t = await api<{ id: number }>('/api/karaoke/prova/tentativas', { method: 'POST', json: { acao: 'iniciar', user_id: userId, catalogo_id: musica?.id } });
      tentativa.current = t;
      mudarEtapa('cantando');
      if (audio.current) audio.current.currentTime = 0;
      iniciarGravacao(lerMs);
      await audio.current?.play();
    } catch (e) {
      setErro((e as Error).message);
      if (tentativa.current) void finalizar(true); else mudarEtapa('regras');
    } finally { abrindo.current = false; }
  };
  const sortear = async () => {
    setSorteando(true); setErro('');
    let i = 0;
    const timer = window.setInterval(() => { const m = painel?.musicas[i++ % 5]; setSorteioNome(m?.faixa ?? '...'); }, 110);
    try {
      const [d] = await Promise.all([api<PainelProva>('/api/karaoke/prova', { method: 'POST', json: { acao: 'sortear' } }), new Promise((resolve) => window.setTimeout(resolve, 3500))]);
      setPainel(d); setSorteioNome(d.musicas.find((m) => m.id === d.config?.final_musica)?.faixa ?? '');
    } catch (e) { setErro((e as Error).message); }
    finally { window.clearInterval(timer); setSorteando(false); }
  };
  const livre = etapa === 'escolha' || (etapa === 'nota' && !tentativa.current && !salvando);
  return <main className={styles.raiz}>
    <audio ref={audio} preload="auto" onPause={() => { if (etapaRef.current === 'cantando' && !audio.current?.ended) void finalizar(true); }} onPlaying={() => void aoTocar()} onEnded={() => void finalizar(false)} onError={() => { if (tentativa.current) void finalizar(true); else { mudarEtapa('regras'); setErro('Não consegui tocar o instrumental. A tentativa ainda não começou.'); } }} />
    <header className={styles.topo}><h1 className={styles.titulo}>Voz do Natal</h1><span className={styles.oficial}>PROVA OFICIAL · DIFÍCIL</span>{livre ? <Link href="/telao/karaoke">Karaokê livre</Link> : null}</header>
    {erro ? <p className={styles.erro} role="alert">{erro}</p> : null}
    {!painel ? <p>Carregando a Prova...</p> : !c ? <p className={styles.card}>A organização ainda vai escolher as cinco músicas.</p> : <>
      {livre ? <section className={styles.card}>
        <h2 className={styles.titulo}>{c.status === 'final' ? 'Final ao vivo' : 'Prova do Karaokê'}</h2>
        <p>Eliminatória até {dataSP(c.eliminatoria_ate)}. Final: {dataSP(c.final_em)} (São Paulo).</p>
        <p><Link href="/karaoke/prova">Regulamento da Prova</Link></p>
        {c.status === 'eliminatoria' ? <div className={styles.controles}>
          {admin ? <label>Quem canta<select value={pessoa || painel.eu} onChange={(e) => setPessoa(e.target.value)}>{painel.pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label> : null}
          <label>Música oficial<select value={musicaId} onChange={(e) => setMusicaId(e.target.value)}><option value="">Escolha</option>{painel.musicas.map((m) => <option key={m.id} value={m.id}>{m.faixa} ({m.artista})</option>)}</select></label>
          <button type="button" disabled={!selecionada || carregando} onClick={() => void preparar()}>Preparar tentativa oficial</button>
        </div> : null}
        {c.status === 'final' ? <>
          <ol>{painel.finalistas?.map((p) => <li key={p.user_id}>{p.nome}{p.user_id === proximo?.user_id ? ' (próximo a cantar)' : ''}</li>)}</ol>
          {sorteando || sorteioNome || c.final_musica ? <div className={styles.sorteio} role="status">{sorteando ? 'Sorteando: ' : 'Música da final: '}{sorteioNome || painel.musicas.find((m) => m.id === c.final_musica)?.faixa}</div> : null}
          {admin ? <div className={styles.controles}>
            {!c.final_musica ? <button type="button" disabled={sorteando} onClick={() => void sortear()}>Sortear música ao vivo</button> : <button type="button" disabled={!proximo || carregando} onClick={() => void preparar()}>{proximo ? `Preparar ${proximo.nome}` : 'Todos os finalistas já cantaram'}</button>}
          </div> : <p>A final é conduzida por quem organiza, no telão da festa.</p>}
        </> : null}
        {c.status === 'preparando' ? <p>A Prova ainda está em preparação.</p> : null}
        {c.status === 'encerrada' ? <p>Prova encerrada. A Voz do Natal será revelada na festa.</p> : null}
      </section> : null}
      {etapa === 'regras' || etapa === 'abrindo' ? <section className={styles.card}>
        <h2 className={styles.titulo}>Tentativa oficial 1 de 1</h2><p>{nome} · {musica?.faixa}</p>
        <p>Prova oficial: 1 tentativa, nível Difícil, vale o que cantar.</p>
        <p>Sem pular trechos, pausar ou recomeçar. Parar ou fechar o telão encerra a tentativa. O que faltar vale zero, e a conta usa a música inteira.</p>
        <p>Afinação e ritmo rendem pontos nas notas. Linhas bem cantadas e sequências dão bônus. Sem bônus por gestos na Prova.</p>
        <div className={styles.controles}>
          <button type="button" disabled={pitch.status === 'ativo' || etapa === 'abrindo'} onClick={() => void pitch.ligar()}>{pitch.status === 'ativo' ? 'Microfone pronto' : 'Ligar microfone'}</button>
          <button type="button" disabled={pitch.status !== 'ativo' || etapa === 'abrindo'} onClick={() => void comecar()}>{etapa === 'abrindo' ? 'Abrindo apresentação...' : 'Começar tentativa oficial'}</button>
          <button type="button" disabled={etapa === 'abrindo'} onClick={() => mudarEtapa('escolha')}>Voltar sem iniciar</button>
        </div>{pitch.erro ? <p role="alert">{pitch.erro}</p> : null}
      </section> : null}
      {etapa === 'cantando' && musica ? <section className={styles.palco} aria-label="Tentativa oficial em andamento">
        <header><b className={styles.oficial}>OFICIAL</b><p>{nome} · {musica.faixa} · {pontos.toLocaleString('pt-BR')} pontos</p></header>
        <PalcoEstudio linhas={musica.palavras.linhas} notas={musica.notas} lerMs={lerMs} historico={pitch.historico} latenciaRef={latencia} offsetRef={offset} rodando={rodando} motor={motor} eventos={eventos} micAtivo={lerMic} />
      </section> : null}
      {etapa === 'cantando' ? <button type="button" onClick={() => void finalizar(true)}>Parar e registrar nota parcial (sem segunda chance)</button> : null}
      {etapa === 'nota' && nota ? <section className={styles.card} aria-live="polite">
        {!abandonada && nota.nota >= 70 ? <Confete modo="rajada" /> : null}
        <h2>{abandonada ? 'Tentativa abandonada: o parcial valeu' : 'Tentativa oficial concluída'}</h2>
        <p className={styles.numero}>{nota.nota}/100</p>
        <p>Afinação: {Math.round(nota.detalhes.afinacao * 100)}%. Ritmo: {Math.round(nota.detalhes.cobertura * 100)}% do tempo das notas com voz.</p>
        <p>Notas com acerto: {nota.detalhes.notasAcertadas ?? 0} de {nota.resumo.notas}. Notas perfeitas: {nota.resumo.perfeitas}. Maior sequência: {nota.resumo.maiorSequencia}, combo x{nota.resumo.maiorCombo}.</p>
        <p>Como somou: {(nota.detalhes.pontosNotas ?? 0).toFixed(1)} nas notas + {nota.detalhes.bonus ?? 0} nas linhas + {nota.detalhes.comboPontos ?? 0} de combo. Limite: 10.000 pontos. A nota é o total dividido por 100, arredondado.</p>
        <p>A conta considera todas as notas da música. Trechos não cantados valem zero.</p>
        <p>{salvando ? 'Confirmando gravação...' : tentativa.current ? 'Aguardando confirmação. Mantenha o telão aberto.' : 'Nota oficial registrada. Não há segunda tentativa nesta fase.'}</p>
        {tentativa.current ? <button type="button" disabled={salvando} onClick={() => void finalizar(abandonada)}>Tentar confirmar gravação</button> : <button type="button" onClick={() => mudarEtapa('escolha')}>Próximo participante</button>}
      </section> : null}
      {livre ? <section className={styles.card}><button type="button" onClick={() => setPlacar((v) => !v)} aria-expanded={placar}>Placar da Prova</button>
        {placar ? painel.classificacao === null ? <p>Classificação oculta. Resultado na revelação dos brindes.</p> : <table className={styles.tabela}><caption>Eliminatória: soma das 5 músicas (até 500)</caption><thead><tr><th>Posição</th><th>Participante</th><th>Soma</th></tr></thead><tbody>{painel.classificacao.map((p) => <tr key={p.user_id}><td>{p.posicao}º</td><td>{p.nome}</td><td>{p.soma_eliminatoria}</td></tr>)}</tbody></table> : null}
        {placar && painel.resultado_final?.length ? <ol aria-label="Resultado da final">{painel.resultado_final.map((p) => <li key={p.user_id}>{p.nome}: {p.nota_final ?? 'ainda não cantou'}</li>)}</ol> : null}
      </section> : null}
    </>}
    {admin && livre && painel?.tentativas_admin ? <TentativasAdmin classe={styles.card} tentativas={painel.tentativas_admin} aoMudar={setPainel} /> : null}
    {admin && livre ? <Configuracao key={JSON.stringify(c)} config={c ?? null} aoSalvar={setPainel} /> : null}
  </main>;
}
