// Catálogo completo de conquistas da gamificação (10 categorias, escadas bronze/prata/ouro/lendária, secretas e vaquinha sem pontos).
// Sem importações de banco ou servidor para permitir testes unitários diretos.

import type {
  CategoriaConquista,
  ConquistaVista,
  NivelConquista,
} from './tipos';

export interface MetricasUsuario {
  visitas_dias: number;
  visitas_seguidas: number;
  visitas_dezembro: number;
  edicoes_participadas: number;
  perfis_familia: number;
  posts: number;
  posts_com_foto: number;
  fotos_mural: number;
  fotos_album: number;
  fotos_total: number;
  marcacoes_album: number;
  curtidas_album_dadas: number;
  comentarios: number;
  reacoes_dadas: number;
  reacoes_recebidas: number;
  comentarios_recebidos: number;
  curtidas_comentario_dadas: number;
  autores_reagidos: number;
  autores_comentados: number;
  enquetes_criadas: number;
  enquetes_mural_votos: number;
  advento_respostas: number;
  advento_votos: number;
  advento_dias: number;
  advento_aberturas: number;
  advento_no_dia: number;
  presenca_confirmada: boolean;
  pratos_ceia: number;
  votos_ceia: number;
  musicas_playlist: number;
  desejos: number;
  dicas_amigo: number;
  palpites_amigo: number;
  quiz_respostas: number;
  quiz_acertos: number;
  quiz_podio: boolean;
  quiz_primeiro: boolean;
  bingo_cartelas: number;
  bingo_marcacoes: number;
  bingo_vitorias: number;
  desafio_fotos: number;
  desafio_votos: number;
  desafio_vitorias: number;
  enquetes_ao_vivo_votos: number;
  jogos_participacoes: number;
  jogos_vitorias: number;
  missoes_cumpridas: number;
  karaoke_cantadas: number;
  karaoke_musicas_distintas: number;
  karaoke_melhor_nota: number;
  karaoke_dificil_cantadas: number;
  karaoke_nota_90: number;
  karaoke_duetos: number;
  karaoke_parceiros_dueto: number;
  karaoke_maior_combo: number;
  karaoke_batalhas_vencidas: number;
  karaoke_pedidos_catalogo: number;
  vaquinha_contribuiu: boolean;
  vaquinha_primeiro: boolean;
  vaquinha_novembro: boolean;
  vaquinha_edicoes: number;
  pessoas_arvore: number;
  elos_arvore: number;
  receitas: number;
  historias: number;
  capsulas: number;
  capsulas_destinatarios: number;
  homenagens: number;
  velas_acesas: number;
  postou_madrugada: boolean;
  abriu_cedo: boolean;
  advento_dia_1_pontual: boolean;
  karaoke_nota_100: boolean;
  missao_em_15min: boolean;
  post_longo: boolean;
  album_5_mesmo_dia: boolean;
  abriu_vespera: boolean;
}

export function metricasVazias(): MetricasUsuario {
  return {
    visitas_dias: 0,
    visitas_seguidas: 0,
    visitas_dezembro: 0,
    edicoes_participadas: 0,
    perfis_familia: 0,
    posts: 0,
    posts_com_foto: 0,
    fotos_mural: 0,
    fotos_album: 0,
    fotos_total: 0,
    marcacoes_album: 0,
    curtidas_album_dadas: 0,
    comentarios: 0,
    reacoes_dadas: 0,
    reacoes_recebidas: 0,
    comentarios_recebidos: 0,
    curtidas_comentario_dadas: 0,
    autores_reagidos: 0,
    autores_comentados: 0,
    enquetes_criadas: 0,
    enquetes_mural_votos: 0,
    advento_respostas: 0,
    advento_votos: 0,
    advento_dias: 0,
    advento_aberturas: 0,
    advento_no_dia: 0,
    presenca_confirmada: false,
    pratos_ceia: 0,
    votos_ceia: 0,
    musicas_playlist: 0,
    desejos: 0,
    dicas_amigo: 0,
    palpites_amigo: 0,
    quiz_respostas: 0,
    quiz_acertos: 0,
    quiz_podio: false,
    quiz_primeiro: false,
    bingo_cartelas: 0,
    bingo_marcacoes: 0,
    bingo_vitorias: 0,
    desafio_fotos: 0,
    desafio_votos: 0,
    desafio_vitorias: 0,
    enquetes_ao_vivo_votos: 0,
    jogos_participacoes: 0,
    jogos_vitorias: 0,
    missoes_cumpridas: 0,
    karaoke_cantadas: 0,
    karaoke_musicas_distintas: 0,
    karaoke_melhor_nota: 0,
    karaoke_dificil_cantadas: 0,
    karaoke_nota_90: 0,
    karaoke_duetos: 0,
    karaoke_parceiros_dueto: 0,
    karaoke_maior_combo: 0,
    karaoke_batalhas_vencidas: 0,
    karaoke_pedidos_catalogo: 0,
    vaquinha_contribuiu: false,
    vaquinha_primeiro: false,
    vaquinha_novembro: false,
    vaquinha_edicoes: 0,
    pessoas_arvore: 0,
    elos_arvore: 0,
    receitas: 0,
    historias: 0,
    capsulas: 0,
    capsulas_destinatarios: 0,
    homenagens: 0,
    velas_acesas: 0,
    postou_madrugada: false,
    abriu_cedo: false,
    advento_dia_1_pontual: false,
    karaoke_nota_100: false,
    missao_em_15min: false,
    post_longo: false,
    album_5_mesmo_dia: false,
    abriu_vespera: false,
  };
}

