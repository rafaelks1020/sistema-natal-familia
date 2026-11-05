import { cleanText, ok, requireUser, route } from '@/app/lib/api';
import { spotify, type SpotifyTrack } from '../_service';

export const GET = route(async req => {
  await requireUser();
  const text = cleanText(new URL(req.url).searchParams.get('q'), 'o nome da música ou artista', 100);
  const data = await spotify<{ tracks: { items: SpotifyTrack[] } }>(`/search?${new URLSearchParams({ q: text, type: 'track', limit: '10', market: 'BR' })}`);
  return ok({ tracks: data.tracks.items.map(t => ({ track_uri: t.uri, nome: t.name,
    artista: t.artists.map(a => a.name).join(', '), capa_url: t.album.images[0]?.url || null })) });
});
