'use client';
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import QRCode from 'qrcode';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Mic, MicOff, Pause, Play } from 'lucide-react';
import { api } from '@/app/ui/client';
import ModerationActions from '@/app/(app)/mural/_components/ModerationActions';
import { AdventoCena, ContagemCena, FRESCA_MS, FotosCena, RecadosCena, TocandoCena, VaziaCena } from './_cenas';
import { JogoTela } from './_jogos';
import { JogoNovoTela } from './_jogos_novos';
import { KaraokeCena } from './_karaoke';
import { AtivarSomTelao, AvisoReconectarTelao, PlayerTelao, useSpotifyTelao } from './_spotify';
import { ReacoesFlutuantes, RecadoVivo, useAoVivo } from './_aovivo';
import { BrindeCena } from './cenas/Brinde';
import { CeiaCena } from './cenas/Ceia';
import { LareiraCena } from './cenas/Lareira';
import { LinhaDoTempoCena } from './cenas/LinhaDoTempo';
import { PapaiNoelCena } from './cenas/PapaiNoel';
import { ViradaCena } from './cenas/Virada';
import { useVoz } from './_voz';
import { itemAtivo, noiteDoEvento } from './roteiro';
import { AJUDA_VOZ, falarDuracao, falarLista, interpretarVoz, normalizar, TEXTO_AJUDA_VOZ, type AcaoVoz } from './voz';
import {
  AVISO_SEGUNDOS, ehCena, FRASE_BRINDE_PADRAO, type AdventoHoje, type Cena, type ComandoTelao, type EstadoTelao, type FotoOficial, type Jogo,
  type PlacarItem, type PratoCeia, type Recado, type Slide, type TocandoTelao,
} from './tipos';
import styles from './telao.module.css';

type Lean = Omit<EstadoTelao, 'fotos' | 'recados' | 'advento' | 'placar' | 'presentes' | 'pratos' | 'fotosOficiais' | 'nomesPresentes'>;
interface Camada { id: number; cena: Cena }
/** Cena fixada neste aparelho (roteiro, brinde, voz). A do organizador (lean.controle.cena_fixa) manda mais. */
interface FixaLocal { cena: Cena; ate: number | null }
interface Brinde { frase: string; inicio: number }
interface Ctx {
  lean: Lean; fotos: Slide[]; recados: Recado[]; advento: AdventoHoje | null; pratos: PratoCeia[]; fotosOficiais: FotoOficial[];
  tocando: TocandoTelao | null; pausado: boolean; fixa: Cena | null; fixaLocal: FixaLocal | null; jogoAtivo: boolean;
  spPronto: boolean; spVolume: number;
}
type Painel = { tipo: 'placar'; ate: number; itens: PlacarItem[] } | { tipo: 'presentes'; ate: number; total: number; nomes: string[] } | { tipo: 'ajuda'; ate: number };

const URL_QR = 'https://natalemfamilia.com.br/mural';
const URL_QR_VIVO = 'https://natalemfamilia.com.br/ao-vivo';
const VIRADA_ANTES_MS = 60_000;
const VIRADA_DEPOIS_MS = 3 * 60_000;
const BRINDE_MS = 60_000;
const VOLUME_PASSO = 15;
/** Cenas que dependem de dado: saem da tela na hora se o dado sumir. As demais só saem pelo tempo. */
const DEPENDEM_DE_DADO: ReadonlySet<Cena> = new Set<Cena>(['fotos', 'tocando', 'karaoke', 'recados', 'advento', 'contagem', 'ceia', 'linha']);
const OCIOSO_MS = 3500;
const SANTA_PARADO_MS = 8 * 60_000;
const FIM_CICLO_MS = 15 * 60_000;

/** A virada de Natal toma a tela de 1 minuto antes até 3 minutos depois da meia-noite. */
function naVirada(agora: number, meiaNoite: number): boolean {
  return agora >= meiaNoite - VIRADA_ANTES_MS && agora < meiaNoite + VIRADA_DEPOIS_MS;
}

