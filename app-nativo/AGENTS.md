# Regras do projeto nativo

- Responder em português do Brasil. Não usar U+2014 nem U+2013.
- Todo trabalho deste app fica em app-nativo/. O site da raiz está em produção e é somente leitura.
- Leia CONTRATO-APP.md antes de implementar telas e siga o visual Meia-Noite.
- Interface nativa React Native, com expo-router. Não usar WebView para telas.
- Rotas em src/app/, telas em src/screens/, componentes em src/ui/.
- SDK 58 usa exclusivamente New Architecture; não adicionar a chave removida newArchEnabled ao app.json.

## APIs e dependências

Antes de usar APIs Expo ou React Native, confira o SDK em package.json e leia a documentação
correspondente em https://docs.expo.dev/versions/v58.0.0/ e o índice https://docs.expo.dev/llms.txt.
APIs mudam entre versões. Confira também os tipos dos pacotes instalados.
Instale dependências com npx expo install. Fixe versões exatas, sem ^ ou ~, e mantenha o lockfile.
Use npm neste projeto. Bun só deve ser usado se houver bun.lock.
Acesso à API e token somente por src/api.ts. Dados pessoais ficam em cache de memória.

## Desenvolvimento e verificação

- npx expo start
- npx tsc --noEmit
- npm run lint
- npx expo-doctor
- npx expo export --platform android

Rode tipos e lint antes de declarar a tarefa pronta. Não repetir builds pesados sem necessidade.
Não usar EAS, conta Expo online, publicação ou criar keystore nesta fase. Builds são locais.
android/ e ios/ são gerados por expo prebuild e não devem ser editados manualmente.
Mudanças nativas ficam em app.json e config plugins. Use módulos Expo recomendados.
Expo Go só tem os módulos embarcados. Para recursos extras e Face ID, use um build local compatível.
Nunca matar processo por nome de executável. Encerre apenas o PID específico da tarefa.
