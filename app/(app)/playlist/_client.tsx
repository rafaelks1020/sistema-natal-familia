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
  return <><PageHeader kicker="O som da nossa festa" title="Playlist da família" /><div className="space-y-6 px-5 pb-8">
    {error ? <div role="alert" className="surface space-y-3 p-5"><p>{error}</p><button className="btn btn-ghost w-full" onClick={() => void reload()}>Tentar novamente</button></div> : null}
    {!data?.connected ? <section className="surface space-y-3 p-5"><h2 className="display text-2xl">Playlist ainda não conectada</h2><p className="text-sm text-marfim-2">Quem organiza conecta o Spotify uma vez. Depois, todos podem escolher músicas.</p></section> : <section className="surface space-y-3 p-5"><p className="kicker">Natal em Família {data.ano}</p><p>Você escolheu {data.minhas} de {data.limite} músicas.</p><a href={data.playlist_url!} target="_blank" rel="noreferrer" className="btn btn-primary w-full">Ouvir no Spotify</a></section>}
    {me.is_admin ? <details className="surface p-5" open={!data?.connected}><summary className="min-h-11 cursor-pointer">Conexão com o Spotify</summary><div className="space-y-3 text-sm text-marfim-2"><p>No Spotify for Developers, crie um aplicativo e cadastre o endereço de retorno abaixo. Configure SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no servidor.</p><p className="break-all">https://natalemfamilia.com.br/api/spotify/callback</p><p>A conta deve ter acesso ao aplicativo no Spotify. Em modo de desenvolvimento, confira a exigência de Premium e as permissões da conta no painel.</p><a href="/api/spotify/conectar" className="btn btn-ghost w-full">{data?.connected ? 'Reconectar Spotify' : 'Conectar Spotify'}</a></div></details> : null}
    {data?.connected ? <><form onSubmit={search} className="space-y-3"><label className="block text-sm">Nome da música ou artista<input className="field mt-2" value={query} onChange={e => { setQuery(e.target.value); setSearched(false); setResults([]); searchController.current?.abort(); setSearching(false); }} maxLength={100} required /></label><button className="btn btn-primary w-full" disabled={searching || !query.trim()}>{searching ? 'Buscando...' : 'Buscar música'}</button></form>
      {searched ? <section><h2 className="display mb-3 text-2xl">Resultado da busca</h2>{!results.length ? <p className="text-sm text-marfim-2">Nenhuma música encontrada. Tente outro nome.</p> : <ul className="divide-y divide-linha">{results.map(song => <li key={song.track_uri} className="space-y-3 py-4"><div className="flex min-w-0 items-center gap-3"><Cover song={song} /><div className="min-w-0"><p className="break-words font-medium">{song.nome}</p><p className="break-words text-sm text-marfim-2">{song.artista}</p></div></div><button className="btn btn-ghost w-full" disabled={busy || data.minhas >= 15 || data.tracks.some(t => t.track_uri === song.track_uri)} onClick={() => void mutate(song, false)}>{data.tracks.some(t => t.track_uri === song.track_uri) ? 'Já está na playlist' : 'Adicionar música'}</button></li>)}</ul>}</section> : null}
      <section><h2 className="display text-2xl">Escolhas da família</h2><p className="mt-2 text-xs text-marfim-3">Músicas e capas fornecidas pelo Spotify.</p>{!data.tracks.length ? <p className="py-6 text-sm text-marfim-2">A primeira música pode ser a sua.</p> : <ul className="divide-y divide-linha">{data.tracks.map(song => <li key={song.id} className="space-y-3 py-4"><div className="flex min-w-0 items-center gap-3"><Cover song={song} /><div className="min-w-0"><a className="break-words font-medium underline" href={`https://open.spotify.com/track/${song.track_uri.split(':')[2]}`} target="_blank" rel="noreferrer">{song.nome}</a><p className="break-words text-sm text-marfim-2">{song.artista}</p><p className="text-xs text-marfim-3">Adicionada por {song.autor}</p></div></div>{song.user_id === me.id || me.is_admin ? <button className="btn btn-quiet min-h-11 w-full" disabled={busy} onClick={() => void mutate(song, true)}>Remover música</button> : null}</li>)}</ul>}</section></> : null}
  </div></>;
}
