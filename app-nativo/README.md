# Natal em Família: app nativo

Expo SDK 58 estável, React Native, expo-router, TypeScript estrito. Projeto independente
do site Next.js. Componentes e abas usam os controles nativos de iOS e Android.
SDK 58 usa exclusivamente a New Architecture. O campo newArchEnabled foi removido
do schema do Expo e não deve ser adicionado ao app.json; a arquitetura já está ativa.
Não há WebView nas telas do app. As cinco abas usam NativeTabs pelo caminho
expo-router/unstable-native-tabs, alias ainda disponível no SDK 58, agora estável como
expo-router/native-tabs: UITabBarController no iOS e navegação Material no Android.
Ícones SF Symbols no iOS e Material Symbols no Android.

## Desenvolvimento local

Requer Node 22.13 ou superior. Instale dentro desta pasta:

```sh
npm ci
npx expo start
```

Use um build local para todos os recursos nativos e os links registrados.
Face ID e SecureStore com autenticação exigem aparelho/build compatível.
Não é necessário usar EAS ou criar conta Expo. Se Expo Go exigir login ou não
suportar os módulos, use `npx expo run:android` ou `npx expo run:ios` no ambiente local.
Para abrir o Metro com um build de desenvolvimento, use `npx expo start --dev-client`
somente se expo-dev-client tiver sido instalado no build correspondente.

## Android

Java 17 e Android SDK local em ~/Android/Sdk:

```sh
export ANDROID_HOME="$HOME/Android/Sdk"
npx expo prebuild -p android
cd android && ./gradlew assembleRelease
```

O comando gera o projeto nativo e o artefato local. Não há assinatura de distribuição
configurada: o template Android pode usar a chave de debug também em release.
Esse APK serve para validação local e não é uma entrega para a Play Store.
Nenhum keystore de distribuição deve ser criado nesta fase.

Build de diagnóstico:

```sh
npx expo prebuild -p android --no-install
cd android && ANDROID_HOME="$HOME/Android/Sdk" ./gradlew assembleDebug
```

## iOS no Mac VPS

No Mac com Xcode e as ferramentas locais configuradas:

```sh
~/bin/build-ios <repo> --app app-nativo
```

Substitua <repo> pelo caminho do checkout no Mac. Não use EAS nem publique o app.

## API e links

API ativa: https://sistema-natal-familia.vercel.app.
Troque API_BASE_URL em src/api.ts para https://natalemfamilia.com.br quando estiver pronto.
Login envia client: app e salva o token no SecureStore. 401 encerra o acesso.
Adesão biométrica protege a leitura do token pelo sistema e bloqueia ao ir para segundo plano.

Links de cadastro:

- natalemfamilia://entrar?convite=X
- https://natalemfamilia.com.br/entrar?convite=X

HTTPS depende de associação do domínio com os identificadores e certificados reais
em apple-app-site-association e assetlinks.json. Esse ajuste externo fica pendente.
O token X deve ser um convite real. Convite inválido mostra erro e permite usar código.
Um usuário já autenticado continua no app; para cadastrar outra pessoa, saia da conta.

## Verificação

```sh
npx tsc --noEmit
npm run lint
npx expo-doctor
npx expo export --platform android
```

Fontes, vídeos e posters são locais. Falha de vídeo ou reduzir movimento usa imagem
estática. As outras quatro abas estão em estado Chegando, conforme a fase 1.
Ícones e splash ainda são os assets técnicos do template; arte final e publicação
ficam para a etapa de identidade e lojas. Push remoto não foi configurado.
Veja CONTRATO-APP.md antes de implementar a fase 2.

## Resultado da fase 1 em 05/11/2026

- npx tsc --noEmit: passou, sem erros.
- npm run lint: passou, sem erros ou avisos.
- npx expo install --check: dependências compatíveis.
- 9 verificações rápidas de normalização, horário de Brasília e moeda: passaram.
- npx expo export --platform android --max-workers 1: passou, 1.953 módulos,
  52 assets e bundle Hermes em dist/_expo/static/js/android/ (4,5 MB informados pelo Expo).
- npx expo-doctor: 19 de 20 verificações passaram. Única falha externa:
  Directory check failed with unexpected server response (React Native Directory).
- Schema do Expo válido após retirar newArchEnabled, removido no SDK atual.
- Prebuild, Gradle, assinatura e teste em aparelho não foram executados.

A primeira exportação atingiu o limite de 150 segundos na otimização Hermes.
Imports individuais do Lucide reduziram o grafo de 3.964 para 1.953 módulos, e a
exportação seguinte concluiu. Preserve esse padrão ao adicionar ícones.
