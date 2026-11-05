#!/usr/bin/env bash
# Converte os GIFs do ChatGPT em vídeo leve para o celular:
#   public/media/<nome>.webm (VP9), <nome>.mp4 (H.264) e <nome>.jpg (pôster, primeiro quadro).
# GIF de 10 MB vira algo entre 200 e 600 KB.
# Uso: bash scripts/converter-gifs.sh <pasta-com-gifs> [largura-max=720]
set -euo pipefail

ORIGEM="${1:?Uso: converter-gifs.sh <pasta-com-gifs> [largura-max]}"
LARG="${2:-720}"
DESTINO="$(cd "$(dirname "$0")/.." && pwd)/public/media"
mkdir -p "$DESTINO"

# Escala para no máximo LARG de largura, dimensões pares (exigência do H.264).
FILTRO="scale='trunc(min($LARG,iw)/2)*2':-2:flags=lanczos,format=yuv420p"

shopt -s nullglob
for gif in "$ORIGEM"/*.gif "$ORIGEM"/*.mp4 "$ORIGEM"/*.webm; do
  nome="$(basename "${gif%.*}")"
  [[ "$nome" == *.conv ]] && continue
  echo "-> $nome"
  ffmpeg -v error -y -i "$gif" -vf "$FILTRO" -an \
    -c:v libvpx-vp9 -b:v 0 -crf 38 -row-mt 1 -deadline good -cpu-used 2 \
    "$DESTINO/$nome.webm"
  ffmpeg -v error -y -i "$gif" -vf "$FILTRO" -an \
    -c:v libx264 -preset slow -crf 26 -profile:v high -movflags +faststart \
    "$DESTINO/$nome.mp4"
  ffmpeg -v error -y -i "$gif" -vf "scale='min(540,iw)':-2" -frames:v 1 -q:v 7 \
    "$DESTINO/$nome.jpg"
  printf '   gif %6s KB  webm %5s KB  mp4 %5s KB  jpg %4s KB\n' \
    "$(( $(stat -c%s "$gif") / 1024 ))" \
    "$(( $(stat -c%s "$DESTINO/$nome.webm") / 1024 ))" \
    "$(( $(stat -c%s "$DESTINO/$nome.mp4") / 1024 ))" \
    "$(( $(stat -c%s "$DESTINO/$nome.jpg") / 1024 ))"
done

# Lista das animações que existem: o LoopMedia só tenta tocar o que está aqui (sem 404 no celular).
MANIFESTO="$(dirname "$DESTINO")/../app/ui/media-manifest.ts"
{
  echo '// Gerado por scripts/converter-gifs.sh. Não editar à mão.'
  echo 'export const MEDIA_DISPONIVEL = new Set<string>(['
  for mp4 in "$DESTINO"/*.mp4; do echo "  '$(basename "${mp4%.mp4}")',"; done
  echo ']);'
} > "$MANIFESTO"
echo "manifesto: $(grep -c "'" "$MANIFESTO") animações"