export interface DefinicaoConquista {
  id: string;
  categoria: CategoriaConquista;
  nome: string;
  descricao: string;
  nivel: NivelConquista;
  secreta: boolean;
  dinheiro: boolean;
  icone: string;
  meta: number | null;
  valor: (m: MetricasUsuario) => number;
}

const PONTOS_POR_NIVEL: Readonly<Record<NivelConquista, number>> = {
  bronze: 20,
  prata: 50,
  ouro: 100,
  lendaria: 250,
};

export function pontosDaConquista(c: Pick<DefinicaoConquista, 'nivel' | 'dinheiro'>): number {
  if (c.dinheiro) return 0;
  return PONTOS_POR_NIVEL[c.nivel];
}

function contavel(
  id: string,
  categoria: CategoriaConquista,
  nome: string,
  descricao: string,
  nivel: NivelConquista,
  icone: string,
  meta: number,
  extrator: (m: MetricasUsuario) => number,
  opcoes?: { secreta?: boolean; dinheiro?: boolean },
): DefinicaoConquista {
  return {
    id,
    categoria,
    nome,
    descricao,
    nivel,
    secreta: opcoes?.secreta ?? false,
    dinheiro: opcoes?.dinheiro ?? false,
    icone,
    meta,
    valor: extrator,
  };
}

function booleana(
  id: string,
  categoria: CategoriaConquista,
  nome: string,
  descricao: string,
  nivel: NivelConquista,
  icone: string,
  predicado: (m: MetricasUsuario) => boolean,
  opcoes?: { secreta?: boolean; dinheiro?: boolean },
): DefinicaoConquista {
  return {
    id,
    categoria,
    nome,
    descricao,
    nivel,
    secreta: opcoes?.secreta ?? false,
    dinheiro: opcoes?.dinheiro ?? false,
    icone,
    meta: null,
    valor: (m) => (predicado(m) ? 1 : 0),
  };
}

