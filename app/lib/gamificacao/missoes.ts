// Banco de modelos de missões relâmpago (eventos surpresa) e regras puras de horário, janela de silêncio e sorteio.
// Sem importações de banco ou servidor para permitir testes unitários diretos.

import type { ModeloMissao, TipoMissao } from './tipos';

export const MODELOS_MISSAO: readonly ModeloMissao[] = [
  {
    id: 'foto_crianca',
    titulo: 'Foto sua quando criança',
    descricao: 'Desenterre do baú uma foto sua pequenininho(a) para a família adivinhar que ano era!',
    tipo: 'foto',
    pontos: 50,
  },
  {
    id: 'selfie_pet',
    titulo: 'Selfie com o pet',
    descricao: 'Tire uma foto com o bichinho de estimação da casa (ou o pet de um parente).',
    tipo: 'foto',
    pontos: 35,
  },
  {
    id: 'decoracao_natal',
    titulo: 'Sua decoração de Natal',
    descricao: 'Mostre a árvore, o presépio, a guirlanda ou qualquer cantinho enfeitado aí na sua casa.',
    tipo: 'foto',
    pontos: 40,
  },
  {
    id: 'pior_blusa',
    titulo: 'A pior blusa de Natal',
    descricao: 'Vista a roupa mais chamativa, vermelha, verde ou natalina do guarda-roupa e mande o registro!',
    tipo: 'foto',
    pontos: 60,
  },
  {
    id: 'prato_levar',
    titulo: 'Prato que você vai levar',
    descricao: 'Conte (ou dê um spoiler misterioso) da delícia que você pretende preparar ou levar para a ceia.',
    tipo: 'texto',
    pontos: 30,
  },
  {
    id: 'foto_avos',
    titulo: 'Foto antiga com os avós',
    descricao: 'Compartilhe um retrato cheio de carinho com os avós ou bisavós da nossa família.',
    tipo: 'foto_texto',
    pontos: 75,
  },
  {
    id: 'natal_engracado',
    titulo: 'Conte o Natal mais engraçado',
    descricao: 'Qual foi a cena mais hilária que você lembra de um Natal da família? Escreva em poucas linhas!',
    tipo: 'texto',
    pontos: 45,
  },
  {
    id: 'caneca_favorita',
    titulo: 'Sua caneca favorita',
    descricao: 'Mostre a xícara ou caneca que te acompanha no café de todo dia.',
    tipo: 'foto',
    pontos: 25,
  },
  {
    id: 'presente_inesquecivel',
    titulo: 'O presente inesquecível',
    descricao: 'Qual presente de infância marcou sua vida até hoje? Conte a história dele.',
    tipo: 'texto',
    pontos: 35,
  },
  {
    id: 'natal_antigo_familia',
    titulo: 'Direto do túnel do tempo',
    descricao: 'Publique uma foto de um Natal antigo da família e diga quem aparece nela.',
    tipo: 'foto_texto',
    pontos: 70,
  },
  {
    id: 'musica_natal',
    titulo: 'Música que tem cara de Natal',
    descricao: 'Qual música não pode faltar quando a família se reúne em dezembro? Diga o nome e o porquê.',
    tipo: 'texto',
    pontos: 20,
  },
  {
    id: 'pisca_pisca',
    titulo: 'Caça às luzes de Natal',
    descricao: 'Fotografe luzinhas ou pisca-piscas acesos na sua rua, janela ou sala.',
    tipo: 'foto',
    pontos: 35,
  },
  {
    id: 'sobremesa_sonhos',
    titulo: 'Time pavê ou time rabanada?',
    descricao: 'Defenda com paixão qual é a sobremesa campeã absoluta da ceia de Natal!',
    tipo: 'texto',
    pontos: 25,
  },
  {
    id: 'careta_natalina',
    titulo: 'Careta em família',
    descricao: 'Junte quem estiver por perto (ou faça solo!) para a careta mais engraçada do dia.',
    tipo: 'foto',
    pontos: 45,
  },
  {
    id: 'objeto_antigo',
    titulo: 'Relíquia de família',
    descricao: 'Fotografe o objeto mais antigo da sua casa e conte de quem ele veio.',
    tipo: 'foto_texto',
    pontos: 65,
  },
  {
    id: 'cheiro_infancia',
    titulo: 'Cheiro de casa de vó',
    descricao: 'Qual cheiro ou tempero faz você voltar imediatamente para a infância?',
    tipo: 'texto',
    pontos: 30,
  },
  {
    id: 'vista_janela',
    titulo: 'Da minha janela agora',
    descricao: 'Tire uma foto do céu ou da vista da sua janela neste exato momento.',
    tipo: 'foto',
    pontos: 25,
  },
  {
    id: 'gorro_improvisado',
    titulo: 'Gorro de Papai Noel improvisado',
    descricao: 'Tem gorro natalino? Vale! Não tem? Improvise com toalha, pano ou chapéu e mande a foto!',
    tipo: 'foto',
    pontos: 55,
  },
  {
    id: 'agradecimento_ano',
    titulo: 'Pelo que você agradece este ano?',
    descricao: 'Compartilhe uma conquista, alegria ou livramento deste ano pelo qual você é grato(a).',
    tipo: 'texto',
    pontos: 40,
  },
  {
    id: 'almoco_hoje',
    titulo: 'O que tem no prato hoje?',
    descricao: 'Mostre seu almoço, lanche ou café de hoje sem filtro!',
    tipo: 'foto',
    pontos: 30,
  },
  {
    id: 'elogio_parente',
    titulo: 'Correio elegante da família',
    descricao: 'Escolha alguém da família e escreva um elogio sincero para alegrar o dia dessa pessoa.',
    tipo: 'texto',
    pontos: 40,
  },
  {
    id: 'enfeite_preferido',
    titulo: 'O enfeite mais especial',
    descricao: 'Mostre de pertinho o seu enfeite de Natal favorito e conte a história dele.',
    tipo: 'foto_texto',
    pontos: 50,
  },
  {
    id: 'bordao_familia',
    titulo: 'Frase clássica da família',
    descricao: 'Qual frase, ditado ou piada interna todo mundo na nossa família conhece de cor?',
    tipo: 'texto',
    pontos: 35,
  },
  {
    id: 'sorriso_dia',
    titulo: 'Sorriso de hoje',
    descricao: 'Mande uma selfie sorrindo para iluminar o painel da família!',
    tipo: 'foto',
    pontos: 30,
  },
  {
    id: 'dupla_primo_irmao',
    titulo: 'Foto com primo(a) ou irmão(ã)',
    descricao: 'Ache uma foto (antiga ou recente) ao lado de um primo, prima, irmão ou irmã!',
    tipo: 'foto_texto',
    pontos: 55,
  },
  {
    id: 'desejo_proximo_ano',
    titulo: 'Meta para o ano novo',
    descricao: 'Escreva um sonho ou plano que você quer realizar no ano que vem.',
    tipo: 'texto',
    pontos: 25,
  },
  {
    id: 'filme_natal',
    titulo: 'Sessão da tarde de Natal',
    descricao: 'Qual filme você sempre lembra quando chega dezembro? Indique para a família!',
    tipo: 'texto',
    pontos: 20,
  },
  {
    id: 'preparativos_ceia',
    titulo: 'Bastidores do Natal',
    descricao: 'Mostre alguma compra, embrulho de presente ou preparativo para a noite de Natal e conte como vai indo!',
    tipo: 'foto_texto',
    pontos: 60,
  },
  {
    id: 'meia_colorida',
    titulo: 'Desafio das meias',
    descricao: 'Tire foto usando meias engraçadas, coloridas ou um pé de cada cor!',
    tipo: 'foto',
    pontos: 40,
  },
  {
    id: 'viagem_familia',
    titulo: 'Lembrança de viagem em família',
    descricao: 'Poste uma foto de um passeio ou viagem com parentes e conte onde foi.',
    tipo: 'foto_texto',
    pontos: 65,
  },
  {
    id: 'simpatia_reveillon',
    titulo: 'Tradição de fim de ano',
    descricao: 'Qual tradição de Natal ou Ano Novo você faz questão de manter todo ano?',
    tipo: 'texto',
    pontos: 30,
  },
  {
    id: 'planta_jardim',
    titulo: 'Cantinho verde da casa',
    descricao: 'Mostre uma plantinha, flor ou horta que você cuida (ou admira!).',
    tipo: 'foto',
    pontos: 30,
  },
  {
    id: 'brinde_pre_ceia',
    titulo: 'Um brinde antecipado!',
    descricao: 'Levante seu copo (vale água, café, suco ou refrigerante!) e faça um brinde em foto com uma frase para a família.',
    tipo: 'foto_texto',
    pontos: 55,
  },
  {
    id: 'conselho_avos',
    titulo: 'Sabedoria dos mais velhos',
    descricao: 'Conte um conselho sábio que você ouviu dos seus pais, tios ou avós e nunca esqueceu.',
    tipo: 'texto',
    pontos: 45,
  },
  {
    id: 'recado_papai_noel',
    titulo: 'Bilhete de 1 linha ao Papai Noel',
    descricao: 'Se você só pudesse escrever uma única frase para o Bom Velhinho hoje, qual seria?',
    tipo: 'texto',
    pontos: 25,
  },
  {
    id: 'recriando_foto',
    titulo: 'Antes e depois de Natal',
    descricao: 'Poste uma foto antiga ou tente imitar a pose de uma foto de infância e conte o ano original!',
    tipo: 'foto_texto',
    pontos: 80,
  },
];

