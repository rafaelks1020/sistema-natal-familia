import { cleanText, HttpError, ok, readJson, requireAdmin, route } from '@/app/lib/api';
import { query, transaction } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import { enviarPush } from '@/app/lib/push';
import { dataEventoValida, carregarVotacoes } from '../dados';
import { tipoDe } from '../tipos';

export const POST = route(async (req) => {
  const me = await requireAdmin();
  const body = await readJson<Record<string, unknown>>(req);
  const pergunta = cleanText(body.pergunta, 'a pergunta', 200);
  const tipo = tipoDe(body.tipo);
  if (!tipo) throw new HttpError(400, 'Escolha o tipo: local, cardápio, data ou outro.');
  if (!Array.isArray(body.opcoes)) throw new HttpError(400, 'Informe as opções da votação.');
  if (body.opcoes.length < 2) throw new HttpError(400, 'A votação precisa ter pelo menos 2 opções.');
  if (body.opcoes.length > 6) throw new HttpError(400, 'A votação pode ter no máximo 6 opções.');

  const maximo = tipo === 'local' ? 500 : tipo === 'data' ? 40 : 160;
  const opcoes: string[] = [];
  const vistas = new Set<string>();
  for (const bruta of body.opcoes) {
    const texto = cleanText(bruta, 'a opção', maximo);
    if (tipo === 'data' && !dataEventoValida(texto)) {
      throw new HttpError(400, 'Cada data precisa ter dia e hora. Use o horário de Brasília.');
    }
    const chave = texto.toLocaleLowerCase('pt-BR');
    if (vistas.has(chave)) throw new HttpError(400, 'As opções precisam ser diferentes.');
    vistas.add(chave);
    opcoes.push(texto);
  }

  const ano = edicaoAtual();
  const id = await transaction(async (q) => {
    const criada = await q<{ id: number }>(
      `INSERT INTO ceia_votacoes (ano, pergunta, tipo, aberta, criado_por)
       VALUES ($1, $2, $3, TRUE, $4)
       RETURNING id`,
      [ano, pergunta, tipo, me.id],
    );
    const votacaoId = criada.rows[0]?.id;
    if (!votacaoId) throw new HttpError(500, 'Não foi possível abrir a votação.');
    for (let ordem = 0; ordem < opcoes.length; ordem += 1) {
      await q(
        `INSERT INTO ceia_votacao_opcoes (ano, votacao_id, texto, ordem) VALUES ($1, $2, $3, $4)`,
        [ano, votacaoId, opcoes[ordem], ordem],
      );
    }
    return votacaoId;
  });

  const destinatarios = await query<{ id: number }>('SELECT id FROM family_users');
  const corpo = pergunta.length > 120 ? `${pergunta.slice(0, 117)}...` : pergunta;
  void enviarPush(destinatarios.rows.map((pessoa) => pessoa.id), {
    titulo: 'Nova votação da ceia',
    corpo,
    rota: '/ceia',
  });

  const [votacao] = await carregarVotacoes(me, ano, id);
  if (!votacao) throw new HttpError(500, 'A votação foi criada, mas não deu para abri-la agora.');
  return ok(votacao, 201);
});
