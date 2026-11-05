# Natal em Família

Rede social privada da família para o Natal: mural com fotos, curtidas, comentários e enquetes; amigo oculto com
revelação; vaquinha da ceia com pagamento por Pix (C6 Bank); álbum; confirmação de presença; perfis.
Feito para o celular, no visual **Meia-Noite** (carvão, marfim, cereja, champagne; Bodoni Moda + Manrope).

## Stack
- Next.js 16 (App Router) + React 19 + Tailwind 4, sem ORM (`pg` puro).
- Postgres na VPS2 (`natal_familia`), acessado pelo pgbouncer (porta 6432).
- Fotos no Vercel Blob. Animações do ChatGPT convertidas em vídeo leve em `public/media`.
- Pix pela API do C6 (BolePIX) na conta da SpeedTech.
- Hospedagem: Vercel, região `gru1` (São Paulo), cron diário de conciliação.

## Rodar local
```bash
npm install
cp .env.example .env.local   # preencher
npm run dev
```

## Banco
Migrations idempotentes em `migrations/`, aplicadas em ordem com a conexão direta:
```bash
psql "$DATABASE_URL_DIRECT" -f migrations/001-schema.sql
psql "$DATABASE_URL_DIRECT" -f migrations/002-repaginada.sql
psql "$DATABASE_URL_DIRECT" -f migrations/003-pagamentos.sql
```

## Acesso
- Cada parente cria o próprio usuário em `/entrar` com o **código da família** (variável `FAMILY_CODE`).
- O primeiro cadastro vira organizador; ele promove outros em `/organizar`.
- Sessão em cookie httpOnly assinado (`SESSION_SECRET`). Nenhuma rota confia em id vindo do navegador.

## Pagamento (C6)
- `/pagar` gera um BolePIX no valor da contribuição (o banco exige CPF e endereço do pagador).
- O status é consultado direto no C6 enquanto a tela está aberta e pelo cron `/api/cron/conciliar`.
- **Sem webhook de propósito:** a conta do C6 só tem um webhook e ele pertence ao ContractHub.
- Referências do Natal começam com `NF` (26 caracteres, exigência do C6).

## Animações
GIFs gerados no ChatGPT ficam fora do repo. Para converter e registrar:
```bash
bash scripts/converter-gifs.sh <pasta-com-gifs>
```
Gera `public/media/<nome>.webm|.mp4|.jpg` e atualiza `app/ui/media-manifest.ts`.
`<LoopMedia name="..." fallback={...} />` só toca o que está no manifesto.

## Variáveis (Vercel)
`DATABASE_URL`, `SESSION_SECRET`, `FAMILY_CODE`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`,
`C6_CLIENT_ID`, `C6_CLIENT_SECRET`, `C6_CERT_B64`, `C6_KEY_B64`, `C6_PIX_CHAVE`.

Regras de visual e de código para quem for mexer: `docs/CONTRATO.md`.

## Notificações push
Aplique `migrations/010-push.sql` após as migrations anteriores. O app registra o token nativo
(APNs no iOS, FCM no Android), autenticado, em `POST /api/push` com `{ platform, token }`;
`DELETE /api/push` com `{ token }` remove apenas o aparelho do usuário atual. O registro
reativa tokens desativados e transfere a propriedade para o login atual. Remova o token ao sair.

Sem credenciais, o registro funciona e o envio fica desligado por plataforma. Android usa
`FCM_SERVICE_ACCOUNT_B64` (JSON da conta de serviço em base64), com a API FCM HTTP v1 habilitada.
iOS usa `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_KEY_P8_B64` (arquivo .p8 em base64),
`APNS_BUNDLE_ID` (padrão `br.com.natalemfamilia.app`) e `APNS_PRODUCTION=true` para produção
ou `false` para sandbox. Configure o ambiente que corresponde ao provisionamento do app.
Consulte os protocolos oficiais de [FCM](https://firebase.google.com/docs/cloud-messaging/send/v1-api)
e [APNs](https://developer.apple.com/documentation/usernotifications/sending-notification-requests-to-apns).

Reações, comentários, curtidas de comentários, sorteio e confirmação de Pix enviam alertas
com rota de destino. O envio usa `after()` do Next após a resposta, sem bloquear a operação,
com timeout por requisição, cache de autenticação e concorrência limitada. Falhas são logadas
sem tokens ou credenciais; aparelhos inválidos recebem `disabled_at`. Não há fila ou retentativa persistente.

Para testar com chaves: registre aparelhos físicos iOS/Android e, com outro login, reaja e
comente no mural, curta um comentário, crie um sorteio e confirme um Pix de teste pelo fluxo
existente. Confira o alerta e a rota aberta (`/mural`, `/amigo-oculto`, `/vaquinha`). Remova
um token pelo DELETE e confirme a ausência de novos alertas; registre novamente para reativar.
Confira também que um login não remove o token de outro e que registrar o mesmo token em
outro login transfere o destinatário. Respostas UNREGISTERED/NOT_FOUND do FCM e 410/BadDeviceToken
do APNs devem preencher `disabled_at` sem afetar a operação original.
