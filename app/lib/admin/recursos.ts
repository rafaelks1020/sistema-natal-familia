// Registro declarativo do painel admin. SEM imports: o teste (node --test) carrega este arquivo direto.
// Tudo que vira SQL (tabela, alias, coluna, expressão) vem DAQUI e nunca de dado da requisição.
//
// PRIVACIDADE (o teste admin.test.mjs confere): este registro nunca lê o sorteio do amigo oculto,
// as compras da lista de desejos, o texto lacrado da cápsula, senha, token ou refresh token.
// Dicas saem sem o autor, cápsula sem texto antes de abrir, CPF só mascarado.

export type TipoColuna = 'texto' | 'longo' | 'data' | 'imagem' | 'dinheiro' | 'bool' | 'numero' | 'link';
export type TipoEditavel = 'texto' | 'longo' | 'bool' | 'numero' | 'dinheiro' | 'opcao';

export interface ColunaDef { campo: string; rotulo: string; tipo: TipoColuna; sql: string }
export interface EditavelDef {
  campo: string;            // tem que existir em colunas
  rotulo: string;
  tipo: TipoEditavel;
  opcoes?: string[];
  coluna?: string;          // coluna real a gravar (padrão: o próprio campo)
  vazio?: 'nulo' | 'vazio'; // aceita limpar: grava NULL ou texto vazio
  limite?: number;          // tamanho máximo do texto
  min?: number;
  max?: number;
  centavosParaReais?: boolean; // coluna é DECIMAL em reais (o campo trafega em centavos)
}
export interface AcaoDef { id: string; rotulo: string; perigosa: boolean }

export interface Recurso {
  id: string;
  nome: string;
  grupo: string;
  tabela: string;           // tabela principal (escrita e contagem)
  alias: string;
  from: string;             // FROM completo com joins (leitura)
  tabelas: string[];        // todas as tabelas usadas (some se alguma não existir)
  idCol?: string;           // padrão 'id'
  ordemAsc?: boolean;       // padrão: mais recente primeiro (id decrescente)
  filtro?: string;          // sempre aplicado
  chavesOcultas?: boolean;  // esconde chaves com token, refresh ou secret (app_settings)
  novos: string | null;     // expressão de data para "novos em 7 dias"
  busca: string[];
  colunas: ColunaDef[];
  editaveis: EditavelDef[];
  aoEditar?: string;        // SET extra ao editar (ex.: updated_at = NOW())
  pode_apagar: boolean;
  naoApagarProprio?: boolean;
  acoes: AcaoDef[];
}

export const GRUPOS = [
  'Pessoas e acesso',
  'Mural e álbum',
  'Vaquinha e ceia',
  'Amigo oculto e Advento',
  'A noite da festa',
  'Memórias da família',
  'Configurações',
] as const;

const ROTULO_ALVO: Record<string, string> = {
  dica: 'Dica do amigo oculto', receita: 'Receita', historia: 'História', advento: 'Resposta do Advento',
  desafio: 'Foto do desafio', homenagem: 'Homenagem', carona: 'Carona ou hospedagem', prato: 'Prato da ceia',
  ceia_despesa: 'Despesa da ceia', capsula: 'Mensagem da cápsula do tempo',
};
const CASE_TIPO_DENUNCIA = `CASE WHEN r.post_id IS NOT NULL THEN 'Post do mural' WHEN r.comment_id IS NOT NULL THEN 'Comentário do mural' ${Object.entries(
  ROTULO_ALVO,
).map(([k, v]) => `WHEN r.alvo_tipo = '${k}' THEN '${v}'`).join(' ')} ELSE 'Conteúdo' END`;

const AUTOR = (a: string) => `${a}.name`;

