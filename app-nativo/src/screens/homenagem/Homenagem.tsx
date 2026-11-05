import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Flame from 'lucide-react-native/icons/flame';
import { api } from '../../api';
import { useSession } from '../../session';
import { theme } from '../../theme';
import { escolherFotos, enviarFoto, type FotoLocal } from '../../upload';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Field } from '../../ui/Field';
import { Sheet } from '../../ui/Sheet';
import { Skeleton } from '../../ui/Skeleton';
import { Surface } from '../../ui/Surface';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { Cabecalho } from '../familia/Cabecalho';
import { ModerationActions } from '../moderacao/Actions';
import { useEscrita } from '../capsula/escrita';
import { homenagemKey, type HomenagemDados, type Memorial } from './data';

export default function Homenagem() {
  const { status, user } = useSession();
  const [criar, setCriar] = useState(false);
  const [editando, setEditando] = useState<Memorial | null>(null);
  const consulta = useQuery({ queryKey: homenagemKey, enabled: status === 'authenticated', queryFn: ({ signal }) => api<HomenagemDados>('/api/homenagem', { signal }) });
  const escrita = useEscrita(homenagemKey);
  if (status !== 'authenticated' || !user) return null;
  const data = consulta.data;
  function voltar() { if (router.canGoBack()) router.back(); else router.navigate('/'); }
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={consulta.isRefetching} onRefresh={() => { void consulta.refetch(); }} tintColor={theme.colors.champagne} />}>
      <Cabecalho titulo="Homenagens" kicker="Natal em Família" aoVoltar={voltar} />
      <View style={styles.content}>
        <Text variant="muted">Um lugar quieto para lembrar de quem a gente ama.</Text>
        {consulta.isPending ? <Skeleton style={{ height: 180 }} /> : null}
        {consulta.isError ? <EmptyState title="Não foi possível abrir" message={consulta.error.message} action="Tentar novamente" onAction={() => { void consulta.refetch(); }} /> : null}
        {data ? <>
          <Button variant="ghost" onPress={() => setCriar(true)}>Criar uma homenagem</Button>
          {!data.memoriais.length ? <EmptyState title="Ainda sem homenagens" message="Quando a família quiser lembrar de alguém, o espaço está aqui." /> : null}
          {data.memoriais.map((item) => <Surface key={item.id} style={styles.stack}>
            {item.foto_url ? <Image source={{ uri: item.foto_url }} contentFit="cover" style={styles.foto} accessibilityLabel={item.nome} /> : null}
            <Text variant="kicker">{item.anos}</Text>
            <Text variant="display" style={styles.titulo}>{item.nome}</Text>
            {item.texto ? <Text>{item.texto}</Text> : null}
            <Text variant="muted">Escrito por {item.autor_nome}</Text>
            {item.pessoa_arvore_id ? <Button variant="ghost" onPress={() => router.push(`/arvore?pessoa=${item.pessoa_arvore_id}`)}>Ver na árvore</Button> : null}
            <Text variant="kicker">{item.velas === 1 ? '1 vela acesa' : `${item.velas} velas acesas`}</Text>
            <Button variant="ghost" icon={<Flame color={theme.colors.champagne} size={16} />} disabled={escrita.busy || item.acendi} onPress={() => escrita.executar(() => api(`/api/homenagem/${item.id}/vela`, { method: 'POST' }))}>{item.acendi ? 'Você acendeu uma vela nesta edição' : 'Acender uma vela'}</Button>
            {item.pode_editar ? <Button variant="ghost" disabled={escrita.busy} onPress={() => setEditando(item)}>Editar homenagem</Button> : null}
            {item.pode_editar ? <Button variant="quiet" disabled={escrita.busy} onPress={() => Alert.alert('Apagar esta homenagem e as lembranças?', '', [{ text: 'Voltar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: () => escrita.executar(() => api(`/api/homenagem/${item.id}`, { method: 'DELETE' })) }])}>Apagar homenagem</Button> : null}
            <Text variant="kicker">Lembranças</Text>
            {!item.lembrancas.length ? <Text variant="muted">As lembranças da família aparecem aqui.</Text> : null}
            {item.lembrancas.map((lembranca) => <View key={lembranca.id} style={styles.stack}>
              <View style={styles.autor}><Avatar name={lembranca.name} src={lembranca.avatar_url} /><Text>{lembranca.name}</Text></View>
              <Text>{lembranca.texto}</Text>
              {lembranca.image_url ? <Image source={{ uri: lembranca.image_url }} contentFit="cover" style={styles.foto} accessibilityLabel="Foto da lembrança" /> : null}
              {lembranca.pode_apagar ? <Button variant="quiet" disabled={escrita.busy} onPress={() => Alert.alert('Apagar esta lembrança?', '', [{ text: 'Voltar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: () => escrita.executar(() => api(`/api/homenagem/${item.id}/lembrancas/${lembranca.id}`, { method: 'DELETE' })) }])}>Apagar lembrança</Button> : null}
              {lembranca.user_id !== data.eu.id ? <ModerationActions userId={lembranca.user_id} name={lembranca.name} alvoTipo="homenagem" alvoId={lembranca.id} onDone={() => { void consulta.refetch(); }} /> : null}
            </View>)}
            <FormLembranca busy={escrita.busy} salvar={(preparar, depois) => escrita.executar(async () => { await api(`/api/homenagem/${item.id}/lembrancas`, { method: 'POST', json: await preparar() }); }, depois)} />
          </Surface>)}
          <Sheet visible={criar} title="Nova homenagem" onClose={() => setCriar(false)}>
            <FormMemorial pessoas={data.pessoas} busy={escrita.busy} onClose={() => setCriar(false)} salvar={(preparar) => escrita.executar(async () => { await api('/api/homenagem', { method: 'POST', json: await preparar() }); setCriar(false); })} />
          </Sheet>
          <Sheet visible={editando != null} title="Editar homenagem" onClose={() => setEditando(null)}>
            {editando ? <FormMemorial pessoas={data.pessoas} busy={escrita.busy} memorial={editando} onClose={() => setEditando(null)} salvar={(preparar) => escrita.executar(async () => { await api(`/api/homenagem/${editando.id}`, { method: 'PATCH', json: await preparar() }); setEditando(null); })} /> : null}
          </Sheet>
        </> : null}
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

function FormMemorial({ pessoas, busy, memorial, onClose, salvar }: {
  pessoas: HomenagemDados['pessoas']; busy: boolean; memorial?: Memorial; onClose: () => void;
  salvar: (preparar: () => Promise<Record<string, unknown>>) => void;
}) {
  const toast = useToast();
  const [nome, setNome] = useState(memorial?.nome ?? '');
  const [anos, setAnos] = useState(memorial?.anos ?? '');
  const [texto, setTexto] = useState(memorial?.texto ?? '');
  const [pessoaId, setPessoaId] = useState<number | null>(memorial?.pessoa_arvore_id ?? null);
  const [foto, setFoto] = useState<FotoLocal | null>(null);
  const [tirar, setTirar] = useState(false);
  async function escolher(origem: 'camera' | 'galeria') {
    try {
      const fotos = await escolherFotos(origem, 1);
      const primeira = fotos[0];
      if (primeira) { setFoto(primeira); setTirar(false); }
    } catch (error) { toast(error instanceof Error ? error.message : 'Não deu para escolher a foto.', 'error'); }
  }
  return <ScrollView keyboardShouldPersistTaps="handled" style={styles.folha} contentContainerStyle={styles.stack}>
    <Field label="Nome" value={nome} onChangeText={setNome} maxLength={120} editable={!busy} />
    <Field label="Anos" value={anos} onChangeText={setAnos} maxLength={40} placeholder="1932 - 2019" editable={!busy} />
    <Field label="Um texto (opcional)" value={texto} onChangeText={setTexto} multiline maxLength={4000} editable={!busy} />
    <Text variant="muted">Pessoa da árvore (opcional)</Text>
    <ScrollView style={styles.lista} nestedScrollEnabled keyboardShouldPersistTaps="handled">
      <Button variant={pessoaId == null ? 'primary' : 'ghost'} selected={pessoaId == null} disabled={busy} onPress={() => setPessoaId(null)}>Não ligar</Button>
      {pessoas.map((item) => <Button key={item.id} variant={pessoaId === item.id ? 'primary' : 'ghost'} selected={pessoaId === item.id} disabled={busy} onPress={() => setPessoaId(item.id)}>{item.nome}</Button>)}
    </ScrollView>
    <Button variant="ghost" disabled={busy} onPress={() => { void escolher('galeria'); }}>Escolher foto</Button>
    <Button variant="ghost" disabled={busy} onPress={() => { void escolher('camera'); }}>Tirar foto</Button>
    {memorial?.foto_url ? <Button variant={tirar ? 'primary' : 'ghost'} selected={tirar} disabled={busy} onPress={() => { setTirar((valor) => !valor); setFoto(null); }}>Tirar a foto</Button> : null}
    <Button loading={busy} disabled={busy || !nome.trim() || !anos.trim()} onPress={() => salvar(async () => {
      const json: Record<string, unknown> = { nome: nome.trim(), anos: anos.trim(), texto: texto.trim(), pessoa_arvore_id: pessoaId };
      if (foto) json.foto_url = await enviarFoto(foto);
      else if (tirar) json.foto_url = null;
      return json;
    })}>Salvar</Button>
    <Button variant="quiet" disabled={busy} onPress={onClose}>Cancelar</Button>
  </ScrollView>;
}

function FormLembranca({ busy, salvar }: { busy: boolean; salvar: (preparar: () => Promise<Record<string, unknown>>, depois?: () => void) => void }) {
  const toast = useToast();
  const [texto, setTexto] = useState('');
  const [foto, setFoto] = useState<FotoLocal | null>(null);
  return <View style={styles.stack}>
    <Field label="Deixar uma lembrança" value={texto} onChangeText={setTexto} multiline maxLength={2000} editable={!busy} />
    <Button variant="ghost" disabled={busy} onPress={() => { void escolherFotos('galeria', 1).then((fotos) => { const primeira = fotos[0]; if (primeira) setFoto(primeira); }).catch((error: unknown) => toast(error instanceof Error ? error.message : 'Não deu para escolher a foto.', 'error')); }}>{foto ? 'Foto escolhida' : 'Foto (opcional)'}</Button>
    <Button loading={busy} disabled={busy || !texto.trim()} onPress={() => salvar(async () => {
      const json: Record<string, unknown> = { texto: texto.trim() };
      if (foto) json.image_url = await enviarFoto(foto);
      return json;
    }, () => { setTexto(''); setFoto(null); })}>Publicar lembrança</Button>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { paddingBottom: 48 },
  content: { padding: 20, gap: 18 },
  stack: { gap: 12 },
  titulo: { fontSize: 30, lineHeight: 38 },
  autor: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  foto: { width: '100%', height: 220, borderRadius: 14 },
  lista: { maxHeight: 160 },
  folha: { maxHeight: 520 },
});
