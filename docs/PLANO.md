# Natal em Família: checklist de TUDO que o Rafael pediu

Status: [x] feito e no ar · [~] em andamento · [ ] a fazer · (R) depende do Rafael
Atualizado: 05/11/2026 15:10

## Pedidos, na ordem em que vieram
1. [x] Montar o sistema do repositório e repaginar tudo
2. [x] Banco no VPS2 (`natal_familia`, pgbouncer)
3. [x] Ideias de estilo pelo ChatGPT web (3 estilos) e mandar no zap
4. [x] Imagens do sistema pronto (login, rede social da família etc.) por estilo, no zap
5. [x] Estilo escolhido: **Meia-Noite**
6. [x] Vários GIFs do ChatGPT para o site ficar dinâmico no celular: 16 animações no ar
7. [x] Código da família `FAMILY_CODE` trocado e fora de qualquer arquivo versionado
8. [x] Baixar e usar todos os GIFs bons (o único fora do estilo ficou de fora)
9. [~] Auditoria em todo o sistema e arrumar tudo que estiver ruim (ver seção A)
10. [x] Ideias para reter a família (seção D) mandadas no zap; esperando o Rafael escolher quais fazer
11. [x] Integrar o C6 para pagar pelo app, na conta da SpeedTech
12. [~] Otimizar ao máximo, lindo, moderno, código limpo (seções A, B, C)
13. [x] Prints no zap e colocar no ar: https://sistema-natal-familia.vercel.app
14. [x] Cadastro que não funcionava (código e usuário tolerantes)
15. [x] Admin dos convites com link de convite (`/convites`)
16. [x] Valor da contribuição escolhido pela pessoa, a partir de R$ 50
17. [x] Revisão geral: bugs (A), velocidade (B), celular (C), retenção (D), build iPhone e Android (E)
18. [x] Domínio **natalemfamilia.com.br** no Registro.br, no ar com HTTPS
19. [x] **App NATIVO** de altíssima qualidade no Android e no iPhone (não PWA, não site em casca) (seção E)

## A. Bugs e segurança (auditoria)
- [x] Toda rota exige login; identidade sempre pela sessão; cookie assinado
- [x] Pix: trava contra dois Pix juntos, baixa só com valor do banco, PAID não regride, vencimento no dia de SP
- [x] Login: limite de tentativas; senha conferida sem travar o servidor; primeiro organizador sem corrida
- [x] Cadastro não assume participante pelo nome (impedia ver o amigo oculto alheio); organizador liga em /organizar
- [x] Fotos aceitas só do nosso Blob; usernames não ficam expostos
- [x] Vaquinha soma o pago de verdade; não desmarca Pix pago; não apaga quem está no sorteio
- [x] Amigo oculto: lista de desejos sobrevive a novo sorteio; data de revelação vale; refazer pede confirmação
- [x] Mural e álbum: sem loop em falha; álbum não perde foto; feed leve (3 comentários); notificação sem duplicar
- [x] Segunda auditoria completa (outro modelo) e correções (commit a122c3b)

## B. Velocidade
- [x] Fotos comprimidas no celular antes do envio (8 MB vira ~300 KB)
- [x] Animações em vídeo leve (GIF de 10 MB virou 250 KB), só carregam quando aparecem, cache de 7 dias
- [x] Região gru1 (São Paulo)
- [x] Miniaturas das fotos (otimizador da Vercel, AVIF/WebP no tamanho da tela) no mural, álbum, vaquinha, início e avatares
- [x] Lighthouse mobile: acessibilidade 100 em todas; Início 65 para 78, Álbum 57 para 81 (trava de 3 s para 0,4 s), entrada 85
- [x] Primeira carga do Início, Mural e Álbum vem pronta do servidor (sem tela vazia esperando)
- [x] Grão de filme por textura (o filtro SVG custava ~1 s de pintura); capa pré-carregada; pôsteres 384 para 187 KB
- [ ] Conferir EXPLAIN do feed e do álbum quando a família tiver postado (hoje o banco está quase vazio)

## C. Celular
- [x] Layout 390 px sem rolagem lateral, alvos de toque de 44 px
- [x] Teclado não cobre os campos (Android encolhe a tela; iOS rola até o campo)
- [x] Letra maior opcional (Perfil > Letra maior)
- (PWA descartado: o Rafael quer app nativo)

## D. Ideias para reter a família
1. Calendário do Advento: uma janela por dia de 1 a 24/12 (foto antiga, receita da vó, enquete, desafio)
2. Notificações que importam: comentário na sua foto, "faltam 3 dias para a ceia", amigo oculto mudou a lista
3. Desafio de foto do dia com votação
4. Dicas anônimas do amigo oculto e revelação ao vivo na ceia
5. Quem leva o quê na ceia (evita 3 pavês)
6. Álbum por ano e "neste dia, ano passado"
7. Retrospectiva em vídeo depois da ceia
8. Recados em vídeo/áudio de quem não pode vir
9. Selos de presença e de contribuição (sem expor valores)
10. Aniversários da família o ano todo; o app "acorda" em novembro

## E. App nativo iPhone e Android
Decisão: **React Native com Expo** (componentes nativos de verdade, uma base, mesma API do site). Pasta `app-nativo/`.
- [x] API: login por token para o app (além do cookie do site)
- [x] Fase 1: fundação, login, cadastro, convite por link, Face ID/digital, abas nativas, Início completo (exporta para Android)
- [x] Fase 2: Mural, Amigo oculto, Vaquinha/Pix, Álbum, Família/Perfil/Convites/Organizar/Excluir conta
- [x] App: abas nativas, todas as telas no visual Meia-Noite, animações nativas, câmera e galeria, push, Face ID/biometria
- [x] Pix no app (copiar código, abrir app do banco)
- [x] Ícone, frente adaptativa, tela de abertura e capa da Play pedidos ao ChatGPT web
- [x] Android: AAB assinado (build fora da VPS2)
- [x] iOS: build no Mac VPS e no Codemagic
- [x] Política de privacidade (/privacidade) e exclusão de conta (/conta/excluir) no site
- [x] As mesmas duas no app
- [x] (R) Criar os apps nas lojas pelo site e o 1º envio da Play com o Conteúdo do app

## Pendências do Rafael
- [x] Blob antigo "fotinhas-natal-familia" apagado (o token vazado morreu junto)
- [x] Apps criados nas lojas
- [ ] (R) Status de comerciante (DSA) na Play até 01/02/2027
- [ ] (R) Escolher quais ideias de retenção (seção D) implementar


## Fechamento 05/11/2026
- [x] Domínio https://natalemfamilia.com.br no ar (HTTPS, www redireciona, links universais)
- [x] App nativo (Expo SDK 58) completo: todas as telas, push APNs/FCM, PDF do boleto, denunciar/bloquear/termos (regra 1.2), testado no emulador
- [x] **iPhone ENVIADO À REVISÃO DA APPLE** (build 2611051634, só iPhone, grátis, Brasil): WAITING_FOR_REVIEW
- [x] **Android ENVIADO À REVISÃO DA PLAY** (AAB 1.0.0, conta SpeedTechDev, Brasil): "Alterações em análise"
- [x] Codemagic configurado para os próximos builds do iPhone
- [ ] Acompanhar as duas revisões e responder se pedirem ajuste
- [ ] Depois da aprovação: assetlinks.json com a impressão digital da chave de assinatura do Google Play (Integridade do app)
- [ ] Prints de verdade do iPhone (simulador) numa próxima versão