export const CATALOGO_CONQUISTAS: readonly DefinicaoConquista[] = [
  // 1. FAMILIA (12 conquistas)
  contavel('visita_bronze', 'familia', 'Passadinha na Sala', 'Abriu o aplicativo em 3 dias diferentes nesta edição.', 'bronze', 'Calendar', 3, (m) => m.visitas_dias),
  contavel('visita_prata', 'familia', 'De Casa', 'Abriu o aplicativo em 10 dias diferentes nesta edição.', 'prata', 'Calendar', 10, (m) => m.visitas_dias),
  contavel('visita_ouro', 'familia', 'Sempre por Perto', 'Abriu o aplicativo em 25 dias diferentes nesta edição.', 'ouro', 'Calendar', 25, (m) => m.visitas_dias),
  contavel('visita_lendaria', 'familia', 'Guardião do Natal', 'Abriu o aplicativo em 40 dias diferentes nesta edição.', 'lendaria', 'Crown', 40, (m) => m.visitas_dias),
  contavel('sequencia_bronze', 'familia', 'Três Dias Seguidos', 'Esteve presente por 3 dias consecutivos.', 'bronze', 'Flame', 3, (m) => m.visitas_seguidas),
  contavel('sequencia_prata', 'familia', 'Semana Inteira', 'Esteve presente por 7 dias consecutivos.', 'prata', 'Flame', 7, (m) => m.visitas_seguidas),
  contavel('sequencia_ouro', 'familia', 'Quinzena Fiel', 'Esteve presente por 14 dias consecutivos.', 'ouro', 'Flame', 14, (m) => m.visitas_seguidas),
  contavel('sequencia_lendaria', 'familia', 'Chama Acesa', 'Esteve presente por 21 dias consecutivos.', 'lendaria', 'Sparkles', 21, (m) => m.visitas_seguidas),
  contavel('dezembro_bronze', 'familia', 'Clima de Dezembro', 'Abriu o aplicativo em 5 dias de dezembro.', 'bronze', 'Snowflake', 5, (m) => m.visitas_dezembro),
  contavel('dezembro_prata', 'familia', 'Contagem Regressiva', 'Abriu o aplicativo em 12 dias de dezembro.', 'prata', 'Snowflake', 12, (m) => m.visitas_dezembro),
  contavel('dezembro_ouro', 'familia', 'Dezembro Inteiro', 'Abriu o aplicativo em 20 dias de dezembro.', 'ouro', 'Snowflake', 20, (m) => m.visitas_dezembro),
  contavel('veterano', 'familia', 'Veterano', 'Participou de pelo menos 2 edições do Natal em Família.', 'prata', 'Award', 2, (m) => m.edicoes_participadas),

  // 2. FOTOGRAFO (11 conquistas)
  contavel('fotografo_bronze', 'fotografo', 'Primeiros Cliques', 'Publicou 3 fotos no mural ou no álbum nesta edição.', 'bronze', 'Camera', 3, (m) => m.fotos_total),
  contavel('fotografo_prata', 'fotografo', 'Fotógrafo', 'Publicou 10 fotos no mural ou no álbum nesta edição.', 'prata', 'Camera', 10, (m) => m.fotos_total),
  contavel('fotografo_ouro', 'fotografo', 'Olhar da Família', 'Publicou 25 fotos no mural ou no álbum nesta edição.', 'ouro', 'Aperture', 25, (m) => m.fotos_total),
  contavel('fotografo_lendaria', 'fotografo', 'Paparazzi Oficial', 'Publicou 50 fotos no mural ou no álbum nesta edição.', 'lendaria', 'Aperture', 50, (m) => m.fotos_total),
  contavel('album_bronze', 'fotografo', 'Álbum Aberto', 'Enviou 3 fotos para o álbum de memórias.', 'bronze', 'Image', 3, (m) => m.fotos_album),
  contavel('album_prata', 'fotografo', 'Colecionador de Momentos', 'Enviou 10 fotos para o álbum de memórias.', 'prata', 'Images', 10, (m) => m.fotos_album),
  contavel('album_ouro', 'fotografo', 'Guardião do Álbum', 'Enviou 25 fotos para o álbum de memórias.', 'ouro', 'Images', 25, (m) => m.fotos_album),
  contavel('marcador_bronze', 'fotografo', 'Quem Está na Foto', 'Marcou 3 pessoas nas fotos do álbum.', 'bronze', 'Tag', 3, (m) => m.marcacoes_album),
  contavel('marcador_prata', 'fotografo', 'Todo Mundo Identificado', 'Marcou 10 pessoas nas fotos do álbum.', 'prata', 'Tag', 10, (m) => m.marcacoes_album),
  contavel('marcador_ouro', 'fotografo', 'Memória de Elefante', 'Marcou 25 pessoas nas fotos do álbum.', 'ouro', 'Focus', 25, (m) => m.marcacoes_album),
  contavel('mural_foto_prata', 'fotografo', 'Retrato no Mural', 'Fez 5 publicações com foto no mural.', 'prata', 'Camera', 5, (m) => m.posts_com_foto),

  // 3. PROSA (12 conquistas)
  contavel('post_bronze', 'prosa', 'Quebrou o Gelo', 'Fez a primeira publicação no mural nesta edição.', 'bronze', 'Feather', 1, (m) => m.posts),
  contavel('post_prata', 'prosa', 'Voz no Mural', 'Fez 5 publicações no mural nesta edição.', 'prata', 'Feather', 5, (m) => m.posts),
  contavel('post_ouro', 'prosa', 'Cronista do Natal', 'Fez 15 publicações no mural nesta edição.', 'ouro', 'Feather', 15, (m) => m.posts),
  contavel('post_lendaria', 'prosa', 'Alma do Mural', 'Fez 30 publicações no mural nesta edição.', 'lendaria', 'Crown', 30, (m) => m.posts),
  contavel('comentarista_bronze', 'prosa', 'Puxou Assunto', 'Fez 5 comentários no mural nesta edição.', 'bronze', 'MessageCircle', 5, (m) => m.comentarios),
  contavel('comentarista_prata', 'prosa', 'Comentarista', 'Fez 20 comentários no mural nesta edição.', 'prata', 'MessageCircle', 20, (m) => m.comentarios),
  contavel('comentarista_ouro', 'prosa', 'Prosa que Não Acaba', 'Fez 50 comentários no mural nesta edição.', 'ouro', 'MessageSquare', 50, (m) => m.comentarios),
  contavel('comentarista_lendaria', 'prosa', 'Roda de Conversa', 'Fez 100 comentários no mural nesta edição.', 'lendaria', 'MessageSquare', 100, (m) => m.comentarios),
  contavel('coracao_bronze', 'prosa', 'Querido no Mural', 'Recebeu 10 curtidas ou reações nas publicações.', 'bronze', 'Heart', 10, (m) => m.reacoes_recebidas),
  contavel('coracao_prata', 'prosa', 'Coração', 'Recebeu 50 curtidas ou reações nas publicações.', 'prata', 'Heart', 50, (m) => m.reacoes_recebidas),
  contavel('coracao_ouro', 'prosa', 'Chuva de Carinho', 'Recebeu 100 curtidas ou reações nas publicações.', 'ouro', 'Heart', 100, (m) => m.reacoes_recebidas),
  contavel('enquete_mural_prata', 'prosa', 'Opinião na Roda', 'Votou em 3 enquetes do mural da família.', 'bronze', 'Vote', 3, (m) => m.enquetes_mural_votos),

  // 4. ADVENTO (10 conquistas)
  contavel('advento_bronze', 'advento', 'Primeiras Portinhas', 'Participou de 3 janelas do Calendário do Advento.', 'bronze', 'Gift', 3, (m) => m.advento_dias),
  contavel('advento_prata', 'advento', 'Advento', 'Participou de 10 janelas do Calendário do Advento.', 'prata', 'Gift', 10, (m) => m.advento_dias),
  contavel('advento_ouro', 'advento', 'Quase Véspera', 'Participou de 18 janelas do Calendário do Advento.', 'ouro', 'Gift', 18, (m) => m.advento_dias),
  contavel('advento_lendaria', 'advento', 'Calendário Completo', 'Participou de todas as 24 janelas do Advento.', 'lendaria', 'Star', 24, (m) => m.advento_dias),
  contavel('advento_pontual_bronze', 'advento', 'No Dia Certo', 'Abriu 3 janelas do Advento exatamente no dia delas.', 'bronze', 'Clock', 3, (m) => m.advento_no_dia),
  contavel('advento_pontual_prata', 'advento', 'Relógio de Natal', 'Abriu 10 janelas do Advento exatamente no dia delas.', 'prata', 'Clock', 10, (m) => m.advento_no_dia),
  contavel('advento_pontual_ouro', 'advento', 'Ritual Matinal', 'Abriu 20 janelas do Advento exatamente no dia delas.', 'ouro', 'Bell', 20, (m) => m.advento_no_dia),
  contavel('advento_resposta_bronze', 'advento', 'Deixou Recado', 'Escreveu resposta em 5 janelas do Advento.', 'bronze', 'Send', 5, (m) => m.advento_respostas),
  contavel('advento_voto_bronze', 'advento', 'Voto Natalino', 'Votou em 2 enquetes do Calendário do Advento.', 'bronze', 'Vote', 2, (m) => m.advento_votos),
  contavel('advento_curioso', 'advento', 'Espiando as Janelas', 'Abriu 15 portinhas do Calendário do Advento.', 'prata', 'Sparkles', 15, (m) => m.advento_aberturas),

  // 5. CEIA (10 conquistas)
  booleana('presente', 'ceia', 'Presente', 'Confirmou presença na ceia desta edição.', 'bronze', 'CheckCircle2', (m) => m.presenca_confirmada),
  contavel('prato_bronze', 'ceia', 'Mão na Massa', 'Cadastrou 1 prato ou bebida para a ceia.', 'bronze', 'Utensils', 1, (m) => m.pratos_ceia),
  contavel('prato_prata', 'ceia', 'Mesa Farta', 'Cadastrou 2 pratos ou bebidas para a ceia.', 'prata', 'ChefHat', 2, (m) => m.pratos_ceia),
  contavel('prato_ouro', 'ceia', 'Banquete Completo', 'Cadastrou 3 pratos ou bebidas para a ceia.', 'ouro', 'ChefHat', 3, (m) => m.pratos_ceia),
  contavel('voto_ceia_bronze', 'ceia', 'Palpite da Ceia', 'Participou de 1 votação da ceia.', 'bronze', 'Vote', 1, (m) => m.votos_ceia),
  contavel('voto_ceia_prata', 'ceia', 'Conselho da Mesa', 'Participou de 3 votações da ceia.', 'prata', 'Vote', 3, (m) => m.votos_ceia),
  contavel('dj_bronze', 'ceia', 'Pediu Música', 'Adicionou 1 música na playlist de Natal.', 'bronze', 'Music', 1, (m) => m.musicas_playlist),
  contavel('dj_prata', 'ceia', 'DJ da Família', 'Adicionou 5 músicas na playlist de Natal.', 'prata', 'Disc3', 5, (m) => m.musicas_playlist),
  contavel('dj_ouro', 'ceia', 'Trilha Sonora Oficial', 'Adicionou 15 músicas na playlist de Natal.', 'ouro', 'Radio', 15, (m) => m.musicas_playlist),
  contavel('desejos_prata', 'ceia', 'Cartinha Pronta', 'Adicionou 3 itens na lista de desejos.', 'bronze', 'ListChecks', 3, (m) => m.desejos),

  // 6. FESTA (16 conquistas)
  contavel('quiz_bronze', 'festa', 'Bom de Memória', 'Acertou 3 perguntas no Quiz da Família.', 'bronze', 'Brain', 3, (m) => m.quiz_acertos),
  contavel('quiz_prata', 'festa', 'Sabe Tudo da Família', 'Acertou 8 perguntas no Quiz da Família.', 'prata', 'Brain', 8, (m) => m.quiz_acertos),
  contavel('quiz_ouro', 'festa', 'Enciclopédia Viva', 'Acertou 15 perguntas no Quiz da Família.', 'ouro', 'Brain', 15, (m) => m.quiz_acertos),
  booleana('quiz_podio', 'festa', 'Pódio do Quiz', 'Terminou entre os 3 primeiros do Quiz da Família.', 'ouro', 'Trophy', (m) => m.quiz_podio),
  booleana('quiz_campeao', 'festa', 'Mestre do Quiz', 'Conquistou o 1º lugar no Quiz da Família.', 'lendaria', 'Crown', (m) => m.quiz_primeiro),
  contavel('bingo_cartela', 'festa', 'Cartela na Mão', 'Pegou cartela e marcou pelo menos 3 casas no Bingo.', 'bronze', 'Grid3x3', 3, (m) => m.bingo_marcacoes),
  contavel('bingo_quase', 'festa', 'Olha a Boa!', 'Marcou 10 casas na cartela do Bingo da Ceia.', 'prata', 'Grid3x3', 10, (m) => m.bingo_marcacoes),
  contavel('bingo_vencedor', 'festa', 'Bingo!', 'Teve um Bingo da Ceia confirmado.', 'ouro', 'PartyPopper', 1, (m) => m.bingo_vitorias),
  contavel('desafio_bronze', 'festa', 'Entrou na Brincadeira', 'Enviou 1 foto em um Desafio de Fotos da festa.', 'bronze', 'Camera', 1, (m) => m.desafio_fotos),
  contavel('desafio_prata', 'festa', 'Topa Qualquer Pose', 'Enviou fotos em 3 Desafios de Fotos da festa.', 'prata', 'Camera', 3, (m) => m.desafio_fotos),
  contavel('desafio_campeao', 'festa', 'Foto Campeã', 'Venceu um Desafio de Fotos com a imagem mais votada.', 'ouro', 'Medal', 1, (m) => m.desafio_vitorias),
  contavel('jogos_bronze', 'festa', 'Animador da Sala', 'Participou de 1 rodada dos jogos ao vivo da festa.', 'bronze', 'Gamepad2', 1, (m) => m.jogos_participacoes),
  contavel('jogos_prata', 'festa', 'Rei da Gincana', 'Participou de 4 rodadas dos jogos ao vivo da festa.', 'prata', 'Gamepad2', 4, (m) => m.jogos_participacoes),
  contavel('jogos_campeao', 'festa', 'Pé Quente na Festa', 'Venceu em qualquer jogo ao vivo da noite de Natal.', 'ouro', 'Trophy', 1, (m) => m.jogos_vitorias),
  contavel('missao_bronze', 'festa', 'Missão Dada', 'Cumpriu 1 missão relâmpago dentro do prazo.', 'bronze', 'Zap', 1, (m) => m.missoes_cumpridas),
  contavel('missao_prata', 'festa', 'Sempre Alerta', 'Cumpriu 4 missões relâmpago nesta edição.', 'prata', 'Zap', 4, (m) => m.missoes_cumpridas),
  contavel('missao_ouro', 'festa', 'Caçador de Missões', 'Cumpriu 8 missões relâmpago nesta edição.', 'ouro', 'Target', 8, (m) => m.missoes_cumpridas),
  contavel('missao_lendaria', 'festa', 'Imbatível nas Missões', 'Cumpriu 14 missões relâmpago nesta edição.', 'lendaria', 'Rocket', 14, (m) => m.missoes_cumpridas),

  // 7. KARAOKE (12 conquistas)
  contavel('karaoke_bronze', 'karaoke', 'Soltou a Voz', 'Cantou 1 música completa no karaokê.', 'bronze', 'Mic', 1, (m) => m.karaoke_cantadas),
  contavel('karaoke_prata', 'karaoke', 'Aquecendo o Gogó', 'Cantou 5 músicas completas no karaokê.', 'prata', 'Mic', 5, (m) => m.karaoke_cantadas),
  contavel('karaoke_ouro', 'karaoke', 'Dono do Microfone', 'Cantou 15 músicas completas no karaokê.', 'ouro', 'Mic2', 15, (m) => m.karaoke_cantadas),
  contavel('karaoke_lendaria', 'karaoke', 'Show Completo', 'Cantou 30 músicas completas no karaokê.', 'lendaria', 'Mic2', 30, (m) => m.karaoke_cantadas),
  contavel('repertorio_bronze', 'karaoke', 'Repertório Variado', 'Cantou 3 músicas diferentes no karaokê.', 'bronze', 'Headphones', 3, (m) => m.karaoke_musicas_distintas),
  contavel('repertorio_prata', 'karaoke', 'Jukebox Humana', 'Cantou 8 músicas diferentes no karaokê.', 'prata', 'Headphones', 8, (m) => m.karaoke_musicas_distintas),
  contavel('repertorio_ouro', 'karaoke', 'Catálogo Vivo', 'Cantou 15 músicas diferentes no karaokê.', 'ouro', 'Volume2', 15, (m) => m.karaoke_musicas_distintas),
  contavel('afinacao_prata', 'karaoke', 'Afinadíssimo', 'Alcançou nota 80 ou maior em uma apresentação.', 'prata', 'Star', 80, (m) => m.karaoke_melhor_nota),
  contavel('afinacao_ouro', 'karaoke', 'Voz de Veludo', 'Tirou nota 90 ou maior em 3 apresentações.', 'ouro', 'Award', 3, (m) => m.karaoke_nota_90),
  contavel('coragem_dificil', 'karaoke', 'Sem Medo do Difícil', 'Cantou 3 músicas no nível Difícil.', 'prata', 'Flame', 3, (m) => m.karaoke_dificil_cantadas),
  contavel('dueto_bronze', 'karaoke', 'Em Dupla É Melhor', 'Cantou em dueto com alguém da família.', 'bronze', 'Users', 1, (m) => m.karaoke_duetos),
  contavel('batalha_campeao', 'karaoke', 'Vencedor do Duelo', 'Venceu uma batalha de karaokê.', 'ouro', 'Swords', 1, (m) => m.karaoke_batalhas_vencidas),

  // 8. GENEROSO (11 conquistas: dinheiro vale 0 pontos; carinho e apoio pontuam normalmente)
  booleana('vaquinha', 'generoso', 'Vaquinha', 'Contribuiu com a vaquinha desta edição (selo comemorativo, sem pontos).', 'bronze', 'PiggyBank', (m) => m.vaquinha_contribuiu, { dinheiro: true }),
  booleana('primeiro', 'generoso', 'Primeiro da Vaquinha', 'Fez o primeiro pagamento confirmado desta edição (selo comemorativo, sem pontos).', 'ouro', 'Coins', (m) => m.vaquinha_primeiro, { dinheiro: true }),
  booleana('vaquinha_novembro', 'generoso', 'Adiantado na Vaquinha', 'Contribuiu com a vaquinha já em novembro (selo comemorativo, sem pontos).', 'prata', 'Coins', (m) => m.vaquinha_novembro, { dinheiro: true }),
  contavel('vaquinha_fiel_prata', 'generoso', 'Parceiro da Vaquinha', 'Contribuiu com a vaquinha em 2 edições (selo comemorativo, sem pontos).', 'prata', 'PiggyBank', 2, (m) => m.vaquinha_edicoes, { dinheiro: true }),
  contavel('vaquinha_fiel_ouro', 'generoso', 'Pilar da Vaquinha', 'Contribuiu com a vaquinha em 3 edições (selo comemorativo, sem pontos).', 'ouro', 'PiggyBank', 3, (m) => m.vaquinha_edicoes, { dinheiro: true }),
  contavel('carinho_bronze', 'generoso', 'Mão Aberta nos Elogios', 'Deu 15 reações em publicações de parentes.', 'bronze', 'ThumbsUp', 15, (m) => m.reacoes_dadas),
  contavel('carinho_prata', 'generoso', 'Espalhador de Carinho', 'Deu 50 reações em publicações de parentes.', 'prata', 'HandHeart', 50, (m) => m.reacoes_dadas),
  contavel('carinho_ouro', 'generoso', 'Coração Gigante', 'Deu 120 reações em publicações de parentes.', 'ouro', 'HandHeart', 120, (m) => m.reacoes_dadas),
  contavel('dica_amigo_bronze', 'generoso', 'Pista Misteriosa', 'Enviou 1 dica anônima no Amigo Secreto.', 'bronze', 'Lightbulb', 1, (m) => m.dicas_amigo),
  contavel('dica_amigo_prata', 'generoso', 'Mestre do Suspense', 'Enviou 5 dicas anônimas no Amigo Secreto.', 'prata', 'Lightbulb', 5, (m) => m.dicas_amigo),
  contavel('familia_unida', 'generoso', 'Abraço em Todos', 'Reagiu em publicações de 8 familiares diferentes.', 'ouro', 'Users', 8, (m) => m.autores_reagidos),

  // 9. MEMORIAS (12 conquistas)
  contavel('arvore_bronze', 'memorias', 'Nova Folha', 'Adicionou 1 pessoa na árvore genealógica.', 'bronze', 'TreePine', 1, (m) => m.pessoas_arvore),
  contavel('arvore_prata', 'memorias', 'Raízes Fortes', 'Adicionou 5 pessoas na árvore genealógica.', 'prata', 'TreePine', 5, (m) => m.pessoas_arvore),
  contavel('arvore_ouro', 'memorias', 'Historiador da Família', 'Adicionou 15 pessoas na árvore genealógica.', 'ouro', 'TreePine', 15, (m) => m.pessoas_arvore),
  contavel('elos_arvore_prata', 'memorias', 'Ligando Gerações', 'Registrou 5 vínculos familiares na árvore.', 'prata', 'GitBranch', 5, (m) => m.elos_arvore),
  contavel('receita_bronze', 'memorias', 'Caderno da Vovó', 'Compartilhou 1 receita tradicional da família.', 'bronze', 'BookOpen', 1, (m) => m.receitas),
  contavel('receita_ouro', 'memorias', 'Chef da Tradição', 'Compartilhou 3 receitas tradicionais da família.', 'ouro', 'BookOpen', 3, (m) => m.receitas),
  contavel('historia_bronze', 'memorias', 'Contador de Causos', 'Gravou 1 história da família em áudio.', 'bronze', 'ScrollText', 1, (m) => m.historias),
  contavel('historia_ouro', 'memorias', 'Memória Viva', 'Gravou 3 histórias da família em áudio.', 'ouro', 'ScrollText', 3, (m) => m.historias),
  contavel('capsula_bronze', 'memorias', 'Mensagem para o Futuro', 'Lacrou 1 cápsula do tempo.', 'bronze', 'Hourglass', 1, (m) => m.capsulas),
  contavel('capsula_ouro', 'memorias', 'Guardião do Tempo', 'Lacrou 3 cápsulas do tempo.', 'ouro', 'Hourglass', 3, (m) => m.capsulas),
  contavel('homenagem_bronze', 'memorias', 'Saudade Carinhosa', 'Publicou 1 homenagem no memorial da família.', 'bronze', 'Heart', 1, (m) => m.homenagens),
  contavel('vela_memorial', 'memorias', 'Luz da Lembrança', 'Acendeu uma vela no memorial da família.', 'bronze', 'Flame', 1, (m) => m.velas_acesas),

  // 10. SECRETAS (12 conquistas secretas: aparecem como '???' até alguém desbloquear)
  booleana('secreta_coruja', 'secretas', 'Coruja de Natal', 'Publicou ou comentou no mural de madrugada (entre 0h e 5h).', 'bronze', 'Moon', (m) => m.postou_madrugada, { secreta: true }),
  booleana('secreta_madrugador', 'secretas', 'Galo da Manhã', 'Abriu o aplicativo bem cedinho (entre 5h e 7h).', 'bronze', 'Sunrise', (m) => m.abriu_cedo, { secreta: true }),
  booleana('secreta_primeiro_dezembro', 'secretas', 'Porteiro de Dezembro', 'Abriu a janela 1 do Advento logo em 1º de dezembro.', 'prata', 'Lock', (m) => m.advento_dia_1_pontual, { secreta: true }),
  booleana('secreta_nota_100', 'secretas', 'Perfeição Absoluta', 'Cravou nota 100 no karaokê da família.', 'lendaria', 'Gem', (m) => m.karaoke_nota_100, { secreta: true }),
  contavel('secreta_combo_50', 'secretas', 'Sem Perder o Fôlego', 'Alcançou combo de 50x ou mais no karaokê.', 'ouro', 'Zap', 50, (m) => m.karaoke_maior_combo, { secreta: true }),
  contavel('secreta_dueto_trio', 'secretas', 'Vozes Unidas', 'Cantou em dueto com 3 pessoas diferentes da família.', 'prata', 'Users', 3, (m) => m.karaoke_parceiros_dueto, { secreta: true }),
  booleana('secreta_relampago', 'secretas', 'Mais Rápido que Trenó', 'Respondeu uma missão relâmpago nos primeiros 15 minutos.', 'ouro', 'Rocket', (m) => m.missao_em_15min, { secreta: true }),
  booleana('secreta_textao', 'secretas', 'Carta ao Papai Noel', 'Escreveu uma publicação inspirada com mais de 400 letras no mural.', 'bronze', 'ScrollText', (m) => m.post_longo, { secreta: true }),
  booleana('secreta_rolo_cheio', 'secretas', 'Rolo Revelado', 'Enviou 5 fotos para o álbum no mesmo dia.', 'prata', 'Images', (m) => m.album_5_mesmo_dia, { secreta: true }),
  booleana('secreta_vespera', 'secretas', 'Já É Natal!', 'Abriu o aplicativo na véspera de Natal (24 de dezembro).', 'prata', 'Sparkles', (m) => m.abriu_vespera, { secreta: true }),
  contavel('secreta_viajante', 'secretas', 'Carteiro do Futuro', 'Lacrou cápsulas do tempo para 2 pessoas diferentes.', 'prata', 'Compass', 2, (m) => m.capsulas_destinatarios, { secreta: true }),
  booleana(
    'secreta_completa',
    'secretas',
    'Espírito Natalino Completo',
    'Publicou no mural, abriu o Advento, mandou foto no álbum, cumpriu missão e cantou no karaokê.',
    'lendaria',
    'Crown',
    (m) => m.posts >= 1 && m.advento_dias >= 1 && m.fotos_album >= 1 && m.missoes_cumpridas >= 1 && m.karaoke_cantadas >= 1,
    { secreta: true },
  ),
];

