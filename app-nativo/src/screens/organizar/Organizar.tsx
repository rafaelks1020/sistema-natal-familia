import { Reports } from '../moderacao/Reports';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, type Href } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery } from '@tanstack/react-query';
import ArrowUpRight from 'lucide-react-native/icons/arrow-up-right';
import Copy from 'lucide-react-native/icons/copy';
import KeyRound from 'lucide-react-native/icons/key-round';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import { api, ApiError, queryClient, queryKeys, sessionStore } from '../../api';
import { Cabecalho } from '../familia/Cabecalho';
import { familiaKeys } from '../familia/chaves';
import { sessaoVigente, useAutenticado } from '../familia/sessao';
import { useSession } from '../../session';
import type { AcessoAtualizado, AjustesEvento, Membro, Perfil, SenhaTemporaria } from '../../types/familia';
import type { HomeData, User } from '../../types';
import { theme } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Field } from '../../ui/Field';
import { Sheet } from '../../ui/Sheet';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { organizarKeys } from './chaves';
import { camposDeEvento, mascaraData, mascaraHora, montarAjustes, valorEmReais, type CamposEvento } from './evento';

export default function Organizar() {
  const ok = useAutenticado();
  const { user } = useSession();
  const toast = useToast();
  const admin = Boolean(user?.is_admin);
  const evento = useQuery({
    queryKey: organizarKeys.evento,
    enabled: ok && admin,
    queryFn: ({ signal }) => api<AjustesEvento>('/api/settings', { signal }),
  });
  const familia = useQuery({
    queryKey: familiaKeys.lista,
    enabled: ok && admin,
    queryFn: ({ signal }) => api<Membro[]>('/api/family', { signal }),
  });
  if (!ok || !user) return null;
  function voltar() { if (router.canGoBack()) router.back(); else router.navigate('/'); }
  return <View style={styles.pagina}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.miolo} contentInsetAdjustmentBehavior="automatic"
        refreshControl={admin ? <RefreshControl refreshing={(evento.isRefetching || familia.isRefetching) && !evento.isPending} onRefresh={() => { void evento.refetch(); void familia.refetch(); }} tintColor={theme.colors.champagne} colors={[theme.colors.cherry]} progressBackgroundColor={theme.colors.surface} /> : undefined}>
        <Cabecalho kicker="Cuidar de cada detalhe" titulo="Organizar" aoVoltar={voltar} />
        {!admin ? <View style={styles.bloco}>
          <EmptyState title="Um espaço de quem organiza" message="Só os organizadores da família podem alterar o evento e gerenciar acessos." />
          <Button variant="ghost" onPress={voltar}>Voltar para o início</Button>
        </View> : evento.isPending || familia.isPending ? <Esqueleto /> : <Conteudo evento={evento.data} erroEvento={evento.error?.message} familia={familia.data} erroFamilia={familia.error?.message} onEvento={() => { void evento.refetch(); }} onFamilia={() => { void familia.refetch(); }} toast={toast} usuario={user} />}
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}

