'use client';
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import QRCode from 'qrcode';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Mic, MicOff, Pause, Play } from 'lucide-react';
import { api } from '@/app/ui/client';
import ModerationActions from '@/app/(app)/mural/_components/ModerationActions';
import { AdventoCena, ContagemCena, EXPLOSAO_MS, FRESCA_MS, FotosCena, RecadosCena, TocandoCena, VaziaCena } from './_cenas';
import { JogoTela } from './_jogos';
import { useVoz } from './_voz';
import { falarDuracao, falarLista, interpretarVoz, normalizar, type AcaoVoz } from './voz';
import { AVISO_SEGUNDOS, type AdventoHoje, type Cena, type EstadoTelao, type Jogo, type PlacarItem, type Recado, type Slide } from './tipos';
import styles from './telao.module.css';

type Lean = Omit<EstadoTelao, 'fotos' | 'recados' | 'advento' | 'placar' | 'presentes'>;
interface Camada { id: number; cena: Cena }
interface Ctx { lean: Lean; fotos: Slide[]; recados: Recado[]; advento: AdventoHoje | null; pausado: boolean; fixa: Cena | null; jogoAtivo: boolean }
type Painel = { tipo: 'placar'; ate: number; itens: PlacarItem[] } | { tipo: 'presentes'; ate: number; total: number; nomes: string[] } | { tipo: 'ajuda'; ate: number };

const URL_QR = 'https://natalemfamilia.com.br/mural';
const OCIOSO_MS = 3500;
const SANTA_PARADO_MS = 8 * 60_000;
const FIM_CICLO_MS = 15 * 60_000;

function disponiveis(c: Ctx, agora: number): Cena[] {
  const lista: Cena[] = [];
  if (c.fotos.length) lista.push('fotos');
  if (c.lean.tocando?.tocando && c.lean.tocando.nome) lista.push('tocando');
  if (agora < Date.parse(c.lean.evento.meiaNoite) + FIM_CICLO_MS) lista.push('contagem');
  if (c.recados.length) lista.push('recados');
  if (c.advento) lista.push('advento');
  return lista.length ? lista : ['fotos'];
}

/** Cada cena fica de 20 a 40 s. */
function duracaoDe(cena: Cena, c: Ctx): number {
  if (cena === 'fotos') return Math.min(40, Math.max(20, c.fotos.length * 8));
  if (cena === 'recados') return Math.min(40, Math.max(24, Math.ceil(c.recados.length / 4) * 14));
  if (cena === 'tocando') return 30;
  return 25;
}

