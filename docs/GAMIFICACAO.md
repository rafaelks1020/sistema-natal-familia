# Gamificação do Natal em Família (contrato técnico)

Decisões do Rafael (08/11/2026):
- Dois brindes no Natal: **Campeão do Natal** (quem mais usa o app: pontos de uso + brincadeiras, inclusive karaokê, + conquistas)
  e **Voz do Natal** (maior pontuação na **Prova do Karaokê**). A mesma pessoa pode ganhar os dois.
- Tem que ser JUSTO e CLARO: cada pessoa vê exatamente de onde veio cada ponto (extrato), e as regras ficam numa página.
- Ranking visível até 2 dias antes do encerramento; depois some (suspense) e é revelado no telão.
- Eventos aleatórios (missões relâmpago), por exemplo "poste uma foto sua quando criança e ganhe X pontos".
- Notificações têm que funcionar de verdade (app Android/iOS **e** site).
- Carona NÃO dá ponto. Dinheiro (vaquinha, pagamento) NÃO dá ponto (só conquista sem ponto), para não favorecer quem paga mais.
- Prova do karaokê: eliminatória (pode ser no telão de casa, `/telao/karaoke`) + final ao vivo na noite de Natal.

Regras gerais de código: nunca travessão nem meia-risca em nada (usar dois pontos, vírgula, parênteses ou hífen).
Texto de UI em português correto com acentos. Seguir os padrões do projeto (app/lib/db.ts `query`/`transaction`,
app/lib/api.ts `HttpError`, `edicaoAtual()` de app/lib/edicao.ts, sessão de app/lib/session.ts). Fuso: America/Sao_Paulo.

## 1. Banco (migração `migrations/046-gamificacao.sql`, parte P1)

```sql
-- Configuração por edição (uma linha por ano).
CREATE TABLE gami_config (
  ano int PRIMARY KEY,
  encerra_em timestamptz NOT NULL,          -- depois disso nada mais conta (padrão: 24/12 22:00 SP)
  ranking_oculto_em timestamptz NOT NULL,   -- padrão: encerra_em - 48 h
  revelado_em timestamptz,                  -- quando o admin revelou o resultado (telão)
  missoes_surpresa boolean NOT NULL DEFAULT true, -- o cron sorteia missões sozinho
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Extrato: TODA pontuação é uma linha aqui. Reconstruído pelo motor (origem <> 'ajuste').
CREATE TABLE gami_lancamentos (
  id bigserial PRIMARY KEY,
  ano int NOT NULL,
  user_id int NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  origem text NOT NULL,        -- 'uso' | 'brincadeira' | 'karaoke' | 'conquista' | 'missao' | 'ajuste'
  regra text NOT NULL,         -- id da regra (ex.: 'visita', 'foto_album', 'quiz_acerto', 'conquista:fotografo_ouro')
  ref text NOT NULL,           -- chave determinística do fato (ex.: 'visita:2026-11-08', 'album:123')
  pontos int NOT NULL,
  descricao text NOT NULL,     -- frase pronta para o extrato: "Abriu o app (08/11)"
  ocorreu_em timestamptz NOT NULL,
  UNIQUE (ano, user_id, regra, ref)
);
CREATE INDEX ON gami_lancamentos (ano, user_id);

-- Conquistas ganhas: só cresce (ganhou, fica). Notifica na inserção.
CREATE TABLE gami_conquistas (
  ano int NOT NULL,
  user_id int NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  conquista_id text NOT NULL,
  ganha_em timestamptz NOT NULL DEFAULT now(),
  notificada_em timestamptz,
  PRIMARY KEY (ano, user_id, conquista_id)
);

-- Ajustes manuais do admin (anular um ponto injusto ou bônus), com motivo. Viram lançamentos origem 'ajuste'.
CREATE TABLE gami_ajustes (
  id bigserial PRIMARY KEY,
  ano int NOT NULL,
  user_id int NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  pontos int NOT NULL,
  motivo text NOT NULL,
  anula_ref text,              -- 'regra|ref' de um lançamento a anular (o motor não o gera mais)
  criado_por int NOT NULL REFERENCES family_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Missões relâmpago (eventos aleatórios).
CREATE TABLE gami_missoes (
  id bigserial PRIMARY KEY,
  ano int NOT NULL,
  modelo text,                 -- id do modelo do banco de missões (null = criada à mão)
  titulo text NOT NULL,
  descricao text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('foto','texto','foto_texto')),
  pontos int NOT NULL CHECK (pontos BETWEEN 5 AND 200),
  inicia_em timestamptz NOT NULL,
  termina_em timestamptz NOT NULL,
  aviso_inicio_em timestamptz, -- push de "começou" enviado
  aviso_fim_em timestamptz,    -- push de "falta 1 hora" enviado
  criado_por int REFERENCES family_users(id), -- null = sorteada pelo cron
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (termina_em > inicia_em)
);
CREATE TABLE gami_missoes_respostas (
  id bigserial PRIMARY KEY,
  missao_id bigint NOT NULL REFERENCES gami_missoes(id) ON DELETE CASCADE,
  user_id int NOT NULL REFERENCES family_users(id) ON DELETE CASCADE,
  texto text,
  image_url text,
  status text NOT NULL DEFAULT 'aprovada' CHECK (status IN ('aprovada','recusada')),
  motivo_recusa text,
  avaliado_por int REFERENCES family_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (missao_id, user_id)
);
```

