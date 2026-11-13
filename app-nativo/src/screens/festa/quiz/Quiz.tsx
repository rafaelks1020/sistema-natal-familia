import { useEffect, useState } from 'react';
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery } from '@tanstack/react-query';
import Award from 'lucide-react-native/icons/award';
import Camera from 'lucide-react-native/icons/camera';
import Check from 'lucide-react-native/icons/check';
import Hourglass from 'lucide-react-native/icons/hourglass';
import ImagePlus from 'lucide-react-native/icons/image-plus';
import Pencil from 'lucide-react-native/icons/pencil';
import Plus from 'lucide-react-native/icons/plus';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Trash2 from 'lucide-react-native/icons/trash';
import Trophy from 'lucide-react-native/icons/trophy';
import X from 'lucide-react-native/icons/x';
import { api, ApiError, queryClient, sessionStore } from '../../../api';
import { useSession } from '../../../session';
import { theme } from '../../../theme';
import { escolherFotos, enviarFoto } from '../../../upload';
import { Avatar } from '../../../ui/Avatar';
import { Button } from '../../../ui/Button';
import { EmptyState } from '../../../ui/EmptyState';
import { Field } from '../../../ui/Field';
import { Sheet } from '../../../ui/Sheet';
import { Skeleton } from '../../../ui/Skeleton';
import { Surface } from '../../../ui/Surface';
import { Text } from '../../../ui/Text';
import { useToast } from '../../../ui/Toast';
import { Cabecalho } from '../../familia/Cabecalho';
import { sessaoVigente, useAutenticado } from '../../familia/sessao';

export const quizKeys = {
  dados: ['festa', 'quiz'] as const,
};

interface QuizQuestionItem {
  id: number;
  ordem: number;
  modelo: string;
  pergunta: string;
  image_url: string | null;
  opcoes: string[];
  correta: number | null;
  encerrada: boolean;
  total_respostas: number;
}

interface QuizRevealedAnswer {
  user_id: number;
  name: string;
  avatar_url: string | null;
  escolha: number;
  acertou: boolean;
  pontos: number;
  tempo_ms: number;
}

interface QuizCurrentQuestion {
  id: number;
  numero: number;
  total: number;
  modelo: string;
  pergunta: string;
  image_url: string | null;
  opcoes: string[];
  correta: number | null;
  encerrada: boolean;
  total_respostas: number;
  minha_resposta: {
    escolha: number;
    acertou: boolean | null;
    pontos: number | null;
    tempo_ms: number;
  } | null;
  respostas_reveladas: QuizRevealedAnswer[];
}

interface QuizLeaderboardEntry {
  user_id: number;
  name: string;
  avatar_url: string | null;
  pontos: number;
  acertos: number;
  respondidas: number;
  tempo_medio_ms: number;
}

interface QuizData {
  ano: number;
  server_now: string;
  duracao_segundos: number;
  modelos: string[];
  state: {
    status: 'preparando' | 'aberta' | 'revelada' | 'podio';
    question_id: number | null;
    aberta_em: string | null;
    encerrada_em: string | null;
    restante_ms: number;
  };
  pergunta_atual: QuizCurrentQuestion | null;
  placar: QuizLeaderboardEntry[];
  perguntas: QuizQuestionItem[];
}

const LETRAS = ['A', 'B', 'C', 'D'] as const;