export const RECURSOS: Recurso[] = [
  // ---------- Pessoas e acesso ----------
  {
    id: 'pessoas', nome: 'Pessoas', grupo: 'Pessoas e acesso',
    tabela: 'family_users', alias: 'u', from: 'family_users u', tabelas: ['family_users'],
    novos: 'u.created_at', busca: ['u.name', 'u.username'],
    colunas: [
      { campo: 'name', rotulo: 'Nome', tipo: 'texto', sql: 'u.name' },
      { campo: 'username', rotulo: 'Usuário', tipo: 'texto', sql: 'u.username' },
      { campo: 'is_admin', rotulo: 'Organizador', tipo: 'bool', sql: 'u.is_admin' },
      { campo: 'avatar_url', rotulo: 'Foto', tipo: 'imagem', sql: 'u.avatar_url' },
      { campo: 'bio', rotulo: 'Sobre', tipo: 'longo', sql: 'u.bio' },
      { campo: 'cpf_mascarado', rotulo: 'CPF', tipo: 'texto',
        sql: `CASE WHEN u.billing_cpf IS NULL THEN NULL ELSE '***.***.***-' || right(regexp_replace(u.billing_cpf, '[^0-9]', '', 'g'), 2) END` },
      { campo: 'created_at', rotulo: 'Entrou em', tipo: 'data', sql: 'u.created_at' },
    ],
    editaveis: [
      { campo: 'name', rotulo: 'Nome', tipo: 'texto', limite: 80 },
      { campo: 'bio', rotulo: 'Sobre', tipo: 'longo', vazio: 'nulo', limite: 500 },
    ],
    pode_apagar: true, naoApagarProprio: true,
    acoes: [
      { id: 'tornar_admin', rotulo: 'Tornar organizador', perigosa: false },
      { id: 'remover_admin', rotulo: 'Remover organização', perigosa: true },
      { id: 'resetar_senha', rotulo: 'Gerar senha temporária', perigosa: true },
      { id: 'encerrar_sessoes', rotulo: 'Encerrar sessões', perigosa: true },
    ],
  },
  {
    id: 'participantes', nome: 'Participantes', grupo: 'Pessoas e acesso',
    tabela: 'participants', alias: 'p',
    from: 'participants p LEFT JOIN family_users u ON u.id = p.user_id', tabelas: ['participants', 'family_users'],
    novos: null, busca: ['p.name', 'u.username'],
    colunas: [
      { campo: 'name', rotulo: 'Nome', tipo: 'texto', sql: 'p.name' },
      { campo: 'paid', rotulo: 'Pagou a vaquinha', tipo: 'bool', sql: 'p.paid' },
      { campo: 'paid_date', rotulo: 'Pagou em', tipo: 'data', sql: 'p.paid_date' },
      { campo: 'usuario', rotulo: 'Acesso ligado', tipo: 'texto', sql: 'u.username' },
    ],
    editaveis: [{ campo: 'name', rotulo: 'Nome', tipo: 'texto', limite: 80 }],
    pode_apagar: false, acoes: [],
  },
  {
    id: 'convites', nome: 'Convites', grupo: 'Pessoas e acesso',
    tabela: 'invites', alias: 'i',
    from: 'invites i LEFT JOIN participants p ON p.id = i.participant_id LEFT JOIN family_users c ON c.id = i.created_by',
    tabelas: ['invites', 'participants', 'family_users'],
    novos: 'i.created_at', busca: ['i.label', 'p.name', 'c.name'],
    colunas: [
      { campo: 'label', rotulo: 'Nome do convite', tipo: 'texto', sql: 'i.label' },
      { campo: 'uses', rotulo: 'Usos', tipo: 'numero', sql: 'i.uses' },
      { campo: 'max_uses', rotulo: 'Limite de usos', tipo: 'numero', sql: 'i.max_uses' },
      { campo: 'participante', rotulo: 'Participante', tipo: 'texto', sql: 'p.name' },
      { campo: 'criado_por', rotulo: 'Criado por', tipo: 'texto', sql: 'c.name' },
      { campo: 'expires_at', rotulo: 'Vence em', tipo: 'data', sql: 'i.expires_at' },
      { campo: 'revoked_at', rotulo: 'Cancelado em', tipo: 'data', sql: 'i.revoked_at' },
      { campo: 'created_at', rotulo: 'Criado em', tipo: 'data', sql: 'i.created_at' },
    ],
    editaveis: [
      { campo: 'label', rotulo: 'Nome do convite', tipo: 'texto', limite: 80 },
      { campo: 'max_uses', rotulo: 'Limite de usos', tipo: 'numero', vazio: 'nulo', min: 1, max: 1000 },
    ],
    pode_apagar: false,
    acoes: [{ id: 'revogar', rotulo: 'Cancelar convite', perigosa: true }],
  },
  {
    id: 'pedidos_convite', nome: 'Pedidos de convite', grupo: 'Pessoas e acesso',
    tabela: 'invitation_requests', alias: 'r',
    from: 'invitation_requests r JOIN family_users u ON u.id = r.user_id', tabelas: ['invitation_requests', 'family_users'],
    novos: 'r.created_at', busca: ['r.nome', 'r.parentesco', 'u.name'],
    colunas: [
      { campo: 'nome', rotulo: 'Nome do convidado', tipo: 'texto', sql: 'r.nome' },
      { campo: 'parentesco', rotulo: 'Parentesco', tipo: 'texto', sql: 'r.parentesco' },
      { campo: 'status', rotulo: 'Situação', tipo: 'texto', sql: 'r.status' },
      { campo: 'solicitante', rotulo: 'Pedido por', tipo: 'texto', sql: AUTOR('u') },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 'r.ano' },
      { campo: 'created_at', rotulo: 'Pedido em', tipo: 'data', sql: 'r.created_at' },
      { campo: 'reviewed_at', rotulo: 'Decidido em', tipo: 'data', sql: 'r.reviewed_at' },
    ],
    editaveis: [], pode_apagar: false,
    acoes: [{ id: 'recusar', rotulo: 'Recusar pedido', perigosa: true }],
  },

  // ---------- Mural e álbum ----------
  {
    id: 'posts', nome: 'Posts do mural', grupo: 'Mural e álbum',
    tabela: 'family_posts', alias: 'p',
    from: 'family_posts p JOIN family_users u ON u.id = p.user_id', tabelas: ['family_posts', 'family_users'],
    novos: 'p.created_at', busca: ['p.content', 'u.name'],
    colunas: [
      { campo: 'content', rotulo: 'Texto', tipo: 'longo', sql: 'p.content' },
      { campo: 'autor', rotulo: 'Autor', tipo: 'texto', sql: AUTOR('u') },
      { campo: 'image_url', rotulo: 'Foto', tipo: 'imagem', sql: 'p.image_url' },
      { campo: 'pinned', rotulo: 'Fixado', tipo: 'bool', sql: 'p.pinned' },
      { campo: 'created_at', rotulo: 'Publicado em', tipo: 'data', sql: 'p.created_at' },
    ],
    editaveis: [
      { campo: 'content', rotulo: 'Texto', tipo: 'longo', limite: 5000 },
      { campo: 'pinned', rotulo: 'Fixado', tipo: 'bool' },
    ],
    aoEditar: 'updated_at = NOW()', pode_apagar: true, acoes: [],
  },
  {
    id: 'comentarios', nome: 'Comentários', grupo: 'Mural e álbum',
    tabela: 'family_post_comments', alias: 'c',
    from: 'family_post_comments c JOIN family_users u ON u.id = c.user_id', tabelas: ['family_post_comments', 'family_users'],
    novos: 'c.created_at', busca: ['c.content', 'u.name'],
    colunas: [
      { campo: 'content', rotulo: 'Comentário', tipo: 'longo', sql: 'c.content' },
      { campo: 'autor', rotulo: 'Autor', tipo: 'texto', sql: AUTOR('u') },
      { campo: 'post_id', rotulo: 'Post', tipo: 'numero', sql: 'c.post_id' },
      { campo: 'created_at', rotulo: 'Comentou em', tipo: 'data', sql: 'c.created_at' },
    ],
    editaveis: [{ campo: 'content', rotulo: 'Comentário', tipo: 'longo', limite: 2000 }],
    pode_apagar: true, acoes: [],
  },
  {
    id: 'enquetes_mural', nome: 'Enquetes do mural', grupo: 'Mural e álbum',
    tabela: 'family_polls', alias: 'f',
    from: 'family_polls f JOIN family_users u ON u.id = f.created_by', tabelas: ['family_polls', 'family_poll_votes', 'family_users'],
    novos: 'f.created_at', busca: ['f.question', 'u.name'],
    colunas: [
      { campo: 'question', rotulo: 'Pergunta', tipo: 'texto', sql: 'f.question' },
      { campo: 'opcoes', rotulo: 'Opções', tipo: 'longo', sql: `array_to_string(f.options, ' | ')` },
      { campo: 'votos', rotulo: 'Votos', tipo: 'numero', sql: '(SELECT count(*)::int FROM family_poll_votes v WHERE v.poll_id = f.id)' },
      { campo: 'autor', rotulo: 'Criada por', tipo: 'texto', sql: AUTOR('u') },
      { campo: 'created_at', rotulo: 'Criada em', tipo: 'data', sql: 'f.created_at' },
    ],
    editaveis: [{ campo: 'question', rotulo: 'Pergunta', tipo: 'texto', limite: 200 }],
    pode_apagar: true, acoes: [],
  },
  {
    id: 'fotos_album', nome: 'Fotos do álbum', grupo: 'Mural e álbum',
    tabela: 'album_photos', alias: 'a',
    from: 'album_photos a JOIN family_users u ON u.id = a.user_id', tabelas: ['album_photos', 'family_users'],
    novos: 'a.created_at', busca: ['a.caption', 'u.name'],
    colunas: [
      { campo: 'image_url', rotulo: 'Foto', tipo: 'imagem', sql: 'a.image_url' },
      { campo: 'caption', rotulo: 'Legenda', tipo: 'longo', sql: 'a.caption' },
      { campo: 'autor', rotulo: 'Enviada por', tipo: 'texto', sql: AUTOR('u') },
      { campo: 'taken_on', rotulo: 'Tirada em', tipo: 'data', sql: 'a.taken_on::text' },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 'a.ano' },
      { campo: 'created_at', rotulo: 'Enviada em', tipo: 'data', sql: 'a.created_at' },
    ],
    editaveis: [{ campo: 'caption', rotulo: 'Legenda', tipo: 'longo', vazio: 'vazio', limite: 500 }],
    pode_apagar: true, acoes: [],
  },
  {
    id: 'denuncias', nome: 'Denúncias pendentes', grupo: 'Mural e álbum',
    tabela: 'content_reports', alias: 'r',
    from: 'content_reports r JOIN family_users rep ON rep.id = r.reporter_id', tabelas: ['content_reports', 'family_posts', 'family_post_comments', 'family_users'],
    filtro: 'r.resolved_at IS NULL',
    novos: 'r.created_at', busca: ['r.motivo', 'r.trecho', 'rep.name'],
    colunas: [
      { campo: 'tipo', rotulo: 'O que foi denunciado', tipo: 'texto', sql: CASE_TIPO_DENUNCIA },
      { campo: 'trecho', rotulo: 'Conteúdo', tipo: 'longo',
        sql: `COALESCE(r.trecho, (SELECT left(p.content, 300) FROM family_posts p WHERE p.id = r.post_id), (SELECT left(c.content, 300) FROM family_post_comments c WHERE c.id = r.comment_id))` },
      { campo: 'motivo', rotulo: 'Motivo', tipo: 'longo', sql: 'r.motivo' },
      { campo: 'reportante', rotulo: 'Denunciado por', tipo: 'texto', sql: 'rep.name' },
      { campo: 'created_at', rotulo: 'Denunciado em', tipo: 'data', sql: 'r.created_at' },
    ],
    editaveis: [], pode_apagar: false,
    acoes: [
      { id: 'apagar_conteudo', rotulo: 'Apagar o conteúdo', perigosa: true },
      { id: 'manter', rotulo: 'Manter', perigosa: false },
    ],
  },

  // ---------- Vaquinha e ceia ----------
  {
    id: 'pagamentos', nome: 'Pagamentos', grupo: 'Vaquinha e ceia',
    tabela: 'payments', alias: 'p',
    from: 'payments p JOIN participants pa ON pa.id = p.participant_id', tabelas: ['payments', 'participants'],
    novos: 'p.created_at', busca: ['pa.name', 'p.reference', 'p.status'],
    colunas: [
      { campo: 'participante', rotulo: 'Participante', tipo: 'texto', sql: 'pa.name' },
      { campo: 'valor', rotulo: 'Valor', tipo: 'dinheiro', sql: 'ROUND(p.amount * 100)::int' },
      { campo: 'status', rotulo: 'Situação', tipo: 'texto', sql: 'p.status' },
      { campo: 'reference', rotulo: 'Referência', tipo: 'texto', sql: 'p.reference' },
      { campo: 'due_date', rotulo: 'Vencimento', tipo: 'data', sql: 'p.due_date::text' },
      { campo: 'created_at', rotulo: 'Criado em', tipo: 'data', sql: 'p.created_at' },
      { campo: 'checked_at', rotulo: 'Conferido em', tipo: 'data', sql: 'p.checked_at' },
      { campo: 'paid_at', rotulo: 'Pago em', tipo: 'data', sql: 'p.paid_at' },
    ],
    editaveis: [], pode_apagar: false,
    acoes: [{ id: 'conferir_no_banco', rotulo: 'Conferir no banco', perigosa: false }],
  },
  {
    id: 'gastos_vaquinha', nome: 'Gastos da vaquinha', grupo: 'Vaquinha e ceia',
    tabela: 'purchases', alias: 'p', from: 'purchases p', tabelas: ['purchases'],
    novos: 'p.created_at', busca: ['p.description', 'p.category', 'p.brand'],
    colunas: [
      { campo: 'description', rotulo: 'Descrição', tipo: 'texto', sql: 'p.description' },
      { campo: 'value_centavos', rotulo: 'Valor', tipo: 'dinheiro', sql: 'p.value_centavos' },
      { campo: 'category', rotulo: 'Categoria', tipo: 'texto', sql: 'p.category' },
      { campo: 'brand', rotulo: 'Marca', tipo: 'texto', sql: 'p.brand' },
      { campo: 'quantity', rotulo: 'Quantidade', tipo: 'numero', sql: 'p.quantity' },
      { campo: 'notes', rotulo: 'Observações', tipo: 'longo', sql: 'p.notes' },
      { campo: 'image_url', rotulo: 'Foto', tipo: 'imagem', sql: 'p.image_url' },
      { campo: 'receipt_url', rotulo: 'Comprovante', tipo: 'link', sql: 'p.receipt_url' },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 'p.ano' },
      { campo: 'created_at', rotulo: 'Lançado em', tipo: 'data', sql: 'p.created_at' },
    ],
    editaveis: [
      { campo: 'description', rotulo: 'Descrição', tipo: 'texto', limite: 200 },
      { campo: 'value_centavos', rotulo: 'Valor', tipo: 'dinheiro', coluna: 'value', centavosParaReais: true, min: 1 },
      { campo: 'category', rotulo: 'Categoria', tipo: 'texto', vazio: 'nulo', limite: 60 },
      { campo: 'quantity', rotulo: 'Quantidade', tipo: 'numero', min: 1, max: 10000 },
      { campo: 'notes', rotulo: 'Observações', tipo: 'longo', vazio: 'nulo', limite: 1000 },
    ],
    pode_apagar: true, acoes: [],
  },
  {
    id: 'presenca', nome: 'Presença', grupo: 'Vaquinha e ceia',
    tabela: 'family_attendance', alias: 'a',
    from: 'family_attendance a JOIN participants p ON p.id = a.participant_id', tabelas: ['family_attendance', 'participants'],
    novos: 'a.created_at', busca: ['p.name', 'a.restricao'],
    colunas: [
      { campo: 'participante', rotulo: 'Participante', tipo: 'texto', sql: 'p.name' },
      { campo: 'status', rotulo: 'Resposta', tipo: 'texto', sql: 'a.status' },
      { campo: 'adultos', rotulo: 'Adultos', tipo: 'numero', sql: 'a.adultos' },
      { campo: 'criancas', rotulo: 'Crianças', tipo: 'numero', sql: 'a.criancas' },
      { campo: 'restricao', rotulo: 'Restrição alimentar', tipo: 'texto', sql: 'a.restricao' },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 'a.ano' },
      { campo: 'updated_at', rotulo: 'Atualizada em', tipo: 'data', sql: 'a.updated_at' },
    ],
    editaveis: [
      { campo: 'status', rotulo: 'Resposta', tipo: 'opcao', opcoes: ['yes', 'maybe', 'no'] },
      { campo: 'adultos', rotulo: 'Adultos', tipo: 'numero', vazio: 'nulo', min: 0, max: 50 },
      { campo: 'criancas', rotulo: 'Crianças', tipo: 'numero', vazio: 'nulo', min: 0, max: 50 },
      { campo: 'restricao', rotulo: 'Restrição alimentar', tipo: 'texto', vazio: 'nulo', limite: 200 },
    ],
    pode_apagar: true, acoes: [],
  },
  {
    id: 'pratos_ceia', nome: 'Pratos da ceia', grupo: 'Vaquinha e ceia',
    tabela: 'ceia_dishes', alias: 'd',
    from: 'ceia_dishes d JOIN family_users u ON u.id = d.user_id LEFT JOIN family_users r ON r.id = d.responsavel_id',
    tabelas: ['ceia_dishes', 'family_users'],
    novos: 'd.created_at', busca: ['d.nome', 'd.quantidade', 'u.name', 'r.name'],
    colunas: [
      { campo: 'nome', rotulo: 'Prato', tipo: 'texto', sql: 'd.nome' },
      { campo: 'categoria', rotulo: 'Categoria', tipo: 'texto', sql: 'd.categoria' },
      { campo: 'quantidade', rotulo: 'Quantidade', tipo: 'texto', sql: 'd.quantidade' },
      { campo: 'autor', rotulo: 'Cadastrado por', tipo: 'texto', sql: AUTOR('u') },
      { campo: 'responsavel', rotulo: 'Quem leva', tipo: 'texto', sql: 'r.name' },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 'd.ano' },
      { campo: 'created_at', rotulo: 'Criado em', tipo: 'data', sql: 'd.created_at' },
    ],
    editaveis: [
      { campo: 'nome', rotulo: 'Prato', tipo: 'texto', limite: 120 },
      { campo: 'categoria', rotulo: 'Categoria', tipo: 'opcao', opcoes: ['salgado', 'doce', 'bebida', 'descartavel', 'outro'] },
      { campo: 'quantidade', rotulo: 'Quantidade', tipo: 'texto', vazio: 'nulo', limite: 60 },
    ],
    pode_apagar: true, acoes: [],
  },
  {
    id: 'votacoes_ceia', nome: 'Votações da ceia', grupo: 'Vaquinha e ceia',
    tabela: 'ceia_votacoes', alias: 'v', from: 'ceia_votacoes v', tabelas: ['ceia_votacoes', 'ceia_votacao_opcoes', 'ceia_votos'],
    novos: 'v.created_at', busca: ['v.pergunta'],
    colunas: [
      { campo: 'pergunta', rotulo: 'Pergunta', tipo: 'texto', sql: 'v.pergunta' },
      { campo: 'tipo', rotulo: 'Tipo', tipo: 'texto', sql: 'v.tipo' },
      { campo: 'aberta', rotulo: 'Aberta', tipo: 'bool', sql: 'v.aberta' },
      { campo: 'opcoes', rotulo: 'Opções', tipo: 'longo', sql: `(SELECT string_agg(o.texto, ' | ' ORDER BY o.ordem, o.id) FROM ceia_votacao_opcoes o WHERE o.votacao_id = v.id)` },
      { campo: 'votos', rotulo: 'Votos', tipo: 'numero', sql: '(SELECT count(*)::int FROM ceia_votos x WHERE x.votacao_id = v.id)' },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 'v.ano' },
      { campo: 'created_at', rotulo: 'Criada em', tipo: 'data', sql: 'v.created_at' },
    ],
    editaveis: [
      { campo: 'pergunta', rotulo: 'Pergunta', tipo: 'texto', limite: 200 },
      { campo: 'tipo', rotulo: 'Tipo', tipo: 'opcao', opcoes: ['local', 'cardapio', 'data', 'outro'] },
      { campo: 'aberta', rotulo: 'Aberta', tipo: 'bool' },
    ],
    pode_apagar: true, acoes: [],
  },
  {
    id: 'caronas', nome: 'Caronas e hospedagem', grupo: 'Vaquinha e ceia',
    tabela: 'ride_offers', alias: 'r',
    from: 'ride_offers r JOIN family_users u ON u.id = r.user_id', tabelas: ['ride_offers', 'family_users'],
    novos: 'r.created_at', busca: ['r.origem', 'r.observacao', 'u.name'],
    colunas: [
      { campo: 'tipo', rotulo: 'Tipo', tipo: 'texto', sql: 'r.tipo' },
      { campo: 'origem', rotulo: 'Origem', tipo: 'texto', sql: 'r.origem' },
      { campo: 'quando', rotulo: 'Quando', tipo: 'texto', sql: 'r.quando' },
      { campo: 'vagas', rotulo: 'Vagas', tipo: 'numero', sql: 'r.vagas' },
      { campo: 'observacao', rotulo: 'Observação', tipo: 'longo', sql: 'r.observacao' },
      { campo: 'ativo', rotulo: 'Ativa', tipo: 'bool', sql: 'r.ativo' },
      { campo: 'autor', rotulo: 'Publicada por', tipo: 'texto', sql: AUTOR('u') },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 'r.ano' },
      { campo: 'created_at', rotulo: 'Criada em', tipo: 'data', sql: 'r.created_at' },
    ],
    editaveis: [
      { campo: 'ativo', rotulo: 'Ativa', tipo: 'bool' },
      { campo: 'origem', rotulo: 'Origem', tipo: 'texto', limite: 120 },
      { campo: 'quando', rotulo: 'Quando', tipo: 'texto', limite: 120 },
      { campo: 'vagas', rotulo: 'Vagas', tipo: 'numero', min: 0, max: 100 },
      { campo: 'observacao', rotulo: 'Observação', tipo: 'longo', limite: 500 },
    ],
    pode_apagar: true, acoes: [],
  },
  {
    id: 'despesas_ceia', nome: 'Despesas da ceia', grupo: 'Vaquinha e ceia',
    tabela: 'ceia_despesas', alias: 'd',
    from: 'ceia_despesas d JOIN family_users u ON u.id = d.user_id', tabelas: ['ceia_despesas', 'family_users'],
    novos: 'd.created_at', busca: ['d.descricao', 'u.name'],
    colunas: [
      { campo: 'descricao', rotulo: 'Descrição', tipo: 'texto', sql: 'd.descricao' },
      { campo: 'valor_centavos', rotulo: 'Valor', tipo: 'dinheiro', sql: 'd.valor_centavos' },
      { campo: 'autor', rotulo: 'Pago por', tipo: 'texto', sql: AUTOR('u') },
      { campo: 'comprovante_url', rotulo: 'Comprovante', tipo: 'link', sql: 'd.comprovante_url' },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 'd.ano' },
      { campo: 'created_at', rotulo: 'Lançada em', tipo: 'data', sql: 'd.created_at' },
    ],
    editaveis: [{ campo: 'descricao', rotulo: 'Descrição', tipo: 'texto', limite: 200 }],
    pode_apagar: true, acoes: [],
  },
  {
    id: 'acertos_ceia', nome: 'Acertos da ceia', grupo: 'Vaquinha e ceia',
    tabela: 'ceia_acertos', alias: 'a',
    from: 'ceia_acertos a JOIN family_users d ON d.id = a.de_user_id JOIN family_users p ON p.id = a.para_user_id',
    tabelas: ['ceia_acertos', 'family_users'],
    novos: 'a.confirmado_em', busca: ['d.name', 'p.name'],
    colunas: [
      { campo: 'de', rotulo: 'Quem pagou', tipo: 'texto', sql: 'd.name' },
      { campo: 'para', rotulo: 'Quem recebeu', tipo: 'texto', sql: 'p.name' },
      { campo: 'valor_centavos', rotulo: 'Valor', tipo: 'dinheiro', sql: 'a.valor_centavos' },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 'a.ano' },
      { campo: 'confirmado_em', rotulo: 'Confirmado em', tipo: 'data', sql: 'a.confirmado_em' },
    ],
    editaveis: [], pode_apagar: false, acoes: [],
  },
  {
    id: 'playlist', nome: 'Playlist', grupo: 'Vaquinha e ceia',
    tabela: 'playlist_tracks', alias: 't',
    from: 'playlist_tracks t JOIN family_users u ON u.id = t.user_id', tabelas: ['playlist_tracks', 'family_users'],
    novos: 't.created_at', busca: ['t.nome', 't.artista', 'u.name'],
    colunas: [
      { campo: 'nome', rotulo: 'Música', tipo: 'texto', sql: 't.nome' },
      { campo: 'artista', rotulo: 'Artista', tipo: 'texto', sql: 't.artista' },
      { campo: 'capa_url', rotulo: 'Capa', tipo: 'imagem', sql: 't.capa_url' },
      { campo: 'autor', rotulo: 'Sugerida por', tipo: 'texto', sql: AUTOR('u') },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 't.ano' },
      { campo: 'created_at', rotulo: 'Sugerida em', tipo: 'data', sql: 't.created_at' },
    ],
    editaveis: [], pode_apagar: true, acoes: [],
  },

  // ---------- Amigo oculto e Advento ----------
  // Nunca lê o sorteio (quem tirou quem) nem quem comprou o quê na lista de desejos.
  {
    id: 'lista_desejos', nome: 'Lista de desejos', grupo: 'Amigo oculto e Advento',
    tabela: 'wish_list', alias: 'w',
    from: 'wish_list w JOIN participants p ON p.id = w.participant_id', tabelas: ['wish_list', 'participants'],
    novos: 'w.created_at', busca: ['w.item_name', 'w.item_description', 'p.name'],
    colunas: [
      { campo: 'item_name', rotulo: 'Item', tipo: 'texto', sql: 'w.item_name' },
      { campo: 'participante', rotulo: 'Participante', tipo: 'texto', sql: 'p.name' },
      { campo: 'item_description', rotulo: 'Descrição', tipo: 'longo', sql: 'w.item_description' },
      { campo: 'item_url', rotulo: 'Link', tipo: 'link', sql: 'w.item_url' },
      { campo: 'preco_min', rotulo: 'Preço mínimo', tipo: 'dinheiro', sql: 'w.price_min_cents' },
      { campo: 'preco_max', rotulo: 'Preço máximo', tipo: 'dinheiro', sql: 'w.price_max_cents' },
      { campo: 'image_url', rotulo: 'Foto', tipo: 'imagem', sql: 'w.image_url' },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 'w.ano' },
      { campo: 'created_at', rotulo: 'Criado em', tipo: 'data', sql: 'w.created_at' },
    ],
    editaveis: [
      { campo: 'item_name', rotulo: 'Item', tipo: 'texto', limite: 200 },
      { campo: 'item_description', rotulo: 'Descrição', tipo: 'longo', vazio: 'nulo', limite: 1000 },
    ],
    pode_apagar: true, acoes: [],
  },
  {
    // Sem o autor: a dica é anônima também para quem organiza.
    id: 'dicas', nome: 'Dicas do amigo oculto', grupo: 'Amigo oculto e Advento',
    tabela: 'secret_santa_hints', alias: 'h',
    from: 'secret_santa_hints h JOIN participants p ON p.id = h.receiver_participant_id', tabelas: ['secret_santa_hints', 'participants'],
    novos: 'h.created_at', busca: ['h.texto', 'p.name'],
    colunas: [
      { campo: 'texto', rotulo: 'Dica', tipo: 'longo', sql: 'h.texto' },
      { campo: 'para', rotulo: 'Dica para', tipo: 'texto', sql: 'p.name' },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 'h.ano' },
      { campo: 'created_at', rotulo: 'Enviada em', tipo: 'data', sql: 'h.created_at' },
    ],
    editaveis: [], pode_apagar: true, acoes: [],
  },
  {
    id: 'advento', nome: 'Calendário do Advento', grupo: 'Amigo oculto e Advento',
    tabela: 'advent_windows', alias: 'w', from: 'advent_windows w', tabelas: ['advent_windows'],
    novos: null, busca: ['w.titulo', 'w.texto'],
    colunas: [
      { campo: 'dia', rotulo: 'Dia', tipo: 'numero', sql: 'w.dia' },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 'w.ano' },
      { campo: 'tipo', rotulo: 'Tipo', tipo: 'texto', sql: 'w.tipo' },
      { campo: 'titulo', rotulo: 'Título', tipo: 'texto', sql: 'w.titulo' },
      { campo: 'texto', rotulo: 'Texto', tipo: 'longo', sql: 'w.texto' },
      { campo: 'image_url', rotulo: 'Imagem', tipo: 'imagem', sql: 'w.image_url' },
    ],
    editaveis: [
      { campo: 'titulo', rotulo: 'Título', tipo: 'texto', limite: 120 },
      { campo: 'texto', rotulo: 'Texto', tipo: 'longo', vazio: 'vazio', limite: 1500 },
    ],
    pode_apagar: true, acoes: [],
  },
  {
    id: 'respostas_advento', nome: 'Respostas do Advento', grupo: 'Amigo oculto e Advento',
    tabela: 'advent_responses', alias: 'r',
    from: 'advent_responses r JOIN family_users u ON u.id = r.user_id', tabelas: ['advent_responses', 'family_users'],
    novos: 'r.created_at', busca: ['r.texto', 'u.name'],
    colunas: [
      { campo: 'texto', rotulo: 'Resposta', tipo: 'longo', sql: 'r.texto' },
      { campo: 'autor', rotulo: 'Autor', tipo: 'texto', sql: AUTOR('u') },
      { campo: 'dia', rotulo: 'Dia', tipo: 'numero', sql: 'r.dia' },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 'r.ano' },
      { campo: 'image_url', rotulo: 'Foto', tipo: 'imagem', sql: 'r.image_url' },
      { campo: 'created_at', rotulo: 'Respondeu em', tipo: 'data', sql: 'r.created_at' },
    ],
    editaveis: [], pode_apagar: true, acoes: [],
  },

  // ---------- A noite da festa ----------
  {
    id: 'desafios', nome: 'Desafios de foto', grupo: 'A noite da festa',
    tabela: 'party_challenges', alias: 'c', from: 'party_challenges c', tabelas: ['party_challenges'],
    novos: 'c.created_at', busca: ['c.titulo'],
    colunas: [
      { campo: 'titulo', rotulo: 'Desafio', tipo: 'texto', sql: 'c.titulo' },
      { campo: 'aberto', rotulo: 'Aberto', tipo: 'bool', sql: 'c.aberto' },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 'c.ano' },
      { campo: 'created_at', rotulo: 'Criado em', tipo: 'data', sql: 'c.created_at' },
      { campo: 'encerrado_em', rotulo: 'Encerrado em', tipo: 'data', sql: 'c.encerrado_em' },
    ],
    editaveis: [{ campo: 'titulo', rotulo: 'Desafio', tipo: 'texto', limite: 120 }],
    pode_apagar: true, acoes: [],
  },
  {
    id: 'fotos_desafio', nome: 'Fotos dos desafios', grupo: 'A noite da festa',
    tabela: 'party_photo_entries', alias: 'e',
    from: 'party_photo_entries e JOIN party_challenges c ON c.id = e.desafio_id AND c.ano = e.ano JOIN family_users u ON u.id = e.user_id',
    tabelas: ['party_photo_entries', 'party_challenges', 'family_users'],
    novos: 'e.created_at', busca: ['e.legenda', 'c.titulo', 'u.name'],
    colunas: [
      { campo: 'image_url', rotulo: 'Foto', tipo: 'imagem', sql: 'e.image_url' },
      { campo: 'legenda', rotulo: 'Legenda', tipo: 'longo', sql: 'e.legenda' },
      { campo: 'desafio', rotulo: 'Desafio', tipo: 'texto', sql: 'c.titulo' },
      { campo: 'autor', rotulo: 'Enviada por', tipo: 'texto', sql: AUTOR('u') },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 'e.ano' },
      { campo: 'created_at', rotulo: 'Enviada em', tipo: 'data', sql: 'e.created_at' },
    ],
    editaveis: [{ campo: 'legenda', rotulo: 'Legenda', tipo: 'longo', vazio: 'vazio', limite: 500 }],
    pode_apagar: true, acoes: [],
  },
  {
    id: 'quiz', nome: 'Perguntas do quiz', grupo: 'A noite da festa',
    tabela: 'party_quiz_questions', alias: 'q', from: 'party_quiz_questions q', tabelas: ['party_quiz_questions'],
    novos: 'q.created_at', busca: ['q.pergunta', 'q.modelo'],
    colunas: [
      { campo: 'pergunta', rotulo: 'Pergunta', tipo: 'texto', sql: 'q.pergunta' },
      { campo: 'opcoes', rotulo: 'Opções', tipo: 'longo', sql: 'q.opcoes::text' },
      { campo: 'correta', rotulo: 'Número da correta (começa em 0)', tipo: 'numero', sql: 'q.correta' },
      { campo: 'ordem', rotulo: 'Ordem', tipo: 'numero', sql: 'q.ordem' },
      { campo: 'encerrada', rotulo: 'Encerrada', tipo: 'bool', sql: 'q.encerrada' },
      { campo: 'image_url', rotulo: 'Imagem', tipo: 'imagem', sql: 'q.image_url' },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 'q.ano' },
      { campo: 'created_at', rotulo: 'Criada em', tipo: 'data', sql: 'q.created_at' },
    ],
    editaveis: [
      { campo: 'pergunta', rotulo: 'Pergunta', tipo: 'texto', limite: 300 },
      { campo: 'ordem', rotulo: 'Ordem', tipo: 'numero', min: 0, max: 1000 },
    ],
    pode_apagar: true, acoes: [],
  },
  {
    id: 'bingo', nome: 'Situações do bingo', grupo: 'A noite da festa',
    tabela: 'party_bingo_items', alias: 'b', from: 'party_bingo_items b', tabelas: ['party_bingo_items'],
    novos: 'b.created_at', busca: ['b.texto'],
    colunas: [
      { campo: 'texto', rotulo: 'Situação', tipo: 'texto', sql: 'b.texto' },
      { campo: 'ativo', rotulo: 'Ativa', tipo: 'bool', sql: 'b.ativo' },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 'b.ano' },
      { campo: 'created_at', rotulo: 'Criada em', tipo: 'data', sql: 'b.created_at' },
    ],
    editaveis: [
      { campo: 'texto', rotulo: 'Situação', tipo: 'texto', limite: 140 },
      { campo: 'ativo', rotulo: 'Ativa', tipo: 'bool' },
    ],
    pode_apagar: true, acoes: [],
  },
  {
    id: 'bingo_pedidos', nome: 'Pedidos de bingo', grupo: 'A noite da festa',
    tabela: 'party_bingo_claims', alias: 'c',
    from: 'party_bingo_claims c JOIN family_users u ON u.id = c.user_id', tabelas: ['party_bingo_claims', 'family_users'],
    novos: 'c.created_at', busca: ['u.name', 'c.padrao', 'c.status'],
    colunas: [
      { campo: 'jogador', rotulo: 'Jogador', tipo: 'texto', sql: 'u.name' },
      { campo: 'padrao', rotulo: 'Padrão', tipo: 'texto', sql: 'c.padrao' },
      { campo: 'status', rotulo: 'Situação', tipo: 'texto', sql: 'c.status' },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 'c.ano' },
      { campo: 'created_at', rotulo: 'Pedido em', tipo: 'data', sql: 'c.created_at' },
      { campo: 'confirmed_at', rotulo: 'Decidido em', tipo: 'data', sql: 'c.confirmed_at' },
    ],
    editaveis: [], pode_apagar: false,
    acoes: [
      { id: 'confirmar', rotulo: 'Confirmar bingo', perigosa: false },
      { id: 'rejeitar', rotulo: 'Rejeitar', perigosa: true },
    ],
  },
  {
    id: 'enquetes_ao_vivo', nome: 'Enquetes ao vivo', grupo: 'A noite da festa',
    tabela: 'party_live_polls', alias: 'p', from: 'party_live_polls p', tabelas: ['party_live_polls'],
    novos: 'p.created_at', busca: ['p.pergunta'],
    colunas: [
      { campo: 'pergunta', rotulo: 'Pergunta', tipo: 'texto', sql: 'p.pergunta' },
      { campo: 'opcoes', rotulo: 'Opções', tipo: 'longo', sql: 'p.opcoes::text' },
      { campo: 'aberta', rotulo: 'Aberta', tipo: 'bool', sql: 'p.aberta' },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 'p.ano' },
      { campo: 'created_at', rotulo: 'Criada em', tipo: 'data', sql: 'p.created_at' },
      { campo: 'encerrada_em', rotulo: 'Encerrada em', tipo: 'data', sql: 'p.encerrada_em' },
    ],
    editaveis: [{ campo: 'pergunta', rotulo: 'Pergunta', tipo: 'texto', limite: 240 }],
    pode_apagar: true,
    acoes: [{ id: 'encerrar', rotulo: 'Encerrar enquete', perigosa: false }],
  },
  {
    id: 'foto_oficial', nome: 'Foto oficial', grupo: 'A noite da festa',
    tabela: 'family_official_photos', alias: 'f',
    from: 'family_official_photos f JOIN family_users u ON u.id = f.user_id', tabelas: ['family_official_photos', 'family_users'],
    novos: 'f.created_at', busca: ['f.legenda', 'u.name'],
    colunas: [
      { campo: 'image_url', rotulo: 'Foto', tipo: 'imagem', sql: 'f.image_url' },
      { campo: 'legenda', rotulo: 'Legenda', tipo: 'longo', sql: 'f.legenda' },
      { campo: 'dica_pose', rotulo: 'Dica de pose', tipo: 'longo', sql: 'f.dica_pose' },
      { campo: 'autor', rotulo: 'Enviada por', tipo: 'texto', sql: AUTOR('u') },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 'f.ano' },
      { campo: 'created_at', rotulo: 'Enviada em', tipo: 'data', sql: 'f.created_at' },
    ],
    editaveis: [
      { campo: 'legenda', rotulo: 'Legenda', tipo: 'longo', vazio: 'vazio', limite: 500 },
      { campo: 'dica_pose', rotulo: 'Dica de pose', tipo: 'longo', vazio: 'vazio', limite: 500 },
    ],
    pode_apagar: true, acoes: [],
  },

  // ---------- Memórias da família ----------
  {
    id: 'receitas', nome: 'Receitas', grupo: 'Memórias da família',
    tabela: 'family_recipes', alias: 'r',
    from: 'family_recipes r JOIN family_users u ON u.id = r.user_id', tabelas: ['family_recipes', 'family_users'],
    novos: 'r.created_at', busca: ['r.titulo', 'r.de_quem', 'u.name'],
    colunas: [
      { campo: 'titulo', rotulo: 'Receita', tipo: 'texto', sql: 'r.titulo' },
      { campo: 'de_quem', rotulo: 'É de quem', tipo: 'texto', sql: 'r.de_quem' },
      { campo: 'categoria', rotulo: 'Categoria', tipo: 'texto', sql: 'r.categoria' },
      { campo: 'foto_url', rotulo: 'Foto', tipo: 'imagem', sql: 'r.foto_url' },
      { campo: 'ingredientes', rotulo: 'Ingredientes', tipo: 'longo', sql: 'r.ingredientes' },
      { campo: 'modo_preparo', rotulo: 'Modo de preparo', tipo: 'longo', sql: 'r.modo_preparo' },
      { campo: 'segredo', rotulo: 'Segredo', tipo: 'longo', sql: 'r.segredo' },
      { campo: 'autor', rotulo: 'Cadastrada por', tipo: 'texto', sql: AUTOR('u') },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 'r.ano' },
      { campo: 'created_at', rotulo: 'Cadastrada em', tipo: 'data', sql: 'r.created_at' },
    ],
    editaveis: [
      { campo: 'titulo', rotulo: 'Receita', tipo: 'texto', limite: 120 },
      { campo: 'de_quem', rotulo: 'É de quem', tipo: 'texto', limite: 80 },
    ],
    aoEditar: 'updated_at = NOW()', pode_apagar: true, acoes: [],
  },
  {
    id: 'historias', nome: 'Histórias contadas', grupo: 'Memórias da família',
    tabela: 'family_stories', alias: 's',
    from: 'family_stories s JOIN family_users u ON u.id = s.user_id', tabelas: ['family_stories', 'family_users'],
    novos: 's.created_at', busca: ['s.titulo', 's.quem_conta', 'u.name'],
    colunas: [
      { campo: 'titulo', rotulo: 'Título', tipo: 'texto', sql: 's.titulo' },
      { campo: 'quem_conta', rotulo: 'Quem conta', tipo: 'texto', sql: 's.quem_conta' },
      { campo: 'epoca', rotulo: 'Época', tipo: 'texto', sql: 's.epoca' },
      { campo: 'audio_url', rotulo: 'Áudio', tipo: 'link', sql: 's.audio_url' },
      { campo: 'foto_url', rotulo: 'Foto', tipo: 'imagem', sql: 's.foto_url' },
      { campo: 'transcricao', rotulo: 'Transcrição', tipo: 'longo', sql: 's.transcricao' },
      { campo: 'duracao_s', rotulo: 'Duração (segundos)', tipo: 'numero', sql: 's.duracao_s' },
      { campo: 'autor', rotulo: 'Gravada por', tipo: 'texto', sql: AUTOR('u') },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 's.ano' },
      { campo: 'created_at', rotulo: 'Gravada em', tipo: 'data', sql: 's.created_at' },
    ],
    editaveis: [
      { campo: 'titulo', rotulo: 'Título', tipo: 'texto', limite: 120 },
      { campo: 'quem_conta', rotulo: 'Quem conta', tipo: 'texto', limite: 80 },
      { campo: 'epoca', rotulo: 'Época', tipo: 'texto', limite: 80 },
      { campo: 'transcricao', rotulo: 'Transcrição', tipo: 'longo', vazio: 'nulo', limite: 8000 },
    ],
    pode_apagar: true, acoes: [],
  },
  {
    // O texto lacrado nunca é lido aqui. Antes de abrir, só aparecem quem escreveu, para quem e a data.
    id: 'capsulas', nome: 'Cápsulas do tempo', grupo: 'Memórias da família',
    tabela: 'time_capsules', alias: 'c',
    from: 'time_capsules c JOIN family_users u ON u.id = c.user_id LEFT JOIN family_users pu ON pu.id = c.para_user_id',
    tabelas: ['time_capsules', 'family_users'],
    novos: 'c.created_at', busca: ['u.name', 'pu.name'],
    colunas: [
      { campo: 'autor', rotulo: 'Escrita por', tipo: 'texto', sql: AUTOR('u') },
      { campo: 'para', rotulo: 'Para', tipo: 'texto', sql: `COALESCE(pu.name, 'Toda a família')` },
      { campo: 'lacrada', rotulo: 'Ainda lacrada', tipo: 'bool', sql: 'c.abre_em > NOW()' },
      { campo: 'abre_em', rotulo: 'Abre em', tipo: 'data', sql: 'c.abre_em' },
      { campo: 'texto', rotulo: 'Mensagem (só depois de aberta)', tipo: 'longo', sql: 'CASE WHEN c.abre_em <= NOW() THEN c.texto END' },
      { campo: 'image_url', rotulo: 'Foto (só depois de aberta)', tipo: 'imagem', sql: 'CASE WHEN c.abre_em <= NOW() THEN c.image_url END' },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 'c.ano' },
      { campo: 'created_at', rotulo: 'Escrita em', tipo: 'data', sql: 'c.created_at' },
    ],
    editaveis: [], pode_apagar: true, acoes: [],
  },
  {
    id: 'arvore', nome: 'Árvore da família', grupo: 'Memórias da família',
    tabela: 'family_tree_people', alias: 't', from: 'family_tree_people t', tabelas: ['family_tree_people'],
    novos: 't.created_at', busca: ['t.nome', 't.apelido'],
    colunas: [
      { campo: 'nome', rotulo: 'Nome', tipo: 'texto', sql: 't.nome' },
      { campo: 'apelido', rotulo: 'Apelido', tipo: 'texto', sql: 't.apelido' },
      { campo: 'foto_url', rotulo: 'Foto', tipo: 'imagem', sql: 't.foto_url' },
      { campo: 'nascimento_ano', rotulo: 'Nasceu em', tipo: 'numero', sql: 't.nascimento_ano' },
      { campo: 'falecimento_ano', rotulo: 'Faleceu em', tipo: 'numero', sql: 't.falecimento_ano' },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 't.ano' },
      { campo: 'created_at', rotulo: 'Cadastrada em', tipo: 'data', sql: 't.created_at' },
    ],
    editaveis: [
      { campo: 'nome', rotulo: 'Nome', tipo: 'texto', limite: 120 },
      { campo: 'apelido', rotulo: 'Apelido', tipo: 'texto', vazio: 'nulo', limite: 80 },
      { campo: 'nascimento_ano', rotulo: 'Nasceu em', tipo: 'numero', vazio: 'nulo', min: 1800, max: 2100 },
      { campo: 'falecimento_ano', rotulo: 'Faleceu em', tipo: 'numero', vazio: 'nulo', min: 1800, max: 2100 },
    ],
    pode_apagar: true, acoes: [],
  },
  {
    id: 'homenagens', nome: 'Homenagens', grupo: 'Memórias da família',
    tabela: 'family_memorials', alias: 'm', from: 'family_memorials m', tabelas: ['family_memorials'],
    novos: 'm.created_at', busca: ['m.nome', 'm.texto'],
    colunas: [
      { campo: 'nome', rotulo: 'Homenageado', tipo: 'texto', sql: 'm.nome' },
      { campo: 'anos', rotulo: 'Anos', tipo: 'texto', sql: 'm.anos' },
      { campo: 'foto_url', rotulo: 'Foto', tipo: 'imagem', sql: 'm.foto_url' },
      { campo: 'texto', rotulo: 'Texto', tipo: 'longo', sql: 'm.texto' },
      { campo: 'created_at', rotulo: 'Criada em', tipo: 'data', sql: 'm.created_at' },
    ],
    editaveis: [
      { campo: 'nome', rotulo: 'Homenageado', tipo: 'texto', limite: 120 },
      { campo: 'anos', rotulo: 'Anos', tipo: 'texto', limite: 60 },
      { campo: 'texto', rotulo: 'Texto', tipo: 'longo', vazio: 'vazio', limite: 3000 },
    ],
    pode_apagar: true, acoes: [],
  },
  {
    id: 'lembrancas', nome: 'Lembranças das homenagens', grupo: 'Memórias da família',
    tabela: 'family_tributes', alias: 't',
    from: 'family_tributes t JOIN family_memorials m ON m.id = t.memorial_id JOIN family_users u ON u.id = t.user_id',
    tabelas: ['family_tributes', 'family_memorials', 'family_users'],
    novos: 't.created_at', busca: ['t.texto', 'm.nome', 'u.name'],
    colunas: [
      { campo: 'texto', rotulo: 'Lembrança', tipo: 'longo', sql: 't.texto' },
      { campo: 'homenageado', rotulo: 'Homenageado', tipo: 'texto', sql: 'm.nome' },
      { campo: 'autor', rotulo: 'Escrita por', tipo: 'texto', sql: AUTOR('u') },
      { campo: 'image_url', rotulo: 'Foto', tipo: 'imagem', sql: 't.image_url' },
      { campo: 'ano', rotulo: 'Edição', tipo: 'numero', sql: 't.ano' },
      { campo: 'created_at', rotulo: 'Escrita em', tipo: 'data', sql: 't.created_at' },
    ],
    editaveis: [{ campo: 'texto', rotulo: 'Lembrança', tipo: 'longo', limite: 3000 }],
    pode_apagar: true, acoes: [],
  },

  // ---------- Configurações ----------
  {
    // Chave a chave. Chaves com token, refresh ou secret ficam escondidas (filtro aplicado pelo servidor).
    id: 'ajustes', nome: 'Ajustes do evento', grupo: 'Configurações',
    tabela: 'app_settings', alias: 's', from: 'app_settings s', tabelas: ['app_settings'],
    idCol: 'key', ordemAsc: true, chavesOcultas: true,
    novos: 's.updated_at', busca: ['s.key', 's.value'],
    colunas: [
      { campo: 'chave', rotulo: 'Ajuste', tipo: 'texto', sql: 's.key' },
      { campo: 'value', rotulo: 'Valor', tipo: 'longo', sql: 's.value' },
      { campo: 'updated_at', rotulo: 'Mudou em', tipo: 'data', sql: 's.updated_at' },
    ],
    editaveis: [{ campo: 'value', rotulo: 'Valor', tipo: 'longo', vazio: 'vazio', limite: 2000 }],
    aoEditar: 'updated_at = NOW()', pode_apagar: false, acoes: [],
  },
];