function Conteudo({ evento, erroEvento, familia, erroFamilia, onEvento, onFamilia, toast, usuario }: {
  evento?: AjustesEvento; erroEvento?: string; familia?: Membro[]; erroFamilia?: string;
  onEvento: () => void; onFamilia: () => void; toast: (mensagem: string, tipo?: 'success' | 'error') => void; usuario: User;
}) {
  const membros = familia ?? [];
  const acessos = membros.filter((membro) => membro.has_login && membro.id !== null);
  const semLogin = membros.filter((membro) => !membro.has_login && membro.participant_id !== null);
  const vinculaveis = acessos.filter((membro) => membro.can_link);
  return <View style={styles.corpo}>
    <Button onPress={() => router.push('/admin' as Href)} icon={<ShieldCheck size={16} color={theme.colors.ivory} strokeWidth={1.5} />}>Painel admin</Button>
    <Reports />
    <Text variant="muted" style={styles.intro}>Os preparativos ficam mais leves quando a família cuida junto.</Text>
    <Secao indice="01" kicker="A nossa noite" titulo="Detalhes da ceia">
      {evento ? <FormularioEvento ajustes={evento} /> : <Falha mensagem={erroEvento ?? 'Não foi possível buscar os detalhes do evento.'} onTentar={onEvento} />}
    </Secao>
    <Secao indice="02" kicker="Quem cuida junto" titulo="Acessos da família" texto="Organizadores podem cuidar do evento e ajudar quem esqueceu a senha.">
      {familia ? acessos.length ? <Acessos membros={acessos} usuarioId={usuario.id} toast={toast} /> : <Text variant="muted">Nenhum acesso disponível no momento.</Text>
        : <Falha mensagem={erroFamilia ?? 'Não foi possível buscar os acessos.'} onTentar={onFamilia} />}
    </Secao>
    <Secao indice="03" kicker="Cada pessoa no seu lugar" titulo="Ligar acesso a participante" texto="Escolha quem criou acesso para um participante já cadastrado. O histórico do participante escolhido será preservado. Só aparecem parentes cujo participante atual não tem pagamentos, sorteios, desejos nem presença.">
      {familia ? <Vinculos semLogin={semLogin} vinculaveis={vinculaveis} toast={toast} /> : null}
    </Secao>
    <Secao indice="04" kicker="A porta da família" titulo="Convites">
      <Pressable accessibilityRole="button" accessibilityLabel="Abrir convites" onPress={() => router.push('/convites')} style={({ pressed }) => [styles.atalho, pressed && styles.pressionado]}>
        <View style={styles.flex}><Text style={styles.atalhoTitulo}>Convites da família</Text><Text variant="muted">Uma pessoa ou a família toda, com link para entrar.</Text></View>
        <ArrowUpRight size={18} color={theme.colors.champagne} strokeWidth={1.5} />
      </Pressable>
    </Secao>
  </View>;
}

function Secao({ indice, kicker, titulo, texto, children }: { indice: string; kicker: string; titulo: string; texto?: string; children: ReactNode }) {
  return <View style={styles.secao}>
    <Text variant="kicker">{indice} / {kicker}</Text>
    <Text variant="display" accessibilityRole="header" style={styles.secaoTitulo}>{titulo}</Text>
    {texto ? <Text variant="muted">{texto}</Text> : null}
    {children}
  </View>;
}

function Falha({ mensagem, onTentar }: { mensagem: string; onTentar: () => void }) {
  return <View style={styles.falha}><Text variant="muted">{mensagem}</Text><Button variant="ghost" onPress={onTentar}>Tentar novamente</Button></View>;
}

