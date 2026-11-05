import { SelosPerfil } from '../conquistas/SelosPerfil';
import { BlockedPeople } from '../moderacao/BlockedPeople';
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import Camera from 'lucide-react-native/icons/camera';
import ExternalLink from 'lucide-react-native/icons/external-link';
import Fingerprint from 'lucide-react-native/icons/fingerprint-pattern';
import ImageIcon from 'lucide-react-native/icons/image';
import LockKeyhole from 'lucide-react-native/icons/lock-keyhole';
import LogOut from 'lucide-react-native/icons/log-out';
import { api, ApiError, queryClient, queryKeys, sessionStore } from '../../api';
import { useSession } from '../../session';
import type { Membro, Perfil as PerfilDados, PerfilSalvo, Publicacao } from '../../types/familia';
import type { User } from '../../types';
import { theme } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Field } from '../../ui/Field';
import { LoopVideo } from '../../ui/LoopVideo';
import { Rise } from '../../ui/motion';
import { Sheet } from '../../ui/Sheet';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { escolherFotos, enviarFoto, type Origem } from '../../upload';
import { Cabecalho } from './Cabecalho';
import { familiaKeys } from './chaves';
import { sessaoVigente, useAutenticado } from './sessao';

type Folha = 'editar' | 'senha' | null;
type Formulario = { name: string; bio: string; avatar_url: string };
const LIMITE = 30;

