import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useMutation, useQuery } from '@tanstack/react-query';
import ChartColumn from 'lucide-react-native/icons/chart-column';
import Check from 'lucide-react-native/icons/check';
import Lock from 'lucide-react-native/icons/lock';
import Plus from 'lucide-react-native/icons/plus';
import Trash2 from 'lucide-react-native/icons/trash-2';
import Trophy from 'lucide-react-native/icons/trophy';
import Tv from 'lucide-react-native/icons/tv';
import X from 'lucide-react-native/icons/x';
import { api, ApiError, queryClient, sessionStore } from '../../../api';
import { useSession } from '../../../session';
import { theme } from '../../../theme';
import { Button } from '../../../ui/Button';
import { EmptyState } from '../../../ui/EmptyState';
import { Field } from '../../../ui/Field';
import { useReduceMotion } from '../../../ui/motion';
import { Sheet } from '../../../ui/Sheet';
import { Skeleton } from '../../../ui/Skeleton';
import { Surface } from '../../../ui/Surface';
import { Text } from '../../../ui/Text';
import { useToast } from '../../../ui/Toast';
import { Cabecalho } from '../../familia/Cabecalho';
import { sessaoVigente, useAutenticado } from '../../familia/sessao';

export const enqueteKeys = {
  dados: ['festa', 'enquete'] as const,
};

interface LivePollOptionStat {
  index: number;
  texto: string;
  votos: number;
  percentual: number;
  vencedora: boolean;
}

interface LivePollItem {
  id: number;
  pergunta: string;
  aberta: boolean;
  encerrada_em: string | null;
  created_at: string;
  total_votos: number;
  meu_voto: number | null;
  opcoes: LivePollOptionStat[];
}

interface EnqueteData {
  ano: number;
  enquete_destaque: LivePollItem | null;
  enquetes: LivePollItem[];
}

const SUGESTOES_RAPIDAS: readonly { pergunta: string; opcoes: readonly string[] }[] = [
  {
    pergunta: 'Qual prato salgado está ganhando a noite?',
    opcoes: ['Peru ou Chester', 'Pernil assado', 'Salpicão', 'Farofa caprichada'],
  },
  {
    pergunta: 'Na sobremesa da família, quem leva o troféu?',
    opcoes: ['Rabanada quentinha', 'Pavê tradicional', 'Pudim de leite', 'Panetone ou Chocotone'],
  },
  {
    pergunta: 'Que horas devemos abrir os presentes do Amigo Oculto?',
    opcoes: ['Agora mesmo!', 'Logo antes da ceia', 'Depois da ceia', 'À meia-noite em ponto'],
  },
];