export const MAPA_CONQUISTAS: ReadonlyMap<string, DefinicaoConquista> = new Map(
  CATALOGO_CONQUISTAS.map((c) => [c.id, c]),
);

/**
 * Conquistas de presença, visitas e edições passadas/vaquinha que não dependem de conteúdo apagável.
 * Todas as demais conquistas (conteúdo, volume, brincadeiras) são revogáveis enquanto revelado_em for null.
 */
export const IDS_CONQUISTAS_IRREVOGAVEIS: ReadonlySet<string> = new Set([
  'visita_bronze',
  'visita_prata',
  'visita_ouro',
  'visita_lendaria',
  'sequencia_bronze',
  'sequencia_prata',
  'sequencia_ouro',
  'sequencia_lendaria',
  'dezembro_bronze',
  'dezembro_prata',
  'dezembro_ouro',
  'veterano',
  'presente',
  'vaquinha',
  'primeiro',
  'vaquinha_novembro',
  'vaquinha_fiel_prata',
  'vaquinha_fiel_ouro',
  'secreta_madrugador',
  'secreta_vespera',
]);

export function conquistaAlcancada(c: DefinicaoConquista, metricas: MetricasUsuario): boolean {
  const atual = c.valor(metricas);
  if (c.meta == null) return atual >= 1;
  return atual >= c.meta;
}