function idDaRota(valor: string | string[] | undefined): number | null {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  if (!texto || !/^\d+$/.test(texto)) return null;
  const id = Number(texto);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function imagens(post: Publicacao): string[] {
  if (!Array.isArray(post.images)) return [];
  return post.images.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function unicos(paginas: Publicacao[][]): Publicacao[] {
  const vistos = new Set<number>();
  const saida: Publicacao[] = [];
  for (const pagina of paginas) for (const post of pagina) {
    if (vistos.has(post.id)) continue;
    vistos.add(post.id);
    saida.push(post);
  }
  return saida;
}

export default function Perfil() {
  const ok = useAutenticado();
  const { user, biometric, signOut } = useSession();
  const toast = useToast();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = idDaRota(params.id);
  const [aba, setAba] = useState<'posts' | 'desejos'>('posts');
  const [folha, setFolha] = useState<Folha>(null);
  const [rolagem, setRolagem] = useState(0);
  const [form, setForm] = useState<Formulario>({ name: '', bio: '', avatar_url: '' });
  const proprio = id !== null && user?.id === id;
  const perfil = useQuery({
    queryKey: familiaKeys.perfil(id ?? 0),
    enabled: ok && id !== null,
    queryFn: ({ signal }) => api<PerfilDados>(`/api/family/${id}`, { signal }),
  });
  const posts = useInfiniteQuery({
    queryKey: familiaKeys.posts(id ?? 0),
    enabled: ok && id !== null,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => api<Publicacao[]>(`/api/posts?user_id=${id}&limit=${LIMITE}${pageParam > 0 ? `&before=${pageParam}` : ''}`, { signal }),
    getNextPageParam: (ultima) => ultima.length < LIMITE ? undefined : ultima[ultima.length - 1]?.id,
  });
  useEffect(() => { if (perfil.error) toast(perfil.error.message, 'error'); }, [perfil.error, toast]);
  useEffect(() => { if (posts.error) toast(posts.error.message, 'error'); }, [posts.error, toast]);
  if (!ok || !user) return null;
  if (id === null) return <View style={styles.pagina}><Cabecalho barra titulo="Perfil" aoVoltar={() => router.replace('/familia')} rotuloVoltar="Voltar para a família" /><EmptyState title="Perfil indisponível" message="Volte à família e escolha outro perfil." action="Ver a família" onAction={() => router.replace('/familia')} /></View>;
  const dados = perfil.data;
  const grade = unicos(posts.data?.pages ?? []);
  function atualizar() {
    void perfil.refetch();
    void posts.refetch();
  }
  function sair() {
    void signOut().catch(() => toast('O acesso foi encerrado. Não conseguimos remover todos os dados salvos.', 'error'));
  }
  return <View style={styles.pagina}>
    <ScrollView contentContainerStyle={styles.miolo} contentInsetAdjustmentBehavior="automatic" scrollEventThrottle={160}
      onScroll={(evento) => setRolagem(evento.nativeEvent.contentOffset.y)}
      refreshControl={<RefreshControl refreshing={(perfil.isRefetching || posts.isRefetching) && !perfil.isPending} onRefresh={atualizar} tintColor={theme.colors.champagne} colors={[theme.colors.cherry]} progressBackgroundColor={theme.colors.surface} />}>
      <Cabecalho barra titulo="Perfil" aoVoltar={() => router.replace('/familia')} rotuloVoltar="Voltar para a família" />
      {perfil.isPending ? <Esqueleto /> : !dados ? <EmptyState title="Perfil indisponível" message={perfil.error?.message ?? 'Volte à família e escolha outro perfil.'} action="Tentar novamente" onAction={() => { void perfil.refetch(); }} /> : <>
        <View style={styles.capa}>
          <LoopVideo name="mn-hero" visible={rolagem < 360} style={[StyleSheet.absoluteFill, { opacity: 0.62 }]} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(23,27,24,0.28)' }]} />
          <LinearGradient colors={['rgba(23,27,24,0.05)', 'rgba(23,27,24,0.35)', theme.colors.background]} locations={[0, 0.42, 1]} style={StyleSheet.absoluteFill} />
        </View>
        <Rise style={styles.corpo}>
          <View style={styles.aro}><Avatar name={dados.name} src={dados.avatar_url} size={112} /></View>
          <Text variant="display" accessibilityRole="header" style={styles.nome}>{dados.name}</Text>
          {dados.is_admin ? <Text variant="kicker" style={styles.kicker}>organiza o nosso Natal</Text> : null}
          {dados.bio ? <Text style={styles.bio}>{dados.bio}</Text> : null}
          <SelosPerfil id={id} />
          <View style={styles.numeros}>
            {([[dados.posts_count, 'posts'], [dados.reactions_received, 'curtidas'], [dados.comments_count, 'comentários']] as const).map(([valor, rotulo], indice) => <View key={rotulo} style={[styles.numero, indice > 0 && styles.numeroBorda]}>
              <Text variant="numeral" style={styles.cifra}>{valor}</Text>
              <Text variant="muted" style={styles.rotulo}>{rotulo}</Text>
            </View>)}
          </View>
          {proprio ? <View style={styles.acoes}>
            <Button variant="ghost" onPress={() => { setForm({ name: dados.name, bio: dados.bio ?? '', avatar_url: dados.avatar_url ?? '' }); setFolha('editar'); }}>Editar perfil</Button>
            <View style={styles.quietos}>
              <Button variant="quiet" onPress={() => setFolha('senha')} icon={<LockKeyhole size={15} color={theme.colors.ivory} strokeWidth={1.5} />}>Trocar senha</Button>
              <Button variant="quiet" onPress={sair} icon={<LogOut size={15} color={theme.colors.ivory} strokeWidth={1.5} />}>Sair</Button>
            </View>
            {biometric ? <View accessibilityLabel="Face ID ou digital ativo neste aparelho" style={styles.biometria}>
              <Fingerprint size={16} color={theme.colors.champagne} strokeWidth={1.5} />
              <Text variant="muted">Face ID ou digital ativo neste aparelho.</Text>
            </View> : null}
            <BlockedPeople />
            <Button variant="quiet" onPress={() => router.push('/termos')}>Termos de uso</Button>
            <View style={styles.links}>
              <Pressable accessibilityRole="button" onPress={() => router.push('/privacidade')} style={styles.link}><Text variant="muted" style={styles.linkTexto}>Privacidade</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.push('/conta/excluir')} style={styles.link}><Text variant="muted" style={styles.linkTexto}>Excluir minha conta</Text></Pressable>
            </View>
          </View> : null}
        </Rise>
        <View accessibilityRole="tablist" style={styles.abas}>
          {([['posts', 'Posts'], ['desejos', 'Lista de desejos']] as const).map(([chave, rotulo]) => <Pressable key={chave} accessibilityRole="tab" accessibilityState={{ selected: aba === chave }} onPress={() => { void Haptics.selectionAsync().catch(() => {}); setAba(chave); }} style={[styles.aba, aba === chave && styles.abaAtiva]}>
            <Text style={{ color: aba === chave ? theme.colors.ivory : theme.colors.muted, fontFamily: theme.fonts.medium, fontSize: 14 }}>{rotulo}</Text>
          </Pressable>)}
        </View>
        <View style={styles.painel}>
          {aba === 'posts' ? <Grade posts={grade} carregando={posts.isPending} erro={posts.error?.message} temMais={Boolean(posts.hasNextPage)} buscando={posts.isFetchingNextPage} onMais={() => { void posts.fetchNextPage(); }} onTentar={() => { void posts.refetch(); }} />
            : <Desejos perfil={dados} />}
        </View>
      </>}
    </ScrollView>
    {folha === 'editar' && id !== null ? <EditarPerfil id={id} form={form} setForm={setForm} onClose={() => setFolha(null)} /> : null}
    {folha === 'senha' ? <TrocarSenha onClose={() => setFolha(null)} /> : null}
  </View>;
}

function Grade({ posts, carregando, erro, temMais, buscando, onMais, onTentar }: {
  posts: Publicacao[]; carregando: boolean; erro?: string; temMais: boolean; buscando: boolean; onMais: () => void; onTentar: () => void;
}) {
  const { width } = useWindowDimensions();
  const celula = Math.floor((Math.min(width, 720) - 48 - 16) / 3);
  if (carregando) return <View style={styles.grade}>{[0, 1, 2, 3, 4, 5].map((item) => <Skeleton key={item} style={{ width: celula, height: celula }} />)}</View>;
  if (!posts.length && erro) return <EmptyState title="Não foi possível abrir os posts" message={erro} action="Tentar novamente" onAction={onTentar} />;
  if (!posts.length) return <EmptyState title="Memórias por chegar" message="As fotos publicadas no mural aparecerão aqui." />;
  return <View style={styles.gradeColuna}>
    <View style={styles.grade}>{posts.map((post) => {
      const foto = imagens(post)[0];
      return <Pressable key={post.id} accessibilityRole="button" accessibilityLabel={post.content || 'Foto da família'} onPress={() => router.navigate('/mural')} style={[styles.celula, { width: celula, height: celula }, foto ? null : styles.celulaVazia]}>
        {foto ? <Image source={{ uri: foto }} recyclingKey={foto} contentFit="cover" style={StyleSheet.absoluteFill} accessible={false} />
          : <Text numberOfLines={5} style={styles.celulaTexto}>{post.content}</Text>}
      </Pressable>;
    })}</View>
    {temMais ? <Button variant="ghost" loading={buscando} onPress={onMais}>Carregar mais</Button> : null}
  </View>;
}

function Desejos({ perfil }: { perfil: PerfilDados }) {
  const toast = useToast();
  if (!perfil.wishlist.length) return <EmptyState title="Um desejo ainda em segredo" message="Quando houver uma lista para o amigo oculto atual, ela aparecerá aqui." />;
  return <View>{perfil.wishlist.map((desejo) => {
    const link = desejo.item_url && /^https?:\/\//i.test(desejo.item_url) ? desejo.item_url : null;
    return <View key={desejo.id} style={styles.desejo}>
      <View style={styles.desejoTopo}>
        <Text variant="display" style={styles.desejoNome}>{desejo.item_name}</Text>
        {desejo.purchased ? <Text style={styles.escolhido}>Já escolhido</Text> : null}
      </View>
      {desejo.item_description ? <Text variant="muted" style={styles.desejoTexto}>{desejo.item_description}</Text> : null}
      {link ? <Pressable accessibilityRole="link" accessibilityLabel={`Ver ideia de presente: ${desejo.item_name}`} style={styles.ideia} onPress={() => { void Linking.openURL(link).catch(() => toast('Não foi possível abrir o link.', 'error')); }}>
        <Text style={styles.ideiaTexto}>Ver ideia de presente</Text>
        <ExternalLink size={14} color={theme.colors.champagne} strokeWidth={1.5} />
      </Pressable> : null}
    </View>;
  })}</View>;
}

function EditarPerfil({ id, form, setForm, onClose }: { id: number; form: Formulario; setForm: Dispatch<SetStateAction<Formulario>>; onClose: () => void }) {
  const toast = useToast();
  const { height } = useWindowDimensions();
  const [enviando, setEnviando] = useState<Origem | null>(null);
  const salvar = useMutation({
    mutationFn: (vars: Formulario & { id: number; generation: number }) => {
      if (!sessaoVigente(vars.generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return api<PerfilSalvo>('/api/me', { method: 'PUT', json: { name: vars.name.trim(), bio: vars.bio.trim(), avatar_url: vars.avatar_url.trim() } });
    },
    onMutate: async (vars) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: familiaKeys.perfil(vars.id) }),
        queryClient.cancelQueries({ queryKey: familiaKeys.lista }),
        queryClient.cancelQueries({ queryKey: queryKeys.me }),
      ]);
      const perfilAnterior = queryClient.getQueryData<PerfilDados>(familiaKeys.perfil(vars.id));
      const listaAnterior = queryClient.getQueryData<Membro[]>(familiaKeys.lista);
      const meAnterior = queryClient.getQueryData<{ user: User | null }>(queryKeys.me);
      if (sessaoVigente(vars.generation)) {
        const name = vars.name.trim();
        const bio = vars.bio.trim() || null;
        const avatar_url = vars.avatar_url.trim() || null;
        if (perfilAnterior) queryClient.setQueryData<PerfilDados>(familiaKeys.perfil(vars.id), { ...perfilAnterior, name, bio, avatar_url });
        if (listaAnterior) queryClient.setQueryData<Membro[]>(familiaKeys.lista, listaAnterior.map((membro) => membro.id === vars.id ? { ...membro, name, bio, avatar_url } : membro));
        if (meAnterior?.user) queryClient.setQueryData(queryKeys.me, { user: { ...meAnterior.user, name, avatar_url } });
      }
      return { perfilAnterior, listaAnterior, meAnterior };
    },
    onError: (erro, vars, ctx) => {
      if (ctx && sessaoVigente(vars.generation)) {
        if (ctx.perfilAnterior) queryClient.setQueryData(familiaKeys.perfil(vars.id), ctx.perfilAnterior);
        if (ctx.listaAnterior) queryClient.setQueryData(familiaKeys.lista, ctx.listaAnterior);
        if (ctx.meAnterior) queryClient.setQueryData(queryKeys.me, ctx.meAnterior);
      }
      toast(erro.message, 'error');
    },
    onSuccess: (salvo, vars) => {
      if (!sessaoVigente(vars.generation)) return;
      queryClient.setQueryData<PerfilDados>(familiaKeys.perfil(vars.id), (atual) => atual ? { ...atual, name: salvo.name, bio: salvo.bio, avatar_url: salvo.avatar_url, is_admin: salvo.is_admin, username: salvo.username } : atual);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast('Perfil atualizado.');
      onClose();
    },
    onSettled: (_dado, _erro, vars) => {
      if (!vars || !sessaoVigente(vars.generation)) return;
      void queryClient.invalidateQueries({ queryKey: familiaKeys.perfil(vars.id) });
      void queryClient.invalidateQueries({ queryKey: familiaKeys.lista });
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
  async function foto(origem: Origem) {
    if (enviando || salvar.isPending) return;
    setEnviando(origem);
    try {
      const fotos = await escolherFotos(origem, 1);
      const escolhida = fotos[0];
      if (!escolhida) return;
      const url = await enviarFoto(escolhida);
      setForm((atual) => ({ ...atual, avatar_url: url }));
    } catch (erro) {
      toast(erro instanceof Error ? erro.message : 'Não foi possível enviar a foto.', 'error');
    } finally { setEnviando(null); }
  }
  function guardar() {
    if (salvar.isPending || enviando) return;
    if (!form.name.trim()) { toast('Preencha o nome.', 'error'); return; }
    salvar.mutate({ ...form, id, generation: sessionStore.getGeneration() });
  }
  return <Sheet visible title="Seu perfil" onClose={() => { if (!salvar.isPending && !enviando) onClose(); }}>
    <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: height * 0.62 }} contentContainerStyle={styles.folha}>
      <View style={styles.fotoLinha}>
        <View style={styles.aroMenor}><Avatar name={form.name || 'Família'} src={form.avatar_url} size={72} /></View>
        <View style={styles.flex}>
          <Button variant="ghost" loading={enviando === 'galeria'} disabled={enviando !== null} onPress={() => { void foto('galeria'); }} icon={<ImageIcon size={16} color={theme.colors.ivory} strokeWidth={1.5} />}>Galeria</Button>
          <Button variant="ghost" loading={enviando === 'camera'} disabled={enviando !== null} onPress={() => { void foto('camera'); }} icon={<Camera size={16} color={theme.colors.ivory} strokeWidth={1.5} />}>Câmera</Button>
        </View>
      </View>
      <Field label="Como a família te chama" value={form.name} onChangeText={(name) => setForm({ ...form, name })} maxLength={120} autoComplete="name" />
      <Field label="Um pouco sobre você" value={form.bio} onChangeText={(bio) => setForm({ ...form, bio })} maxLength={160} multiline numberOfLines={4} style={styles.bioCampo} />
      <Text variant="muted" style={styles.contador}>{form.bio.length}/160</Text>
      <Button loading={salvar.isPending} disabled={enviando !== null} onPress={guardar}>Salvar alterações</Button>
    </ScrollView>
  </Sheet>;
}