function BarraAnimada({
  percentual,
  vencedora,
  grande,
}: {
  percentual: number;
  vencedora: boolean;
  grande?: boolean;
}) {
  const reduced = useReduceMotion();
  const largura = useSharedValue(percentual);

  useEffect(() => {
    largura.set(
      reduced ? percentual : withTiming(percentual, { duration: 480 }),
    );
  }, [largura, percentual, reduced]);

  const estiloAnimado = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(100, largura.get()))}%`,
  }));

  return (
    <View style={[styles.trilhaBarra, grande && styles.trilhaBarraGrande]}>
      <Animated.View
        style={[
          styles.preenchimentoBarra,
          vencedora && styles.preenchimentoVencedor,
          estiloAnimado,
        ]}
      />
    </View>
  );
}

export default function FestaEnqueteScreen() {
  const ok = useAutenticado();
  const { user } = useSession();
  const toast = useToast();
  const params = useLocalSearchParams<{ tv?: string }>();
  const admin = Boolean(user?.is_admin);

  const [modoTv, setModoTv] = useState(params.tv === '1');
  const [sheetNova, setSheetNova] = useState(false);
  const [pergunta, setPergunta] = useState('');
  const [opcoes, setOpcoes] = useState<string[]>(['', '', '']);

  const consulta = useQuery({
    queryKey: enqueteKeys.dados,
    enabled: ok,
    refetchInterval: 2000,
    queryFn: ({ signal }) => api<EnqueteData>('/api/festa/enquete', { signal }),
  });

  const mutacao = useMutation({
    mutationFn: (vars: { payload: Record<string, unknown>; msg?: string; generation: number }) => {
      if (!sessaoVigente(vars.generation)) {
        throw new ApiError('A sessão mudou. Tente novamente.', 401);
      }
      return api<EnqueteData>('/api/festa/enquete', { method: 'POST', json: vars.payload });
    },
    onSuccess: (novo, vars) => {
      if (!sessaoVigente(vars.generation)) return;
      queryClient.setQueryData(enqueteKeys.dados, novo);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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

  function lancarEnquete() {
    if (mutacao.isPending) return;
    const limpas = opcoes.map((o) => o.trim()).filter(Boolean);
    if (!pergunta.trim()) {
      toast('Digite a pergunta da enquete.', 'error');
      return;
    }
    if (limpas.length < 2) {
      toast('Preencha pelo menos 2 opções.', 'error');
      return;
    }
    mutacao.mutate(
      {
        payload: { acao: 'criar', pergunta: pergunta.trim(), opcoes: limpas },
        msg: 'Enquete lançada ao vivo!',
        generation: sessionStore.getGeneration(),
      },
      {
        onSuccess: () => {
          setPergunta('');
          setOpcoes(['', '', '']);
          setSheetNova(false);
        },
      },
    );
  }

  const data = consulta.data;
  const destaque = data?.enquete_destaque ?? null;

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
          <Cabecalho
            kicker="Jogos da Ceia"
            titulo="Enquete"
            italico="ao Vivo"
            aoVoltar={voltar}
            extra={
              <Button
                variant={modoTv ? 'primary' : 'ghost'}
                icon={<Tv size={16} color={theme.colors.ivory} />}
                onPress={() => setModoTv((v) => !v)}
              >
                {modoTv ? 'Normal' : 'TV'}
              </Button>
            }
          />

          {!modoTv ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.abas}
            >
              <Button variant="ghost" onPress={() => router.replace('/festa-quiz')}>
                Quiz da Família
              </Button>
              <Button variant="ghost" onPress={() => router.replace('/festa-bingo')}>
                Bingo da Ceia
              </Button>
              <Button variant="primary" onPress={() => {}}>
                Enquete ao Vivo
              </Button>
            </ScrollView>
          ) : null}

          {consulta.isPending ? (
            <View style={styles.corpo}>
              <Skeleton style={{ height: 220 }} />
              <Skeleton style={{ height: 140 }} />
            </View>
          ) : consulta.isError || !data ? (
            <View style={styles.corpo}>
              <EmptyState
                title="Não foi possível carregar as enquetes"
                message={consulta.error?.message ?? 'Confira sua internet e tente novamente.'}
                action="Tentar novamente"
                onAction={() => {
                  void consulta.refetch();
                }}
              />
            </View>
          ) : (
            <View style={styles.corpo}>
              {admin && !modoTv ? (
                <Button
                  icon={<Plus size={16} color={theme.colors.ivory} />}
                  onPress={() => setSheetNova(true)}
                >
                  Lançar nova enquete rápida
                </Button>
              ) : null}

              {!destaque ? (
                <Surface style={styles.blocoVazio}>
                  <ChartColumn size={28} color={theme.colors.champagne} strokeWidth={1.5} />
                  <Text variant="display" style={styles.centro}>
                    Nenhuma enquete lançada ainda
                  </Text>
                  <Text variant="muted" style={styles.centro}>
                    Assim que quem organiza lançar uma pergunta rápida, todos votam e o resultado atualiza a cada 2 segundos!
                  </Text>
                </Surface>
              ) : (
                <CartaoEnquete
                  poll={destaque}
                  modoTv={modoTv}
                  admin={admin}
                  busy={mutacao.isPending}
                  onVotar={(idx) =>
                    enviarAcao({ acao: 'votar', poll_id: destaque.id, opcao_index: idx })
                  }
                  onEncerrar={() =>
                    enviarAcao(
                      { acao: 'encerrar', poll_id: destaque.id },
                      'Enquete encerrada! Vencedor revelado.',
                    )
                  }
                  onReabrir={() =>
                    enviarAcao({ acao: 'reabrir', poll_id: destaque.id }, 'Enquete reaberta!')
                  }
                  onExcluir={() =>
                    Alert.alert('Excluir enquete?', destaque.pergunta, [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Excluir',
                        style: 'destructive',
                        onPress: () =>
                          enviarAcao({ acao: 'excluir', poll_id: destaque.id }, 'Enquete excluída.'),
                      },
                    ])
                  }
                />
              )}

              {/* HISTORICO DE ENQUETES ANTERIORES */}
              {!modoTv && data.enquetes.length > 1 ? (
                <View style={styles.historicoWrap}>
                  <Text variant="kicker">Histórico da noite</Text>
                  <Text variant="display" style={styles.tituloSecao}>
                    Enquetes anteriores
                  </Text>
                  {data.enquetes
                    .filter((e) => e.id !== destaque?.id)
                    .map((poll) => (
                      <CartaoEnquete
                        key={poll.id}
                        poll={poll}
                        modoTv={false}
                        admin={admin}
                        busy={mutacao.isPending}
                        onVotar={(idx) =>
                          enviarAcao({ acao: 'votar', poll_id: poll.id, opcao_index: idx })
                        }
                        onEncerrar={() =>
                          enviarAcao({ acao: 'encerrar', poll_id: poll.id }, 'Enquete encerrada!')
                        }
                        onReabrir={() =>
                          enviarAcao({ acao: 'reabrir', poll_id: poll.id }, 'Enquete reaberta!')
                        }
                        onExcluir={() =>
                          Alert.alert('Excluir enquete?', poll.pergunta, [
                            { text: 'Cancelar', style: 'cancel' },
                            {
                              text: 'Excluir',
                              style: 'destructive',
                              onPress: () =>
                                enviarAcao(
                                  { acao: 'excluir', poll_id: poll.id },
                                  'Enquete excluída.',
                                ),
                            },
                          ])
                        }
                      />
                    ))}
                </View>
              ) : null}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* SHEET DO ORGANIZADOR PARA CRIAR ENQUETE */}
      <Sheet
        visible={sheetNova}
        onClose={() => setSheetNova(false)}
        title="Lançar enquete"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.sheetConteudo}
        >
          <Text variant="kicker">Sugestões rápidas</Text>
          {SUGESTOES_RAPIDAS.map((s, idx) => (
            <Pressable
              key={idx}
              accessibilityRole="button"
              onPress={() => {
                setPergunta(s.pergunta);
                setOpcoes([...s.opcoes]);
              }}
              style={styles.sugestaoBtn}
            >
              <Text style={styles.sugestaoTexto}>{s.pergunta}</Text>
            </Pressable>
          ))}

          <Field
            label="Pergunta rápida"
            placeholder="Ex.: É pavê ou pacomê?"
            value={pergunta}
            onChangeText={setPergunta}
            maxLength={240}
          />

          <View style={styles.linhaTopo}>
            <Text variant="kicker">Opções (2 a 6)</Text>
            {opcoes.length < 6 ? (
              <Button
                variant="quiet"
                onPress={() => setOpcoes((xs) => [...xs, ''])}
              >
                + Opção
              </Button>
            ) : null}
          </View>

          {opcoes.map((op, idx) => (
            <View key={idx} style={styles.linhaOpcaoForm}>
              <View style={styles.flex}>
                <Field
                  label={`Opção ${idx + 1}`}
                  placeholder={`Texto da opção ${idx + 1}`}
                  value={op}
                  onChangeText={(txt) =>
                    setOpcoes((xs) => xs.map((item, i) => (i === idx ? txt : item)))
                  }
                  maxLength={100}
                />
              </View>
              {opcoes.length > 2 ? (
                <Button
                  variant="quiet"
                  icon={<X size={16} color={theme.colors.ivory} />}
                  onPress={() => setOpcoes((xs) => xs.filter((_, i) => i !== idx))}
                >
                  {' '}
                </Button>
              ) : null}
            </View>
          ))}

          <Button loading={mutacao.isPending} onPress={lancarEnquete}>
            Lançar ao vivo
          </Button>
        </ScrollView>
      </Sheet>
    </View>
  );
}

function CartaoEnquete({
  poll,
  modoTv,
  admin,
  busy,
  onVotar,
  onEncerrar,
  onReabrir,
  onExcluir,
}: {
  poll: LivePollItem;
  modoTv: boolean;
  admin: boolean;
  busy: boolean;
  onVotar: (idx: number) => void;
  onEncerrar: () => void;
  onReabrir: () => void;
  onExcluir: () => void;
}) {
  return (
    <Surface style={styles.cartao}>
      <View style={styles.linhaTopo}>
        <Text variant="kicker">
          {poll.aberta ? 'Ao vivo · Pode trocar o voto' : 'Encerrada · Resultado final'}
        </Text>
        <Text variant="numeral" style={[styles.totalVotos, modoTv && styles.totalVotosTv]}>
          {poll.total_votos} {poll.total_votos === 1 ? 'voto' : 'votos'}
        </Text>
      </View>

      <Text variant="display" style={modoTv ? styles.perguntaTv : styles.perguntaNormal}>
        {poll.pergunta}
      </Text>

      <View style={styles.listaOpcoes}>
        {poll.opcoes.map((op) => {
          const voteiNesta = poll.meu_voto === op.index;
          return (
            <Pressable
              key={op.index}
              accessibilityRole="button"
              accessibilityLabel={`${op.texto}: ${op.percentual} por cento, ${op.votos} votos`}
              disabled={!poll.aberta || busy}
              onPress={() => onVotar(op.index)}
              style={[
                styles.opcaoCard,
                voteiNesta && styles.opcaoVotada,
                op.vencedora && styles.opcaoVencedora,
              ]}
            >
              <View style={styles.linhaTopo}>
                <View style={styles.linhaOpcaoTitulo}>
                  {op.vencedora ? (
                    <Trophy size={18} color={theme.colors.champagne} strokeWidth={1.8} />
                  ) : voteiNesta ? (
                    <Check size={16} color={theme.colors.champagne} strokeWidth={2} />
                  ) : null}
                  <Text
                    style={[
                      styles.flex,
                      styles.textoOpcao,
                      modoTv && styles.textoOpcaoTv,
                    ]}
                  >
                    {op.texto}
                  </Text>
                </View>
                <Text
                  variant="numeral"
                  style={[styles.percentualTexto, modoTv && styles.percentualTv]}
                >
                  {op.percentual}% ({op.votos})
                </Text>
              </View>

              <BarraAnimada
                percentual={Math.max(op.percentual, op.votos > 0 ? 4 : 0)}
                vencedora={op.vencedora}
                grande={modoTv}
              />
            </Pressable>
          );
        })}
      </View>

      {!poll.aberta && poll.total_votos > 0 ? (
        <View style={styles.vencedorBox}>
          <Trophy size={16} color={theme.colors.champagne} strokeWidth={1.6} />
          <Text style={{ color: theme.colors.champagne, flex: 1 }}>
            Vencedor:{' '}
            {poll.opcoes
              .filter((o) => o.vencedora)
              .map((o) => o.texto)
              .join(' / ')}
          </Text>
        </View>
      ) : null}

      {admin && !modoTv ? (
        <View style={styles.acoesAdmin}>
          {poll.aberta ? (
            <Button
              style={styles.flex}
              disabled={busy}
              icon={<Lock size={15} color={theme.colors.ivory} />}
              onPress={onEncerrar}
            >
              Encerrar e mostrar vencedor
            </Button>
          ) : (
            <Button
              style={styles.flex}
              variant="ghost"
              disabled={busy}
              onPress={onReabrir}
            >
              Reabrir votação
            </Button>
          )}
          <Button
            variant="quiet"
            disabled={busy}
            icon={<Trash2 size={16} color={theme.colors.error} />}
            onPress={onExcluir}
          >
            {' '}
          </Button>
        </View>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1, minWidth: 0 },
  miolo: { paddingBottom: 48, gap: 18 },
  abas: { paddingHorizontal: 24, gap: 8 },
  corpo: { paddingHorizontal: 24, gap: 20 },
  blocoVazio: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  centro: { textAlign: 'center' },
  cartao: { gap: 16 },
  linhaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  totalVotos: { fontSize: 18, lineHeight: 24, color: theme.colors.champagne },
  totalVotosTv: { fontSize: 28, lineHeight: 36 },
  perguntaNormal: { fontSize: 26, lineHeight: 34 },
  perguntaTv: { fontSize: 36, lineHeight: 46 },
  listaOpcoes: { gap: 12 },
  opcaoCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.lineStrong,
    backgroundColor: theme.colors.field,
    padding: 14,
    gap: 10,
  },
  opcaoVotada: { borderColor: theme.colors.champagne },
  opcaoVencedora: {
    borderColor: theme.colors.champagne,
    backgroundColor: 'rgba(96,117,104,0.34)',
  },
  linhaOpcaoTitulo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  textoOpcao: { fontFamily: theme.fonts.semibold, fontSize: 15 },
  textoOpcaoTv: { fontSize: 22, lineHeight: 30 },
  percentualTexto: { fontSize: 18, lineHeight: 24, color: theme.colors.champagne },
  percentualTv: { fontSize: 26, lineHeight: 34 },
  trilhaBarra: {
    height: 10,
    borderRadius: 999,
    backgroundColor: theme.colors.background,
    overflow: 'hidden',
  },
  trilhaBarraGrande: { height: 18 },
  preenchimentoBarra: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: theme.colors.cherry,
  },
  preenchimentoVencedor: { backgroundColor: theme.colors.champagne },
  vencedorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: theme.colors.field,
  },
  acoesAdmin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.line,
    paddingTop: 12,
  },
  historicoWrap: { gap: 14 },
  tituloSecao: { fontSize: 24, lineHeight: 32 },
  sheetConteudo: { gap: 12, paddingBottom: 28 },
  sugestaoBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.lineStrong,
    backgroundColor: theme.colors.field,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sugestaoTexto: { fontSize: 13, color: theme.colors.secondary },
  linhaOpcaoForm: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
});