export const MAPA_MODELOS_MISSAO: ReadonlyMap<string, ModeloMissao> = new Map(
  MODELOS_MISSAO.map((m) => [m.id, m]),
);

const partesSP = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function relogioSP(agora: Date = new Date()): {
  ano: number;
  mes: number;
  dia: number;
  data: string;
  hora: number;
  minuto: number;
} {
  const mapa: Record<string, string> = {};
  for (const p of partesSP.formatToParts(agora)) {
    if (p.type !== 'literal') mapa[p.type] = p.value;
  }
  const ano = Number(mapa.year);
  const mes = Number(mapa.month);
  const dia = Number(mapa.day);
  const hora = Number(mapa.hour);
  const minuto = Number(mapa.minute);
  return {
    ano,
    mes,
    dia,
    data: `${mapa.year}-${mapa.month}-${mapa.day}`,
    hora: hora === 24 ? 0 : hora,
    minuto,
  };
}

/** Sem push entre 22h e 8h de São Paulo (avisos noturnos ficam adiados para 8h). */
export function horarioPermitidoPushSP(agora: Date = new Date()): boolean {
  const { hora } = relogioSP(agora);
  return hora >= 8 && hora < 22;
}

export function estadoMissao(
  inicia_em: string,
  termina_em: string,
  encerra_em: string,
  agora: Date = new Date(),
): 'agendada' | 'ativa' | 'encerrada' {
  const agoraMs = agora.getTime();
  const iniciaMs = Date.parse(inicia_em);
  const terminaMs = Math.min(Date.parse(termina_em), Date.parse(encerra_em));
  if (agoraMs >= terminaMs) return 'encerrada';
  if (agoraMs < iniciaMs) return 'agendada';
  return 'ativa';
}

