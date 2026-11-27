# Quadro das sessões do Natal em Família

Duas sessões do Claude trabalham neste projeto e mexem no MESMO código (este repositório, na VPS). Este quadro é o que
liga uma à outra. Regra das duas:

1. **Ao começar qualquer pedido:** ler este quadro inteiro e rodar `git log --oneline -8` neste repositório.
2. **Ao terminar algo que muda estado** (commit, build, envio a loja, mudança no banco, coisa instalada em celular):
   escrever UMA linha no "Diário" abaixo, com data e hora, e fazer commit deste arquivo junto.
3. **Antes de mexer em algo da outra sessão** (ver "Quem cuida de quê"): olhar o Diário. Se a outra fez algo há menos
   de 2 horas no mesmo assunto, perguntar ao Rafael antes.
4. Pendências e decisões continuam em `docs/PLANO.md`. Aqui fica só quem fez o quê e onde está cada coisa.

## Quem cuida de quê

| Sessão | Onde roda | Cuida de |
| --- | --- | --- |
| **sistema natal** | VPS, pasta `~/Jobs/Pessoais/sistemaNatal` | Código do site e do app, correções, testes (site, app no celular pelo Notebook, jogos e pontos na API), avisos |
| **natal-lojas** | Desktop, pasta `C:\Jobs\Pessoais\natal-lojas` (trabalha na VPS por `ssh fleet-vps`) | Lojas (versão, envio, revisão, prints, respostas à Apple), builds de loja do iPhone e do Android, vídeos de tutorial, envio pelo WhatsApp, tudo que usa o navegador do Desktop |

Mudança de código pedida na natal-lojas: pode fazer, mas registra no Diário. Build de loja pedido na sistema natal: idem.

## Onde está cada coisa (atualizar quando mudar)

- 27/11 03:40 natal-lojas: bônus surpresa na notificação (ce4afa4): admin em /admin/notificacoes dispara push com pontos, resgate em /bonus/<codigo> (site e app), motor regra bonus_notificacao. Migração 051 aplicada em produção. App precisa da 1.3.5 para abrir /bonus (mandar depois da aprovação da 1.3.4 na Apple). Ainda NÃO disparado.
- 27/11 02:55 natal-lojas: aviso push "Campeão do Natal" agendado (admin_scheduled_pushes id 2) para 27/11 09:00, todos menos revisao.lojas; sai pelo cron frequente.
- **Versões publicadas:** Android e iPhone na **1.3.3** (versionCode 11, build iOS 9), enviadas em 24/11. A 1.3.3 já
  inclui tudo da 1.3.1 e da 1.3.2. Conferir: Apple pela API (`asc.py`), Play pela página pública da loja.
- **Build do iPhone:** repositório PÚBLICO e criptografado `speeduptidev/ios-build-runner`, script
  `~/natal133/ios-publico.sh` (`preparar`, `rodar`, `limpar`). O repositório privado (`speeduptidev/natal-teste-app` com
  `app-nativo/scripts/build-ios.sh`) parou: a cobrança do GitHub recusou os minutos de Mac. Nada pode vazar do público.
- **Build do Android:** na VPS com `~/natal133/android.sh` (Gradle isolado em `~/natal133/gradle`) ou no Notebook em
  `D:\natal-build` (memória `testar-app-no-celular`). Disco da VPS acima de 85% faz o `limpa-vps` apagar cache no meio.
- **Teste do app no celular:** S24 do Rafael no cabo do Notebook (adb). Ele está com uma versão de TESTE (assinada com a
  chave de envio) e a conta de revisão: a da Play não instala por cima, é preciso desinstalar antes.
- **Vídeos de tutorial:** `~/Jobs/Pessoais/natal-video/` (família v2 entregue; organizador v2 entregue em 25/11),
  entregas em `/mnt/storage/entregas/natal-familia/`. Banco de demonstração separado, nunca o de produção.
- **Conta de revisão** (`revisao.lojas`): fora do ranking e escondida da lista da família (só quem organiza vê). Usada
  nos testes e pela Apple e pelo Google. Nunca deixar como organizadora. Teste que crie dados tem de ser apagado depois.
- **Desde 24/11 o banco está em uso real pela família:** nada de teste com dados visíveis sem apagar em seguida.

## Diário (mais novo em cima, uma linha por coisa)

