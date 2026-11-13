# Contrato do app nativo: fase 2

Este projeto é independente do Next.js. Tudo do app fica em `app-nativo/`.
O site da raiz está em produção: somente leitura. Ignore `mobile/`.
SDK 58 tem somente New Architecture. Não adicionar newArchEnabled ao app.json:
o campo deixou de existir no schema e faz o expo-doctor falhar.

## Estrutura

- `src/app/_layout.tsx`: fontes locais, provedores e proteção das rotas.
- `src/app/entrar.tsx`: login, cadastro, convites e desbloqueio biométrico.
- `src/app/(tabs)/`: cinco rotas das abas nativas. Não crie outra navegação inferior.
- `src/screens/`: implementação das telas. `Home.tsx` é o início completo.
- `src/ui/`: componentes compartilhados. Não copie estilos ou controles para cada tela.
- `src/theme.ts`: única fonte da paleta, fontes, espaçamentos e raios.
- `src/api.ts`: API, armazenamento seguro, chaves e cliente de cache.
- `src/types.ts`: contratos conferidos nas rotas do servidor.
- `src/media.ts` e `assets/media/`: manifesto e vídeos/posters locais.

## Visual e componentes

Meia-Noite: carvão `#171B18`, superfícies `#1D221F` e `#252B27`, marfim,
cereja para ações e champagne somente como acento fino. Raios de 14 a 18.
Fonte Bodoni Moda nos títulos e números, Bodoni itálica em Família, Manrope no corpo.
Interface em português do Brasil. Alvos de toque de pelo menos 44 pontos.
Importe ícones diretamente de lucide-react-native/icons/<nome>, com export default.
O índice geral inclui milhares de módulos no Metro e torna a otimização Hermes lenta.

Use `Text` com `variant` display, displayItalic, kicker, numeral, body ou muted.
Use `Button` primary, ghost ou quiet; o componente cuida de escala e haptics.
`Field` inclui rótulo, foco, erro e campo de 16 pontos. `Surface` desenha cartões.
`Avatar` recebe name, src e size; falhas de imagem mostram as iniciais.
`LoopVideo` recebe name, once, onEnded e visible. Passe visible quando sair da área
visível de uma lista. O componente pausa fora de foco e em segundo plano. Reduzir
movimento usa o poster estático. Use apenas nomes do manifesto, sem URLs de vídeo.
`Rise` faz entradas suaves escalonadas com index. `Skeleton` respeita reduzir movimento.
`Sheet` recebe visible, onClose e title, fecha pelo gesto, botão voltar ou fundo.
Para conteúdos longos em Sheet, use ScrollView e keyboardShouldPersistTaps="handled".
`EmptyState` cuida dos estados vazios e de erro. `useToast()` mostra mensagens curtas.

## Chamadas, sessão e cache

Toda chamada passa por `api<T>(path, { method, json, signal })`.
O retorno é o JSON direto do servidor, sem envelope data.
Use public: true somente em login/cadastro e validação de convite.
O token nunca vai para URL, log, AsyncStorage ou estado persistido do React Query.
Nunca leia o SecureStore fora de `src/api.ts`. O servidor decide a identidade.
401 limpa sessão e cache e volta ao acesso. Não repita mutações automaticamente.
O domínio ativo começa pela reserva em API_BASE_URL. A troca é feita nessa constante.
Não implemente fallback automático de POST: uma resposta perdida pode duplicar escrita.

Use useQuery com chaves estáveis em queryKeys e repasse AbortSignal.
Padrão atual: staleTime de 60 segundos, gcTime de 15 minutos, uma repetição em erros
de rede/servidor e refetch ao voltar para o app. Dados pessoais ficam só em memória.
Use useMutation para escrita; cancele leitura concorrente, guarde snapshot, aplique
update otimista, reverta em erro e invalide somente as chaves afetadas.
Confira o status autenticado e getGeneration() antes de restaurar cache após uma mutação.
Cada troca, bloqueio e saída incrementa a geração para descartar respostas da sessão anterior.
Presença já segue esse padrão e bloqueia toques concorrentes.

`useSession()` fornece user, status, biometric, signIn, unlock e signOut.
Biometria é opcional, oferecida após autenticação por senha em aparelho compatível.
O token migra para uma entrada requireAuthentication do SecureStore. O próprio
Keychain/Keystore solicita a biometria para ler esse token; LocalAuthentication
confere hardware e cadastro. Voltar de um segundo plano com mais de 60 s limpa token da
memória e bloqueia a UI (idas rápidas, como câmera, galeria e compartilhar, não bloqueiam).
Senha continua disponível se a biometria falhar ou mudar.

## Estado da fase 2

Mural, amigo oculto, vaquinha, álbum e as demais telas já existem e leem dados reais da
família. Câmera, galeria, compressão e clipboard estão em uso.
Push nativo (APNs/FCM) já funciona: o aparelho registra o token em /api/push, o toque no
aviso abre a rota de data.rota (rota que o app não tem cai no início; /pontos e /missoes
vão para /conquistas). A permissão só é pedida quando a pessoa toca em "Ativar avisos".
A mensagem nativa do sistema para notificações é controlada pelo iOS/Android.

Links HTTPS precisam de apple-app-site-association e assetlinks.json no domínio,
com Team ID Apple e impressão digital do certificado Android reais. Os filtros e
entitlements estão no app.json; não simule esses dados, não altere o site nesta fase.
O link customizado natalemfamilia://entrar?convite=X já é roteado para cadastro.
O parâmetro convite é validado em GET /api/invites/check?t=X antes do cadastro.

## Proibições e verificação

Sem WebView para telas, sem site em casca, sem EAS, publicação, keystore ou conta Expo.
Sem credenciais/código da família versionados. Sem alterações na raiz ou em mobile/.
Sem dependências com intervalos (^ ou ~) no package.json. Use expo install e fixe
a versão resolvida; mantenha package-lock.json atualizado. Não use force/legacy-peer-deps.
Não editar android/ios manualmente: são gerados por expo prebuild.
Proibidos os caracteres U+2014 e U+2013 em código, texto e documentação próprios.
Não matar processos por nome. Não gerar arte ou substituir os mockups aprovados.

Antes de entregar: `npx tsc --noEmit` e `npm run lint`.
Conferência completa do integrador: `npx expo-doctor` e
`npx expo export --platform android`. Verificar também no aparelho real: login,
convite frio/quente, presença com erro/reversão, pull-to-refresh, biometria,
segundo plano, reduzir movimento, leitor de tela e fontes grandes.
