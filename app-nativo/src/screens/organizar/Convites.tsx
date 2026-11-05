import { PedidosConvite } from '../convidar/Pedidos';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery } from '@tanstack/react-query';
import Check from 'lucide-react-native/icons/check';
import Copy from 'lucide-react-native/icons/copy';
import ShareIcon from 'lucide-react-native/icons/share';
import X from 'lucide-react-native/icons/x';
import { api, ApiError, queryClient, sessionStore } from '../../api';
import { Cabecalho } from '../familia/Cabecalho';
import { sessaoVigente, useAutenticado } from '../familia/sessao';
import { useSession } from '../../session';
import type { Convite, ConviteCriado, ParticipanteVaquinha } from '../../types/familia';
import { theme } from '../../theme';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Field } from '../../ui/Field';
import { Sheet } from '../../ui/Sheet';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { conviteKeys } from './chaves';

const DIAS = [7, 30, 60, 120] as const;
type Tipo = 'pessoa' | 'geral';

function linkConvite(token: string): string {
  return `https://natalemfamilia.com.br/entrar?convite=${encodeURIComponent(token)}`;
}

function textoConvite(token: string): string {
  return `Oi! Entra no nosso Natal em Família: mural, amigo oculto, vaquinha e as fotos da ceia. Cria seu usuário por este link: ${linkConvite(token)}`;
}

function nomes(joined: Convite['joined']): string[] {
  if (!Array.isArray(joined)) return [];
  return joined.filter((nome): nome is string => typeof nome === 'string' && nome.length > 0);
}

function resumo(convite: Convite): string {
  const liga = convite.participant_name ? ` Liga a ${convite.participant_name}.` : '';
  if (convite.status !== 'ativo') {
    const estado = convite.status === 'usado' ? 'Já usado.' : convite.status === 'vencido' ? 'Vencido.' : 'Cancelado.';
    return `${estado}${liga}`;
  }
  const uso = convite.max_uses != null
    ? `${convite.uses} de ${convite.max_uses} ${convite.max_uses === 1 ? 'uso' : 'usos'}`
    : `${convite.uses} ${convite.uses === 1 ? 'cadastro' : 'cadastros'}`;
  const prazo = convite.days_left == null ? '' : convite.days_left <= 0 ? ' Vence hoje.' : ` Vale mais ${convite.days_left} ${convite.days_left === 1 ? 'dia' : 'dias'}.`;
  return `${uso}.${prazo}${liga}`;
}

export default function Convites() {
  const ok = useAutenticado();
  const { user } = useSession();
  const toast = useToast();
  const admin = Boolean(user?.is_admin);
  const [alvo, setAlvo] = useState<Convite | null>(null);
  const lista = useQuery({
    queryKey: conviteKeys.lista,
    enabled: ok && admin,
    queryFn: ({ signal }) => api<Convite[]>('/api/invites', { signal }),
  });
  const vaquinha = useQuery({
    queryKey: conviteKeys.participantes,
    enabled: ok && admin,
    queryFn: ({ signal }) => api<{ participants: ParticipanteVaquinha[] }>('/api/vaquinha', { signal }),
  });
  if (!ok || !user) return null;
  function voltar() { if (router.canGoBack()) router.back(); else router.replace('/organizar'); }
  const semAcesso = (vaquinha.data?.participants ?? []).filter((pessoa) => !pessoa.user_id);
  return <View style={styles.pagina}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.miolo} contentInsetAdjustmentBehavior="automatic"
      refreshControl={admin ? <RefreshControl refreshing={(lista.isRefetching || vaquinha.isRefetching) && !lista.isPending} onRefresh={() => { void lista.refetch(); void vaquinha.refetch(); }} tintColor={theme.colors.champagne} colors={[theme.colors.cherry]} progressBackgroundColor={theme.colors.surface} /> : undefined}>
      <Cabecalho kicker={admin ? 'Só quem organiza' : 'Convites'} titulo={admin ? 'Convites' : 'Só para quem organiza'} aoVoltar={voltar} />
      {!admin ? <View style={styles.bloco}><EmptyState title="Um convite de quem organiza" message="Peça o link de convite para quem organiza o Natal." /><Button variant="ghost" onPress={voltar}>Voltar</Button></View>
        : <>
          <View style={styles.bloco}><PedidosConvite organizar /></View>
          <Formulario semAcesso={semAcesso} avisoVaquinha={vaquinha.isError} toast={toast} />
          <View style={styles.enviados}>
            <Text variant="display" accessibilityRole="header" style={styles.subtitulo}>Enviados</Text>
            {lista.isPending ? <Skeleton style={{ height: 96 }} /> : lista.isError ? <EmptyState title="Não foi possível abrir os convites" message={lista.error.message} action="Tentar novamente" onAction={() => { void lista.refetch(); }} />
              : !lista.data?.length ? <Text variant="muted">Nenhum convite ainda.</Text>
                : lista.data.map((convite) => <Item key={convite.id} convite={convite} toast={toast} onCancelar={() => setAlvo(convite)} />)}
            <CancelarConvite convite={alvo} onClose={() => setAlvo(null)} toast={toast} />
          </View>
        </>}
    </ScrollView>
  </View>;
}