/** Dia 24/12, de 17h às 23h50 em São Paulo. */
function noRadarDoPapaiNoel(agora: number): boolean {
  const partes = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(agora));
  const v = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  const min = v('hour') * 60 + v('minute');
  return v('month') === 12 && v('day') === 24 && min >= 17 * 60 && min < 23 * 60 + 50;
}

function brindeDoComando(cmd: ComandoTelao, referencia: number): Brinde | null {
  if (cmd.tipo !== 'brinde' || cmd.idade_ms >= BRINDE_MS) return null;
  return { frase: cmd.texto.trim() || FRASE_BRINDE_PADRAO, inicio: referencia - cmd.idade_ms };
}

const fixaValida = (f: FixaLocal | null, agora: number): Cena | null => (f && (f.ate == null || agora < f.ate) ? f.cena : null);

function disponiveis(c: Ctx, agora: number): Cena[] {
  const lista: Cena[] = [];
  if (c.fotos.length) lista.push('fotos');
  if (c.tocando?.tocando && c.tocando.nome) lista.push('tocando', 'karaoke');
  if (agora < Date.parse(c.lean.evento.meiaNoite) + FIM_CICLO_MS) lista.push('contagem');
  if (c.recados.length) lista.push('recados');
  if (c.advento) lista.push('advento');
  if (c.pratos.length) lista.push('ceia');
  if (new Set(c.fotosOficiais.map((f) => f.ano)).size >= 2) lista.push('linha');
  if (noRadarDoPapaiNoel(agora)) lista.push('papainoel');
  // A lareira é a cena de descanso: só aparece sozinha quando não há mais nada para mostrar.
  return lista.length ? lista : ['lareira'];
}

/** Cada cena fica de 20 a 40 s. */
function duracaoDe(cena: Cena, c: Ctx): number {
  if (cena === 'fotos') return Math.min(40, Math.max(20, c.fotos.length * 8));
  if (cena === 'recados') return Math.min(40, Math.max(24, Math.ceil(c.recados.length / 4) * 14));
  if (cena === 'tocando') return 30;
  if (cena === 'karaoke') return 40;
  if (cena === 'ceia' || cena === 'papainoel') return 30;
  if (cena === 'linha') return 30;
  if (cena === 'brinde') return BRINDE_MS / 1000;
  return 25;
}

