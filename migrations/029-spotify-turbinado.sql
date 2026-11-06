-- Playlist por momento (jantar, festa, amigo oculto) e votação das músicas. Não executada automaticamente.
ALTER TABLE playlist_tracks ADD COLUMN IF NOT EXISTS momento TEXT NOT NULL DEFAULT 'festa';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'playlist_tracks_momento_check') THEN
    ALTER TABLE playlist_tracks ADD CONSTRAINT playlist_tracks_momento_check CHECK (momento IN ('jantar', 'festa', 'amigo_oculto'));
  END IF;
END $$;

-- A mesma música pode entrar em momentos diferentes: a unicidade passa a ser por edição e momento.
ALTER TABLE playlist_tracks DROP CONSTRAINT IF EXISTS playlist_tracks_ano_track_uri_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_playlist_tracks_momento_uri ON playlist_tracks(ano, momento, track_uri);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_momento ON playlist_tracks(ano, momento, user_id);

CREATE TABLE IF NOT EXISTS playlist_track_votes (
  id SERIAL PRIMARY KEY,
  track_id INTEGER NOT NULL REFERENCES playlist_tracks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(track_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_playlist_track_votes_user ON playlist_track_votes(user_id);