export default function ScreenClient({ initial }: { initial: EstadoTelao }) {
  const inicioMs = Date.parse(initial.agora);
  const [lean, setLean] = useState<Lean>(initial);
  const [fotos, setFotos] = useState<Slide[]>(initial.fotos ?? []);
  const [recados, setRecados] = useState<Recado[]>(initial.recados ?? []);
  const [advento, setAdvento] = useState<AdventoHoje | null>(initial.advento ?? null);
  const [now, setNow] = useState(inicioMs);
  const [recebidoEm, setRecebidoEm] = useState(inicioMs);
  const [camadas, setCamadas] = useState<Camada[]>(() => [{ id: 1, cena: initial.controle.cena_fixa ?? ((initial.fotos?.length ?? 0) ? 'fotos' : 'contagem') }]);
  const [fotoInicial, setFotoInicial] = useState(initial.fotos?.[0]?.key ?? '');
  const [forcar, setForcar] = useState({ n: 0, key: '' });
  const [fotoKey, setFotoKey] = useState('');
  const [mostrado, setMostrado] = useState<{ jogo: Jogo | null; fim: number }>({ jogo: initial.jogo, fim: 0 });
  const [santa, setSanta] = useState(() => ({ atual: initial.jogo?.tipo === 'amigo' ? initial.jogo.atual : -2, desde: 0, vistoEm: inicioMs }));
  const [aviso, setAviso] = useState<{ texto: string; ate: number } | null>(() => {
    const c = initial.controle.comando;
    return c?.tipo === 'aviso' && c.idade_ms < AVISO_SEGUNDOS * 1000 ? { texto: c.texto, ate: inicioMs + AVISO_SEGUNDOS * 1000 - c.idade_ms } : null;
  });
  const [painel, setPainel] = useState<Painel | null>(null);
  const [balao, setBalao] = useState<{ ouvi: string; resposta: string; ate: number } | null>(null);
  const [pausaLocal, setPausaLocal] = useState(false);
  const [ocioso, setOcioso] = useState(false);
  const [cheia, setCheia] = useState(false);
  const [erro, setErro] = useState('');
  const [qr, setQr] = useState('');

  const offsetRef = useRef(inicioMs - Date.now());
  const idRef = useRef(1);
  const cenaRef = useRef<Cena>(camadas[0].cena);
  const cenaDesdeRef = useRef(inicioMs);
  const fotosRef = useRef<Slide[]>(initial.fotos ?? []);
  const filaRef = useRef<string[]>([]);
  const cursorRef = useRef(initial.fotos?.[0]?.key ?? '');
  const vistasRef = useRef(new Set((initial.fotos ?? []).map((f) => f.key)));
  const ultimoCmdRef = useRef(initial.controle.comando?.id ?? '');
  const marcaRef = useRef(initial.marca);
  const precisaPesadoRef = useRef(false);
  const fixaRef = useRef<Cena | null>(initial.controle.cena_fixa);
  const jogoAntesRef = useRef(false);
  const ultimaVozRef = useRef({ texto: '', em: 0 });
  const falarRef = useRef<(texto: string) => void>(() => {});
  const ctxRef = useRef<Ctx | null>(null);

  const santaParado = lean.jogo?.tipo === 'amigo' && !lean.jogo.encerrado && santa.atual === lean.jogo.atual && now - santa.vistoEm > SANTA_PARADO_MS;
  const jogo = santaParado ? null : lean.jogo;
  const pausado = lean.controle.pausado || pausaLocal;
  const fixa = lean.controle.cena_fixa;

  // Último jogo fica na tela por um instante depois de acabar (saída suave) e some do DOM em seguida.
  if (jogo && jogo !== mostrado.jogo) setMostrado({ jogo, fim: 0 });
  else if (!jogo && mostrado.jogo && mostrado.fim === 0) setMostrado({ jogo: mostrado.jogo, fim: now });
  const mostrarJogo = mostrado.jogo && (jogo || now - mostrado.fim < 1000);

  useEffect(() => {
    ctxRef.current = { lean, fotos, recados, advento, pausado, fixa, jogoAtivo: Boolean(jogo) };
  });

  // ---------- navegação entre cenas ----------
  const proximaFoto = useCallback((atual: string): string => {
    const fila = filaRef.current;
    while (fila.length) {
      const k = fila.shift() as string;
      if (fotosRef.current.some((f) => f.key === k)) return k;
    }
    const lista = fotosRef.current;
    if (!lista.length) return '';
    const i = lista.findIndex((f) => f.key === atual);
    return lista[(i + 1) % lista.length].key;
  }, []);

  const aoMostrarFoto = useCallback((key: string) => {
    cursorRef.current = key;
    filaRef.current = filaRef.current.filter((k) => k !== key);
    setFotoKey(key);
  }, []);

  const irPara = useCallback((nova: Cena) => {
    cenaDesdeRef.current = Date.now() + offsetRef.current;
    if (cenaRef.current === nova) return;
    cenaRef.current = nova;
    idRef.current += 1;
    const id = idRef.current;
    if (nova === 'fotos') {
      const lista = fotosRef.current;
      const i = lista.findIndex((f) => f.key === cursorRef.current);
      const fila = filaRef.current.find((k) => lista.some((f) => f.key === k));
      setFotoInicial(fila ?? lista[(i + 1) % Math.max(1, lista.length)]?.key ?? '');
    }
    setCamadas((p) => [...p.slice(-1), { id, cena: nova }]);
  }, []);

  const navegar = useCallback((delta: 1 | -1) => {
    const c = ctxRef.current;
    if (!c) return;
    const agora = Date.now() + offsetRef.current;
    const lista = disponiveis(c, agora);
    const i = lista.indexOf(cenaRef.current);
    irPara(lista[(((i === -1 && delta === -1 ? 0 : i + delta) % lista.length) + lista.length) % lista.length]);
  }, [irPara]);

  const chamarFotos = useCallback((key: string) => {
    const c = ctxRef.current;
    if (!c || c.jogoAtivo || c.fixa || c.pausado) return;
    if (cenaRef.current === 'fotos') {
      filaRef.current = filaRef.current.filter((k) => k !== key);
      setForcar((f) => ({ n: f.n + 1, key }));
    } else {
      irPara('fotos');
    }
  }, [irPara]);

  // ---------- leitura do servidor ----------
  const aplicar = useCallback((e: EstadoTelao) => {
    const agoraS = Date.parse(e.agora);
    offsetRef.current = agoraS - Date.now();
    const { fotos: listaFotos, recados: listaRecados, advento: adv, placar: _placar, presentes: _presentes, ...resto } = e;
    void _placar; void _presentes;
    setRecebidoEm(agoraS);
    setNow(agoraS);
    setLean((p) => ({ ...resto, tocando: resto.tocando ?? p.tocando }));
    if (listaRecados) setRecados(listaRecados);
    if (adv !== undefined) setAdvento(adv);
    if (listaFotos) {
      const validas = new Set(listaFotos.map((f) => f.key));
      const novas = listaFotos.filter((f) => !vistasRef.current.has(f.key) && agoraS - Date.parse(f.created_at) < FRESCA_MS);
      vistasRef.current = validas;
      fotosRef.current = listaFotos;
      marcaRef.current = e.marca;
      filaRef.current = [...novas.map((f) => f.key), ...filaRef.current.filter((k) => validas.has(k))];
      setFotos(listaFotos);
      if (novas.length) chamarFotos(novas[0].key);
    } else if (e.marca !== marcaRef.current) {
      precisaPesadoRef.current = true;
    }
    // Amigo oculto: guarda quando a vez mudou (suspense) e quando foi visto pela primeira vez.
    if (e.jogo?.tipo === 'amigo') {
      const atual = e.jogo.atual;
      setSanta((s) => (s.atual === atual ? s : { atual, desde: s.atual === -2 ? 0 : agoraS, vistoEm: agoraS }));
    }
    // Comandos do celular: cada um roda uma vez.
    const cmd = e.controle.comando;
    if (cmd && cmd.id !== ultimoCmdRef.current) {
      ultimoCmdRef.current = cmd.id;
      if (cmd.tipo === 'aviso') {
        const resta = AVISO_SEGUNDOS * 1000 - cmd.idade_ms;
        if (resta > 0) setAviso({ texto: cmd.texto, ate: agoraS + resta });
      } else if (cmd.idade_ms < 20_000) {
        navegar(cmd.tipo === 'proxima' ? 1 : -1);
      }
    }
    const meiaNoite = Date.parse(e.evento.meiaNoite);
    const explosao = agoraS >= meiaNoite && agoraS < meiaNoite + EXPLOSAO_MS;
    if (e.controle.cena_fixa && e.controle.cena_fixa !== cenaRef.current && !explosao) irPara(e.controle.cena_fixa);
    if (!e.controle.cena_fixa && fixaRef.current) cenaDesdeRef.current = agoraS;
    fixaRef.current = e.controle.cena_fixa;
  }, [chamarFotos, irPara, navegar]);

  useEffect(() => {
    const ctl = new AbortController();
    let lendo = false;
    let ultimoPesado = Date.now();
    const rodar = async () => {
      if (lendo) return;
      lendo = true;
      try {
        const pesado = precisaPesadoRef.current || Date.now() - ultimoPesado > 60_000;
        const e = await api<EstadoTelao>(`/api/telao/estado${pesado ? '?inclui=fotos,recados,advento' : ''}`, { signal: ctl.signal });
        if (ctl.signal.aborted) return;
        if (pesado) { precisaPesadoRef.current = false; ultimoPesado = Date.now(); }
        aplicar(e);
        setErro('');
      } catch (e) {
        if (!ctl.signal.aborted) setErro((e as Error).message);
      } finally { lendo = false; }
    };
    const t = setInterval(() => void rodar(), 3000);
    return () => { ctl.abort(); clearInterval(t); };
  }, [aplicar]);

  // ---------- relógio e rodízio das cenas ----------
  useEffect(() => {
    const t = setInterval(() => {
      const agora = Date.now() + offsetRef.current;
      setNow(agora);
      const c = ctxRef.current;
      if (!c) return;
      const meiaNoite = Date.parse(c.lean.evento.meiaNoite);
      const explosao = agora >= meiaNoite && agora < meiaNoite + EXPLOSAO_MS;
      if (jogoAntesRef.current && !c.jogoAtivo) cenaDesdeRef.current = agora;
      jogoAntesRef.current = c.jogoAtivo;
      if (c.jogoAtivo) return;
      // Meia-noite: a explosão de Feliz Natal tem a tela (só os jogos passam na frente).
      if (explosao) { if (cenaRef.current !== 'contagem') irPara('contagem'); return; }
      if (c.pausado || c.fixa) return;
      const lista = disponiveis(c, agora);
      if (!lista.includes(cenaRef.current) || agora - cenaDesdeRef.current >= duracaoDe(cenaRef.current, c) * 1000) navegar(1);
    }, 1000);
    return () => clearInterval(t);
  }, [irPara, navegar]);

  // Cena que saiu some depois da transição.
  useEffect(() => {
    if (camadas.length < 2) return;
    const t = setTimeout(() => setCamadas((p) => p.slice(-1)), 1600);
    return () => clearTimeout(t);
  }, [camadas]);

  // ---------- voz ----------
  const mostrarBalao = useCallback((ouvi: string, resposta: string) => {
    setBalao({ ouvi, resposta, ate: Date.now() + offsetRef.current + 6000 });
    falarRef.current(resposta);
  }, []);

  const executarVoz = useCallback(async (ouvi: string, acao: AcaoVoz) => {
    const c = ctxRef.current;
    if (!c) return;
    const agora = Date.now() + offsetRef.current;
    const travada = 'A cena está fixada pelo celular de quem organiza.';
    const pedido = ouvi.charAt(0).toUpperCase() + ouvi.slice(1);
    switch (acao.tipo) {
      case 'proxima': if (c.fixa) return mostrarBalao(pedido, travada); navegar(1); return mostrarBalao(pedido, 'Próxima.');
      case 'volta': if (c.fixa) return mostrarBalao(pedido, travada); navegar(-1); return mostrarBalao(pedido, 'Voltando.');
      case 'pausa': setPausaLocal(true); return mostrarBalao(pedido, 'Pausado. Diga Natal, continua, para seguir.');
      case 'continua':
        setPausaLocal(false);
        return mostrarBalao(pedido, c.lean.controle.pausado ? 'O telão foi pausado pelo celular de quem organiza.' : 'Continuando.');
      case 'ciclo': setPausaLocal(false); return mostrarBalao(pedido, c.fixa ? 'Peça a quem organiza para soltar a cena fixa.' : 'De volta ao ciclo automático.');
      case 'ajuda':
        setPainel({ tipo: 'ajuda', ate: agora + 20_000 });
        return mostrarBalao(pedido, 'Diga Natal e depois: próxima, volta, pausa, mostra as fotos, mostra a música, quanto falta, mostra o placar ou quem está aqui.');
      case 'placar': {
        const e = await api<EstadoTelao>('/api/telao/estado?inclui=placar').catch(() => null);
        const itens = e?.placar ?? [];
        setPainel({ tipo: 'placar', ate: Date.now() + offsetRef.current + 15_000, itens });
        if (!itens.length) return mostrarBalao(pedido, 'Ainda não tem placar do quiz.');
        const [a, b, d] = itens;
        return mostrarBalao(pedido, `Na frente está ${a.nome}, com ${a.pontos} pontos${b ? `, depois ${b.nome}` : ''}${d ? ` e ${d.nome}` : ''}.`);
      }
      case 'presentes': {
        const e = await api<EstadoTelao>('/api/telao/estado?inclui=presentes').catch(() => null);
        const p = e?.presentes ?? { total: 0, nomes: [] };
        setPainel({ tipo: 'presentes', ate: Date.now() + offsetRef.current + 15_000, total: p.total, nomes: p.nomes });
        if (!p.total) return mostrarBalao(pedido, 'Ninguém entrou no aplicativo hoje ainda.');
        return mostrarBalao(pedido, `Hoje já entraram no aplicativo ${p.total} ${p.total === 1 ? 'pessoa' : 'pessoas'}: ${falarLista(p.nomes.slice(0, 8))}.`);
      }
      case 'cena': {
        if (c.fixa) return mostrarBalao(pedido, travada);
        const lista = disponiveis(c, agora);
        const meiaNoite = Date.parse(c.lean.evento.meiaNoite);
        const { ceia, troca } = c.lean.evento;
        const t = c.lean.tocando;
        if (acao.cena === 'contagem') {
          irPara('contagem');
          if (agora >= meiaNoite) return mostrarBalao(pedido, 'Já é Natal! Feliz Natal!');
          return mostrarBalao(pedido, agora < Date.parse(troca) ? `Faltam ${falarDuracao(Date.parse(ceia) - agora)} para a ceia.` : `Faltam ${falarDuracao(meiaNoite - agora)} para a meia-noite.`);
        }
        if (!lista.includes(acao.cena)) {
          const falta = { fotos: 'Ainda não tem fotos.', tocando: 'Não tem música tocando agora.', recados: 'Ainda não tem recados no mural.', advento: 'O Advento só vai de 1 a 24 de dezembro.', contagem: '' }[acao.cena];
          return mostrarBalao(pedido, falta);
        }
        irPara(acao.cena);
        if (acao.cena === 'tocando') return mostrarBalao(pedido, `Tocando agora: ${t?.nome}${t?.artista ? `, de ${t.artista}` : ''}.${t?.adicionada_por ? ` Pedida por ${t.adicionada_por}.` : ''}`);
        if (acao.cena === 'advento') return mostrarBalao(pedido, `Hoje é o dia ${c.advento?.dia} do Advento: ${c.advento?.titulo}.`);
        return mostrarBalao(pedido, acao.cena === 'fotos' ? 'Aqui estão as fotos da noite.' : 'Aqui estão os últimos recados do mural.');
      }
    }
  }, [irPara, mostrarBalao, navegar]);

  const aoOuvir = useCallback((alternativas: string[]) => {
    for (const alt of alternativas) {
      const acao = interpretarVoz(alt);
      if (!acao) continue;
      const texto = normalizar(alt);
      const agora = Date.now();
      // O reconhecedor às vezes repete a mesma frase: executa uma vez.
      if (ultimaVozRef.current.texto === texto && agora - ultimaVozRef.current.em < 2500) return;
      ultimaVozRef.current = { texto, em: agora };
      void executarVoz(alt.trim(), acao);
      return;
    }
    // Ouviu "Natal" mas não entendeu o pedido.
    const frase = normalizar(alternativas[0] ?? '');
    if (/\bnatal\b/.test(frase) && frase.split(' ').length > 1 && !/\bfeliz natal\b/.test(frase)) mostrarBalao(alternativas[0].trim(), 'Não entendi. Diga Natal, ajuda.');
  }, [executarVoz, mostrarBalao]);

  const voz = useVoz(aoOuvir);
  useEffect(() => { falarRef.current = voz.falar; }, [voz.falar]);

  // ---------- tela cheia, cursor, descanso de tela, teclas ----------
  const alternarTelaCheia = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void document.documentElement.requestFullscreen?.().catch(() => setErro('Use a opção de tela cheia do navegador.'));
  }, []);

  useEffect(() => {
    const mudou = () => setCheia(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', mudou);
    return () => document.removeEventListener('fullscreenchange', mudou);
  }, []);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const acordar = () => { setOcioso(false); clearTimeout(t); t = setTimeout(() => setOcioso(true), OCIOSO_MS); };
    t = setTimeout(() => setOcioso(true), OCIOSO_MS);
    const eventos = ['mousemove', 'mousedown', 'touchstart', 'keydown'] as const;
    eventos.forEach((ev) => window.addEventListener(ev, acordar, { passive: true }));
    return () => { clearTimeout(t); eventos.forEach((ev) => window.removeEventListener(ev, acordar)); };
  }, []);

  useEffect(() => {
    let lock: { release?: () => Promise<void> } | null = null;
    const pedir = async () => {
      try {
        const wl = (navigator as unknown as { wakeLock?: { request: (tipo: 'screen') => Promise<{ release?: () => Promise<void>; addEventListener?: (e: string, f: () => void) => void }> } }).wakeLock;
        if (!wl) return;
        const l = await wl.request('screen');
        lock = l;
        l.addEventListener?.('release', () => { if (lock === l) lock = null; });
      } catch { /* sem Wake Lock: o descanso de tela segue as regras da TV */ }
    };
    void pedir();
    const voltou = () => { if (document.visibilityState === 'visible' && !lock) void pedir(); };
    document.addEventListener('visibilitychange', voltou);
    return () => { document.removeEventListener('visibilitychange', voltou); void lock?.release?.().catch(() => undefined); };
  }, []);

  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      const alvo = ev.target as HTMLElement | null;
      if (ev.ctrlKey || ev.metaKey || ev.altKey || alvo?.closest('button, a, input, textarea, summary')) return;
      if (ev.key === 'f' || ev.key === 'F') { ev.preventDefault(); alternarTelaCheia(); }
      else if (ev.key === 'ArrowRight' && !ctxRef.current?.fixa) navegar(1);
      else if (ev.key === 'ArrowLeft' && !ctxRef.current?.fixa) navegar(-1);
      else if (ev.key === ' ') { ev.preventDefault(); setPausaLocal((p) => !p); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [alternarTelaCheia, navegar]);

  useEffect(() => {
    let vivo = true;
    QRCode.toDataURL(URL_QR, { margin: 1, width: 480, errorCorrectionLevel: 'M', color: { dark: '#171b18', light: '#f3ebdc' } })
      .then((url) => { if (vivo) setQr(url); }).catch(() => undefined);
    return () => { vivo = false; };
  }, []);

  // ---------- desenho ----------
  const fotoAtual = fotos.find((f) => f.key === fotoKey);
  const cenaAtual = camadas[camadas.length - 1].cena;
  const elemento = (cena: Cena) => {
    switch (cena) {
      case 'fotos': return fotos.length ? <FotosCena fotos={fotos} agora={now} inicial={fotoInicial} forcar={forcar} proxima={proximaFoto} aoMostrar={aoMostrarFoto} /> : <VaziaCena />;
      case 'tocando': return <TocandoCena t={lean.tocando} agora={now} recebidoEm={recebidoEm} />;
      case 'contagem': return <ContagemCena agora={now} evento={lean.evento} />;
      case 'recados': return recados.length ? <RecadosCena recados={recados} /> : <VaziaCena />;
      case 'advento': return <AdventoCena a={advento} />;
    }
  };
  const relogio = new Date(now).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  const balaoVisivel = balao && now < balao.ate;
  const painelVisivel = painel && now < painel.ate ? painel : null;
  const avisoVisivel = aviso && now < aviso.ate ? aviso : null;

  return <main className={`${styles.root} ${ocioso ? styles.semMouse : ''}`}>
    <div className={styles.palco}>
      {camadas.map((c, i) => <div key={c.id} className={i === camadas.length - 1 ? styles.cena : styles.cenaSai}>{elemento(c.cena)}</div>)}
    </div>

    {mostrarJogo && mostrado.jogo && <div className={jogo ? styles.jogoEntra : styles.jogoSai}>
      <JogoTela jogo={jogo ?? mostrado.jogo} agora={now} recebidoEm={recebidoEm} amigoDesde={santa.desde} />
    </div>}

    <header className={styles.topo}>
      <p className={styles.marca}>Natal em Família · {lean.ano}</p>
      <time className={styles.relogio}>{relogio}</time>
    </header>

    <aside className={styles.qr} aria-label="Código para enviar fotos">
      {qr && <img src={qr} alt="QR code para o mural da família" />}
      <p className={styles.qrTexto}>Aponte o celular e mande sua foto</p>
      <p className={styles.qrLink}>natalemfamilia.com.br/mural</p>
    </aside>

    {pausado && <p className={styles.selo2} role="status"><Pause size={18} /> Pausado</p>}
    {erro && <p className={styles.reconectando} role="status">Reconectando...</p>}
    {voz.ativa && <p className={styles.ouvindo} aria-label="Voz ativada"><Mic size={18} /><span>Diga &quot;Natal&quot;</span></p>}

    {painelVisivel && <section className={styles.painel} aria-live="polite">
      {painelVisivel.tipo === 'placar' && <><p className={styles.kicker}>Quiz da Família</p><h2 className={styles.painelTitulo}>Placar</h2>{painelVisivel.itens.length ? <ol className={styles.painelLista}>{painelVisivel.itens.map((p, i) => <li key={`${p.nome}-${i}`}><span>{i + 1}</span><span>{p.nome}</span><b>{p.pontos}</b></li>)}</ol> : <p className={styles.texto}>Ainda não tem placar.</p>}</>}
      {painelVisivel.tipo === 'presentes' && <><p className={styles.kicker}>No aplicativo hoje</p><h2 className={styles.painelTitulo}>{painelVisivel.total} {painelVisivel.total === 1 ? 'pessoa' : 'pessoas'}</h2>{painelVisivel.nomes.length ? <p className={styles.painelNomes}>{painelVisivel.nomes.join(' · ')}</p> : <p className={styles.texto}>Ninguém entrou ainda.</p>}</>}
      {painelVisivel.tipo === 'ajuda' && <><p className={styles.kicker}>Diga &quot;Natal&quot; e depois</p><ul className={styles.painelAjuda}>{['próxima', 'volta', 'pausa', 'continua', 'mostra as fotos', 'mostra a música', 'quanto falta', 'mostra o placar', 'quem está aqui'].map((x) => <li key={x}>{x}</li>)}</ul></>}
    </section>}

    {balaoVisivel && balao && <div className={styles.balao} role="status" aria-live="polite"><p>Entendi: &ldquo;{balao.ouvi}&rdquo;</p><p className={styles.balaoResposta}>{balao.resposta}</p></div>}

    {avisoVisivel && <div className={styles.aviso} role="alert"><p className={styles.kicker}>Aviso</p><p className={avisoVisivel.texto.length > 60 ? styles.avisoTextoLongo : styles.avisoTexto}>{avisoVisivel.texto}</p></div>}

    <div className={`${styles.controles} ${ocioso ? styles.controlesOcultos : ''}`}>
      <button type="button" className={styles.botao} onClick={alternarTelaCheia}><Maximize2 size={18} /> {cheia ? 'Sair da tela cheia' : 'Tela cheia (F)'}</button>
      {voz.suportado && <button type="button" className={styles.botao} onClick={() => { if (voz.ativa) voz.desativar(); else { voz.ativar(); voz.falar('Voz ativada. Diga Natal e o que você quer.'); } }}>{voz.ativa ? <><MicOff size={18} /> Desativar voz</> : <><Mic size={18} /> Ativar voz</>}</button>}
      <button type="button" className={styles.botao} onClick={() => setPausaLocal((p) => !p)}>{pausaLocal ? <><Play size={18} /> Continuar</> : <><Pause size={18} /> Pausar</>}</button>
      <details className={styles.menu}>
        <summary className={styles.botao}>Opções</summary>
        <div className={styles.menuCaixa}>
          <Link className="btn btn-quiet min-h-11 w-full justify-start px-4 text-sm" href="/festa">Voltar à festa</Link>
          {lean.meId && cenaAtual === 'fotos' && fotoAtual?.user_id && fotoAtual.user_id !== lean.meId && <ModerationActions key={fotoAtual.key} userId={fotoAtual.user_id} name={fotoAtual.nome} {...(fotoAtual.source === 'desafio' ? { alvoTipo: 'desafio', alvoId: fotoAtual.id } : { postId: fotoAtual.id })} />}
        </div>
      </details>
      {voz.erro && <p className={styles.erroVoz} role="alert">{voz.erro}</p>}
    </div>
  </main>;
}