function FormularioEvento({ ajustes }: { ajustes: AjustesEvento }) {
  const toast = useToast();
  const inicio = camposDeEvento(ajustes.event_date);
  const [titulo, setTitulo] = useState(ajustes.event_title);
  const [data, setData] = useState(inicio.data);
  const [hora, setHora] = useState(inicio.hora);
  const [local, setLocal] = useState(ajustes.event_place);
  const [valor, setValor] = useState(valorEmReais(ajustes.contribution_value));
  const [erros, setErros] = useState<Partial<Record<keyof CamposEvento, string>>>({});
  const salvar = useMutation({
    mutationFn: (vars: { ajustes: AjustesEvento; generation: number }) => {
      if (!sessaoVigente(vars.generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return api<AjustesEvento>('/api/settings', { method: 'PUT', json: vars.ajustes });
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: organizarKeys.evento });
      const anterior = queryClient.getQueryData<AjustesEvento>(organizarKeys.evento);
      if (sessaoVigente(vars.generation)) queryClient.setQueryData(organizarKeys.evento, vars.ajustes);
      return { anterior };
    },
    onError: (erro, vars, ctx) => {
      if (ctx && sessaoVigente(vars.generation)) queryClient.setQueryData(organizarKeys.evento, ctx.anterior);
      toast(erro.message, 'error');
    },
    onSuccess: (salvo, vars) => {
      if (!sessaoVigente(vars.generation)) return;
      queryClient.setQueryData(organizarKeys.evento, salvo);
      queryClient.setQueryData<HomeData>(queryKeys.home, (atual) => atual ? { ...atual, settings: { ...atual.settings, ...salvo } } : atual);
      const campos = camposDeEvento(salvo.event_date);
      setTitulo(salvo.event_title);
      setData(campos.data);
      setHora(campos.hora);
      setLocal(salvo.event_place);
      setValor(valorEmReais(salvo.contribution_value));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast('Os detalhes da ceia foram salvos.');
    },
    onSettled: (_dado, _erro, vars) => {
      if (!vars || !sessaoVigente(vars.generation)) return;
      void queryClient.invalidateQueries({ queryKey: organizarKeys.evento });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
    },
  });
  function guardar() {
    if (salvar.isPending) return;
    const campos = { titulo, data, hora, local, valor };
    const resultado = montarAjustes(campos);
    if ('erro' in resultado) { setErros(resultado.erro); return; }
    setErros({});
    salvar.mutate({ ajustes: resultado.ajustes, generation: sessionStore.getGeneration() });
  }
  return <View style={styles.form}>
    <Field label="Título do evento" value={titulo} onChangeText={(texto) => { setTitulo(texto); setErros((atual) => ({ ...atual, titulo: undefined })); }} error={erros.titulo} maxLength={160} />
    <View style={styles.quando}>
      <View style={styles.flex}><Field label="Data" value={data} onChangeText={(texto) => { setData(mascaraData(texto)); setErros((atual) => ({ ...atual, data: undefined })); }} error={erros.data} placeholder="24/12/2026" keyboardType="number-pad" maxLength={10} /></View>
      <View style={styles.hora}><Field label="Hora" value={hora} onChangeText={(texto) => { setHora(mascaraHora(texto)); setErros((atual) => ({ ...atual, data: undefined })); }} placeholder="20:00" keyboardType="number-pad" maxLength={5} /></View>
    </View>
    <Text variant="muted" style={styles.fuso}>Horário de Brasília.</Text>
    <Field label="Onde vamos nos encontrar" value={local} onChangeText={(texto) => { setLocal(texto); setErros((atual) => ({ ...atual, local: undefined })); }} error={erros.local} placeholder="Casa, endereço ou ponto de encontro" maxLength={500} />
    <Field label="Contribuição por pessoa (R$)" value={valor} onChangeText={(texto) => { setValor(texto.replace(/[^\d.,]/g, '')); setErros((atual) => ({ ...atual, valor: undefined })); }} error={erros.valor} keyboardType="decimal-pad" maxLength={12} />
    <Button loading={salvar.isPending} onPress={guardar}>Salvar detalhes</Button>
  </View>;
}

