'use client';
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Captions, Mic2, Music4, SkipForward, Star, Trash2, Video } from 'lucide-react';
import PageHeader from '@/app/ui/PageHeader';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { useMe } from '@/app/ui/user';
import { formatarDuracao, quemCanta, ROTULO_PREPARO, slugDaMusica, type EstadoKaraoke, type ItemFila, type MusicaCatalogo, type MusicaLrclib, type VideoKaraoke } from '@/app/telao/karaoke/tipos';

function Estrelas({ n }: { n: number }) {
  return <span className="inline-flex items-center gap-0.5 text-champagne" aria-label={`${n} de 5 estrelas`}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={13} strokeWidth={1.6} fill={i <= n ? 'currentColor' : 'none'} className={i <= n ? '' : 'opacity-40'} />)}</span>;
}

/** Como a música vai aparecer no telão. */
function SeloModo({ f }: { f: ItemFila }) {
  if (f.modo === 'estudio') return <span className="mt-1 inline-flex items-center gap-1 text-xs text-champagne"><Music4 size={13} strokeWidth={1.6} aria-hidden="true" />Versão estúdio</span>;
  if (f.catalogo_id !== null && f.catalogo_status && f.catalogo_status !== 'pronta') {
    return <span className="mt-1 flex flex-col text-xs text-marfim-3">
      <SeloBase f={f} />
      <span className="inline-flex items-center gap-1 text-champagne"><Music4 size={13} strokeWidth={1.6} aria-hidden="true" />Versão estúdio: {ROTULO_PREPARO[f.catalogo_status]}{f.catalogo_status === 'falhou' ? ' (segue com a letra)' : ''}</span>
    </span>;
  }
  if (f.catalogo_id !== null && f.catalogo_status === 'pronta') {
    return <span className="mt-1 flex flex-col text-xs text-marfim-3"><SeloBase f={f} /><span className="inline-flex items-center gap-1 text-champagne"><Music4 size={13} strokeWidth={1.6} aria-hidden="true" />Versão estúdio pronta: vai tocar assim</span></span>;
  }
  return <SeloBase f={f} />;
}

function SeloBase({ f }: { f: ItemFila }) {
  const letra = f.modo === 'letra';
  return <span className={`mt-1 inline-flex items-center gap-1 text-xs ${letra ? 'text-champagne' : 'text-marfim-3'}`}>
    {letra ? <Captions size={13} strokeWidth={1.6} aria-hidden="true" /> : <Video size={13} strokeWidth={1.6} aria-hidden="true" />}{letra ? 'Letra na tela' : 'Vídeo karaokê'}
  </span>;
}

const EH_LINK = /youtu\.?be|youtube\.com/i;

