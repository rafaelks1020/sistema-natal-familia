#!/usr/bin/env bash
# Gera o AAB assinado para a Play (e um APK para testar no celular).
# Uso: bash scripts/build-android.sh   (a chave fica em ~/Jobs/SPEEDTECH/credenciais/natal-familia)
set -euo pipefail
cd "$(dirname "$0")/.."
CRED="$HOME/Jobs/SPEEDTECH/credenciais/natal-familia"
cp "$CRED/google-services.json" ./google-services.json
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export NODE_ENV=production
npx expo prebuild -p android --clean --no-install
PROPS=$(grep -E '^NATAL_' "$CRED/keystore.properties" | sed 's/^/-P/' | tr '\n' ' ')
cd android
./gradlew --no-daemon $PROPS bundleRelease assembleRelease
ls -la app/build/outputs/bundle/release/*.aab app/build/outputs/apk/release/*.apk
