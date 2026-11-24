# Natal em Família

Site Next.js (raiz) e app Expo (`app-nativo/`) da família do Rafael para o Natal de 2026. Repositório
`rafaelks1020/sistema-natal-familia`; push em `main` publica o site na Vercel.

## Duas sessões no mesmo código: LER O QUADRO ANTES DE TUDO

Este projeto tem duas sessões do Claude: **sistema natal** (VPS, esta pasta) e **natal-lojas** (Desktop, que trabalha
aqui por SSH). As duas mexem neste mesmo repositório.

- Ao começar qualquer pedido: ler `docs/QUADRO-SESSOES.md` e rodar `git log --oneline -8`.
- Ao terminar algo que muda estado (commit, build, envio a loja, banco, celular): uma linha no Diário do quadro, com
  commit junto.
- Pendências e decisões: `docs/PLANO.md`.
