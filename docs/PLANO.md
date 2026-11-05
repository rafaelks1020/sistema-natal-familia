# Plano: Natal em Família (pedidos do Rafael, 05/11/2026)

Status: [x] feito e no ar · [~] em andamento · [ ] a fazer

## 1. Sistema repaginado e no ar
- [x] Visual Meia-Noite escolhido (ChatGPT web), telas novas, animações do ChatGPT em vídeo leve
- [x] Banco `natal_familia` na VPS2 (pgbouncer), Vercel `gru1`, Blob novo (o antigo vazou no repo público)
- [x] Produção: https://sistema-natal-familia.vercel.app
- [~] Domínio **natalemfamilia.com.br** (Registro.br, aguardando ativação): já no projeto Vercel; zona A @ 216.150.1.1 / 216.150.16.1 e CNAME www 7cd292af9af3c78f.vercel-dns-017.com
- [x] Rafael (`rafaelks1020`) é o organizador
- [x] Cadastro tolerante (usuário sem acento/espaço, código da família só letras e números)
- [x] Convites por link (`/convites`): para uma pessoa (1 uso, já liga ao participante da vaquinha) ou link da família; validade, cancelar, WhatsApp
- [x] Pix pelo C6 da SpeedTech com **valor livre a partir do mínimo** (R$ 50); sem webhook (o da conta é do ContractHub)

## 2. Auditoria geral (bugs)
- [x] Pagamento: trava contra dois Pix ao mesmo tempo, baixa só com valor confirmado, PAID nunca regride, vencimento no dia de SP
- [x] Login: limite de tentativas (8 por usuário, 30 por IP em 15 min), scrypt assíncrono, primeiro organizador sem corrida
- [x] Cadastro não assume mais participante pelo nome (impedia ver o amigo oculto de outra pessoa)
- [x] Fotos aceitas só do nosso Blob (`isBlobUrl`)
- [~] Vaquinha: arrecadado pela soma real dos Pix; não desmarcar quem pagou por Pix; não apagar quem está no sorteio
- [~] Amigo oculto: lista de desejos sobrevive a novo sorteio; data de revelação vale; refazer sorteio pede confirmação
- [~] Mural/álbum: sem loop quando a rede falha; cursor do álbum sem perder fotos; feed com 3 comentários; notificação sem duplicar
- [~] Família: organizador liga acesso a participante; usuários não ficam expostos

## 3. Velocidade
- [ ] Medir no celular (Lighthouse mobile) as telas principais e atacar o que pesar
- [ ] Fotos: gerar miniatura no upload (largura 640/1280) e servir `srcset`; hoje vai a foto original
- [ ] Cache: `Cache-Control` nas rotas que mudam pouco (settings, álbum por cursor), `stale-while-revalidate` no início
- [ ] Vídeos: `preload="none"` fora da primeira dobra, pausar quando sai da tela (IntersectionObserver)
- [ ] Fontes: subset só latin, só os pesos usados
- [ ] Índices: conferir `EXPLAIN` do feed e do álbum com dados reais

## 4. Celular (mobile web)
- [ ] PWA: manifest, ícones, tela cheia, "Adicionar à tela inicial" com dica no iPhone
- [ ] Fotos: comprimir no aparelho antes de enviar (HEIC/foto de 8 MB vira ~400 KB)
- [ ] Teclado: campos não ficarem atrás do teclado nas folhas inferiores (visualViewport)
- [ ] Gestos: puxar para atualizar no mural; voltar com gesto fecha a folha aberta
- [ ] Acessibilidade: fonte maior para os mais velhos (opção no perfil), contraste conferido

## 5. Retenção (ideias)
Ver seção "Ideias" no fim.

## 6. App iPhone e Android
Decisão técnica: **Capacitor** com o site, MAIS recursos nativos de verdade, porque a Apple recusa "site em casca"
(regra 4.2, recusa real no Equipei em 28/10/2026). Roteiro das lojas: memória `publicar-lojas-via-api.md`.
- [ ] Projeto `mobile/` (Capacitor 7): appId `br.com.natalemfamilia.app`, nome "Natal em Família"
- [ ] Nativo que justifica o app: notificações push (APNs/FCM) do mural, amigo oculto e Pix; câmera e galeria nativas;
      abas nativas (UITabBarController, igual ao Equipei); tela sem internet + "Salvos" offline (álbum baixado); compartilhar
- [ ] Ícone e tela de abertura (ChatGPT web, estilo Meia-Noite)
- [ ] Android: build AAB assinado; Play pela conta de serviço (pronta)
- [ ] iOS: build no Mac VPS (`~/bin/build-ios`), conta Apple do Rafael (Team 96D6HWHH5S)
- [ ] **Rafael pelo site:** criar o app nas duas lojas e, na Play, o 1º envio com o Conteúdo do app
- [ ] Política de privacidade e exclusão de conta (as lojas exigem): página `/privacidade` e botão "Excluir minha conta"

## 7. Pendências que dependem do Rafael
- Criar os apps nas lojas (App Store Connect e Play Console)
- Decidir se apaga o Blob antigo "fotinhas-natal-familia" (o token dele vazou no GitHub; apagar some com as fotos de 2025)

---

## Ideias para reter a família no app
1. **Calendário do Advento**: uma "janela" por dia de 1 a 24/12 (foto antiga da família, receita da vó, enquete, desafio). Volta todo dia.
2. **Notificações que importam**: "Fulano comentou sua foto", "faltam 3 dias para a ceia", "seu amigo oculto atualizou a lista".
3. **Desafio de fotos do dia** ("sua árvore", "o prato que você leva") com mural temático e votação.
4. **Dicas do amigo oculto**: quem tirou pode mandar pistas anônimas para quem vai receber; revelação ao vivo na ceia.
5. **Quem leva o quê na ceia**: lista de pratos e bebidas com "eu levo", evita 3 pavês.
6. **Linha do tempo de Natais**: álbum por ano (2025, 2026...) para voltar todo ano; "neste dia, ano passado".
7. **Retrospectiva** em vídeo curto (fotos + números da vaquinha) gerada depois da ceia para compartilhar.
8. **Recados para quem não pode vir** (vídeo/áudio curto) exibidos na ceia.
9. **Placar de presença e de contribuição** só com selos (sem expor valores de cada um).
10. **Ano todo**: aniversários da família, enquetes, e o app "acorda" em novembro com o Natal seguinte.