export default function ScreenClient({ initial }: { initial: EstadoTelao }) {
  const inicioMs = Date.parse(initial.agora);
  const [lean, setLean] = useState<Lean>(initial);
  const [fotos, setFotos] = useState<Slide[]>(initial.fotos ?? []);
  const [recados, setRecados] = useState<Recado[]>(initial.recados ?? []);
  const [advento, setAdvento] = useState<AdventoHoje | null>(initial.advento ?? null);
  const [pratos, setPratos] = useState<PratoCeia[]>(initial.pratos ?? []);
  const [fotosOficiais, setFotosOficiais] = useState<FotoOficial[]>(initial.fotosOficiais ?? []);
  const [nomes, setNomes] = useState<string[]>(initial.nomesPresentes ?? []);
  const [brinde, setBrinde] = useState<Brinde | null>(() => (initial.controle.comando ? brindeDoComando(initial.controle.comando, inicioMs) : null));
  const [fixaLocal, setFixaLocal] = useState<FixaLocal | null>(() => {
    const b = initial.controle.comando ? brindeDoComando(initial.controle.comando, inicioMs) : null;
    return b ? { cena: 'brinde', ate: b.inicio + BRINDE_MS } : null;
  });
  const [anoLinha, setAnoLinha] = useState<{ ano: number; ate: number } | null>(null);
  const [now, setNow] = useState(inicioMs);
  const [recebidoEm, setRecebidoEm] = useState(inicioMs);
  const [camadas, setCamadas] = useState<Camada[]>(() => {
    const cmd = initial.controle.comando;
    const cena: Cena = naVirada(inicioMs, Date.parse(initial.evento.meiaNoite)) ? 'virada'
      : cmd && brindeDoComando(cmd, inicioMs) ? 'brinde'
      : initial.controle.cena_fixa ?? ((initial.fotos?.length ?? 0) ? 'fotos' : 'contagem');
    return [{ id: 1, cena }];
  });
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
  const [qrVivo, setQrVivo] = useState('');

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
  const roteiroRef = useRef<{ id: number | null; iniciado: boolean }>({ id: null, iniciado: false });

  const santaParado = lean.jogo?.tipo === 'amigo' && !lean.jogo.encerrado && santa.atual === lean.jogo.atual && now - santa.vistoEm > SANTA_PARADO_MS;
  const jogo = santaParado ? null : lean.jogo;
  const pausado = lean.controle.pausado || pausaLocal;
  const fixa = lean.controle.cena_fixa;

  // Spotify no telão (só quem é admin tem o token) e camada ao vivo (reações e recados dos celulares).
  const sp = useSpotifyTelao({ ativo: lean.souAdmin });
  const ao = useAoVivo();
  const { controlar: controlarSp } = sp;
  const faixaSp = sp.faixa;
  const tocandoEfetivo: TocandoTelao | null = faixaSp
    ? { tocando: sp.tocando, nome: faixaSp.nome, artista: faixaSp.artista, capa_url: faixaSp.capa, progresso_ms: faixaSp.posicao_ms, duracao_ms: faixaSp.duracao_ms,
      adicionada_por: lean.tocando?.nome === faixaSp.nome ? lean.tocando.adicionada_por : null }
    : lean.tocando;

  // Último jogo fica na tela por um instante depois de acabar (saída suave) e some do DOM em seguida.
  if (jogo && jogo !== mostrado.jogo) setMostrado({ jogo, fim: 0 });
  else if (!jogo && mostrado.jogo && mostrado.fim === 0) setMostrado({ jogo: mostrado.jogo, fim: now });
  const mostrarJogo = mostrado.jogo && (jogo || now - mostrado.fim < 1000);

  useEffect(() => {
    ctxRef.current = {
      lean, fotos, recados, advento, pratos, fotosOficiais, tocando: tocandoEfetivo, pausado, fixa, fixaLocal,
      jogoAtivo: Boolean(jogo) || Boolean(lean.jogoNovo), spPronto: sp.pronto && Boolean(faixaSp), spVolume: sp.volume,
    };
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
    setFixaLocal(null);
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
    const { fotos: listaFotos, recados: listaRecados, advento: adv, placar: _placar, presentes: _presentes,
      pratos: listaPratos, fotosOficiais: listaOficiais, nomesPresentes: listaNomes, ...resto } = e;
    void _placar; void _presentes;
    setRecebidoEm(agoraS);
    setNow(agoraS);
    setLean((p) => ({ ...resto, tocando: resto.tocando ?? p.tocando }));
    if (listaRecados) setRecados(listaRecados);
    if (adv !== undefined) setAdvento(adv);
    if (listaPratos) setPratos(listaPratos);
    if (listaOficiais) setFotosOficiais(listaOficiais);
    if (listaNomes) setNomes(listaNomes);
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
      } else if (cmd.tipo === 'brinde') {
        const b = brindeDoComando(cmd, agoraS);
        if (b) {
          setBrinde(b);
          setFixaLocal({ cena: 'brinde', ate: b.inicio + BRINDE_MS });
          irPara('brinde');
        }
      } else if (cmd.idade_ms < 20_000) {
        navegar(cmd.tipo === 'proxima' ? 1 : -1);
      }
    }
    const meiaNoite = Date.parse(e.evento.meiaNoite);
    const virada = naVirada(agoraS, meiaNoite);
    if (e.controle.cena_fixa && e.controle.cena_fixa !== cenaRef.current && !virada) irPara(e.controle.cena_fixa);
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
        // Os nomes de quem está no app só interessam perto da virada.
        const meiaNoite = Date.parse(ctxRef.current?.lean.evento.meiaNoite ?? '');
        const perto = Math.abs(Date.now() + offsetRef.current - meiaNoite) < 10 * 60_000;
        const inclui = `fotos,recados,advento,ceia,linha${perto ? ',nomes' : ''}`;
        const e = await api<EstadoTelao>(`/api/telao/estado${pesado ? `?inclui=${inclui}` : ''}`, { signal: ctl.signal });
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

  // ---------- roteiro da noite ----------
  // Roda uma vez por item: o id aplicado fica na ref. O controle fixo do organizador manda mais que o roteiro.
  const aplicarRoteiro = useCallback((c: Ctx, agora: number) => {
    const item = noiteDoEvento(c.lean.evento.ceia, agora) ? itemAtivo(c.lean.roteiro, agora) : null;
    const id = item ? item.id : null;
    const ref = roteiroRef.current;
    if (ref.iniciado && ref.id === id) return;
    // Na primeira leitura (telão recém-aberto) só retoma a cena: não repete aviso nem recomeça a música.
    const primeira = !ref.iniciado;
    roteiroRef.current = { id, iniciado: true };
    if (!item) return;
    if (item.acao.startsWith('cena:')) {
      const cena = item.acao.slice(5);
      if (!ehCena(cena) || c.fixa) return;
      setFixaLocal({ cena, ate: null });
      if (cena === 'brinde') setBrinde({ frase: item.texto?.trim() || FRASE_BRINDE_PADRAO, inicio: primeira ? 0 : agora });
      if (!naVirada(agora, Date.parse(c.lean.evento.meiaNoite))) irPara(cena);
    } else if (item.acao === 'ciclo') {
      setFixaLocal(null);
    } else if (item.acao === 'aviso') {
      if (!primeira && item.texto) setAviso({ texto: item.texto, ate: agora + AVISO_SEGUNDOS * 1000 });
    } else if (item.acao.startsWith('musica:')) {
      // Só o admin tem o Spotify: para os outros a rota devolveria 403.
      if (!primeira && c.lean.souAdmin) void api('/api/spotify/player', { method: 'POST', json: { acao: 'tocar', momento: item.acao.slice(7) } }).catch(() => undefined);
    }
  }, [irPara]);

  // ---------- relógio e rodízio das cenas ----------
  useEffect(() => {
    const t = setInterval(() => {
      const agora = Date.now() + offsetRef.current;
      setNow(agora);
      const c = ctxRef.current;
      if (!c) return;
      const meiaNoite = Date.parse(c.lean.evento.meiaNoite);
      aplicarRoteiro(c, agora);
      if (jogoAntesRef.current && !c.jogoAtivo) cenaDesdeRef.current = agora;
      jogoAntesRef.current = c.jogoAtivo;
      if (c.jogoAtivo) return;
      // Virada: de 1 min antes a 3 min depois da meia-noite a cena toma a tela (só os jogos passam na frente).
      if (naVirada(agora, meiaNoite)) { if (cenaRef.current !== 'virada') irPara('virada'); return; }
      if (c.pausado || c.fixa || fixaValida(c.fixaLocal, agora)) return;
      const lista = disponiveis(c, agora);
      const sumiu = DEPENDEM_DE_DADO.has(cenaRef.current) && !lista.includes(cenaRef.current);
      if (sumiu || agora - cenaDesdeRef.current >= duracaoDe(cenaRef.current, c) * 1000) navegar(1);
    }, 1000);
    return () => clearInterval(t);
  }, [aplicarRoteiro, irPara, navegar]);

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
      case 'ciclo': setPausaLocal(false); setFixaLocal(null); return mostrarBalao(pedido, c.fixa ? 'Peça a quem organiza para soltar a cena fixa.' : 'De volta ao ciclo automático.');
      case 'ajuda':
        setPainel({ tipo: 'ajuda', ate: agora + 20_000 });
        return mostrarBalao(pedido, TEXTO_AJUDA_VOZ);
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
      case 'musica': {
        if (!c.spPronto) return mostrarBalao(pedido, 'A música do telão não está ligada neste aparelho.');
        const volume = (delta: number) => controlarSp({ acao: 'volume', valor: Math.min(100, Math.max(0, c.spVolume + delta)) });
        switch (acao.acao) {
          case 'proxima': controlarSp('proxima'); return mostrarBalao(pedido, 'Próxima música.');
          case 'anterior': controlarSp('anterior'); return mostrarBalao(pedido, 'Música anterior.');
          case 'pausar': controlarSp('pausar'); return mostrarBalao(pedido, 'Música pausada.');
          case 'continuar': controlarSp('continuar'); return mostrarBalao(pedido, 'Tocando.');
          case 'mais_alto': volume(VOLUME_PASSO); return mostrarBalao(pedido, 'Mais alto.');
          case 'mais_baixo': volume(-VOLUME_PASSO); return mostrarBalao(pedido, 'Mais baixo.');
        }
        return;
      }
      case 'fotos_ano': {
        if (c.fixa) return mostrarBalao(pedido, travada);
        // As fotos do ciclo são todas da edição atual; os outros anos vêm das fotos oficiais da família.
        if (acao.ano === c.lean.ano) {
          if (!c.fotos.length) return mostrarBalao(pedido, 'Ainda não tem fotos.');
          setFixaLocal(null); setAnoLinha(null); irPara('fotos');
          return mostrarBalao(pedido, `Aqui estão as fotos de ${acao.ano}.`);
        }
        if (!c.fotosOficiais.some((f) => f.ano === acao.ano)) return mostrarBalao(pedido, `Não encontrei fotos de ${acao.ano}.`);
        setFixaLocal(null);
        setAnoLinha({ ano: acao.ano, ate: agora + 90_000 });
        irPara('linha');
        return mostrarBalao(pedido, `Aqui está o Natal de ${acao.ano}.`);
      }
      case 'cena': {
        if (c.fixa) return mostrarBalao(pedido, travada);
        setFixaLocal(null);
        const lista = disponiveis(c, agora);
        const meiaNoite = Date.parse(c.lean.evento.meiaNoite);
        const { ceia, troca } = c.lean.evento;
        const t = c.tocando;
        if (acao.cena === 'contagem') {
          irPara('contagem');
          if (agora >= meiaNoite) return mostrarBalao(pedido, 'Já é Natal! Feliz Natal!');
          return mostrarBalao(pedido, agora < Date.parse(troca) ? `Faltam ${falarDuracao(Date.parse(ceia) - agora)} para a ceia.` : `Faltam ${falarDuracao(meiaNoite - agora)} para a meia-noite.`);
        }
        switch (acao.cena) {
          case 'brinde':
            setBrinde({ frase: FRASE_BRINDE_PADRAO, inicio: agora });
            setFixaLocal({ cena: 'brinde', ate: agora + BRINDE_MS });
            irPara('brinde');
            return mostrarBalao(pedido, 'Levantem as taças!');
          case 'virada': irPara('virada'); return mostrarBalao(pedido, 'Contagem final para o Natal.');
          case 'lareira': irPara('lareira'); return mostrarBalao(pedido, 'Aqui está a lareira.');
          case 'papainoel': irPara('papainoel'); return mostrarBalao(pedido, 'Vamos ver por onde anda o Papai Noel.');
          case 'ceia':
            if (!c.pratos.length) return mostrarBalao(pedido, 'Ninguém cadastrou pratos da ceia ainda.');
            irPara('ceia');
            return mostrarBalao(pedido, 'Este é o cardápio da ceia.');
          case 'linha':
            if (!c.fotosOficiais.length) return mostrarBalao(pedido, 'Ainda não tem fotos oficiais de outros anos.');
            setAnoLinha(null);
            irPara('linha');
            return mostrarBalao(pedido, 'O Natal da família através dos anos.');
          case 'karaoke':
            if (!(c.tocando?.tocando && c.tocando.nome)) return mostrarBalao(pedido, 'Não tem música tocando agora.');
            irPara('karaoke');
            return mostrarBalao(pedido, 'Hora de cantar junto!');
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
  }, [controlarSp, irPara, mostrarBalao, navegar]);

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
    QRCode.toDataURL(URL_QR_VIVO, { margin: 1, width: 320, errorCorrectionLevel: 'M', color: { dark: '#171b18', light: '#f3ebdc' } })
      .then((url) => { if (vivo) setQrVivo(url); }).catch(() => undefined);
    return () => { vivo = false; };
  }, []);

  // ---------- desenho ----------
  const fotoAtual = fotos.find((f) => f.key === fotoKey);
  const cenaAtual = camadas[camadas.length - 1].cena;
  const recebidoTocando = faixaSp ? now : recebidoEm;
  const fotosLinha = anoLinha && now < anoLinha.ate ? fotosOficiais.filter((f) => f.ano === anoLinha.ano) : fotosOficiais;
  const elemento = (cena: Cena) => {
    switch (cena) {
      case 'fotos': return fotos.length ? <FotosCena fotos={fotos} agora={now} inicial={fotoInicial} forcar={forcar} proxima={proximaFoto} aoMostrar={aoMostrarFoto} /> : <VaziaCena />;
      case 'tocando': return <TocandoCena t={tocandoEfetivo} agora={now} recebidoEm={recebidoTocando} />;
      case 'karaoke': return tocandoEfetivo?.nome
        ? <KaraokeCena nome={tocandoEfetivo.nome} artista={tocandoEfetivo.artista ?? ''} capa={tocandoEfetivo.capa_url} duracaoMs={tocandoEfetivo.duracao_ms}
          posicaoMs={faixaSp ? tocandoEfetivo.progresso_ms : tocandoEfetivo.progresso_ms + (tocandoEfetivo.tocando ? Math.max(0, now - recebidoEm) : 0)} />
        : <VaziaCena />;
      case 'virada': return <ViradaCena agora={now} meiaNoite={lean.evento.meiaNoite} nomes={nomes} />;
      case 'ceia': return <CeiaCena pratos={pratos} />;
      case 'linha': return <LinhaDoTempoCena fotos={fotosLinha} agora={now} />;
      case 'lareira': return <LareiraCena agora={now} />;
      case 'papainoel': return <PapaiNoelCena agora={now} />;
      case 'brinde': return <BrindeCena frase={brinde?.frase ?? FRASE_BRINDE_PADRAO} inicio={brinde?.inicio ?? 0} agora={now} />;
      case 'contagem': return <ContagemCena agora={now} evento={lean.evento} />;
      case 'recados': return recados.length ? <RecadosCena recados={recados} /> : <VaziaCena />;
      case 'advento': return <AdventoCena a={advento} />;
    }
  };
  const relogio = new Date(now).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  const balaoVisivel = balao && now < balao.ate;
  const painelVisivel = painel && now < painel.ate ? painel : null;
  const avisoVisivel = aviso && now < aviso.ate ? aviso : null;
  const playerVisivel = !ocioso && sp.pronto && Boolean(faixaSp);

  return <main className={`${styles.root} ${ocioso ? styles.semMouse : ''}`}>
    <div className={styles.palco}>
      {camadas.map((c, i) => <div key={c.id} className={i === camadas.length - 1 ? styles.cena : styles.cenaSai}>{elemento(c.cena)}</div>)}
    </div>

    {mostrarJogo && mostrado.jogo && <div className={jogo ? styles.jogoEntra : styles.jogoSai}>
      <JogoTela jogo={jogo ?? mostrado.jogo} agora={now} recebidoEm={recebidoEm} amigoDesde={santa.desde} />
    </div>}

    {!mostrarJogo && lean.jogoNovo && <div className={styles.jogoEntra}><JogoNovoTela jogo={lean.jogoNovo} agora={now} /></div>}

    <ReacoesFlutuantes reacoes={ao.reacoes} />
    <RecadoVivo recado={ao.recados} />
    {ao.pendentes.length ? (
      <div style={{ position: 'absolute', zIndex: 9, top: '10vmin', right: '3vmin', padding: '1vmin 2vmin', borderRadius: '999px',
        background: 'rgba(197, 41, 45, 0.92)', color: '#F3EBDC', fontSize: '2vmin', fontWeight: 700 }}>
        {ao.pendentes.length === 1 ? '1 recado esperando aprovação no controle' : `${ao.pendentes.length} recados esperando aprovação no controle`}
      </div>
    ) : null}

    <header className={styles.topo}>
      <p className={styles.marca}>Natal em Família · {lean.ano}</p>
      <time className={styles.relogio}>{relogio}</time>
    </header>

    <aside className={`${styles.qr} ${playerVisivel ? styles.qrEscondido : ''}`} aria-label="Código para enviar fotos">
      {qr && <img src={qr} alt="QR code para o mural da família" />}
      <p className={styles.qrTexto}>Aponte o celular e mande sua foto</p>
      <p className={styles.qrLink}><span>natalemfamilia.com.br</span><span>/mural</span></p>
    </aside>

    {(cenaAtual === 'lareira' || ocioso) && qrVivo && <aside className={`${styles.qrVivo} ${playerVisivel ? styles.qrEscondido : ''}`} aria-label="Código para mandar reações e recados">
      <img src={qrVivo} alt="QR code para reações e recados ao vivo" />
      <p className={styles.qrVivoTexto}>Mande reações e recados</p>
      <p className={styles.qrLink}><span>natalemfamilia.com.br</span><span>/ao-vivo</span></p>
    </aside>}

    {sp.precisaClique && <AtivarSomTelao onAtivar={() => void sp.ativar()} />}
    {sp.precisaReconectar && <AvisoReconectarTelao />}
    <PlayerTelao estado={{ pronto: sp.pronto, tocando: sp.tocando, faixa: faixaSp, volume: sp.volume }} controlar={controlarSp} ocioso={ocioso} />

    {pausado && <p className={styles.selo2} role="status"><Pause size={18} /> Pausado</p>}
    {erro && <p className={styles.reconectando} role="status">Reconectando...</p>}
    {voz.ativa && <p className={styles.ouvindo} aria-label="Voz ativada"><Mic size={18} /><span>Diga &quot;Natal&quot;</span></p>}

    {painelVisivel && <section className={styles.painel} aria-live="polite">
      {painelVisivel.tipo === 'placar' && <><p className={styles.kicker}>Quiz da Família</p><h2 className={styles.painelTitulo}>Placar</h2>{painelVisivel.itens.length ? <ol className={styles.painelLista}>{painelVisivel.itens.map((p, i) => <li key={`${p.nome}-${i}`}><span>{i + 1}</span><span>{p.nome}</span><b>{p.pontos}</b></li>)}</ol> : <p className={styles.texto}>Ainda não tem placar.</p>}</>}
      {painelVisivel.tipo === 'presentes' && <><p className={styles.kicker}>No aplicativo hoje</p><h2 className={styles.painelTitulo}>{painelVisivel.total} {painelVisivel.total === 1 ? 'pessoa' : 'pessoas'}</h2>{painelVisivel.nomes.length ? <p className={styles.painelNomes}>{painelVisivel.nomes.join(' · ')}</p> : <p className={styles.texto}>Ninguém entrou ainda.</p>}</>}
      {painelVisivel.tipo === 'ajuda' && <><p className={styles.kicker}>Diga &quot;Natal&quot; e depois</p><ul className={styles.painelAjuda}>{AJUDA_VOZ.map((x) => <li key={x}>{x}</li>)}</ul></>}
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

