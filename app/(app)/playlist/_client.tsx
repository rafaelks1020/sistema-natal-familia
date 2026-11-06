'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import PageHeader from '@/app/ui/PageHeader';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { useMe } from '@/app/ui/user';
import type { playlistData, Retrospectiva as RetroDados, Track } from '@/app/api/spotify/_service';
import type { Momento } from '@/app/api/spotify/momentos';

type Data = Awaited<ReturnType<typeof playlistData>>;
type Song = Pick<Track, 'track_uri' | 'nome' | 'artista' | 'capa_url'>;

function Cover({ song }: { song: Song }) {
  return song.capa_url ? <a href={`https://open.spotify.com/track/${song.track_uri.split(':')[2]}`} target="_blank" rel="noreferrer" aria-label={`Ouvir ${song.nome} no Spotify`} className="shrink-0">{/* eslint-disable-next-line @next/next/no-img-element */}
<img src={song.capa_url} alt={`Capa de ${song.nome}`} width={56} height={56} className="h-14 w-14 rounded-xl object-cover" /></a> : null;
}

function Previa({ uri }: { uri: string }) {
  // Player oficial do Spotify da música: prévia de 30 s para quem não está logado, música inteira para quem está.
  return <iframe title="Prévia da música no Spotify" src={`https://open.spotify.com/embed/track/${uri.split(':')[2]}?utm_source=generator&theme=0`} width="100%" height={80} loading="lazy" allow="autoplay; clipboard-write; encrypted-media" className="rounded-xl border-0" />;
}

