#!/usr/bin/env bash
# Build do app do iPhone num Mac do GitHub, gastando o mínimo de minutos de Mac (ver scripts/github-ios.yml).
# Uso: bash scripts/build-ios.sh            gera o IPA assinado e baixa para a pasta de saída
#      bash scripts/build-ios.sh --enviar   gera e envia o IPA ao App Store Connect (envio feito daqui, de graça)
#      bash scripts/build-ios.sh --publicar-fluxo   só atualiza o workflow no repositório de build
# Vai o que está no último commit (HEAD); mudança sem commit fica de fora.
set -euo pipefail
REPO=speeduptidev/natal-teste-app
CRED="$HOME/Jobs/SPEEDTECH/credenciais"
RAIZ="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
SAIDA="${SAIDA:-$RAIZ/app-nativo/dist/ios}"
cd "$RAIZ"

publicar_fluxo() {
  local atual novo sha
  novo=$(base64 -w0 app-nativo/scripts/github-ios.yml)
  atual=$(gh api "repos/$REPO/contents/.github/workflows/ios.yml" --jq '.content' 2>/dev/null | tr -d '\n' || true)
  [ "$atual" = "$novo" ] && return 0
  sha=$(gh api "repos/$REPO/contents/.github/workflows/ios.yml" --jq '.sha' 2>/dev/null || true)
  gh api -X PUT "repos/$REPO/contents/.github/workflows/ios.yml" -f message="Build do iPhone" -f content="$novo" ${sha:+-f sha="$sha"} --jq '.commit.sha' >/dev/null
  echo "workflow atualizado no $REPO"
  sleep 5
}

publicar_fluxo
[ "${1:-}" = "--publicar-fluxo" ] && exit 0

if [ -n "$(git status --porcelain app-nativo)" ]; then echo "AVISO: há mudança sem commit em app-nativo; ela não entra no build."; fi
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
git archive --format=tar.gz --add-virtual-file="app-nativo/.commit:$(git rev-parse HEAD)" -o "$TMP/fonte.tgz" HEAD app-nativo
gh release upload pacote "$TMP/fonte.tgz" --clobber -R "$REPO"

ANTES=$(gh run list -R "$REPO" --workflow ios.yml --limit 1 --json databaseId --jq '.[0].databaseId // 0')
gh workflow run ios.yml -R "$REPO"
for _ in $(seq 1 20); do
  sleep 4
  ID=$(gh run list -R "$REPO" --workflow ios.yml --limit 1 --json databaseId --jq '.[0].databaseId // 0')
  [ "$ID" != "$ANTES" ] && break
done
[ "$ID" != "$ANTES" ] || { echo "o build não apareceu na fila"; exit 1; }
echo "build $ID em andamento: https://github.com/$REPO/actions/runs/$ID"
gh run watch "$ID" -R "$REPO" --exit-status --interval 30 >/dev/null || { echo "build falhou"; gh run view "$ID" -R "$REPO" --log-failed | tail -60; exit 1; }
gh api "repos/$REPO/actions/runs/$ID/jobs" --jq '.jobs[0] | "tempo de Mac: \(((.completed_at|fromdate) - (.started_at|fromdate)) / 60 | floor) minutos"'

rm -rf "$SAIDA"; mkdir -p "$SAIDA"
gh run download "$ID" -R "$REPO" -n ipa -D "$SAIDA"
ls -la "$SAIDA"
if [ "${1:-}" = "--enviar" ]; then python3 "$CRED/natal-familia/enviar-ipa.py" "$SAIDA"/*.ipa; fi
