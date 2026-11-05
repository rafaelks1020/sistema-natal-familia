'use client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import PageHeader from '@/app/ui/PageHeader';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { useMe } from '@/app/ui/user';
import type { playlistData, Track } from '@/app/api/spotify/_service';

type Data = Awaited<ReturnType<typeof playlistData>>;
type Song = Pick<Track, 'track_uri' | 'nome' | 'artista' | 'capa_url'>;

function Cover({ song }: { song: Song }) {
  return song.capa_url ? <a href={`https://open.spotify.com/track/${song.track_uri.split(':')[2]}`} target="_blank" rel="noreferrer" aria-label={`Ouvir ${song.nome} no Spotify`} className="shrink-0">{/* eslint-disable-next-line @next/next/no-img-element */}
<img src={song.capa_url} alt={`Capa de ${song.nome}`} width={56} height={56} className="h-14 w-14 rounded-xl object-cover" /></a> : null;
}

export default function PlaylistClient({ initial, initialError }: { initial: Data | null; initialError: string }) {
  const me = useMe();
  const toast = useToast();
  const params = useSearchParams();
  const [data, setData] = useState(initial);
  const [error, setError] = useState(initialError);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pedido, setPedido] = useState('');
  const [linkTexto, setLinkTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const lock = useRef(false);
  const searchController = useRef<AbortController | null>(null);
  useEffect(() => { const message = params.get('spotify'); if (message) toast(message === 'conectada' ? 'Spotify conectado. Escolha as músicas da família!' : message, message === 'conectada' ? undefined : 'erro'); }, [params, toast]);
  useEffect(() => () => searchController.current?.abort(), []);
  async function reload() {
    try { setData(await api<Data>('/api/spotify')); setError(''); }
    catch (cause) { setError((cause as Error).message); }
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
      await api(`/api/spotify/${remove ? 'remover' : 'adicionar'}`, { method: remove ? 'DELETE' : 'POST', json: { track_uri: song.track_uri } });
      await reload(); toast(remove ? 'Música removida.' : 'Música adicionada.');
    } catch (cause) { toast((cause as Error).message, 'erro'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function pedir(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await api('/api/spotify/pedido', { method: 'POST', json: { texto: pedido } }); setPedido(''); await reload(); toast('Pedido enviado.'); }
    catch (cause) { toast((cause as Error).message, 'erro'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function apagar(id: number) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await api('/api/spotify/pedido', { method: 'DELETE', json: { id } }); await reload(); toast('Pedido removido.'); }
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
    {error ? <div role="alert" className="surface space-y-3 p-5"><p>{error}</p><button className="btn btn-ghost w-full" onClick={() => void reload()}>Tentar novamente</button></div> : null}
    {data ? <section className="surface space-y-4 p-5"><p className="kicker">Natal em Família {data.ano}</p><p>Você escolheu {data.minhas} de {data.limite} músicas.</p>
      {data.embed_id ? <iframe title="Playlist do Natal no Spotify" src={`https://open.spotify.com/embed/playlist/${data.embed_id}?utm_source=generator&theme=0`} width="100%" height={380} loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" className="w-full rounded-xl border-0" /> : <p className="text-sm text-marfim-2">{me.is_admin ? 'Cole abaixo o link da playlist do Spotify para ela aparecer aqui.' : 'Quem organiza vai colocar a playlist aqui em breve. Enquanto isso, você já pode pedir músicas.'}</p>}
      {data.link ? <a href={data.link} target="_blank" rel="noreferrer" className="btn btn-primary w-full">Abrir no Spotify e adicionar músicas</a> : null}</section> : null}
    {me.is_admin ? <details className="surface p-5" open={!data?.link}><summary className="min-h-11 cursor-pointer">Link da playlist do Spotify</summary><form onSubmit={salvarLink} className="space-y-3 text-sm text-marfim-2"><p>No Spotify, abra a playlist, toque em Compartilhar e escolha o link de convite para colaborar. Cole aqui uma vez só.</p>{data?.link ? <p className="break-all">Link atual: {data.link}</p> : null}<input className="field" type="url" inputMode="url" placeholder="https://open.spotify.com/playlist/..." aria-label="Link da playlist do Spotify" value={linkTexto} onChange={e => setLinkTexto(e.target.value)} maxLength={500} required /><button className="btn btn-primary w-full" disabled={salvando || !linkTexto.trim()}>{salvando ? 'Salvando...' : 'Salvar link'}</button></form></details> : null}
    {me.is_admin ? <details className="surface p-5"><summary className="min-h-11 cursor-pointer">Busca automática (opcional)</summary><div className="space-y-3 text-sm text-marfim-2"><p>Só funciona se o Spotify liberar a Web API para a conta dona do aplicativo (em modo de desenvolvimento, isso exige Premium). Sem ela, o link da playlist e os pedidos da família já resolvem.</p><p className="break-all">Retorno a cadastrar no painel: https://natalemfamilia.com.br/api/spotify/callback</p><a href="/api/spotify/conectar" className="btn btn-ghost w-full">{data?.connected ? 'Reconectar Spotify' : 'Conectar Spotify'}</a></div></details> : null}
    {data ? <section className="space-y-4"><form onSubmit={pedir} className="space-y-3"><h2 className="display text-2xl">Pedir uma música</h2><label className="block text-sm">Música e artista<input className="field mt-2" value={pedido} onChange={e => setPedido(e.target.value)} maxLength={120} placeholder="Então é Natal - Simone" required /></label><button className="btn btn-primary w-full" disabled={busy || !pedido.trim() || data.minhas >= data.limite}>Pedir música</button></form>
      <div><h2 className="display text-2xl">Pedidos da família</h2>{!data.pedidos.length ? <p className="py-4 text-sm text-marfim-2">Ainda não há pedidos. Que tal o primeiro?</p> : <ul className="divide-y divide-linha">{data.pedidos.map(item => <li key={item.id} className="space-y-3 py-4"><div className="min-w-0"><p className="break-words font-medium">{item.nome}</p>{item.artista ? <p className="break-words text-sm text-marfim-2">{item.artista}</p> : null}<p className="text-xs text-marfim-3">Pedida por {item.autor}</p></div>{item.user_id === me.id || me.is_admin ? <button className="btn btn-quiet min-h-11 w-full" disabled={busy} onClick={() => void apagar(item.id)}>Remover pedido</button> : null}</li>)}</ul>}</div></section> : null}
    {data?.api ? <><form onSubmit={search} className="space-y-3"><label className="block text-sm">Nome da música ou artista<input className="field mt-2" value={query} onChange={e => { setQuery(e.target.value); setSearched(false); setResults([]); searchController.current?.abort(); setSearching(false); }} maxLength={100} required /></label><button className="btn btn-primary w-full" disabled={searching || !query.trim()}>{searching ? 'Buscando...' : 'Buscar música'}</button></form>
      {searched ? <section><h2 className="display mb-3 text-2xl">Resultado da busca</h2>{!results.length ? <p className="text-sm text-marfim-2">Nenhuma música encontrada. Tente outro nome.</p> : <ul className="divide-y divide-linha">{results.map(song => <li key={song.track_uri} className="space-y-3 py-4"><div className="flex min-w-0 items-center gap-3"><Cover song={song} /><div className="min-w-0"><p className="break-words font-medium">{song.nome}</p><p className="break-words text-sm text-marfim-2">{song.artista}</p></div></div><button className="btn btn-ghost w-full" disabled={busy || data.minhas >= 15 || data.tracks.some(t => t.track_uri === song.track_uri)} onClick={() => void mutate(song, false)}>{data.tracks.some(t => t.track_uri === song.track_uri) ? 'Já está na playlist' : 'Adicionar música'}</button></li>)}</ul>}</section> : null}
      <section><h2 className="display text-2xl">Escolhas da família</h2><p className="mt-2 text-xs text-marfim-3">Músicas e capas fornecidas pelo Spotify.</p>{!data.tracks.length ? <p className="py-6 text-sm text-marfim-2">A primeira música pode ser a sua.</p> : <ul className="divide-y divide-linha">{data.tracks.map(song => <li key={song.id} className="space-y-3 py-4"><div className="flex min-w-0 items-center gap-3"><Cover song={song} /><div className="min-w-0"><a className="break-words font-medium underline" href={`https://open.spotify.com/track/${song.track_uri.split(':')[2]}`} target="_blank" rel="noreferrer">{song.nome}</a><p className="break-words text-sm text-marfim-2">{song.artista}</p><p className="text-xs text-marfim-3">Adicionada por {song.autor}</p></div></div>{song.user_id === me.id || me.is_admin ? <button className="btn btn-quiet min-h-11 w-full" disabled={busy} onClick={() => void mutate(song, true)}>Remover música</button> : null}</li>)}</ul>}</section></> : null}
  </div></>;
}