- 26/11 16:30 natal-lojas: FOTOS de novo (Deisy, iPhone): o app quebrava ANTES de enviar. Expo 58 troca o fetch pelo expo/fetch, que não aceita { uri } no FormData ("Unsupported FormDataPart", mostrado como sem internet). App 1.3.4 (61088c6) anexa com bytes(); enviada à Play (produção, versionCode 12) e à Apple (WAITING_FOR_REVIEW, build 10, liberação automática). Sem teste em aparelho: o S24 não estava no cabo e o emulador do Notebook não instalou (espaço).
- 26/11 07:55 sistema natal: FOTOS no iPhone da Deisy ainda falham (perfil e mural, "não foi possível conectar"), mesmo depois do repasse à VPS. Testado o caminho /api/upload pela Vercel (Frankfurt e São Paulo, rápido, lento, até 10 MB): tudo 200. Só falha corpo SEM tamanho declarado (chunked) acima de ~4 MB: a Vercel devolve 502 ROUTER_EXTERNAL_TARGET_CONNECTION_ERROR. O natal-arquivos agora registra cada envio (`journalctl -u natal-arquivos | grep app-upload`) para ver a próxima tentativa dela.
- 25/11 13:45 natal-lojas: FOTOS. iPhone falhava como "sem internet" (foto inteira passava de 4,5 MB e a Vercel cortava). /api/upload agora é repassado (rewrite) ao natal-arquivos na VPS (POST /app-upload: confere login no /api/auth, reduz a 1600 px, lê HEIC, grava na Storage Box). Vale para app e site, sem versão nova. Código do serviço versionado em infra/natal-arquivos (54cc28f).
- 25/11 13:20 natal-lojas: cadastro aceita o link ou token do convite colado no campo Código da família (641e24e, no ar e testado). Aviso no grupo do Natal: tocar no link do convite com o app instalado.
- 25/11 12:33 natal-lojas: vídeo do organizador v2 (40 s) entregue ao Rafael como documento e copiado em /mnt/storage/entregas/natal-familia/.
- 25/11 12:32 natal-lojas: cobrada a Denyse (zap pessoal do Rafael) para encaminhar a mensagem do convite no grupo da família.
- 24/11 19:34 sistema natal: mandado à Denyse (WhatsApp pessoal do Rafael, contato "Denyse Amô"): o acesso dela, a mensagem
  do grupo com o convite e o vídeo da família v2 como documento.
- 24/11 19:30 sistema natal: RESET do banco de produção para o lançamento (backup antes em
  `/mnt/storage/backups/natal-familia/natal_familia_antes-do-reset_20261124-1923.dump`). Ficaram só as contas do Rafael, da
  Denyse e a de revisão (escondida da lista da família e fora do ranking). Mantidos: configurações da ceia, catálogo do
  karaokê, itens do bingo. Criado o convite "Grupo da família" (sem limite, vale até 23/01/2027), testado com cadastro.
- 24/11 18:30 sistema natal: criado este quadro; `CLAUDE.md` na raiz do repositório e em `C:\Jobs\Pessoais\natal-lojas`
  passam a mandar ler o quadro.
- 24/11 ~16:00 natal-lojas: vídeo de tutorial da família v2 entregue no WhatsApp; organizador v2 renderizando.
- 24/11 09:46 natal-lojas: 1.3.3 enviada à produção da Play e à revisão da Apple (liberação automática).
- 24/11 00:07 natal-lojas: app 1.3.3 (versionCode 11, build iOS 9); build do iPhone pelo repositório público criptografado.
- 23/11 17:08 sistema natal: varredura do site (41 páginas) e do app (33 telas no S24); Advento corrigido no site.
- 23/11 16:00 sistema natal: jogos e pontos testados em produção pela API (quiz, enquete, bingo, desafio, times, mímica,
  roleta, bebê, karaokê, mural), tudo apagado depois. Faltam: perguntas do quiz e sorteio do amigo oculto (do Rafael).
- 23/11 15:20 sistema natal: Android 1.3.2 (versionCode 10) enviado à Play, compilado no Notebook.
- 27/11 14:17 (natal-lojas): iOS 1.3.4 aprovada pela Apple (READY_FOR_DISTRIBUTION, liberação automática). Deisy e Denyse avisadas no zap para atualizar. Próximo: 1.3.5 com a rota do bônus nas duas lojas.
- 27/11 (natal-lojas): app 1.3.5 (bônus surpresa, commit 8091b08) enviado: iOS build 11 aguardando revisão (liberação automática), Android versionCode 13 em produção. Push do bônus só depois da Apple aprovar.