function Formulario({ semAcesso, avisoVaquinha = false, toast }: { semAcesso: ParticipanteVaquinha[]; avisoVaquinha?: boolean; toast: (mensagem: string, tipo?: 'success' | 'error') => void }) {
  const { height } = useWindowDimensions();
  const [tipo, setTipo] = useState<Tipo>('pessoa');
  const [rotulo, setRotulo] = useState('');
  const [participanteId, setParticipanteId] = useState<number | null>(null);
  const [dias, setDias] = useState<(typeof DIAS)[number]>(30);
  const [escolher, setEscolher] = useState(false);
  const pessoa = semAcesso.find((item) => item.id === participanteId);
  const criar = useMutation({
    mutationFn: (vars: { label: string; participant_id: number | null; days: number; generation: number }) => {
      if (!sessaoVigente(vars.generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return api<ConviteCriado>('/api/invites', { method: 'POST', json: { label: vars.label, participant_id: vars.participant_id, days: vars.days } });
    },
    onSuccess: async (criado, vars) => {
      if (!sessaoVigente(vars.generation)) return;
      setRotulo('');
      setParticipanteId(null);
      let copiou = false;
      try { copiou = await Clipboard.setStringAsync(linkConvite(criado.token)); } catch { copiou = false; }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast(copiou ? 'Convite criado. Link copiado.' : 'Convite criado.');
    },
    onError: (erro) => toast(erro.message, 'error'),
    onSettled: (_dado, _erro, vars) => {
      if (!vars || !sessaoVigente(vars.generation)) return;
      void queryClient.invalidateQueries({ queryKey: conviteKeys.lista });
    },
  });
  function enviar() {
    if (criar.isPending) return;
    const label = (rotulo.trim() || (tipo === 'geral' ? 'Família toda' : pessoa?.name ?? '')).slice(0, 60);
    if (!label) { toast('Diga para quem é o convite.', 'error'); return; }
    criar.mutate({ label, participant_id: tipo === 'pessoa' ? participanteId : null, days: dias, generation: sessionStore.getGeneration() });
  }
  return <View style={styles.form}>
    <Text variant="kicker">Novo convite</Text>
    <View accessibilityRole="radiogroup" style={styles.tipos}>
      {([['pessoa', 'Uma pessoa'], ['geral', 'Família toda']] as const).map(([chave, nome]) => <View key={chave} style={styles.flex}>
        <Button variant={tipo === chave ? 'primary' : 'ghost'} selected={tipo === chave} onPress={() => { setTipo(chave); if (chave === 'geral') setParticipanteId(null); }}>{nome}</Button>
      </View>)}
    </View>
    <Text variant="muted">{tipo === 'pessoa' ? 'Vale para 1 cadastro. Se a pessoa já está na vaquinha ou no sorteio, escolha ela abaixo e o acesso já entra ligado.' : 'Vale para quantas pessoas precisar até vencer. Bom para mandar no grupo da família.'}</Text>
    {avisoVaquinha ? <Text variant="muted">Não foi possível listar quem está na vaquinha sem acesso. Dá para criar o convite mesmo assim.</Text> : null}
    {tipo === 'pessoa' && semAcesso.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Participante já cadastrado" onPress={() => setEscolher(true)} style={styles.seletor}>
      <Text style={{ color: pessoa ? theme.colors.ivory : theme.colors.muted }}>{pessoa ? `${pessoa.name} (já na vaquinha)` : 'Pessoa nova (não está na vaquinha)'}</Text>
    </Pressable> : null}
    <Field label={tipo === 'pessoa' ? 'Nome no convite' : 'Nome do convite'} value={rotulo} onChangeText={setRotulo} placeholder={tipo === 'pessoa' ? 'Ex.: Vó Maria' : 'Ex.: Grupo da família'} maxLength={60} />
    <Text variant="muted">Vale por, em dias</Text>
    <View accessibilityRole="radiogroup" style={styles.dias}>
      {DIAS.map((opcao) => <Pressable key={opcao} accessibilityRole="radio" accessibilityLabel={`${opcao} dias`} accessibilityState={{ selected: dias === opcao }} onPress={() => setDias(opcao)} style={[styles.dia, dias === opcao && styles.diaAtivo]}>
        <Text style={{ fontFamily: theme.fonts.medium }}>{opcao}</Text>
      </Pressable>)}
    </View>
    <Button loading={criar.isPending} onPress={enviar}>Criar convite</Button>
    <Sheet visible={escolher} title="Já está na vaquinha" onClose={() => setEscolher(false)}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: height * 0.5 }}>
        <Pressable accessibilityRole="button" onPress={() => { setParticipanteId(null); setEscolher(false); }} style={styles.opcao}><Text>Pessoa nova (não está na vaquinha)</Text></Pressable>
        {semAcesso.map((item) => <Pressable key={item.id} accessibilityRole="button" onPress={() => { setParticipanteId(item.id); if (!rotulo.trim()) setRotulo(item.name); setEscolher(false); }} style={styles.opcao}>
          <Text>{item.name}</Text>
          <Text variant="muted">Já na vaquinha</Text>
        </Pressable>)}
      </ScrollView>
    </Sheet>
  </View>;
}