function Coracao({ cheio }: { cheio: boolean }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill={cheio ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.7 4.5 7 4.5c1.9 0 3.7 1 5 2.8 1.3-1.8 3.1-2.8 5-2.8 3.3 0 5.4 3.1 4.2 6.6-1.7 4.8-9.2 9.4-9.2 9.4z" /></svg>;
}

const porVotos = (a: Track, b: Track) => b.votos - a.votos || a.created_at.localeCompare(b.created_at) || a.id - b.id;

function Retrospectiva({ r }: { r: RetroDados }) {
  if (!r.total) return null;
  return <section className={`surface space-y-4 p-5 ${r.destaque ? 'border border-champagne' : ''}`} aria-labelledby="retro-titulo">
    <p className="kicker">{r.destaque ? `O som do Natal de ${r.ano}` : `Edição ${r.ano}`}</p>
    <h2 id="retro-titulo" className="display text-2xl">Retrospectiva musical</h2>
    {r.mais_votadas.length ? <div><h3 className="text-sm text-marfim-2">Músicas mais votadas</h3><ol className="divide-y divide-linha">{r.mais_votadas.map((song, i) => <li key={song.track_uri} className="flex min-w-0 items-center gap-3 py-3"><span className="display w-6 shrink-0 text-xl text-champagne">{i + 1}</span><div className="min-w-0 flex-1"><p className="break-words font-medium">{song.nome}</p><p className="break-words text-sm text-marfim-2">{song.artista}</p></div><span className="shrink-0 text-sm text-marfim-2">{song.votos} {song.votos === 1 ? 'voto' : 'votos'}</span></li>)}</ol></div> : <p className="text-sm text-marfim-2">Ainda não há músicas votadas.</p>}
    {r.artista_mais_pedido ? <p className="text-sm">Artista mais pedido: <span className="font-medium">{r.artista_mais_pedido.nome}</span> ({r.artista_mais_pedido.total})</p> : null}
    {r.quem_mais_adicionou.length ? <div><h3 className="text-sm text-marfim-2">Quem mais adicionou</h3><ol className="divide-y divide-linha">{r.quem_mais_adicionou.map(autor => <li key={autor.nome} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="min-w-0 break-words">{autor.nome}</span><span className="shrink-0 text-marfim-2">{autor.total}</span></li>)}</ol></div> : null}
    <div><h3 className="text-sm text-marfim-2">Músicas por momento</h3><ul className="divide-y divide-linha">{r.por_momento.map(m => <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span>{m.nome}</span><span className="text-marfim-2">{m.total}</span></li>)}</ul></div>
  </section>;
}

export default function PlaylistClient({ initial, initialError }: { initial: Data | null; initialError: string }) {
  const me = useMe();
  const toast = useToast();
  const params = useSearchParams();
  const [data, setData] = useState(initial);
  const [momento, setMomento] = useState<Momento>('festa');
  const [trocando, setTrocando] = useState(false);
  const [retro, setRetro] = useState<RetroDados | null>(null);
  const [error, setError] = useState(initialError);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ouvindo, setOuvindo] = useState<string | null>(null);
  const [pedido, setPedido] = useState('');
  const [linkTexto, setLinkTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const lock = useRef(false);
  const searchController = useRef<AbortController | null>(null);
  const pedidoCarga = useRef(0);
  useEffect(() => { const message = params.get('spotify'); if (message) toast(message === 'conectada' ? 'Spotify conectado. Escolha as músicas da família!' : message, message === 'conectada' ? undefined : 'erro'); }, [params, toast]);
  useEffect(() => () => searchController.current?.abort(), []);
  const carregarRetro = useCallback(async () => {
    try { setRetro(await api<RetroDados>('/api/spotify/retrospectiva')); } catch { /* seção opcional */ }
  }, []);
  useEffect(() => { void carregarRetro(); }, [carregarRetro]);
  async function reload(alvo: Momento = momento) {
    const carga = ++pedidoCarga.current;
    try {
      const novo = await api<Data>(`/api/spotify?momento=${alvo}`);
      if (carga === pedidoCarga.current) { setData(novo); setError(''); }
    } catch (cause) { if (carga === pedidoCarga.current) setError((cause as Error).message); }
  }
  async function trocarMomento(alvo: Momento) {
    if (alvo === momento) return;
    searchController.current?.abort();
    setMomento(alvo); setResults([]); setSearched(false); setSearching(false); setOuvindo(null); setPedido('');
    setTrocando(true);
    await reload(alvo);
    setTrocando(false);
  }
  async function votar(song: Track) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const r = await api<{ votou: boolean; votos: number }>('/api/spotify/votar', { method: 'POST', json: { track_id: song.id } });
      setData(atual => atual ? { ...atual, tracks: atual.tracks.map(t => t.id === song.id ? { ...t, votei: r.votou, votos: r.votos } : t).sort(porVotos) } : atual);
      void carregarRetro();
    } catch (cause) { toast((cause as Error).message, 'erro'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function search(event: React.FormEvent) {
    event.preventDefault();
    searchController.current?.abort();
    const controller = new AbortController(); searchController.current = controller;
    setSearching(true);
    try { const response = await api<{ tracks: Song[] }>(`/api/spotify/buscar?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal }); setResults(response.tracks); setSearched(true); }
    catch (cause) { if (!controller.signal.aborted) toast((cause as Error).message, 'erro'); }
    finally { if (!controller.signal.aborted) setSearching(false); }
  }
  async function mutate(song: Song, remove: boolean) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      await api(`/api/spotify/${remove ? 'remover' : 'adicionar'}`, { method: remove ? 'DELETE' : 'POST', json: { track_uri: song.track_uri, momento } });
      await reload(); void carregarRetro(); toast(remove ? 'Música removida.' : 'Música adicionada.');
    } catch (cause) { toast((cause as Error).message, 'erro'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function pedir(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await api('/api/spotify/pedido', { method: 'POST', json: { texto: pedido, momento } }); setPedido(''); await reload(); void carregarRetro(); toast('Pedido enviado.'); }
    catch (cause) { toast((cause as Error).message, 'erro'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function apagar(id: number) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await api('/api/spotify/pedido', { method: 'DELETE', json: { id } }); await reload(); void carregarRetro(); toast('Pedido removido.'); }
    catch (cause) { toast((cause as Error).message, 'erro'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function salvarLink(event: React.FormEvent) {
    event.preventDefault();
    setSalvando(true);
    try { await api('/api/spotify/link', { method: 'PUT', json: { link: linkTexto } }); setLinkTexto(''); await reload(); toast('Link da playlist salvo.'); }
    catch (cause) { toast((cause as Error).message, 'erro'); }
    finally { setSalvando(false); }
  }
  return <><PageHeader kicker="O som da nossa festa" title="Playlist da família" /><div className="space-y-6 px-5 pb-8">
    {retro?.destaque ? <Retrospectiva r={retro} /> : null}
    <div role="tablist" aria-label="Momento da noite" className="grid grid-cols-3 gap-2">{(data?.momentos || [{ id: 'jantar', nome: 'Jantar' }, { id: 'festa', nome: 'Festa' }, { id: 'amigo_oculto', nome: 'Amigo oculto' }] as { id: Momento; nome: string }[]).map(m => <button key={m.id} type="button" role="tab" aria-selected={momento === m.id} disabled={trocando} className={`btn min-h-11 px-2 text-sm ${momento === m.id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => void trocarMomento(m.id)}>{m.nome}</button>)}</div>
    {data ? <p className="text-sm text-marfim-2" aria-live="polite">{data.momentos.find(m => m.id === momento)?.descricao}</p> : null}
    {error ? <div role="alert" className="surface space-y-3 p-5"><p>{error}</p><button className="btn btn-ghost w-full" onClick={() => void reload()}>Tentar novamente</button></div> : null}
    {data ? <section className="surface space-y-4 p-5" aria-busy={trocando}><p className="kicker">Natal em Família {data.ano}</p><p>Você escolheu {data.minhas} de {data.limite} músicas neste momento.</p>
      {data.embed_id ? <iframe key={momento} title="Playlist do Natal no Spotify" src={`https://open.spotify.com/embed/playlist/${data.embed_id}?utm_source=generator&theme=0`} width="100%" height={380} loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" className="w-full rounded-xl border-0" /> : <p className="text-sm text-marfim-2">{me.is_admin ? 'Cole abaixo o link da playlist do Spotify para ela aparecer aqui.' : 'Quem organiza vai colocar a playlist aqui em breve. Enquanto isso, você já pode pedir músicas.'}</p>}
      {data.link ? <a href={data.link} target="_blank" rel="noreferrer" className="btn btn-primary w-full">Abrir no Spotify e adicionar músicas</a> : null}</section> : null}
    {me.is_admin ? <details className="surface p-5" open={!data?.link}><summary className="min-h-11 cursor-pointer">Link da playlist do Spotify</summary><form onSubmit={salvarLink} className="space-y-3 text-sm text-marfim-2"><p>No Spotify, abra a playlist, toque em Compartilhar e escolha o link de convite para colaborar. Cole aqui uma vez só.</p>{data?.link ? <p className="break-all">Link atual: {data.link}</p> : null}<input className="field" type="url" inputMode="url" placeholder="https://open.spotify.com/playlist/..." aria-label="Link da playlist do Spotify" value={linkTexto} onChange={e => setLinkTexto(e.target.value)} maxLength={500} required /><button className="btn btn-primary w-full" disabled={salvando || !linkTexto.trim()}>{salvando ? 'Salvando...' : 'Salvar link'}</button></form></details> : null}
    {me.is_admin ? <details className="surface p-5"><summary className="min-h-11 cursor-pointer">Busca automática (opcional)</summary><div className="space-y-3 text-sm text-marfim-2"><p>Só funciona se o Spotify liberar a Web API para a conta dona do aplicativo (em modo de desenvolvimento, isso exige Premium). Sem ela, o link da playlist e os pedidos da família já resolvem.</p><p className="break-all">Retorno a cadastrar no painel: https://natalemfamilia.com.br/api/spotify/callback</p><a href="/api/spotify/conectar" className="btn btn-ghost w-full">{data?.connected ? 'Reconectar Spotify' : 'Conectar Spotify'}</a></div></details> : null}
    {data?.api ? <><form onSubmit={search} className="space-y-3"><h2 className="display text-2xl">Pedir uma música</h2><p className="text-sm text-marfim-2">Busque, ouça a prévia para conferir e adicione na playlist.</p><label className="block text-sm">Nome da música ou artista<input className="field mt-2" value={query} onChange={e => { setQuery(e.target.value); setSearched(false); setResults([]); searchController.current?.abort(); setSearching(false); }} maxLength={100} required /></label><button className="btn btn-primary w-full" disabled={searching || !query.trim()}>{searching ? 'Buscando...' : 'Buscar música'}</button></form>
      {searched ? <section><h2 className="display mb-3 text-2xl">Resultado da busca</h2>{!results.length ? <p className="text-sm text-marfim-2">Nenhuma música encontrada. Tente outro nome.</p> : <ul className="divide-y divide-linha">{results.map(song => <li key={song.track_uri} className="space-y-3 py-4"><div className="flex min-w-0 items-center gap-3"><Cover song={song} /><div className="min-w-0"><p className="break-words font-medium">{song.nome}</p><p className="break-words text-sm text-marfim-2">{song.artista}</p></div></div><button type="button" className="btn btn-quiet min-h-11 w-full" aria-expanded={ouvindo === song.track_uri} onClick={() => setOuvindo(ouvindo === song.track_uri ? null : song.track_uri)}>{ouvindo === song.track_uri ? 'Fechar prévia' : 'Ouvir prévia'}</button>{ouvindo === song.track_uri ? <Previa uri={song.track_uri} /> : null}<button className="btn btn-ghost w-full" disabled={busy || data.minhas >= data.limite || data.tracks.some(t => t.track_uri === song.track_uri)} onClick={() => void mutate(song, false)}>{data.tracks.some(t => t.track_uri === song.track_uri) ? 'Já está na playlist' : 'Adicionar música'}</button></li>)}</ul>}</section> : null}
      <section><h2 className="display text-2xl">Escolhas da família</h2><p className="mt-2 text-xs text-marfim-3">As mais votadas ficam no topo, na lista e no Spotify.</p><p className="mt-2 text-xs text-marfim-3">Músicas e capas fornecidas pelo Spotify.</p>{!data.tracks.length ? <p className="py-6 text-sm text-marfim-2">A primeira música pode ser a sua.</p> : <ul className="divide-y divide-linha">{data.tracks.map(song => <li key={song.id} className="space-y-3 py-4"><div className="flex min-w-0 items-center gap-3"><Cover song={song} /><div className="min-w-0"><a className="break-words font-medium underline" href={`https://open.spotify.com/track/${song.track_uri.split(':')[2]}`} target="_blank" rel="noreferrer">{song.nome}</a><p className="break-words text-sm text-marfim-2">{song.artista}</p><p className="text-xs text-marfim-3">Adicionada por {song.autor}</p></div></div><button type="button" aria-pressed={song.votei} aria-label={`${song.votei ? 'Tirar o voto de' : 'Votar em'} ${song.nome}`} className={`btn btn-quiet min-h-11 w-full gap-2 ${song.votei ? 'text-cereja' : ''}`} disabled={busy} onClick={() => void votar(song)}><Coracao cheio={song.votei} /><span>{song.votos} {song.votos === 1 ? 'voto' : 'votos'}</span></button><button type="button" className="btn btn-quiet min-h-11 w-full" aria-expanded={ouvindo === song.track_uri} onClick={() => setOuvindo(ouvindo === song.track_uri ? null : song.track_uri)}>{ouvindo === song.track_uri ? 'Fechar prévia' : 'Ouvir prévia'}</button>{ouvindo === song.track_uri ? <Previa uri={song.track_uri} /> : null}{song.user_id === me.id || me.is_admin ? <button className="btn btn-quiet min-h-11 w-full" disabled={busy} onClick={() => void mutate(song, true)}>Remover música</button> : null}</li>)}</ul>}</section></> : null}
    {data && (!data.api || data.pedidos.length) ? <section className="space-y-4">{!data.api ? <form onSubmit={pedir} className="space-y-3"><h2 className="display text-2xl">Pedir uma música</h2><label className="block text-sm">Música e artista<input className="field mt-2" value={pedido} onChange={e => setPedido(e.target.value)} maxLength={120} placeholder="Então é Natal - Simone" required /></label><button className="btn btn-primary w-full" disabled={busy || !pedido.trim() || data.minhas >= data.limite}>Pedir música</button></form> : null}
      <div><h2 className="display text-2xl">Pedidos da família</h2>{!data.pedidos.length ? <p className="py-4 text-sm text-marfim-2">Ainda não há pedidos. Que tal o primeiro?</p> : <ul className="divide-y divide-linha">{data.pedidos.map(item => <li key={item.id} className="space-y-3 py-4"><div className="min-w-0"><p className="break-words font-medium">{item.nome}</p>{item.artista ? <p className="break-words text-sm text-marfim-2">{item.artista}</p> : null}<p className="text-xs text-marfim-3">Pedida por {item.autor}</p></div>{item.user_id === me.id || me.is_admin ? <button className="btn btn-quiet min-h-11 w-full" disabled={busy} onClick={() => void apagar(item.id)}>Remover pedido</button> : null}</li>)}</ul>}</div></section> : null}
    {retro && !retro.destaque ? <Retrospectiva r={retro} /> : null}
  </div></>;
}