export default function FestaQuizScreen() {
  const ok = useAutenticado();
  const { user } = useSession();
  const toast = useToast();
  const admin = Boolean(user?.is_admin);

  const consulta = useQuery({
    queryKey: quizKeys.dados,
    enabled: ok,
    refetchInterval: 2000,
    queryFn: ({ signal }) => api<QuizData>('/api/festa/quiz', { signal }),
  });

  const data = consulta.data;
  const [agora, setAgora] = useState<number>(() => Date.now());

  // Estado da folha de criacao/edicao de pergunta pelo organizador
  const [sheetAberta, setSheetAberta] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [modelo, setModelo] = useState('Quem disse isso?');
  const [pergunta, setPergunta] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [opcoes, setOpcoes] = useState<string[]>(['', '', '', '']);
  const [correta, setCorreta] = useState<number>(0);
  const [subindoFoto, setSubindoFoto] = useState(false);

  const [appAtivo, setAppAtivo] = useState(() => AppState.currentState === 'active');
  useEffect(() => {
    const ouvinte = AppState.addEventListener('change', (estado) => { setAppAtivo(estado === 'active'); if (estado === 'active') setAgora(Date.now()); });
    return () => ouvinte.remove();
  }, []);

  useEffect(() => {
    if (data?.state.status !== 'aberta' || !appAtivo) return;
    const id = setInterval(() => {
      setAgora(Date.now());
    }, 150);
    return () => clearInterval(id);
  }, [data?.state.status, data?.state.question_id, appAtivo]);

  const decorridoMs =
    data?.state.status === 'aberta' && consulta.dataUpdatedAt > 0
      ? Math.max(0, agora - consulta.dataUpdatedAt)
      : 0;
  const restanteMs =
    data?.state.status === 'aberta' ? Math.max(0, data.state.restante_ms - decorridoMs) : 0;

  const mutacao = useMutation({
    mutationFn: (vars: { payload: Record<string, unknown>; msg?: string; generation: number }) => {
      if (!sessaoVigente(vars.generation)) {
        throw new ApiError('A sessão mudou. Tente novamente.', 401);
      }
      return api<QuizData>('/api/festa/quiz', { method: 'POST', json: vars.payload });
    },
    onSuccess: (novo, vars) => {
      if (!sessaoVigente(vars.generation)) return;
      queryClient.setQueryData(quizKeys.dados, novo);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (vars.msg) toast(vars.msg);
    },
    onError: (erro) => {
      toast(erro.message, 'error');
    },
  });

  if (!ok || !user) return null;

  function voltar() {
    if (router.canGoBack()) router.back();
    else router.navigate('/');
  }

  function enviarAcao(payload: Record<string, unknown>, msg?: string) {
    if (mutacao.isPending) return;
    mutacao.mutate({ payload, msg, generation: sessionStore.getGeneration() });
  }

  function abrirNovaPerguntaSheet() {
    setEditId(null);
    setModelo('Quem disse isso?');
    setPergunta('');
    setImageUrl(null);
    setOpcoes(['', '', '', '']);
    setCorreta(0);
    setSheetAberta(true);
  }

  function abrirEdicaoSheet(q: QuizQuestionItem) {
    setEditId(q.id);
    setModelo(q.modelo || '');
    setPergunta(q.pergunta);
    setImageUrl(q.image_url);
    setOpcoes(q.opcoes.length >= 2 ? [...q.opcoes] : ['', '']);
    setCorreta(q.correta ?? 0);
    setSheetAberta(true);
  }

  async function escolherEEnviarFoto(origem: 'camera' | 'galeria') {
    if (subindoFoto) return;
    setSubindoFoto(true);
    try {
      const fotos = await escolherFotos(origem, 1);
      if (!fotos[0]) return;
      const url = await enviarFoto(fotos[0]);
      setImageUrl(url);
      toast('Foto anexada à pergunta.');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSubindoFoto(false);
    }
  }

  function salvarPergunta() {
    if (mutacao.isPending || subindoFoto) return;
    const limpas = opcoes.map((o) => o.trim()).filter(Boolean);
    if (!pergunta.trim()) {
      toast('Digite o texto da pergunta.', 'error');
      return;
    }
    if (limpas.length < 2) {
      toast('Preencha pelo menos 2 alternativas.', 'error');
      return;
    }
    const idxCerto = Math.min(correta, limpas.length - 1);
    mutacao.mutate(
      {
        payload: {
          acao: editId ? 'editar_pergunta' : 'criar_pergunta',
          id: editId ?? undefined,
          modelo,
          pergunta: pergunta.trim(),
          image_url: imageUrl,
          opcoes: limpas,
          correta: idxCerto,
        },
        msg: editId ? 'Pergunta atualizada!' : 'Pergunta criada!',
        generation: sessionStore.getGeneration(),
      },
      {
        onSuccess: () => {
          setSheetAberta(false);
        },
      },
    );
  }

  const segundos = Math.ceil(restanteMs / 1000);
  const qAtual = data?.pergunta_atual ?? null;
  const temProxima = Boolean(data?.perguntas.some((q) => !q.encerrada));

  return (
    <View style={styles.pagina}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.miolo}
          refreshControl={
            <RefreshControl
              refreshing={consulta.isRefetching && !consulta.isPending}
              onRefresh={() => {
                void consulta.refetch();
              }}
              tintColor={theme.colors.champagne}
              colors={[theme.colors.cherry]}
              progressBackgroundColor={theme.colors.surface}
            />
          }
        >
          <Cabecalho kicker="Jogos da Ceia" titulo="Quiz da" italico="Família" aoVoltar={voltar} />

          {/* Atalhos entre os 3 jogos */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.abas}
          >
            <Button variant="primary" onPress={() => {}}>
              Quiz da Família
            </Button>
            <Button variant="ghost" onPress={() => router.replace('/festa-bingo')}>
              Bingo da Ceia
            </Button>
            <Button variant="ghost" onPress={() => router.replace('/festa-enquete')}>
              Enquete ao Vivo
            </Button>
          </ScrollView>

          {consulta.isPending ? (
            <View style={styles.corpo}>
              <Skeleton style={{ height: 190 }} />
              <Skeleton style={{ height: 140 }} />
            </View>
          ) : consulta.isError || !data ? (
            <View style={styles.corpo}>
              <EmptyState
                title="Não foi possível abrir o Quiz"
                message={consulta.error?.message ?? 'Confira sua internet e tente novamente.'}
                action="Tentar novamente"
                onAction={() => {
                  void consulta.refetch();
                }}
              />
            </View>
          ) : (
            <View style={styles.corpo}>
              {/* PERGUNTA AO VIVO (ABERTA OU REVELADA) */}
              {(data.state.status === 'aberta' || data.state.status === 'revelada') && qAtual ? (
                <Surface style={styles.bloco}>
                  <View style={styles.linhaTopo}>
                    <Text variant="kicker" style={styles.flex}>
                      Pergunta {qAtual.numero} de {qAtual.total}
                      {qAtual.modelo ? ` : ${qAtual.modelo}` : ''}
                    </Text>
                    {data.state.status === 'aberta' ? (
                      <View style={styles.badgeTempo}>
                        <Hourglass size={14} color={theme.colors.champagne} strokeWidth={1.6} />
                        <Text variant="numeral" style={styles.textoTempo}>
                          {segundos}s
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.badgeRevelada}>
                        <Text variant="kicker">Resposta revelada</Text>
                      </View>
                    )}
                  </View>

                  {data.state.status === 'aberta' ? (
                    <View style={styles.trilhaTempo}>
                      <View
                        style={[
                          styles.barraTempo,
                          {
                            width: `${Math.max(
                              0,
                              Math.min(100, (restanteMs / (data.duracao_segundos * 1000)) * 100),
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                  ) : null}

                  <Text variant="display" style={styles.tituloPergunta}>
                    {qAtual.pergunta}
                  </Text>

                  {qAtual.image_url ? (
                    <Image
                      source={{ uri: qAtual.image_url }}
                      style={styles.fotoPergunta}
                      contentFit="contain"
                    />
                  ) : null}

                  <View style={styles.listaOpcoes}>
                    {qAtual.opcoes.map((texto, idx) => {
                      const escolhida = qAtual.minha_resposta?.escolha === idx;
                      const revelada = data.state.status === 'revelada' && qAtual.correta !== null;
                      const ehCorreta = revelada && qAtual.correta === idx;
                      const erreiEsta = revelada && escolhida && qAtual.correta !== idx;

                      return (
                        <Pressable
                          key={idx}
                          accessibilityRole="button"
                          accessibilityLabel={`Alternativa ${LETRAS[idx]}: ${texto}`}
                          disabled={
                            data.state.status !== 'aberta' ||
                            Boolean(qAtual.minha_resposta) ||
                            restanteMs <= 0 ||
                            mutacao.isPending
                          }
                          onPress={() =>
                            enviarAcao(
                              { acao: 'responder', question_id: qAtual.id, escolha: idx },
                              'Resposta enviada!',
                            )
                          }
                          style={[
                            styles.opcaoBtn,
                            escolhida && styles.opcaoEscolhida,
                            ehCorreta && styles.opcaoCorreta,
                            erreiEsta && styles.opcaoErrada,
                          ]}
                        >
                          <View style={styles.letraCirculo}>
                            <Text variant="display" style={styles.letraTexto}>
                              {LETRAS[idx] ?? idx + 1}
                            </Text>
                          </View>
                          <Text style={styles.flex}>{texto}</Text>
                          {ehCorreta ? (
                            <Check size={18} color={theme.colors.champagne} strokeWidth={2} />
                          ) : escolhida && !revelada ? (
                            <Text variant="kicker">Sua escolha</Text>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>

                  {data.state.status === 'aberta' && qAtual.minha_resposta ? (
                    <Text variant="muted" style={styles.avisoCentro}>
                      Resposta registrada! A alternativa certa aparece quando a pergunta encerrar.
                    </Text>
                  ) : null}

                  {data.state.status === 'revelada' ? (
                    <View style={styles.caixaResumo}>
                      {qAtual.minha_resposta ? (
                        <Text style={{ color: theme.colors.champagne }}>
                          {qAtual.minha_resposta.acertou
                            ? `Você acertou e ganhou +${qAtual.minha_resposta.pontos ?? 0} pontos!`
                            : 'Não foi dessa vez! Você não pontuou nesta pergunta.'}
                        </Text>
                      ) : (
                        <Text variant="muted">Você não respondeu a tempo nesta pergunta.</Text>
                      )}

                      {qAtual.respostas_reveladas.map((r) => (
                        <View key={r.user_id} style={styles.linhaPlacar}>
                          <View style={styles.linhaPessoa}>
                            <Avatar name={r.name} src={r.avatar_url} size={28} />
                            <Text>{r.name}</Text>
                            <Text variant="muted">({(r.tempo_ms / 1000).toFixed(1)}s)</Text>
                          </View>
                          <Text
                            style={{
                              color: r.acertou ? theme.colors.champagne : theme.colors.muted,
                            }}
                          >
                            {r.acertou ? `+${r.pontos} pts` : 'Errou'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <Text variant="muted">
                    {qAtual.total_respostas} resposta(s) · atualiza a cada 2 s
                  </Text>

                  {admin ? (
                    <View style={styles.blocoAdmin}>
                      <Text variant="kicker">Controle do organizador</Text>
                      {data.state.status === 'aberta' ? (
                        <Button
                          onPress={() =>
                            enviarAcao(
                              { acao: 'encerrar_pergunta' },
                              'Pergunta encerrada e resposta revelada!',
                            )
                          }
                          loading={mutacao.isPending}
                        >
                          Encerrar e revelar resposta
                        </Button>
                      ) : (
                        <View style={styles.botoesEmpilhados}>
                          {temProxima ? (
                            <Button
                              onPress={() =>
                                enviarAcao(
                                  { acao: 'abrir_pergunta', notificar: false },
                                  'Próxima pergunta aberta!',
                                )
                              }
                              loading={mutacao.isPending}
                            >
                              Abrir próxima pergunta
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            onPress={() =>
                              enviarAcao({ acao: 'mostrar_podio' }, 'Pódio final exibido!')
                            }
                            loading={mutacao.isPending}
                          >
                            Mostrar pódio final
                          </Button>
                        </View>
                      )}
                    </View>
                  ) : null}
                </Surface>
              ) : null}

              {/* PODIO FINAL */}
              {data.state.status === 'podio' ? (
                <Surface style={styles.bloco}>
                  <View style={styles.iconeDestaque}>
                    <Trophy size={26} color={theme.colors.champagne} strokeWidth={1.5} />
                  </View>
                  <Text variant="kicker" style={styles.avisoCentro}>
                    Resultado final
                  </Text>
                  <Text variant="display" style={[styles.tituloSecao, styles.avisoCentro]}>
                    Pódio da Família
                  </Text>

                  {data.placar.length === 0 ? (
                    <Text variant="muted" style={styles.avisoCentro}>
                      Ninguém pontuou nesta rodada.
                    </Text>
                  ) : (
                    <View style={styles.podioLinha}>
                      {[0, 1, 2].map((idx) => {
                        const p = data.placar[idx];
                        if (!p) return null;
                        return (
                          <View key={p.user_id} style={styles.podioCard}>
                            <Text variant="kicker">{idx + 1}º lugar</Text>
                            <Avatar name={p.name} src={p.avatar_url} size={idx === 0 ? 52 : 42} />
                            <Text numberOfLines={1} style={styles.podioNome}>
                              {p.name}
                            </Text>
                            <Text variant="numeral" style={styles.podioPontos}>
                              {p.pontos}
                            </Text>
                            <Text variant="muted">{p.acertos} acerto(s)</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {admin ? (
                    <View style={styles.botoesEmpilhados}>
                      <Button
                        variant="ghost"
                        onPress={() => enviarAcao({ acao: 'voltar_preparacao' })}
                      >
                        Voltar para preparação
                      </Button>
                      <Button
                        variant="quiet"
                        onPress={() =>
                          Alert.alert(
                            'Reiniciar Quiz?',
                            'Isso zerará o placar e deixará todas as perguntas prontas para jogar novamente.',
                            [
                              { text: 'Cancelar', style: 'cancel' },
                              {
                                text: 'Reiniciar',
                                style: 'destructive',
                                onPress: () =>
                                  enviarAcao({ acao: 'reiniciar_quiz' }, 'Quiz reiniciado!'),
                              },
                            ],
                          )
                        }
                      >
                        Zerar placar e reiniciar rodada
                      </Button>
                    </View>
                  ) : null}
                </Surface>
              ) : null}

              {/* SALA DE ESPERA QUANDO EM PREPARACAO */}
              {data.state.status === 'preparando' ? (
                <Surface style={styles.bloco}>
                  <View style={styles.linhaTopo}>
                    <View style={styles.flex}>
                      <Text variant="kicker">Ao vivo na ceia</Text>
                      <Text variant="display" style={styles.tituloSecao}>
                        Preparando a rodada
                      </Text>
                    </View>
                    <Sparkles size={22} color={theme.colors.champagne} strokeWidth={1.5} />
                  </View>
                  <Text variant="muted">
                    Quando quem organiza abrir uma pergunta, ela aparece na hora aqui. Cada pessoa tem 20 segundos para responder e ganhar pontos por acerto e rapidez!
                  </Text>
                  <View style={styles.caixaResumo}>
                    <View style={styles.linhaPlacar}>
                      <Text variant="muted">Perguntas preparadas</Text>
                      <Text variant="numeral" style={styles.podioPontos}>
                        {data.perguntas.length}
                      </Text>
                    </View>
                  </View>
                  {admin && data.perguntas.length > 0 ? (
                    <View style={styles.botoesEmpilhados}>
                      <Button
                        disabled={!temProxima}
                        loading={mutacao.isPending}
                        onPress={() =>
                          enviarAcao(
                            { acao: 'abrir_pergunta', notificar: true },
                            'Pergunta aberta ao vivo!',
                          )
                        }
                      >
                        Abrir próxima pergunta ao vivo
                      </Button>
                      {!temProxima ? (
                        <Button
                          variant="ghost"
                          onPress={() => enviarAcao({ acao: 'mostrar_podio' })}
                        >
                          Mostrar pódio final
                        </Button>
                      ) : null}
                    </View>
                  ) : null}
                </Surface>
              ) : null}

              {/* PLACAR AO VIVO */}
              <Surface style={styles.bloco}>
                <View style={styles.linhaTopo}>
                  <View style={styles.flex}>
                    <Text variant="kicker">Classificação</Text>
                    <Text variant="display" style={styles.tituloSecao}>
                      Placar ao vivo
                    </Text>
                  </View>
                  <Award size={20} color={theme.colors.champagne} strokeWidth={1.5} />
                </View>

                {data.placar.length === 0 ? (
                  <Text variant="muted">
                    A pontuação aparece assim que a primeira pergunta é encerrada.
                  </Text>
                ) : (
                  <View style={styles.listaPlacar}>
                    {data.placar.map((item, idx) => (
                      <View key={item.user_id} style={styles.linhaPlacar}>
                        <View style={styles.linhaPessoa}>
                          <Text variant="kicker" style={{ width: 24 }}>
                            {idx + 1}º
                          </Text>
                          <Avatar name={item.name} src={item.avatar_url} size={36} />
                          <View style={styles.flex}>
                            <Text numberOfLines={1}>{item.name}</Text>
                            <Text variant="muted">
                              {item.acertos} acerto(s) · {(item.tempo_medio_ms / 1000).toFixed(1)}s
                            </Text>
                          </View>
                        </View>
                        <Text variant="numeral" style={styles.podioPontos}>
                          {item.pontos}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </Surface>

              {/* GESTAO DE PERGUNTAS PELO ORGANIZADOR */}
              {admin ? (
                <View style={styles.secaoAdmin}>
                  <View style={styles.linhaTopo}>
                    <View style={styles.flex}>
                      <Text variant="kicker">Só quem organiza</Text>
                      <Text variant="display" style={styles.tituloSecao}>
                        Perguntas ({data.perguntas.length})
                      </Text>
                    </View>
                    <Button
                      variant="ghost"
                      icon={<Plus size={16} color={theme.colors.ivory} />}
                      onPress={abrirNovaPerguntaSheet}
                    >
                      Criar
                    </Button>
                  </View>

                  {data.perguntas.map((q, idx) => (
                    <Surface key={q.id} style={styles.cardPerguntaAdmin}>
                      <Text variant="kicker">
                        #{idx + 1} {q.modelo ? `· ${q.modelo}` : ''}{' '}
                        {q.encerrada ? '· Encerrada' : '· Pendente'}
                      </Text>
                      <Text style={{ fontFamily: theme.fonts.semibold }}>{q.pergunta}</Text>
                      <Text variant="muted">
                        {q.opcoes.length} alternativas · {q.total_respostas} resposta(s)
                      </Text>
                      <View style={styles.acoesItemAdmin}>
                        <Button
                          variant="ghost"
                          onPress={() =>
                            enviarAcao(
                              { acao: 'abrir_pergunta', question_id: q.id, notificar: true },
                              `Pergunta #${idx + 1} aberta!`,
                            )
                          }
                        >
                          Abrir agora
                        </Button>
                        <Button
                          variant="quiet"
                          icon={<Pencil size={15} color={theme.colors.ivory} />}
                          onPress={() => abrirEdicaoSheet(q)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="quiet"
                          icon={<Trash2 size={15} color={theme.colors.error} />}
                          onPress={() =>
                            Alert.alert('Excluir pergunta?', q.pergunta, [
                              { text: 'Cancelar', style: 'cancel' },
                              {
                                text: 'Excluir',
                                style: 'destructive',
                                onPress: () =>
                                  enviarAcao(
                                    { acao: 'excluir_pergunta', id: q.id },
                                    'Pergunta excluída.',
                                  ),
                              },
                            ])
                          }
                        >
                          Excluir
                        </Button>
                      </View>
                    </Surface>
                  ))}
                </View>
              ) : null}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* SHEET DE CRIAR / EDITAR PERGUNTA */}
      <Sheet
        visible={sheetAberta}
        onClose={() => setSheetAberta(false)}
        title={editId ? 'Editar pergunta' : 'Nova pergunta'}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.sheetConteudo}
        >
          <Text variant="kicker">Modelos prontos</Text>
          <View style={styles.modelosWrap}>
            {[...(data?.modelos ?? []), 'Pergunta livre'].map((m) => {
              const val = m === 'Pergunta livre' ? '' : m;
              return (
                <Button
                  key={m}
                  variant={modelo === val ? 'primary' : 'ghost'}
                  onPress={() => {
                    setModelo(val);
                    if (!pergunta.trim() && val) setPergunta(val);
                  }}
                >
                  {m}
                </Button>
              );
            })}
          </View>

          <Field
            label="Pergunta"
            placeholder="Ex.: Quem dormiu no sofá na ceia passada?"
            value={pergunta}
            onChangeText={setPergunta}
            maxLength={300}
          />

          <Text variant="muted">Foto opcional</Text>
          {imageUrl ? (
            <View style={styles.previewFotoBox}>
              <Image
                source={{ uri: imageUrl }}
                style={styles.previewFoto}
                contentFit="contain"
              />
              <Button
                variant="quiet"
                icon={<X size={16} color={theme.colors.ivory} />}
                onPress={() => setImageUrl(null)}
              >
                Remover foto
              </Button>
            </View>
          ) : (
            <View style={styles.linhaFotoBtns}>
              <Button
                variant="ghost"
                style={styles.flex}
                loading={subindoFoto}
                icon={<ImagePlus size={16} color={theme.colors.ivory} />}
                onPress={() => {
                  void escolherEEnviarFoto('galeria');
                }}
              >
                Galeria
              </Button>
              <Button
                variant="ghost"
                style={styles.flex}
                loading={subindoFoto}
                icon={<Camera size={16} color={theme.colors.ivory} />}
                onPress={() => {
                  void escolherEEnviarFoto('camera');
                }}
              >
                Câmera
              </Button>
            </View>
          )}

          <Text variant="kicker">Alternativas (toque na letra para marcar a certa)</Text>
          {opcoes.map((op, idx) => (
            <View key={idx} style={styles.linhaAlternativaForm}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Marcar alternativa ${LETRAS[idx]} como certa`}
                onPress={() => setCorreta(idx)}
                style={[
                  styles.seletorCorreta,
                  correta === idx && styles.seletorCorretaAtivo,
                ]}
              >
                <Text style={{ fontFamily: theme.fonts.semibold }}>
                  {correta === idx ? '✓' : LETRAS[idx]}
                </Text>
              </Pressable>
              <View style={styles.flex}>
                <Field
                  label={`Alternativa ${LETRAS[idx]}`}
                  placeholder={`Texto da opção ${LETRAS[idx]}`}
                  value={op}
                  onChangeText={(txt) =>
                    setOpcoes((xs) => xs.map((item, i) => (i === idx ? txt : item)))
                  }
                  maxLength={120}
                />
              </View>
            </View>
          ))}

          <Button loading={mutacao.isPending} onPress={salvarPergunta}>
            {editId ? 'Salvar alterações' : 'Adicionar pergunta'}
          </Button>
        </ScrollView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1, minWidth: 0 },
  miolo: { paddingBottom: 48, gap: 18 },
  abas: { paddingHorizontal: 24, gap: 8 },
  corpo: { paddingHorizontal: 24, gap: 20 },
  bloco: { gap: 16 },
  linhaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  badgeTempo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.cherry,
    backgroundColor: 'rgba(197,41,45,0.2)',
  },
  textoTempo: { fontSize: 18, lineHeight: 24, color: theme.colors.ivory },
  badgeRevelada: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.champagne,
  },
  trilhaTempo: {
    height: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.field,
    overflow: 'hidden',
  },
  barraTempo: { height: '100%', backgroundColor: theme.colors.cherry },
  tituloPergunta: { fontSize: 26, lineHeight: 34 },
  tituloSecao: { fontSize: 24, lineHeight: 32 },
  fotoPergunta: { width: '100%', height: 220, borderRadius: 14, backgroundColor: theme.colors.field },
  listaOpcoes: { gap: 10 },
  opcaoBtn: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.lineStrong,
    backgroundColor: theme.colors.field,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  opcaoEscolhida: { borderColor: theme.colors.champagne },
  opcaoCorreta: {
    borderColor: theme.colors.champagne,
    backgroundColor: 'rgba(96,117,104,0.35)',
  },
  opcaoErrada: {
    borderColor: theme.colors.cherry,
    backgroundColor: 'rgba(197,41,45,0.22)',
  },
  letraCirculo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letraTexto: { fontSize: 15, lineHeight: 20, color: theme.colors.champagne },
  avisoCentro: { textAlign: 'center' },
  caixaResumo: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.field,
    padding: 14,
    gap: 10,
  },
  blocoAdmin: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.line,
    paddingTop: 14,
    gap: 10,
  },
  botoesEmpilhados: { gap: 10 },
  iconeDestaque: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.field,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  podioLinha: { flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  podioCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.lineStrong,
    backgroundColor: theme.colors.field,
  },
  podioNome: { fontFamily: theme.fonts.semibold, fontSize: 13 },
  podioPontos: { fontSize: 22, lineHeight: 28, color: theme.colors.champagne },
  listaPlacar: { gap: 12 },
  linhaPlacar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  linhaPessoa: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  secaoAdmin: { gap: 14 },
  cardPerguntaAdmin: { gap: 8 },
  acoesItemAdmin: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  sheetConteudo: { gap: 14, paddingBottom: 28 },
  modelosWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewFotoBox: { gap: 8 },
  previewFoto: { width: '100%', height: 160, borderRadius: 14, backgroundColor: theme.colors.field },
  linhaFotoBtns: { flexDirection: 'row', gap: 10 },
  linhaAlternativaForm: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  seletorCorreta: {
    width: 48,
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.lineStrong,
    backgroundColor: theme.colors.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seletorCorretaAtivo: {
    borderColor: theme.colors.champagne,
    backgroundColor: theme.colors.cherry,
  },
});