## 2. Pontuação (app/lib/gamificacao/regras.ts, parte P1)

Só conta o que aconteceu entre o início da edição (1/11 do ano, SP) e `encerra_em`. Conteúdo apagado ou moderado
deixa de contar (o motor reconstrói do zero). Tetos são por dia de São Paulo.

| regra | origem | pontos | teto |
|---|---|---|---|
| visita: abriu o app no dia (family_daily_visits) | uso | 5 | 1/dia |
| post: publicação no mural (texto com 10+ letras ou foto) | uso | 5 | 3/dia |
| foto_album: foto no álbum | uso | 3 | 5/dia |
| comentario: comentário com 3+ letras | uso | 2 | 10/dia |
| reacao: curtida/reação dada (não conta em post próprio) | uso | 1 | 10/dia |
| advento: respondeu a janela do dia do Advento | uso | 15 | 1 por janela |
| advento_voto: votou numa resposta do Advento | uso | 2 | 5/dia |
| presenca: confirmou presença na ceia | uso | 30 | 1 |
| receita / historia / capsula / homenagem | uso | 20 / 20 / 20 / 15 | 3 de cada no total |
| desejo: item na lista de desejos | uso | 5 | 5 no total |
| arvore: pessoa adicionada na árvore | uso | 3 | 20 no total |
| quiz_acerto: acertou pergunta do quiz | brincadeira | 5 | |
| quiz_podio: 1º/2º/3º do quiz do ano | brincadeira | 50/30/20 | |
| bingo: bingo confirmado | brincadeira | 40 | |
| desafio_foto: mandou foto no desafio | brincadeira | 10 | 1 por desafio |
| desafio_vencedor: foto mais votada do desafio | brincadeira | 40 | |
| enquete: votou na enquete ao vivo / enquete da família | brincadeira | 2 | |
| jogo_*: jogos novos (participou 5, venceu 30), conforme as tabelas party_* | brincadeira | 5/30 | |
| karaoke: nota da apresentação (Normal x1, Difícil x1,2, Fácil x0,5), arredondado | karaoke | nota | só a MELHOR nota de cada música por pessoa; no máximo 10 músicas pontuadas por dia |
| karaoke_batalha: venceu uma batalha | karaoke | 30 | |
| karaoke_dueto: os dois do dueto recebem a nota | karaoke | | |
| missao: resposta aprovada de missão | missao | pontos da missão | 1 por missão |
| conquista: bronze 20, prata 50, ouro 100, lendária 250; conquistas de dinheiro valem 0 | conquista | | |
| ajuste: do admin, com motivo visível no extrato | ajuste | +/- | |

Carona e pagamento NÃO pontuam.

## 3. Conquistas (app/lib/gamificacao/catalogo.ts, parte P1)

Pelo menos 100 conquistas em 10 categorias (familia, fotografo, prosa, advento, ceia, festa, karaoke, generoso,
memorias, secretas). A maioria em escada bronze/prata/ouro (ids `fotografo_bronze`, `fotografo_prata`...).
Cada uma: `{ id, categoria, nome, descricao, nivel: 'bronze'|'prata'|'ouro'|'lendaria', secreta: boolean, dinheiro: boolean, icone (nome lucide-react) }`
e uma função de verificação sobre as métricas do usuário. As secretas aparecem como "???" até alguém ganhar.
As 8 atuais de app/lib/conquistas.ts continuam existindo (migrar para o catálogo novo, mesma ideia).

## 4. Motor (app/lib/gamificacao/motor.ts, parte P1)

`recalcular(ano)`: lê as tabelas de origem, monta a lista de lançamentos (com tetos), avalia conquistas, e em UMA
transação: apaga os lançamentos do ano com origem <> 'ajuste', reinsere, insere conquistas novas
(ON CONFLICT DO NOTHING RETURNING) e os lançamentos 'conquista' de todas as ganhas, aplica os ajustes.
Depois da transação: push + notificação no sininho para cada conquista nova (marca `notificada_em`).
Roda no cron de 5 em 5 minutos (`app/lib/tarefas/gamificacao.ts`, registrado em app/api/cron/frequente/route.ts)
e, só como rede de segurança, quando alguém abre a página de pontos e o último cálculo tem mais de 7 minutos
(sinal de que o cron falhou): a vez é reservada em `gami_config` antes da coleta, então só uma requisição
recalcula e as outras leem o que existe. A leitura usa cache de 15 s por instância. Também é a tarefa que:
- sorteia missão surpresa (se `missoes_surpresa`): no máximo 1 por dia, começando entre 10h e 20h SP em minuto
  aleatório, duração entre 3 h e 24 h, modelo ainda não usado no ano, só de 1/12 até `encerra_em`;
