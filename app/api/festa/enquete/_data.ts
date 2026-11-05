import { query } from '@/app/lib/db';
import { edicaoAtual } from '@/app/lib/edicao';
import type { SessionUser } from '@/app/lib/session';

export interface LivePollOptionStat {
  index: number;
  texto: string;
  votos: number;
  percentual: number;
  vencedora: boolean;
}

export interface LivePollItem {
  id: number;
  pergunta: string;
  aberta: boolean;
  encerrada_em: string | null;
  created_at: string;
  total_votos: number;
  meu_voto: number | null;
  opcoes: LivePollOptionStat[];
}

export interface EnqueteData {
  ano: number;
  enquete_destaque: LivePollItem | null;
  enquetes: LivePollItem[];
}

export const SUGESTOES_ENQUETE: ReadonlyArray<{
  pergunta: string;
  opcoes: readonly string[];
}> = [
  {
    pergunta: 'Qual prato salgado está ganhando a noite?',
    opcoes: ['Peru ou Chester', 'Pernil assado', 'Salpicão e acompanhamentos', 'Farofa caprichada'],
  },
  {
    pergunta: 'Na sobremesa da família, quem leva o troféu?',
    opcoes: ['Rabanada quentinha', 'Pavê tradicional', 'Pudim de leite', 'Panetone ou Chocotone'],
  },
  {
    pergunta: 'Que horas devemos abrir os presentes do Amigo Oculto?',
    opcoes: ['Agora mesmo!', 'Logo antes da ceia', 'Depois da ceia', 'À meia-noite em ponto'],
  },
  {
    pergunta: 'Arroz com uva-passa na ceia de Natal:',
    opcoes: ['Com certeza, é tradição!', 'Passo longe, prefiro sem', 'Como tudo sem reclamar'],
  },
];

export async function carregarEnquetes(me: SessionUser): Promise<EnqueteData> {
  const ano = edicaoAtual();

  const pollsRes = await query<{
    id: number;
    pergunta: string;
    opcoes: string[];
    aberta: boolean;
    encerrada_em: string | null;
    created_at: string;
  }>(
    `SELECT id,
            pergunta,
            opcoes,
            aberta,
            encerrada_em::text AS encerrada_em,
            created_at::text AS created_at
       FROM party_live_polls
      WHERE ano = $1
      ORDER BY aberta DESC, created_at DESC, id DESC`,
    [ano],
  );

  const votesRes = await query<{
    poll_id: number;
    opcao_index: number;
    total: number;
  }>(
    `SELECT poll_id, opcao_index, COUNT(*)::int AS total
       FROM party_live_poll_votes
      WHERE ano = $1
        AND NOT EXISTS (
          SELECT 1 FROM user_blocks b
           WHERE (b.blocker_id = $2 AND b.blocked_id = party_live_poll_votes.user_id)
              OR (b.blocker_id = party_live_poll_votes.user_id AND b.blocked_id = $2)
        )
      GROUP BY poll_id, opcao_index`,
    [ano, me.id],
  );

  const myVotesRes = await query<{ poll_id: number; opcao_index: number }>(
    `SELECT poll_id, opcao_index
       FROM party_live_poll_votes
      WHERE ano = $1 AND user_id = $2`,
    [ano, me.id],
  );

  const myVoteMap = new Map<number, number>();
  for (const row of myVotesRes.rows) {
    myVoteMap.set(row.poll_id, row.opcao_index);
  }

  const countMap = new Map<string, number>();
  for (const row of votesRes.rows) {
    countMap.set(`${row.poll_id}:${row.opcao_index}`, row.total);
  }

  const enquetes: LivePollItem[] = pollsRes.rows.map((p) => {
    const textos = Array.isArray(p.opcoes) ? p.opcoes.map(String) : [];
    const contagens = textos.map((_, idx) => countMap.get(`${p.id}:${idx}`) ?? 0);
    const total_votos = contagens.reduce((acc, v) => acc + v, 0);
    const maxVotos = contagens.length > 0 ? Math.max(...contagens) : 0;

    const opcoes: LivePollOptionStat[] = textos.map((texto, idx) => {
      const votos = contagens[idx] ?? 0;
      const percentual = total_votos > 0 ? Math.round((votos / total_votos) * 100) : 0;
      const vencedora = !p.aberta && total_votos > 0 && votos === maxVotos && maxVotos > 0;
      return {
        index: idx,
        texto,
        votos,
        percentual,
        vencedora,
      };
    });

    return {
      id: p.id,
      pergunta: p.pergunta,
      aberta: p.aberta,
      encerrada_em: p.encerrada_em,
      created_at: p.created_at,
      total_votos,
      meu_voto: myVoteMap.get(p.id) ?? null,
      opcoes,
    };
  });

  const enquete_destaque = enquetes.find((e) => e.aberta) ?? enquetes[0] ?? null;

  return {
    ano,
    enquete_destaque,
    enquetes,
  };
}