function TrocarSenha({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const { height } = useWindowDimensions();
  const [atual, setAtual] = useState('');
  const [proxima, setProxima] = useState('');
  const [erroProxima, setErroProxima] = useState('');
  const salvar = useMutation({
    mutationFn: (vars: { current: string; next: string; generation: number }) => {
      if (!sessaoVigente(vars.generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return api<{ ok: boolean }>('/api/me/password', { method: 'POST', json: { current: vars.current, next: vars.next } });
    },
    onSuccess: (_dado, vars) => {
      if (!sessaoVigente(vars.generation)) return;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast('Senha alterada.');
      onClose();
    },
    onError: (erro) => toast(erro.message, 'error'),
  });
  function guardar() {
    if (salvar.isPending) return;
    if (proxima.length < 6) { setErroProxima('Pelo menos 6 caracteres.'); return; }
    setErroProxima('');
    salvar.mutate({ current: atual, next: proxima, generation: sessionStore.getGeneration() });
  }
  return <Sheet visible title="Trocar senha" onClose={() => { if (!salvar.isPending) onClose(); }}>
    <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: height * 0.62 }} contentContainerStyle={styles.folha}>
      <Field label="Senha atual" value={atual} onChangeText={setAtual} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password" maxLength={1024} />
      <Field label="Nova senha" value={proxima} onChangeText={(valor) => { setProxima(valor); setErroProxima(''); }} error={erroProxima} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" maxLength={1024} />
      <Text variant="muted">Pelo menos 6 caracteres.</Text>
      <Button loading={salvar.isPending} disabled={!atual || proxima.length < 6} onPress={guardar}>Salvar alterações</Button>
    </ScrollView>
  </Sheet>;
}

function Esqueleto() {
  return <View accessibilityLabel="Preparando o perfil" style={styles.esqueleto}>
    <Skeleton style={{ height: 180 }} /><Skeleton style={{ height: 112, width: 112, borderRadius: 56, alignSelf: 'center' }} /><Skeleton style={{ height: 36, width: '70%', alignSelf: 'center' }} /><Skeleton style={{ height: 72 }} />
  </View>;
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: theme.colors.background },
  miolo: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 48 },
  capa: { height: 210, overflow: 'hidden' },
  corpo: { alignItems: 'center', marginTop: -62, paddingHorizontal: 24 },
  aro: { padding: 4, borderRadius: 999, borderWidth: 1.5, borderColor: theme.colors.champagne },
  aroMenor: { padding: 3, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.champagne },
  nome: { marginTop: 18, textAlign: 'center', fontSize: 40, lineHeight: 50 },
  kicker: { marginTop: 8 },
  bio: { marginTop: 12, textAlign: 'center', color: theme.colors.secondary, fontSize: 15, lineHeight: 23, maxWidth: 320 },
  numeros: { alignSelf: 'stretch', marginTop: 28, marginBottom: 8, flexDirection: 'row' },
  numero: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 8 },
  numeroBorda: { borderLeftWidth: 1, borderLeftColor: theme.colors.line },
  cifra: { fontSize: 32, lineHeight: 40 },
  rotulo: { fontSize: 12 },
  acoes: { alignSelf: 'stretch', gap: 4, marginTop: 18 },
  quietos: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  biometria: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  linkTexto: { textDecorationLine: 'underline', fontSize: 13 },
  abas: { flexDirection: 'row', marginHorizontal: 24, marginTop: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  aba: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  abaAtiva: { borderBottomColor: theme.colors.cherry },
  painel: { paddingHorizontal: 24, paddingTop: 18 },
  gradeColuna: { gap: 16 },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  celula: { borderRadius: 14, overflow: 'hidden', backgroundColor: theme.colors.field },
  celulaVazia: { padding: 8 },
  celulaTexto: { fontSize: 11, lineHeight: 15, color: theme.colors.secondary },
  desejo: { paddingVertical: 18, gap: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  desejoTopo: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  desejoNome: { flex: 1, fontSize: 24, lineHeight: 32 },
  escolhido: { color: theme.colors.sage, fontSize: 12, marginTop: 8 },
  desejoTexto: { fontSize: 14, lineHeight: 21 },
  ideia: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8 },
  ideiaTexto: { color: theme.colors.champagne, fontSize: 13 },
  folha: { gap: 16, paddingBottom: 8 },
  fotoLinha: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  flex: { flex: 1, gap: 8 },
  bioCampo: { minHeight: 96, textAlignVertical: 'top' },
  contador: { textAlign: 'right', marginTop: -8 },
  esqueleto: { padding: 24, gap: 20 },
});