function Item({ convite, toast, onCancelar }: { convite: Convite; toast: (mensagem: string, tipo?: 'success' | 'error') => void; onCancelar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const entrou = nomes(convite.joined);
  const ativo = convite.status === 'ativo' && convite.token.length > 0;
  async function copiar() {
    try {
      await Clipboard.setStringAsync(linkConvite(convite.token));
      setCopiado(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => setCopiado(false), 2000);
    } catch { toast('Não deu para copiar. Tente compartilhar.', 'error'); }
  }
  async function compartilhar() {
    try {
      const resultado = await Share.share({ message: textoConvite(convite.token) });
      if (resultado.action === Share.sharedAction) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch { toast('Não foi possível compartilhar agora.', 'error'); }
  }
  return <View style={[styles.item, !ativo && styles.inativo]}>
    <View style={styles.itemTopo}>
      <View style={styles.flex}>
        <Text style={styles.itemNome}>{convite.label}</Text>
        <Text variant="muted" style={styles.resumo}>{resumo(convite)}</Text>
        {entrou.length ? <Text style={styles.entraram}>Entraram: {entrou.join(', ')}</Text> : null}
      </View>
      {ativo ? <Pressable accessibilityRole="button" accessibilityLabel={`Cancelar convite ${convite.label}`} onPress={onCancelar} style={styles.cancelar}><X size={18} color={theme.colors.ivory} strokeWidth={1.5} /></Pressable> : null}
    </View>
    {ativo ? <View style={styles.itemAcoes}>
      <View style={styles.flex}><Button variant="ghost" onPress={() => { void compartilhar(); }} icon={<ShareIcon size={16} color={theme.colors.ivory} strokeWidth={1.5} />}>Compartilhar</Button></View>
      <View style={styles.flex}><Button variant="ghost" onPress={() => { void copiar(); }} icon={copiado ? <Check size={16} color={theme.colors.ivory} strokeWidth={1.5} /> : <Copy size={16} color={theme.colors.ivory} strokeWidth={1.5} />}>{copiado ? 'Copiado' : 'Copiar'}</Button></View>
    </View> : null}
  </View>;
}

function CancelarConvite({ convite, onClose, toast }: { convite: Convite | null; onClose: () => void; toast: (mensagem: string, tipo?: 'success' | 'error') => void }) {
  const cancelar = useMutation({
    mutationFn: (vars: { id: number; generation: number }) => {
      if (!sessaoVigente(vars.generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return api<{ ok: boolean }>(`/api/invites/${vars.id}`, { method: 'DELETE' });
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: conviteKeys.lista });
      const anterior = queryClient.getQueryData<Convite[]>(conviteKeys.lista);
      if (anterior && sessaoVigente(vars.generation)) {
        queryClient.setQueryData<Convite[]>(conviteKeys.lista, anterior.map((item) => item.id === vars.id ? { ...item, status: 'cancelado' } : item));
      }
      return { anterior };
    },
    onError: (erro, vars, ctx) => {
      if (ctx?.anterior && sessaoVigente(vars.generation)) queryClient.setQueryData(conviteKeys.lista, ctx.anterior);
      toast(erro.message, 'error');
    },
    onSuccess: (_dado, vars) => {
      if (!sessaoVigente(vars.generation)) return;
      onClose();
      toast('Convite cancelado.');
    },
    onSettled: (_dado, _erro, vars) => {
      if (!vars || !sessaoVigente(vars.generation)) return;
      void queryClient.invalidateQueries({ queryKey: conviteKeys.lista });
    },
  });
  return <Sheet visible={convite !== null} title="Cancelar convite" onClose={() => { if (!cancelar.isPending) onClose(); }}>
    <Text variant="muted">Cancelar o convite {convite?.label ?? ''}? O link para de funcionar.</Text>
    <Button loading={cancelar.isPending} onPress={() => { if (!convite) return; cancelar.mutate({ id: convite.id, generation: sessionStore.getGeneration() }); }}>Cancelar convite</Button>
    <Button variant="ghost" disabled={cancelar.isPending} onPress={onClose}>Manter convite</Button>
  </Sheet>;
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: theme.colors.background },
  miolo: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 48 },
  bloco: { paddingHorizontal: 24 },
  form: { marginHorizontal: 24, marginTop: 12, padding: 20, gap: 14, borderRadius: theme.radius.card, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface },
  tipos: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  seletor: { minHeight: 54, justifyContent: 'center', paddingHorizontal: 15, borderRadius: theme.radius.field, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.field },
  dias: { flexDirection: 'row', gap: 8 },
  dia: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.field, borderWidth: 1, borderColor: theme.colors.lineStrong },
  diaAtivo: { borderColor: theme.colors.champagne, backgroundColor: theme.colors.field },
  opcao: { minHeight: 56, justifyContent: 'center', gap: 2, borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  enviados: { paddingHorizontal: 24, paddingTop: 28, gap: 8 },
  subtitulo: { fontSize: 28, lineHeight: 36, marginBottom: 8 },
  item: { paddingVertical: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  inativo: { opacity: 0.55 },
  itemTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  itemNome: { fontFamily: theme.fonts.medium, fontSize: 15 },
  resumo: { marginTop: 4, fontSize: 12, lineHeight: 18 },
  entraram: { marginTop: 6, color: theme.colors.champagne, fontSize: 12, lineHeight: 18 },
  cancelar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  itemAcoes: { flexDirection: 'row', gap: 8 },
});