export default function KaraokeClient() {
  const me = useMe();
  const toast = useToast();
  const [estado, setEstado] = useState<EstadoKaraoke | null>(null);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [musicas, setMusicas] = useState<MusicaLrclib[]>([]);
  const [resultados, setResultados] = useState<VideoKaraoke[]>([]);
  /** false: busca de música com letra; true: busca de vídeo de karaokê no YouTube (ou link). */
  const [porVideo, setPorVideo] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [dueto, setDueto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [catalogo, setCatalogo] = useState<MusicaCatalogo[]>([]);
  const [buscaCat, setBuscaCat] = useState('');
  const [catalogoErro, setCatalogoErro] = useState('');
  const trava = useRef(false);
  const controle = useRef<AbortController | null>(null);

  const carregar = useCallback(async () => {
    try { setEstado(await api<EstadoKaraoke>('/api/karaoke/fila')); setErro(''); }
    catch (e) { setErro((e as Error).message); }
  }, []);

  useEffect(() => {
    void carregar();
    const t = window.setInterval(() => { if (!document.hidden) void carregar(); }, 5000);
    return () => window.clearInterval(t);
  }, [carregar]);
  useEffect(() => () => controle.current?.abort(), []);

  const carregarCatalogo = useCallback(async (q: string) => {
    try { setCatalogo((await api<{ musicas: MusicaCatalogo[] }>(`/api/karaoke/catalogo?q=${encodeURIComponent(q.trim())}`)).musicas); setCatalogoErro(''); }
    catch (e) { setCatalogoErro((e as Error).message); }
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => void carregarCatalogo(buscaCat), buscaCat ? 350 : 0);
    const r = window.setInterval(() => { if (!document.hidden) void carregarCatalogo(buscaCat); }, 10000);
    return () => { window.clearTimeout(t); window.clearInterval(r); };
  }, [buscaCat, carregarCatalogo]);
  const prontas = catalogo.filter((m) => m.status === 'pronta');
  const emPreparo = catalogo.filter((m) => m.status !== 'pronta');
  /** Música do catálogo que corresponde a um resultado do LRCLIB (pelo id ou pelo nome). */
  const doCatalogo = (m: MusicaLrclib) => catalogo.find((c) => c.lrclib_id === m.id) ?? catalogo.find((c) => c.slug === slugDaMusica(m.artista, m.faixa));

  async function buscar(event: React.FormEvent) {
    event.preventDefault();
    controle.current?.abort();
    const c = new AbortController(); controle.current = c;
    setBuscando(true);
    try {
      const termo = encodeURIComponent(busca.trim());
      if (porVideo || EH_LINK.test(busca)) {
        const r = await api<{ videos: VideoKaraoke[] }>(`/api/karaoke/buscar?q=${termo}`, { signal: c.signal });
        setResultados(r.videos); setMusicas([]); setPorVideo(true);
      } else {
        const r = await api<{ musicas: MusicaLrclib[] }>(`/api/karaoke/musica?q=${termo}`, { signal: c.signal });
        setMusicas(r.musicas); setResultados([]);
      }
      setBuscou(true);
    } catch (e) { if (!c.signal.aborted) toast((e as Error).message, 'erro'); }
    finally { if (!c.signal.aborted) setBuscando(false); }
  }

  async function executar(fn: () => Promise<EstadoKaraoke>, sucesso?: string) {
    if (trava.current) return;
    trava.current = true; setOcupado(true);
    try { setEstado(await fn()); if (sucesso) toast(sucesso); }
    catch (e) { toast((e as Error).message, 'erro'); }
    finally { trava.current = false; setOcupado(false); }
  }

  const cantar = (v: VideoKaraoke) => executar(
    () => api<EstadoKaraoke>('/api/karaoke/fila', { method: 'POST', json: { video_id: v.video_id, titulo: v.titulo, canal: v.canal, duracao_s: v.duracao_s, candidatos: resultados.filter((r) => r.video_id !== v.video_id).slice(0, 8), dueto_user_id: dueto ? Number(dueto) : null } }),
    'Você entrou na fila!',
  );
  const cantarEstudio = (c: MusicaCatalogo) => executar(
    async () => {
      const novo = await api<EstadoKaraoke>('/api/karaoke/fila', { method: 'POST', json: { catalogo_id: c.id, dueto_user_id: dueto ? Number(dueto) : null } });
      void carregarCatalogo(buscaCat);
      return novo;
    },
    'Você entrou na fila na versão estúdio!',
  );
  /** Entra na fila como hoje (letra ou vídeo) e, se a música não está no catálogo, pede também a versão estúdio. */
  const cantarMusica = (m: MusicaLrclib) => executar(
    async () => {
      let cat = doCatalogo(m);
      let aviso = '';
      if (!cat) {
        try {
          cat = await api<MusicaCatalogo>('/api/karaoke/catalogo', { method: 'POST', json: { lrclib_id: m.id, artista: m.artista, faixa: m.faixa, duracao_s: m.duracao_s } });
          aviso = 'Preparando versão estúdio (fica pronta em uns 15 min).';
        } catch (e) { aviso = `Versão estúdio não pedida: ${(e as Error).message}`; }
      }
      const comEstudio = cat && cat.status !== 'falhou';
      const novo = await api<EstadoKaraoke>('/api/karaoke/fila', { method: 'POST', json: { lrclib_id: m.id, ...(comEstudio ? { catalogo_id: cat!.id } : {}), dueto_user_id: dueto ? Number(dueto) : null } });
      if (aviso) toast(aviso);
      void carregarCatalogo(buscaCat);
      return novo;
    },
    'Você entrou na fila!',
  );
  const admin = (id: number, acao: 'subir' | 'descer' | 'pular' | 'remover') => executar(() => api<EstadoKaraoke>('/api/karaoke/fila', { method: 'PATCH', json: { id, acao } }));

  const minhas = estado ? estado.fila.map((f, i) => ({ f, pos: i + 1 })).filter(({ f }) => f.user_id === me.id || f.dueto_user_id === me.id) : [];
  const nomeFila = (f: ItemFila) => quemCanta(f);

  return <><PageHeader kicker="A festa canta junto" title="Karaokê da família" /><div className="space-y-6 px-5 pb-8">
    {erro ? <div role="alert" className="surface space-y-3 p-5"><p>{erro}</p><button className="btn btn-ghost w-full" onClick={() => void carregar()}>Tentar novamente</button></div> : null}

    {estado?.atual ? <section className="surface space-y-1 border border-champagne p-5" aria-label="Cantando agora">
      <p className="kicker">Cantando agora</p>
      <p className="display break-words text-2xl">{nomeFila(estado.atual)}</p>
      <p className="break-words text-sm text-marfim-2">{estado.atual.titulo}</p>
      {estado.atual.modo === 'estudio' && estado.atual.parcial !== null ? <p className="text-sm text-champagne" aria-live="polite">Agora: {nomeFila(estado.atual)}, {estado.atual.parcial.toLocaleString('pt-BR')} pontos</p> : null}
    </section> : null}

    {minhas.length ? <section className="surface space-y-3 p-5" aria-label="Minha posição na fila">
      <p className="kicker">Sua vez chega já</p>
      {minhas.map(({ f, pos }) => <div key={f.id} className="flex items-center gap-3">
        <span className="display w-10 shrink-0 text-3xl text-champagne">{pos}º</span>
        <div className="min-w-0"><p className="break-words font-medium">{f.titulo}</p><p className="text-sm text-marfim-2">{pos === 1 ? 'Você é o próximo! Fique perto da TV.' : `${pos - 1} ${pos === 2 ? 'pessoa' : 'pessoas'} na sua frente`}</p></div>
      </div>)}
    </section> : null}

    <section className="surface space-y-3 border border-champagne p-5" aria-label="Versão estúdio">
      <h2 className="display text-2xl">Versão estúdio</h2>
      <p className="inline-flex items-center gap-1 text-xs text-champagne"><Music4 size={14} strokeWidth={1.6} aria-hidden="true" />Estúdio: letra palavra a palavra e nota de verdade</p>
      <label className="block text-sm">Buscar no catálogo
        <input className="field mt-2" value={buscaCat} onChange={(e) => setBuscaCat(e.target.value)} maxLength={120} placeholder="Artista ou música" />
      </label>
      {catalogoErro ? <p className="text-sm text-marfim-2">{catalogoErro}</p> : null}
      {!catalogoErro && !prontas.length ? <p className="text-sm text-marfim-2">{buscaCat.trim() ? 'Nada pronto com esse nome.' : 'Ainda não há músicas prontas. Peça uma na busca abaixo.'}</p> : <ul className="divide-y divide-linha">
        {prontas.map((c) => <li key={c.id} className="flex items-center gap-3 py-3">
          {c.capa_url ? <img src={c.capa_url} alt="" width={48} height={48} loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" /> : null}
          <div className="min-w-0 flex-1"><p className="break-words font-medium">{c.faixa}</p><p className="break-words text-sm text-marfim-2">{c.artista}</p></div>
          <button type="button" className="btn btn-primary min-h-11 shrink-0 gap-1" disabled={ocupado || (estado?.minhasPendentes ?? 0) >= (estado?.maxPendentes ?? 2)} onClick={() => void cantarEstudio(c)}><Mic2 size={18} strokeWidth={1.6} aria-hidden="true" />Cantar</button>
        </li>)}
      </ul>}
      {emPreparo.length ? <div className="space-y-1 pt-1"><p className="text-xs text-marfim-3">Em preparo</p>
        {emPreparo.slice(0, 6).map((c) => <p key={c.id} className="break-words text-sm text-marfim-2">{c.faixa} · {c.artista}: {ROTULO_PREPARO[c.status]}</p>)}
      </div> : null}
    </section>

    <form onSubmit={buscar} className="space-y-3">
      <h2 className="display text-2xl">Quero cantar</h2>
      <p className="text-sm text-marfim-2">{porVideo
        ? 'Busque um vídeo de karaokê no YouTube ou cole o link. A letra é a do próprio vídeo.'
        : 'Busque a música: a letra aparece na TV, palavra por palavra, enquanto você canta.'} Cada pessoa pode ter até {estado?.maxPendentes ?? 2} músicas esperando.</p>
      <label className="block text-sm">{porVideo ? 'Vídeo, música ou link' : 'Música ou artista'}
        <input className="field mt-2" value={busca} onChange={(e) => { setBusca(e.target.value); setBuscou(false); setResultados([]); setMusicas([]); }} maxLength={120} placeholder={porVideo ? 'Então é Natal ou https://youtu.be/...' : 'Então é Natal'} required />
      </label>
      {estado?.pessoas.length ? <label className="block text-sm">Dueto com (opcional)
        <select className="field mt-2" value={dueto} onChange={(e) => setDueto(e.target.value)}>
          <option value="">Vou cantar sozinho(a)</option>
          {estado.pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </label> : null}
      <button className="btn btn-primary w-full" disabled={buscando || !busca.trim()}>{buscando ? 'Buscando...' : porVideo ? 'Buscar vídeo' : 'Buscar música'}</button>
      <button type="button" className="btn btn-quiet w-full" onClick={() => { setPorVideo((v) => !v); setBuscou(false); setResultados([]); setMusicas([]); }}>{porVideo ? 'Voltar para a busca de música com letra' : 'Não achou? Buscar vídeo de karaokê no YouTube'}</button>
    </form>

    {buscou && !porVideo ? <section aria-live="polite"><h2 className="display mb-3 text-2xl">Resultado da busca</h2>
      {!musicas.length ? <p className="text-sm text-marfim-2">Nada encontrado. Tente outro nome ou use a busca de vídeo de karaokê.</p> : <ul className="divide-y divide-linha">
        {musicas.map((m) => <li key={m.id} className="space-y-3 py-4">
          <div className="min-w-0">
            <p className="break-words font-medium">{m.faixa}</p>
            <p className="break-words text-sm text-marfim-2">{m.artista}{m.duracao_s ? ` · ${formatarDuracao(m.duracao_s)}` : ''}</p>
            {m.sincronizada
              ? <span className="mt-1 inline-flex items-center gap-1 text-xs text-champagne"><Captions size={13} strokeWidth={1.6} aria-hidden="true" />Letra sincronizada</span>
              : <span className="mt-1 inline-flex items-center gap-1 text-xs text-marfim-3"><Video size={13} strokeWidth={1.6} aria-hidden="true" />Sem letra sincronizada: toca o vídeo de karaokê</span>}
          </div>
          {(() => {
            const c = doCatalogo(m);
            const cheio = ocupado || (estado?.minhasPendentes ?? 0) >= (estado?.maxPendentes ?? 2);
            if (c?.status === 'pronta') return <>
              <span className="inline-flex items-center gap-1 text-xs text-champagne"><Music4 size={13} strokeWidth={1.6} aria-hidden="true" />Estúdio: letra palavra a palavra e nota de verdade</span>
              <button type="button" className="btn btn-primary w-full gap-2" disabled={cheio} onClick={() => void cantarEstudio(c)}><Mic2 size={18} strokeWidth={1.6} aria-hidden="true" />{ocupado ? 'Preparando...' : 'Quero cantar'}</button>
            </>;
            return <>
              {c && c.status !== 'falhou' ? <span className="block text-xs text-champagne">Preparando versão estúdio ({ROTULO_PREPARO[c.status]}; fica pronta em uns 15 min)</span> : null}
              <button type="button" className="btn btn-primary w-full gap-2" disabled={cheio} onClick={() => void cantarMusica(m)}><Mic2 size={18} strokeWidth={1.6} aria-hidden="true" />{ocupado ? 'Preparando...' : 'Quero cantar'}</button>
              {!c ? <span className="block text-xs text-marfim-3">Também preparamos a versão estúdio (fica pronta em uns 15 min).</span> : null}
            </>;
          })()}
        </li>)}
      </ul>}
    </section> : null}

    {buscou && porVideo ? <section aria-live="polite"><h2 className="display mb-3 text-2xl">Resultado da busca</h2>
      {!resultados.length ? <p className="text-sm text-marfim-2">Nada encontrado. Tente outro nome ou cole o link do vídeo.</p> : <ul className="divide-y divide-linha">
        {resultados.map((v) => <li key={v.video_id} className="space-y-3 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <img src={v.miniatura} alt="" width={112} height={63} loading="lazy" className="h-16 w-28 shrink-0 rounded-xl object-cover" />
            <div className="min-w-0"><p className="line-clamp-2 break-words font-medium">{v.titulo}</p><p className="break-words text-sm text-marfim-2">{v.canal}{v.duracao_s ? ` · ${formatarDuracao(v.duracao_s)}` : ''}</p></div>
          </div>
          <button type="button" className="btn btn-primary w-full gap-2" disabled={ocupado || (estado?.minhasPendentes ?? 0) >= (estado?.maxPendentes ?? 2)} onClick={() => void cantar(v)}><Mic2 size={18} strokeWidth={1.6} aria-hidden="true" />Quero cantar</button>
        </li>)}
      </ul>}
    </section> : null}

    <section><h2 className="display text-2xl">Fila da noite</h2>
      {!estado?.fila.length ? <p className="py-4 text-sm text-marfim-2">A fila está vazia. A primeira música pode ser a sua!</p> : <ol className="divide-y divide-linha">
        {estado.fila.map((f, i) => <li key={f.id} className="space-y-2 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="display w-8 shrink-0 text-xl text-champagne">{i + 1}</span>
            <div className="min-w-0 flex-1"><p className="break-words font-medium">{nomeFila(f)}</p><p className="break-words text-sm text-marfim-2">{f.titulo}</p><SeloModo f={f} /></div>
          </div>
          {me.is_admin ? <div className="flex flex-wrap gap-2" role="group" aria-label={`Organizar ${f.titulo}`}>
            <button type="button" className="btn btn-quiet min-h-11" disabled={ocupado || i === 0} aria-label="Subir na fila" onClick={() => void admin(f.id, 'subir')}><ArrowUp size={18} aria-hidden="true" /></button>
            <button type="button" className="btn btn-quiet min-h-11" disabled={ocupado || i === estado.fila.length - 1} aria-label="Descer na fila" onClick={() => void admin(f.id, 'descer')}><ArrowDown size={18} aria-hidden="true" /></button>
            <button type="button" className="btn btn-quiet min-h-11 gap-1" disabled={ocupado} onClick={() => void admin(f.id, 'pular')}><SkipForward size={18} aria-hidden="true" />Pular</button>
            <button type="button" className="btn btn-quiet min-h-11 gap-1" disabled={ocupado} onClick={() => void admin(f.id, 'remover')}><Trash2 size={18} aria-hidden="true" />Remover</button>
          </div> : null}
        </li>)}
      </ol>}
    </section>

    {estado?.ranking.length ? <section><h2 className="display text-2xl">Ranking da noite</h2><p className="mt-2 text-xs text-marfim-3">Vale a melhor nota de cada pessoa.</p>
      <ol className="divide-y divide-linha">{estado.ranking.map((r, i) => <li key={r.user_id} className="flex items-center gap-3 py-3">
        <span className="display w-8 shrink-0 text-xl text-champagne">{i + 1}</span>
        <span className="min-w-0 flex-1 break-words">{r.nome}<span className="block text-xs text-marfim-3">{r.cantadas} {r.cantadas === 1 ? 'música' : 'músicas'} · média {r.media}</span></span>
        <span className="display shrink-0 text-2xl">{r.melhor}</span>
      </li>)}</ol>
    </section> : null}

    {estado?.feitas.length ? <section><h2 className="display text-2xl">Já cantaram</h2>
      <ul className="divide-y divide-linha">{estado.feitas.map((f) => <li key={f.id} className="flex items-center gap-3 py-3">
        <div className="min-w-0 flex-1"><p className="break-words font-medium">{nomeFila(f)}</p><p className="break-words text-sm text-marfim-2">{f.titulo}</p></div>
        {f.nota !== null && f.estrelas !== null ? <div className="shrink-0 text-right"><p className="display text-xl">{f.nota}</p><Estrelas n={f.estrelas} /></div> : null}
      </li>)}</ul>
    </section> : null}
  </div></>;
}
