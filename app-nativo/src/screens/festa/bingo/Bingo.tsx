import { useMemo, useState } from 'react';
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
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery } from '@tanstack/react-query';
import Bell from 'lucide-react-native/icons/bell';
import Check from 'lucide-react-native/icons/check';
import Dices from 'lucide-react-native/icons/dices';
import Pencil from 'lucide-react-native/icons/pencil';
import Plus from 'lucide-react-native/icons/plus';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Star from 'lucide-react-native/icons/star';
import Trash2 from 'lucide-react-native/icons/trash';
import Trophy from 'lucide-react-native/icons/trophy';
import { api, ApiError, queryClient, sessionStore } from '../../../api';
import { useSession } from '../../../session';
import { theme } from '../../../theme';
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

export const bingoKeys = {
  dados: ['festa', 'bingo'] as const,
};

interface BingoCasa {
  posicao: number;
  item_id: number | null;
  texto: string;
  livre: boolean;
}

interface BingoItemRow {
  id: number;
  texto: string;
  ativo: boolean;
}

interface BingoClaimItem {
  id: number;
  user_id: number;
  user_name: string;
  avatar_url: string | null;
  padrao: string;
  posicoes: number[];
  frases: string[];
  status: 'pendente' | 'confirmado' | 'rejeitado';
  confirmed_by_name: string | null;
  created_at: string;
}

interface BingoParticipanteProgresso {
  user_id: number;
  name: string;
  avatar_url: string | null;
  marcadas: number;
  tem_bingo: boolean;
}

interface BingoData {
  ano: number;
  cartela: {
    id: number;
    casas: BingoCasa[];
    marcadas: number[];
    padroes_completos: { nome: string; posicoes: number[] }[];
    ja_gritou: boolean;
  };
  claims: BingoClaimItem[];
  participantes: BingoParticipanteProgresso[];
  itens: BingoItemRow[];
}