function Acessos({ membros, usuarioId, toast }: { membros: Membro[]; usuarioId: number; toast: (mensagem: string, tipo?: 'success' | 'error') => void }) {
  const [alvo, setAlvo] = useState<Membro | null>(null);
  const [temporaria, setTemporaria] = useState('');
  const alternar = useMutation({
    mutationFn: (vars: { id: number; is_admin: boolean; generation: number }) => {
      if (!sessaoVigente(vars.generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return api<AcessoAtualizado>(`/api/family/${vars.id}/admin`, { method: 'PUT', json: { is_admin: vars.is_admin } });
    },
    onMutate: async (vars) => {
      await Promise.all([queryClient.cancelQueries({ queryKey: familiaKeys.lista }), queryClient.cancelQueries({ queryKey: queryKeys.me })]);
      const lista = queryClient.getQueryData<Membro[]>(familiaKeys.lista);
      const eu = queryClient.getQueryData<{ user: User | null }>(queryKeys.me);
      const perfil = queryClient.getQueryData<Perfil>(familiaKeys.perfil(vars.id));
      if (sessaoVigente(vars.generation)) {
        if (lista) queryClient.setQueryData<Membro[]>(familiaKeys.lista, lista.map((membro) => membro.id === vars.id ? { ...membro, is_admin: vars.is_admin } : membro));
        if (perfil) queryClient.setQueryData<Perfil>(familiaKeys.perfil(vars.id), { ...perfil, is_admin: vars.is_admin });
        if (vars.id === usuarioId && eu?.user) queryClient.setQueryData(queryKeys.me, { user: { ...eu.user, is_admin: vars.is_admin } });
      }
      return { lista, eu, perfil };
    },
    onError: (erro, vars, ctx) => {
      if (ctx && sessaoVigente(vars.generation)) {
        if (ctx.lista) queryClient.setQueryData(familiaKeys.lista, ctx.lista);
        if (ctx.perfil) queryClient.setQueryData(familiaKeys.perfil(vars.id), ctx.perfil);
        if (ctx.eu) queryClient.setQueryData(queryKeys.me, ctx.eu);
      }
      toast(erro.message, 'error');
    },
    onSuccess: (salvo, vars) => {
      if (!sessaoVigente(vars.generation)) return;
      toast(salvo.is_admin ? 'Novo organizador na família.' : 'Acesso de organizador removido.');
    },
    onSettled: (_dado, _erro, vars) => {
      if (!vars || !sessaoVigente(vars.generation)) return;
      void queryClient.invalidateQueries({ queryKey: familiaKeys.lista });
      void queryClient.invalidateQueries({ queryKey: familiaKeys.perfil(vars.id) });
      if (vars.id === usuarioId) void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
  const gerar = useMutation({
    mutationFn: (vars: { id: number; generation: number }) => {
      if (!sessaoVigente(vars.generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return api<SenhaTemporaria>(`/api/family/${vars.id}/reset-password`, { method: 'POST' });
    },
    onSuccess: (dado, vars) => { if (sessaoVigente(vars.generation)) setTemporaria(dado.password); },
    onError: (erro) => toast(erro.message, 'error'),
  });
  const ocupado = alternar.isPending || gerar.isPending;
  async function copiar() {
    try {
      await Clipboard.setStringAsync(temporaria);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast('Senha copiada.');
    } catch { toast('Não foi possível copiar. Selecione a senha e copie manualmente.', 'error'); }
  }
  return <View>
    {membros.map((membro) => <View key={membro.id} style={styles.pessoa}>
      <View style={styles.pessoaTopo}>
        <Avatar name={membro.name} src={membro.avatar_url} size={44} />
        <View style={styles.flex}>
          <Text style={styles.pessoaNome}>{membro.name}</Text>
          {membro.username ? <Text variant="muted" style={styles.usuario}>@{membro.username}</Text> : null}
        </View>
        {membro.is_admin ? <ShieldCheck size={18} color={theme.colors.champagne} strokeWidth={1.5} accessibilityLabel="Organizador" /> : null}
      </View>
      <View style={styles.acoes}>
        <Button variant="quiet" selected={membro.is_admin} disabled={ocupado} onPress={() => { if (membro.id === null) return; alternar.mutate({ id: membro.id, is_admin: !membro.is_admin, generation: sessionStore.getGeneration() }); }}>{membro.is_admin ? 'Remover organização' : 'Tornar organizador'}</Button>
        <Button variant="quiet" disabled={ocupado} onPress={() => { setTemporaria(''); setAlvo(membro); }} icon={<KeyRound size={14} color={theme.colors.ivory} strokeWidth={1.5} />}>Gerar senha</Button>
      </View>
    </View>)}
    <Sheet visible={alvo !== null} title={temporaria ? 'Senha temporária' : 'Gerar nova senha'} onClose={() => { if (!gerar.isPending) { setAlvo(null); setTemporaria(''); } }}>
      {temporaria ? <View style={styles.folha}>
        <Text variant="muted">Compartilhe com {alvo?.name} e peça para trocar a senha no perfil. Ela só será exibida desta vez.</Text>
        <Field label="Senha temporária" value={temporaria} editable={false} selectTextOnFocus style={styles.senha} />
        <Button onPress={() => { void copiar(); }} icon={<Copy size={16} color={theme.colors.ivory} strokeWidth={1.5} />}>Copiar senha</Button>
      </View> : <View style={styles.folha}>
        <Text variant="muted">A senha atual de {alvo?.name} deixará de funcionar. A nova senha será mostrada para você compartilhar com essa pessoa.</Text>
        <Button loading={gerar.isPending} onPress={() => { if (!alvo || alvo.id === null) return; gerar.mutate({ id: alvo.id, generation: sessionStore.getGeneration() }); }}>Gerar senha temporária</Button>
      </View>}
    </Sheet>
  </View>;
}

function Vinculos({ semLogin, vinculaveis, toast }: { semLogin: Membro[]; vinculaveis: Membro[]; toast: (mensagem: string, tipo?: 'success' | 'error') => void }) {
  const { height } = useWindowDimensions();
  const [escolha, setEscolha] = useState<Record<number, number>>({});
  const [escolhendo, setEscolhendo] = useState<number | null>(null);
  const [confirma, setConfirma] = useState<{ participante: Membro; usuario: Membro } | null>(null);
  const ligar = useMutation({
    mutationFn: (vars: { user_id: number; participant_id: number; generation: number }) => {
      if (!sessaoVigente(vars.generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return api('/api/family/link', { method: 'POST', json: { user_id: vars.user_id, participant_id: vars.participant_id } });
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: familiaKeys.lista });
      const lista = queryClient.getQueryData<Membro[]>(familiaKeys.lista);
      if (lista && sessaoVigente(vars.generation)) {
        queryClient.setQueryData<Membro[]>(familiaKeys.lista, lista
          .filter((membro) => membro.participant_id !== vars.participant_id)
          .map((membro) => membro.id === vars.user_id ? { ...membro, participant_id: vars.participant_id, can_link: false } : membro));
      }
      return { lista };
    },
    onError: (erro, vars, ctx) => {
      if (ctx?.lista && sessaoVigente(vars.generation)) queryClient.setQueryData(familiaKeys.lista, ctx.lista);
      toast(erro.message, 'error');
    },
    onSuccess: (_dado, vars) => {
      if (!sessaoVigente(vars.generation)) return;
      setConfirma(null);
      setEscolha({});
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast('Acesso ligado ao participante.');
    },
    onSettled: (_dado, _erro, vars) => {
      if (!vars || !sessaoVigente(vars.generation)) return;
      void queryClient.invalidateQueries({ queryKey: familiaKeys.lista });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance });
    },
  });
  if (!semLogin.length) return <Text variant="muted">Todos os participantes já têm acesso vinculado.</Text>;
  return <View style={styles.blocoVinculo}>
    {semLogin.map((participante) => {
      const participantId = participante.participant_id;
      if (participantId === null) return null;
      const usuario = vinculaveis.find((item) => item.id === escolha[participantId]);
      return <View key={participantId} style={styles.pessoa}>
        <Text variant="display" style={styles.pessoaTitulo}>{participante.name}</Text>
        <Text variant="muted">Acesso do parente</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Escolher parente" disabled={ligar.isPending || vinculaveis.length === 0} onPress={() => setEscolhendo(participantId)} style={styles.seletor}>
          <Text style={{ color: usuario ? theme.colors.ivory : theme.colors.muted }}>{usuario ? `${usuario.name}${usuario.username ? ` (@${usuario.username})` : ''}` : 'Escolha um parente'}</Text>
        </Pressable>
        <Button variant="ghost" disabled={!usuario || ligar.isPending} onPress={() => { if (usuario) setConfirma({ participante, usuario }); }}>Ligar acesso</Button>
      </View>;
    })}
    {semLogin.length > 0 && vinculaveis.length === 0 ? <Text variant="muted">Nenhum parente pode ser vinculado no momento. O participante atual precisa estar sem histórico.</Text> : null}
    <Sheet visible={escolhendo !== null} title="Acesso do parente" onClose={() => setEscolhendo(null)}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: height * 0.5 }}>
        {vinculaveis.map((usuario) => <Pressable key={usuario.id} accessibilityRole="button" onPress={() => {
          const userId = usuario.id;
          if (escolhendo === null || userId === null) return;
          setEscolha((atual) => ({ ...atual, [escolhendo]: userId }));
          setEscolhendo(null);
        }} style={styles.opcao}>
          <Text>{usuario.name}</Text>
          {usuario.username ? <Text variant="muted">@{usuario.username}</Text> : null}
        </Pressable>)}
      </ScrollView>
    </Sheet>
    <Sheet visible={confirma !== null} title="Confirmar vínculo" onClose={() => { if (!ligar.isPending) setConfirma(null); }}>
      <Text variant="muted">Ligar o acesso de {confirma?.usuario.name}{confirma?.usuario.username ? ` (@${confirma.usuario.username})` : ''} ao participante {confirma?.participante.name}? O participante vazio criado no cadastro será excluído. O participante escolhido receberá o nome {confirma?.usuario.name} e manterá o histórico.</Text>
      <Button loading={ligar.isPending} onPress={() => {
        if (!confirma || confirma.usuario.id === null || confirma.participante.participant_id === null) return;
        ligar.mutate({ user_id: confirma.usuario.id, participant_id: confirma.participante.participant_id, generation: sessionStore.getGeneration() });
      }}>Confirmar vínculo</Button>
      <Button variant="ghost" disabled={ligar.isPending} onPress={() => setConfirma(null)}>Cancelar</Button>
    </Sheet>
  </View>;
}

function Esqueleto() {
  return <View accessibilityLabel="Preparando a organização" style={styles.esqueleto}><Skeleton style={{ height: 220 }} /><Skeleton style={{ height: 160 }} /><Skeleton style={{ height: 120 }} /></View>;
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  miolo: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 48 },
  corpo: { paddingHorizontal: 24, paddingTop: 8, gap: 8 },
  intro: { marginBottom: 18 },
  bloco: { paddingHorizontal: 24, gap: 8 },
  secao: { gap: 12, paddingTop: 22, marginTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.line },
  secaoTitulo: { fontSize: 30, lineHeight: 38 },
  form: { gap: 14, marginTop: 6 },
  quando: { flexDirection: 'row', gap: 12 },
  hora: { width: 120 },
  fuso: { marginTop: -6 },
  falha: { gap: 12 },
  pessoa: { paddingVertical: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  pessoaTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pessoaNome: { fontFamily: theme.fonts.medium, fontSize: 15 },
  pessoaTitulo: { fontSize: 24, lineHeight: 32 },
  usuario: { fontSize: 12 },
  acoes: { flexDirection: 'row', flexWrap: 'wrap' },
  folha: { gap: 16 },
  senha: { textAlign: 'center', fontSize: 22, letterSpacing: 3, color: theme.colors.champagne },
  blocoVinculo: { gap: 8 },
  seletor: { minHeight: 54, justifyContent: 'center', paddingHorizontal: 15, borderRadius: theme.radius.field, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.field },
  opcao: { minHeight: 56, justifyContent: 'center', gap: 2, borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  atalho: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  atalhoTitulo: { fontFamily: theme.fonts.medium, fontSize: 15, marginBottom: 4 },
  pressionado: { opacity: 0.72 },
  esqueleto: { padding: 24, gap: 20 },
});