- manda os pushes de missão (começou / falta 1 hora) para todos;
- manda o aviso "o ranking some em 24 horas" e "o ranking sumiu, o resultado sai na festa".

## 5. APIs (parte P1). Tipos em app/lib/gamificacao/tipos.ts (cliente pode importar com `import type`).

- `GET /api/pontos` -> `PainelPontos` (meu total, minha posição se ranking visível, meu extrato agrupado por dia,
  conquistas com progresso, ranking (top completo) ou `ranking: null` + `oculto_desde` quando oculto, regras).
- `GET /api/pontos/[userId]` -> conquistas e total de outra pessoa (sem extrato detalhado de terceiros).
- `GET /api/missoes` -> missões ativas e passadas do ano, com minha resposta; `POST /api/missoes/[id]/responder`
  (texto e/ou image_url já enviada pela rota de upload existente; valida tipo e prazo).
- Admin (`is_admin`): `GET/PATCH /api/admin/gamificacao` (config, ranking completo mesmo oculto, extrato de qualquer
  pessoa), `POST /api/admin/gamificacao/ajustes`, `POST /api/admin/gamificacao/missoes` (criar/agendar),
  `PATCH /api/admin/gamificacao/missoes/respostas/[id]` (recusar com motivo, reaprovar),
  `POST /api/admin/gamificacao/revelar` (marca revelado_em; o telão lê).
- `GET /api/telao/gamificacao` -> dados da revelação (top 5 do Campeão do Natal e top 4 da Prova), só depois de
  `revelado_em` ou para admin.

## 6. Web Push (parte P2)

`push_devices.platform = 'web'`, `token` = JSON da PushSubscription. VAPID com a lib `web-push`
(env `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). `enviarPush` passa a mandar também para 'web'.
Service worker em `public/sw.js` (mostra a notificação, clique abre a rota). Botão "Ativar notificações" no app
(site), com explicação para iPhone (precisa "Adicionar à Tela de Início" e abrir por lá). Admin: tela de diagnóstico
(quantos aparelhos por plataforma, por pessoa, último erro) e "mandar notificação de teste para mim".

## 7. Prova do Karaokê (parte P3, migração `migrations/047-karaoke-prova.sql`)

- `karaoke_prova` (ano PK, musicas bigint[] (catalogo_id, 5 músicas), eliminatoria_ate timestamptz, final_em,
  final_musica bigint, status 'preparando'|'eliminatoria'|'final'|'encerrada').
- `karaoke_prova_tentativas` (id, ano, user_id, catalogo_id, fase 'eliminatoria'|'final', fila_id, nota int null,
  detalhes jsonb, iniciada_em, terminada_em, status 'cantando'|'valida'|'abandonada', UNIQUE(ano,user_id,catalogo_id,fase)).
- Regras: nível Difícil travado; UMA tentativa oficial por música; a tentativa nasce quando a música começa no
  telão em modo Prova; se parar no meio ou fechar, vale o que cantou até ali (status 'abandonada', nota parcial
  calculada sobre a música inteira, sem segunda chance). Nada de pular trecho.
- Eliminatória: soma das 5 notas (música não cantada = 0). Os 4 maiores vão para a final.
- Final: música sorteada entre as 5 na hora; cada finalista canta uma vez; vence a maior nota da final;
  desempate: soma da eliminatória, depois afinação média.
- Clareza: tela antes ("Prova oficial: 1 tentativa, nível Difícil, vale o que cantar"), durante (selo OFICIAL),
  depois (nota com explicação: afinação, ritmo, combo, notas acertadas) e página "Regulamento da Prova" no app.
- Escolha das 5 músicas: sugestão automática pela dificuldade medida no catálogo; admin confirma.
- As notas da Prova também contam para o Campeão do Natal pelas regras de karaokê normais.
- Telão: cena de revelação dos dois brindes (suspense: 3º, 2º, 1º, fogos), lendo `/api/telao/gamificacao`.

## 8. Telas no app (parte P4)

- `/pontos`: meu total grande, posição (ou "ranking oculto, resultado na festa" com contagem regressiva), extrato
  por dia (cada linha com a frase e os pontos), "Como funciona" com a tabela de regras inteira.
- `/conquistas`: álbum por categoria, silhueta para bloqueadas, "???" para secretas, barra "23 de 104".
- `/missoes`: missão ativa em destaque com contagem regressiva e botão de responder (foto/texto), respostas da família.
- `/admin/gamificacao`: config de datas, ranking completo, extrato de qualquer um, ajustes, missões (agendar a partir
  do banco de modelos ou criar), recusar respostas, botão Revelar.
- Atalhos no hub "Tudo do Natal" e no início; aviso de conquista nova (toast com animação).