export function progressoDaConquista(
  c: DefinicaoConquista,
  metricas: MetricasUsuario,
): { atual: number; meta: number } | null {
  if (c.meta == null) return null;
  const bruto = Math.max(0, Math.floor(c.valor(metricas)));
  return { atual: Math.min(bruto, c.meta), meta: c.meta };
}

export function avaliarConquistasAlcancadas(metricas: MetricasUsuario): DefinicaoConquista[] {
  return CATALOGO_CONQUISTAS.filter((c) => conquistaAlcancada(c, metricas));
}

/**
 * Enquanto revelado_em for null, devolve os IDs de conquistas de conteúdo que deixaram de ser alcançadas
 * (por exemplo, quando uma publicação, foto, comentário ou reação foi apagada ou recusada).
 */
export function conquistasParaRevogar(
  ganhasAtuais: readonly string[],
  metricas: MetricasUsuario,
  reveladoEm: string | null,
): string[] {
  if (reveladoEm) return [];
  const alcancadas = new Set(avaliarConquistasAlcancadas(metricas).map((c) => c.id));
  return ganhasAtuais.filter(
    (id) => !IDS_CONQUISTAS_IRREVOGAVEIS.has(id) && !alcancadas.has(id),
  );
}

/**
 * Monta a lista de ConquistaVista para exibição.
 * Conquistas secretas ainda não desbloqueadas por ninguém na família aparecem como '???' e sem progresso.
 */
export function montarConquistasVistas(
  metricas: MetricasUsuario,
  ganhasDoUsuario: ReadonlyMap<string, string>,
  contagemFamilia: ReadonlyMap<string, number>,
): ConquistaVista[] {
  return CATALOGO_CONQUISTAS.map((c): ConquistaVista => {
    const ganhaEm = ganhasDoUsuario.get(c.id) ?? null;
    const quantos = Math.max(contagemFamilia.get(c.id) ?? 0, ganhaEm ? 1 : 0);
    const mascarada = c.secreta && !ganhaEm && quantos === 0;
    return {
      id: c.id,
      categoria: c.categoria,
      nome: mascarada ? '???' : c.nome,
      descricao: mascarada ? '???' : c.descricao,
      nivel: c.nivel,
      icone: c.icone,
      secreta: c.secreta,
      pontos: pontosDaConquista(c),
      ganha_em: ganhaEm,
      progresso: mascarada ? null : progressoDaConquista(c, metricas),
      quantos_ganharam: quantos,
    };
  });
}
