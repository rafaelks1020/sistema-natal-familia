'use client';
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Mic2, SkipForward, Star, Trash2 } from 'lucide-react';
import PageHeader from '@/app/ui/PageHeader';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { useMe } from '@/app/ui/user';
import { formatarDuracao, quemCanta, type EstadoKaraoke, type ItemFila, type VideoKaraoke } from '@/app/telao/karaoke/tipos';

function Estrelas({ n }: { n: number }) {
  return <span className="inline-flex items-center gap-0.5 text-champagne" aria-label={`${n} de 5 estrelas`}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={13} strokeWidth={1.6} fill={i <= n ? 'currentColor' : 'none'} className={i <= n ? '' : 'opacity-40'} />)}</span>;
}

export default function KaraokeClient() {
  const me = useMe();
  const toast = useToast();
  const [estado, setEstado] = useState<EstadoKaraoke | null>(null);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<VideoKaraoke[]>([]);
  const [buscou, setBuscou] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [dueto, setDueto] = useState('');
  const [ocupado, setOcupado] = useState(false);
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

  async function buscar(event: React.FormEvent) {
    event.preventDefault();
    controle.current?.abort();
    const c = new AbortController(); controle.current = c;
    setBuscando(true);
    try {
      const r = await api<{ videos: VideoKaraoke[] }>(`/api/karaoke/buscar?q=${encodeURIComponent(busca.trim())}`, { signal: c.signal });
      setResultados(r.videos); setBuscou(true);
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
    () => api<EstadoKaraoke>('/api/karaoke/fila', { method: 'POST', json: { video_id: v.video_id, titulo: v.titulo, canal: v.canal, duracao_s: v.duracao_s, dueto_user_id: dueto ? Number(dueto) : null } }),
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
    </section> : null}

    {minhas.length ? <section className="surface space-y-3 p-5" aria-label="Minha posição na fila">
      <p className="kicker">Sua vez chega já</p>
      {minhas.map(({ f, pos }) => <div key={f.id} className="flex items-center gap-3">
        <span className="display w-10 shrink-0 text-3xl text-champagne">{pos}º</span>
        <div className="min-w-0"><p className="break-words font-medium">{f.titulo}</p><p className="text-sm text-marfim-2">{pos === 1 ? 'Você é o próximo! Fique perto da TV.' : `${pos - 1} ${pos === 2 ? 'pessoa' : 'pessoas'} na sua frente`}</p></div>
      </div>)}
    </section> : null}

    <form onSubmit={buscar} className="space-y-3">
      <h2 className="display text-2xl">Quero cantar</h2>
      <p className="text-sm text-marfim-2">Busque a música (a gente procura a versão karaokê) ou cole o link de um vídeo do YouTube. Cada pessoa pode ter até {estado?.maxPendentes ?? 2} músicas esperando.</p>
      <label className="block text-sm">Música, artista ou link
        <input className="field mt-2" value={busca} onChange={(e) => { setBusca(e.target.value); setBuscou(false); setResultados([]); }} maxLength={120} placeholder="Então é Natal ou https://youtu.be/..." required />
      </label>
      {estado?.pessoas.length ? <label className="block text-sm">Dueto com (opcional)
        <select className="field mt-2" value={dueto} onChange={(e) => setDueto(e.target.value)}>
          <option value="">Vou cantar sozinho(a)</option>
          {estado.pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </label> : null}
      <button className="btn btn-primary w-full" disabled={buscando || !busca.trim()}>{buscando ? 'Buscando...' : 'Buscar música'}</button>
    </form>

    {buscou ? <section aria-live="polite"><h2 className="display mb-3 text-2xl">Resultado da busca</h2>
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
            <div className="min-w-0 flex-1"><p className="break-words font-medium">{nomeFila(f)}</p><p className="break-words text-sm text-marfim-2">{f.titulo}</p></div>
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