export const FERRAMENTAS = [
  { titulo: 'Amigo oculto', texto: 'Sorteio, regras e revelação ao vivo', rota_site: '/amigo-oculto', rota_app: '/amigo-oculto' },
  { titulo: 'Calendário do Advento', texto: 'Conteúdo de cada portinha', rota_site: '/advento', rota_app: '/advento' },
  { titulo: 'Quiz da família', texto: 'Perguntas, abrir e revelar', rota_site: '/festa/quiz', rota_app: '/festa-quiz' },
  { titulo: 'Bingo da ceia', texto: 'Situações e confirmação dos pedidos', rota_site: '/festa/bingo', rota_app: '/festa-bingo' },
  { titulo: 'Enquete ao vivo', texto: 'Criar e encerrar votações da noite', rota_site: '/festa/enquete', rota_app: '/festa-enquete' },
  { titulo: 'Desafio de foto', texto: 'Abrir, encerrar e ver os votos', rota_site: '/festa/desafio', rota_app: '/festa-desafio' },
  { titulo: 'Foto oficial', texto: 'A foto da família do ano', rota_site: '/festa/foto-oficial', rota_app: '/festa-foto-oficial' },
  { titulo: 'Vaquinha', texto: 'Meta, pagamentos e compras', rota_site: '/vaquinha', rota_app: '/vaquinha' },
  { titulo: 'Convites', texto: 'Links de convite e pedidos de parentes', rota_site: '/convites', rota_app: '/convites' },
  { titulo: 'Organizar', texto: 'Detalhes do evento e acessos', rota_site: '/organizar', rota_app: '/organizar' },
  { titulo: 'A ceia', texto: 'Presença, pratos e votações', rota_site: '/ceia', rota_app: '/ceia' },
  { titulo: 'Playlist', texto: 'As músicas da noite', rota_site: '/playlist', rota_app: '/playlist' },
] as const;

export function achar(id: string): Recurso | undefined {
  return RECURSOS.find((r) => r.id === id);
}
