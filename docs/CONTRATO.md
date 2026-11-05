# Natal em Família: contrato da repaginada (Meia-Noite)

App de Natal da família do Rafael, usado **no celular** por parentes de todas as idades. Next.js 16 (App Router),
React 19, Tailwind 4, `pg` puro (sem ORM), Postgres na VPS2. Toda a interface em **português do Brasil**.
**Proibido** usar travessão (U+2014) ou meia-risca (U+2013) em qualquer texto, código ou comentário: use dois pontos, vírgula, parênteses ou hífen.

## 1. Visual Meia-Noite (obrigatório)
Referência: `docs/ref/estilo2a.png` e `docs/ref/estilo2b.png` (mockups aprovados). Editorial, noturno, fotografia com flash, elegante, pouco ornamento.
- Cores (classes Tailwind já existem): `bg-carvao` (#171B18, fundo), `bg-carvao-2` (superfície), `bg-carvao-3` (campo), `text-marfim` / `text-marfim-2` / `text-marfim-3`, `bg-cereja`/`text-cereja` (#C5292D, ação e destaque), `text-champagne` (#BFA577, só acento fino: kicker, aro, linha, número), `text-salvia`, `border-linha` / `border-linha-forte`.
- Fontes: `.display` (Bodoni Moda, títulos e números grandes), `.display-italic`, corpo em Manrope (padrão). `.kicker` = rótulo pequeno em caixa alta champagne. `.numeral` = números em Bodoni tabulares.
- Classes prontas em `app/globals.css`: `.surface` (cartão), `.field` (input 16px), `.btn .btn-primary | .btn-ghost | .btn-quiet`, `.rule` (divisória 1px), `.rise`, `.fade-in`, `.pop`, `.stagger` (entrada escalonada dos filhos), `.no-scrollbar`, `.pb-nav`.
- Regras: mobile primeiro (360 a 430 px), alvo de toque mínimo 44 px, ícones `lucide-react` com `strokeWidth={1.5}`, divisórias de 1 px em vez de caixas em tudo, fotos grandes sem moldura, cantos 14 a 18 px. **Não** usar: gradiente roxo/azul, emoji gigante, cartões todos iguais em grade, sombras pesadas, `bg-white`, cinza do Tailwind cru (`gray-*`, `slate-*`), cores fora da paleta. Movimento suave e lento (`var(--ease-cine)`, 0,6 a 0,9 s), respeitando `prefers-reduced-motion` (já no CSS global).
- Estados vazios e de carregamento sempre desenhados (nada de tela branca ou "Carregando..." solto). Erros mostrados com `useToast()`.

## 2. Componentes compartilhados (NÃO alterar estes arquivos; só usar)
- `app/ui/LoopMedia.tsx`: `<LoopMedia name="mn-hero" className="..." fallback={<.../>} once? onEnded? />` toca `/public/media/<name>.webm|.mp4` em loop, mudo; se o arquivo faltar mostra `fallback`. **Sempre passe um fallback bonito em CSS** (os vídeos chegam depois).
  Nomes disponíveis: `mn-hero` (9:16 bokeh e velas, capa do início), `mn-login`, `mn-revelacao` (cartão VIP com selo rompendo), `mn-presente` (presente abrindo com faíscas), `mn-curtida` (coração pulsando), `mn-loader` (estrela desenhando, carregamento), `mn-brinde` (taças brindando: confirmação "Vou"), `mn-confete` (meta da vaquinha), `mn-sino` (notificações), `mn-vazio` (árvore em traço: estado vazio), `mn-countdown` (16:9 estrelinha queimando: fundo da contagem), `mn-album` (16:9 polaroids caindo: topo do álbum).
- `app/ui/PageHeader.tsx`: `<PageHeader kicker="..." title="..." back="/rota"? action={...}? />`.
- `app/ui/Avatar.tsx`: `<Avatar name src size ring />`.
- `app/ui/toast.tsx`: `const toast = useToast(); toast('Publicado'); toast(msg, 'erro')`.
- `app/ui/user.tsx`: `const me = useMe()` = `{ id, name, username, is_admin, avatar_url, participant_id }` (client components dentro de `(app)`).
- `app/ui/client.ts`: `api<T>(path, { method, json })` (lança Error com a mensagem do servidor; 401 manda para /entrar), `uploadImage(file) -> url`, `brl(n)`, `timeAgo(date)`.
- `app/(app)/layout.tsx` já exige login, envolve com UserProvider + ToastProvider e desenha a barra inferior (Início, Mural, Amigo oculto, Vaquinha, Álbum). Páginas ficam em `app/(app)/<rota>/page.tsx` e já recebem padding inferior (`pb-nav`).

## 3. API (padrão obrigatório)
- Arquivos em `app/api/<recurso>/route.ts`. Use `app/lib/api.ts`:
  `export const GET = route(async (req) => { const me = await requireUser(); ...; return ok(dados); })`.
  `requireAdmin()` para ações de organizador. Erro de regra: `throw new HttpError(400, 'mensagem em português')`. `readJson(req)`, `toInt(v)`, `cleanText(v, 'campo', max)`.
  Rotas dinâmicas no Next 16: `route<{ params: Promise<{ id: string }> }>(async (req, { params }) => { const { id } = await params; ... })`.
- **Segurança:** NUNCA confiar em `user_id`/`participant_id` vindo do cliente para dizer quem é a pessoa: use `me.id` e `me.participant_id` da sessão. Editar/apagar algo de outra pessoa só se `me.is_admin`. Sempre SQL parametrizado (`$1`). Valide tamanho de texto. URLs de imagem aceitas só se começarem com `https://`.
- Banco: `import { query, transaction } from '@/app/lib/db'`. Datas `TIMESTAMP` sem fuso (gravadas com NOW() do servidor em UTC).

## 4. Banco (tabelas existentes; ver `migrations/001-schema.sql` e `migrations/002-repaginada.sql`)
- `family_users(id, name, username, password_hash, is_admin, avatar_url, bio, created_at)` = login do parente.
- `participants(id, name, paid, paid_date, user_id)` = quem entra na vaquinha e no sorteio (pode existir sem login; `user_id` liga ao parente).
- `purchases(id, description, value, category, brand, color, size, quantity, notes, image_url, image_urls(JSON texto), created_at)` = gastos da vaquinha.
- `family_posts(id, user_id, content, image_url, image_urls, pinned, created_at, updated_at)`, `family_post_reactions(post_id, user_id, reaction_type)` UNIQUE(post,user,type), `family_post_comments(id, post_id, user_id, content, created_at)`, `family_comment_likes(comment_id, user_id)`, `family_polls(id, question, options TEXT[], created_by, created_at)`, `family_poll_votes(poll_id, user_id, option_index)` UNIQUE(poll,user), `family_notifications(id, user_id, actor_id, type, post_id, comment_id, reaction_type, created_at, read_at)`.
- `family_attendance(participant_id UNIQUE, user_id, status 'yes'|'maybe'|'no', created_at, updated_at)`.
- `secret_santa_config(id, is_active, min_gift_value, max_gift_value, reveal_date, rules JSONB, created_at)`, `secret_santa_draws(config_id, giver_id, receiver_id → participants, token, revealed, revealed_at)`, `wish_list(id, participant_id, config_id, item_name, item_description, item_url, priority, purchased, created_at)`.
- `app_settings(key, value)`: `event_title`, `event_date` (ISO com -03:00), `event_place`, `contribution_value` (número em texto).
- Para mudar o banco, crie `migrations/0NN-<nome>.sql` idempotente e diga no relatório (não rode contra o banco).
- Código antigo de referência (regras de negócio): `git show HEAD:app/api/<rota>/route.ts`, `git show HEAD:app/components/<X>.tsx`, `app/lib/secretSanta.ts` (algoritmo de sorteio, pode usar).

## 5. Dono de cada arquivo
Cada tarefa só cria/edita os arquivos da sua área. Não mexa em `app/lib/*`, `app/ui/*`, `app/globals.css`, `app/layout.tsx`, `app/(app)/layout.tsx`, `app/entrar/*`, `app/api/auth/*`, `app/api/upload/*`. Se precisar de um componente só seu, crie em `app/(app)/<sua-rota>/_components/`.

## 6. Pronto quando
`npx tsc --noEmit` e `npx eslint app --quiet` limpos; tela funcionando em 390 px de largura; textos em português sem travessão.