export function validarConteudoMissao(
  tipo: TipoMissao,
  texto: string | null,
  imageUrl: string | null,
): string | null {
  const temTexto = Boolean(texto && [...texto.trim()].length >= 3);
  const temFoto = Boolean(imageUrl && imageUrl.trim());
  if (tipo === 'foto' && !temFoto) return 'Envie uma foto para cumprir esta missão.';
  if (tipo === 'texto' && !temTexto) return 'Escreva uma resposta com pelo menos 3 letras.';
  if (tipo === 'foto_texto' && (!temFoto || !temTexto)) {
    return 'Esta missão pede uma foto acompanhada de um pequeno texto (3+ letras).';
  }
  return null;
}

export interface MissaoSorteada {
  modelo: ModeloMissao;
  inicia_em: string;
  termina_em: string;
}

/**
 * Sorteia no máximo 1 missão surpresa por dia entre 01/12 e encerra_em:
 * - começa entre 10h e 20h SP em minuto aleatório;
 * - duração entre 3h e 24h (limitada a encerra_em);
 * - usa apenas modelo ainda não utilizado no ano.
 */
export function planejarMissaoSurpresa(params: {
  ano: number;
  encerra_em: string;
  modelosUsados: ReadonlySet<string>;
  diasComMissao: ReadonlySet<string>;
  agora?: Date;
  aleatorio?: () => number;
}): MissaoSorteada | null {
  const agora = params.agora ?? new Date();
  const rnd = params.aleatorio ?? Math.random;
  const sp = relogioSP(agora);

  const inicioDezMs = Date.parse(`${params.ano}-12-01T00:00:00-03:00`);
  const encerraMs = Date.parse(params.encerra_em);
  if (!Number.isFinite(encerraMs) || agora.getTime() < inicioDezMs || agora.getTime() >= encerraMs) {
    return null;
  }

  if (params.diasComMissao.has(sp.data)) return null;

  const disponiveis = MODELOS_MISSAO.filter((m) => !params.modelosUsados.has(m.id));
  if (disponiveis.length === 0) return null;

  // Minuto do dia entre 10:00 (600) e 20:00 (1200) SP.
  const minutoAtualDia = sp.hora * 60 + sp.minuto;
  const minInicio = Math.max(10 * 60, minutoAtualDia + 5);
  const maxInicio = 20 * 60;
  if (minInicio > maxInicio) return null;

  const minutoEscolhido = minInicio + Math.floor(rnd() * (maxInicio - minInicio + 1));
  const h = String(Math.floor(minutoEscolhido / 60)).padStart(2, '0');
  const m = String(minutoEscolhido % 60).padStart(2, '0');
  const iniciaMs = Date.parse(`${sp.data}T${h}:${m}:00-03:00`);

  const minDuracaoMs = 3 * 60 * 60 * 1000;
  const maxDuracaoMs = Math.min(24 * 60 * 60 * 1000, encerraMs - iniciaMs);
  if (maxDuracaoMs < minDuracaoMs) return null;

  const duracaoMinutos = 180 + Math.floor(rnd() * (Math.floor(maxDuracaoMs / 60_000) - 180 + 1));
  const terminaMs = Math.min(encerraMs, iniciaMs + duracaoMinutos * 60_000);

  const modelo = disponiveis[Math.floor(rnd() * disponiveis.length)];
  return {
    modelo,
    inicia_em: new Date(iniciaMs).toISOString(),
    termina_em: new Date(terminaMs).toISOString(),
  };
}