export default function FestaBingoScreen() {
  const ok = useAutenticado();
  const { user } = useSession();
  const toast = useToast();
  const admin = Boolean(user?.is_admin);

  const [casaFocada, setCasaFocada] = useState<BingoCasa | null>(null);
  const [sheetItens, setSheetItens] = useState(false);
  const [novoTexto, setNovoTexto] = useState('');
  const [editItem, setEditItem] = useState<BingoItemRow | null>(null);

  const consulta = useQuery({
    queryKey: bingoKeys.dados,
    enabled: ok,
    refetchInterval: 3500,
    queryFn: ({ signal }) => api<BingoData>('/api/festa/bingo', { signal }),
  });

  const data = consulta.data;

  const marcadasSet = useMemo(
    () => new Set(data?.cartela.marcadas ?? [12]),
    [data?.cartela.marcadas],
  );

  const posicoesEmBingo = useMemo(() => {
    const s = new Set<number>();
    for (const p of data?.cartela.padroes_completos ?? []) {
      for (const pos of p.posicoes) s.add(pos);
    }
    return s;
  }, [data?.cartela.padroes_completos]);

  const linhasCartela = useMemo(() => {
    const casas = data?.cartela.casas ?? [];
    const linhas: BingoCasa[][] = [];
    for (let r = 0; r < 5; r++) {
      linhas.push(casas.slice(r * 5, r * 5 + 5));
    }
    return linhas;
  }, [data?.cartela.casas]);

  const mutacao = useMutation({
    mutationFn: (vars: { payload: Record<string, unknown>; msg?: string; generation: number }) => {
      if (!sessaoVigente(vars.generation)) {
        throw new ApiError('A sessão mudou. Tente novamente.', 401);
      }
      return api<BingoData>('/api/festa/bingo', { method: 'POST', json: vars.payload });
    },
    onSuccess: (novo, vars) => {
      if (!sessaoVigente(vars.generation)) return;
      queryClient.setQueryData(bingoKeys.dados, novo);
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

  function tocarCasa(casa: BingoCasa) {
    setCasaFocada(casa);
    if (casa.livre || mutacao.isPending) return;
    enviarAcao({ acao: 'alternar_casa', posicao: casa.posicao });
  }

  function adicionarOuEditarItem() {
    if (mutacao.isPending) return;
    if (editItem) {
      if (!editItem.texto.trim()) return;
      mutacao.mutate(
        {
          payload: {
            acao: 'editar_item',
            id: editItem.id,
            texto: editItem.texto.trim(),
            ativo: editItem.ativo,
          },
          msg: 'Situação atualizada!',
          generation: sessionStore.getGeneration(),
        },
        { onSuccess: () => setEditItem(null) },
      );
      return;
    }
    if (!novoTexto.trim()) return;
    mutacao.mutate(
      {
        payload: { acao: 'adicionar_item', texto: novoTexto.trim() },
        msg: 'Situação adicionada!',
        generation: sessionStore.getGeneration(),
      },
      { onSuccess: () => setNovoTexto('') },
    );
  }

  const temLinhaCompleta = (data?.cartela.padroes_completos.length ?? 0) > 0;

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
          <Cabecalho kicker="Jogos da Ceia" titulo="Bingo da" italico="Ceia" aoVoltar={voltar} />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.abas}
          >
            <Button variant="ghost" onPress={() => router.replace('/festa-quiz')}>
              Quiz da Família
            </Button>
            <Button variant="primary" onPress={() => {}}>
              Bingo da Ceia
            </Button>
            <Button variant="ghost" onPress={() => router.replace('/festa-enquete')}>
              Enquete ao Vivo
            </Button>
          </ScrollView>

          {consulta.isPending ? (
            <View style={styles.corpo}>
              <Skeleton style={{ height: 340 }} />
              <Skeleton style={{ height: 140 }} />
            </View>
          ) : consulta.isError || !data ? (
            <View style={styles.corpo}>
              <EmptyState
                title="Não foi possível carregar o Bingo"
                message={consulta.error?.message ?? 'Confira sua internet e tente novamente.'}
                action="Tentar novamente"
                onAction={() => {
                  void consulta.refetch();
                }}
              />
            </View>
          ) : (
            <View style={styles.corpo}>
              {/* AVISO DE LINHA COMPLETA E BOTAO DE GRITAR BINGO */}
              {temLinhaCompleta ? (
                <Surface style={styles.bannerBingo}>
                  <View style={styles.iconeCirculo}>
                    <Sparkles size={22} color={theme.colors.champagne} strokeWidth={1.6} />
                  </View>
                  <Text variant="kicker" style={styles.centro}>
                    Linha completa na cartela!
                  </Text>
                  <Text variant="display" style={[styles.tituloSecao, styles.centro]}>
                    {data.cartela.padroes_completos.map((p) => p.nome).join(' · ')}
                  </Text>
                  {data.cartela.ja_gritou ? (
                    <Text style={{ color: theme.colors.champagne, textAlign: 'center' }}>
                      Você já gritou Bingo! Confira a validação abaixo.
                    </Text>
                  ) : (
                    <Button
                      loading={mutacao.isPending}
                      icon={<Bell size={18} color={theme.colors.ivory} />}
                      onPress={() =>
                        enviarAcao(
                          { acao: 'gritar_bingo' },
                          'BINGO! A família inteira foi avisada!',
                        )
                      }
                    >
                      Gritar BINGO!
                    </Button>
                  )}
                </Surface>
              ) : null}

              {/* CARTELA 5X5 */}
              <Surface style={styles.blocoCartela}>
                <View style={styles.linhaTopo}>
                  <View style={styles.flex}>
                    <Text variant="kicker">Sua cartela 5x5 ({data.ano})</Text>
                    <Text variant="muted">
                      Toque quando acontecer ({data.cartela.marcadas.length}/25)
                    </Text>
                  </View>
                  <Button
                    variant="quiet"
                    icon={<Dices size={16} color={theme.colors.champagne} />}
                    onPress={() =>
                      Alert.alert(
                        'Sortear nova cartela?',
                        'Isso sorteará outras 24 situações e limpará as marcações atuais.',
                        [
                          { text: 'Cancelar', style: 'cancel' },
                          {
                            text: 'Sortear nova',
                            onPress: () =>
                              enviarAcao({ acao: 'nova_cartela' }, 'Nova cartela sorteada!'),
                          },
                        ],
                      )
                    }
                  >
                    Nova
                  </Button>
                </View>

                <View style={styles.cabecalhoLetras}>
                  {['B', 'I', 'N', 'G', 'O'].map((l) => (
                    <View key={l} style={styles.colunaLetra}>
                      <Text variant="display" style={styles.letraBingo}>
                        {l}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={styles.grade}>
                  {linhasCartela.map((linha, rIdx) => (
                    <View key={rIdx} style={styles.linhaGrade}>
                      {linha.map((casa) => {
                        const marcada = casa.livre || marcadasSet.has(casa.posicao);
                        const emBingo = posicoesEmBingo.has(casa.posicao);

                        return (
                          <Pressable
                            key={casa.posicao}
                            accessibilityRole="button"
                            accessibilityLabel={`Casa ${casa.posicao + 1}: ${casa.texto}`}
                            accessibilityState={{ selected: marcada }}
                            onPress={() => tocarCasa(casa)}
                            style={[
                              styles.casa,
                              marcada && styles.casaMarcada,
                              emBingo && styles.casaBingo,
                            ]}
                          >
                            {casa.livre ? (
                              <>
                                <Star size={16} color={theme.colors.champagne} strokeWidth={1.8} />
                                <Text variant="kicker" style={styles.textoLivre}>
                                  Livre
                                </Text>
                              </>
                            ) : (
                              <>
                                <Text numberOfLines={3} style={styles.textoCasa}>
                                  {casa.texto}
                                </Text>
                                {marcada ? (
                                  <View style={styles.seloCheck}>
                                    <Check
                                      size={10}
                                      color={theme.colors.champagne}
                                      strokeWidth={2.5}
                                    />
                                  </View>
                                ) : null}
                              </>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>

                {casaFocada ? (
                  <View style={styles.detalheCasa}>
                    <Text variant="kicker">
                      Casa #{casaFocada.posicao + 1}{' '}
                      {marcadasSet.has(casaFocada.posicao) ? '· Marcada' : '· Não marcada'}
                    </Text>
                    <Text>{casaFocada.texto}</Text>
                  </View>
                ) : null}
              </Surface>

              {/* QUEM GRITOU BINGO */}
              {data.claims.length > 0 ? (
                <Surface style={styles.bloco}>
                  <View style={styles.linhaTopo}>
                    <View style={styles.flex}>
                      <Text variant="kicker">Gritos na roda</Text>
                      <Text variant="display" style={styles.tituloSecao}>
                        Quem gritou Bingo!
                      </Text>
                    </View>
                    <Trophy size={20} color={theme.colors.champagne} strokeWidth={1.5} />
                  </View>

                  {data.claims.map((c) => (
                    <View
                      key={c.id}
                      style={[
                        styles.claimCard,
                        c.status === 'confirmado' && styles.claimConfirmado,
                      ]}
                    >
                      <View style={styles.linhaTopo}>
                        <View style={styles.linhaPessoa}>
                          <Avatar name={c.user_name} src={c.avatar_url} size={36} />
                          <View style={styles.flex}>
                            <Text style={{ fontFamily: theme.fonts.semibold }}>{c.user_name}</Text>
                            <Text style={{ color: theme.colors.champagne, fontSize: 12 }}>
                              {c.padrao}
                            </Text>
                          </View>
                        </View>
                        <Text variant="kicker">
                          {c.status === 'confirmado'
                            ? 'Confirmado'
                            : c.status === 'pendente'
                              ? 'Aguardando'
                              : 'Descartado'}
                        </Text>
                      </View>

                      <View style={styles.frasesLista}>
                        {c.frases.map((f, idx) => (
                          <Text key={idx} variant="muted">
                            • {f}
                          </Text>
                        ))}
                      </View>

                      {admin && c.status === 'pendente' ? (
                        <View style={styles.acoesClaim}>
                          <Button
                            style={styles.flex}
                            loading={mutacao.isPending}
                            onPress={() =>
                              enviarAcao(
                                {
                                  acao: 'confirmar_bingo',
                                  claim_id: c.id,
                                  decisao: 'confirmado',
                                },
                                'Bingo confirmado!',
                              )
                            }
                          >
                            Confirmar Bingo
                          </Button>
                          <Button
                            variant="ghost"
                            loading={mutacao.isPending}
                            onPress={() =>
                              enviarAcao(
                                {
                                  acao: 'confirmar_bingo',
                                  claim_id: c.id,
                                  decisao: 'rejeitado',
                                },
                                'Pedido descartado.',
                              )
                            }
                          >
                            Descartar
                          </Button>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </Surface>
              ) : null}

              {/* CARTELAS DA FAMILIA */}
              <Surface style={styles.bloco}>
                <Text variant="kicker">Acompanhamento</Text>
                <Text variant="display" style={styles.tituloSecao}>
                  Cartelas da família
                </Text>
                {data.participantes.map((p) => (
                  <View key={p.user_id} style={styles.linhaTopo}>
                    <View style={styles.linhaPessoa}>
                      <Avatar name={p.name} src={p.avatar_url} size={34} />
                      <View style={styles.flex}>
                        <Text numberOfLines={1}>{p.name}</Text>
                        {p.tem_bingo ? (
                          <Text style={{ color: theme.colors.champagne, fontSize: 12 }}>
                            Gritou Bingo!
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <Text variant="numeral" style={styles.contadorNum}>
                      {p.marcadas}/25
                    </Text>
                  </View>
                ))}
              </Surface>

              {/* BOTAO DO ORGANIZADOR PARA EDITAR LISTA DE 40+ ITENS */}
              {admin ? (
                <Surface style={styles.bloco}>
                  <Text variant="kicker">Só quem organiza</Text>
                  <Text variant="display" style={styles.tituloSecao}>
                    Lista da ceia ({data.itens.length} itens)
                  </Text>
                  <Text variant="muted">
                    Adicione ou edite as situações divertidas que entram no sorteio das cartelas.
                  </Text>
                  <Button
                    variant="ghost"
                    icon={<Pencil size={16} color={theme.colors.ivory} />}
                    onPress={() => setSheetItens(true)}
                  >
                    Editar lista de situações
                  </Button>
                </Surface>
              ) : null}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Sheet
        visible={sheetItens}
        onClose={() => {
          setSheetItens(false);
          setEditItem(null);
        }}
        title="Situações do Bingo"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.sheetConteudo}
        >
          {editItem ? (
            <View style={styles.boxFormItem}>
              <Field
                label="Editar situação"
                value={editItem.texto}
                onChangeText={(txt) =>
                  setEditItem((prev) => (prev ? { ...prev, texto: txt } : null))
                }
                maxLength={140}
              />
              <View style={styles.acoesClaim}>
                <Button
                  style={styles.flex}
                  loading={mutacao.isPending}
                  onPress={adicionarOuEditarItem}
                >
                  Salvar
                </Button>
                <Button variant="ghost" onPress={() => setEditItem(null)}>
                  Cancelar
                </Button>
              </View>
            </View>
          ) : (
            <View style={styles.boxFormItem}>
              <Field
                label="Nova situação da ceia"
                placeholder="Ex.: Tio contou a mesma piada"
                value={novoTexto}
                onChangeText={setNovoTexto}
                maxLength={140}
              />
              <Button
                loading={mutacao.isPending}
                icon={<Plus size={16} color={theme.colors.ivory} />}
                onPress={adicionarOuEditarItem}
              >
                Adicionar à lista
              </Button>
            </View>
          )}

          <View style={styles.listaItensSheet}>
            {data?.itens.map((item) => (
              <View key={item.id} style={styles.linhaItemSheet}>
                <Text style={styles.flex}>{item.texto}</Text>
                <Button variant="quiet" onPress={() => setEditItem(item)}>
                  Editar
                </Button>
                <Button
                  variant="quiet"
                  icon={<Trash2 size={15} color={theme.colors.error} />}
                  onPress={() =>
                    enviarAcao({ acao: 'excluir_item', id: item.id }, 'Situação removida.')
                  }
                >
                  {' '}
                </Button>
              </View>
            ))}
          </View>
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
  bloco: { gap: 14 },
  blocoCartela: { padding: 14, gap: 12 },
  bannerBingo: {
    borderColor: theme.colors.champagne,
    gap: 12,
  },
  iconeCirculo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(197,41,45,0.22)',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centro: { textAlign: 'center' },
  tituloSecao: { fontSize: 24, lineHeight: 32 },
  linhaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  linhaPessoa: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cabecalhoLetras: { flexDirection: 'row', gap: 6 },
  colunaLetra: { flex: 1, alignItems: 'center' },
  letraBingo: { fontSize: 18, lineHeight: 24, color: theme.colors.champagne },
  grade: { gap: 6 },
  linhaGrade: { flexDirection: 'row', gap: 6 },
  casa: {
    flex: 1,
    minHeight: 68,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.field,
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  casaMarcada: {
    borderColor: theme.colors.champagne,
    backgroundColor: 'rgba(96,117,104,0.34)',
  },
  casaBingo: {
    borderColor: theme.colors.champagne,
    backgroundColor: 'rgba(197,41,45,0.35)',
  },
  textoCasa: {
    fontSize: 10,
    lineHeight: 13,
    textAlign: 'center',
    color: theme.colors.ivory,
  },
  textoLivre: { fontSize: 9, lineHeight: 12 },
  seloCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(191,165,119,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detalheCasa: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.field,
    padding: 12,
    gap: 4,
  },
  claimCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.lineStrong,
    backgroundColor: theme.colors.field,
    padding: 14,
    gap: 10,
  },
  claimConfirmado: { borderColor: theme.colors.champagne },
  frasesLista: { gap: 4 },
  acoesClaim: { flexDirection: 'row', gap: 8 },
  contadorNum: { fontSize: 18, lineHeight: 24, color: theme.colors.champagne },
  sheetConteudo: { gap: 14, paddingBottom: 28 },
  boxFormItem: { gap: 10 },
  listaItensSheet: { gap: 8 },
  linhaItemSheet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.line,
    paddingVertical: 6,
  },
});
