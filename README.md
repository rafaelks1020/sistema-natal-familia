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
