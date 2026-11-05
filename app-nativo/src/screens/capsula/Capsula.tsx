import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import { useSession } from '../../session';
import { theme } from '../../theme';
import { escolherFotos, enviarFoto, type FotoLocal } from '../../upload';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Field } from '../../ui/Field';
import { Rise } from '../../ui/motion';
import { Sheet } from '../../ui/Sheet';
import { Skeleton } from '../../ui/Skeleton';
import { Surface } from '../../ui/Surface';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { Cabecalho } from '../familia/Cabecalho';
import { ModerationActions } from '../moderacao/Actions';
import { useEscrita } from './escrita';
import { capsulaKey, type CapsulaDados, type CapsulaMinha, type PessoaResumo } from './data';

export default function Capsula() {
  const { status, user } = useSession();
  const [form, setForm] = useState(false);
  const [editando, setEditando] = useState<CapsulaMinha | null>(null);
  const consulta = useQuery({ queryKey: capsulaKey, enabled: status === 'authenticated', queryFn: ({ signal }) => api<CapsulaDados>('/api/capsula', { signal }) });
  const escrita = useEscrita(capsulaKey);
  if (status !== 'authenticated' || !user) return null;
  const data = consulta.data;
  function voltar() { if (router.canGoBack()) router.back(); else router.navigate('/'); }
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={consulta.isRefetching} onRefresh={() => { void consulta.refetch(); }} tintColor={theme.colors.champagne} />}>
      <Cabecalho titulo="Cápsula do tempo" kicker={data ? `Natal ${data.ano}` : 'Natal em Família'} aoVoltar={voltar} />
      <View style={styles.content}>
        <Text variant="muted">Escreva hoje. A mensagem fica lacrada e só abre na ceia do ano que vem{data ? `, em ${data.abertura_texto}` : ''}.</Text>
        {consulta.isPending ? <Skeleton style={{ height: 160 }} /> : null}
        {consulta.isError ? <EmptyState title="A cápsula não abriu" message={consulta.error.message} action="Tentar novamente" onAction={() => { void consulta.refetch(); }} /> : null}
        {data ? <>
          <Surface><Text variant="kicker">Lacrada</Text><Text variant="display" style={styles.titulo}>{data.frase}</Text></Surface>
          <Button variant="ghost" onPress={() => setForm(true)}>Guardar uma mensagem</Button>
          {data.minhas.map((item) => <Surface key={item.id} style={styles.stack}>
            <Text variant="kicker">Sua mensagem</Text>
            <Text variant="display" style={styles.titulo}>Para {item.para_nome}</Text>
            <Text variant="muted">Lacrada. Abre em {item.abre_em_texto}.{item.tem_foto ? ' Tem uma foto junto.' : ''}</Text>
            <Text variant="muted">Ninguém consegue ler enquanto estiver fechada, nem você.</Text>
            {item.pode_editar ? <Button variant="ghost" disabled={escrita.busy} onPress={() => setEditando(item)}>Trocar mensagem</Button> : null}
            {item.pode_editar || data.eu.admin ? <Button variant="quiet" disabled={escrita.busy} onPress={() => confirmar('Apagar esta mensagem lacrada?', () => escrita.executar(() => api(`/api/capsula/${item.id}`, { method: 'DELETE' })))}>Apagar</Button> : null}
          </Surface>)}
          {data.aguardando ? <Text variant="muted">{data.aguardando.total === 1 ? '1 mensagem abre' : `${data.aguardando.total} mensagens abrem`} em {data.aguardando.abre_em_texto}. Até lá, o texto fica guardado.</Text> : null}
          {data.abertas.length ? <>
            <Rise><Surface style={styles.centro}><Text variant="kicker">Aberta</Text><Text variant="display" style={styles.titulo}>A cápsula abriu</Text><Text variant="muted" style={styles.centroTexto}>As mensagens guardadas no Natal anterior estão aqui.</Text></Surface></Rise>
            {data.abertas.map((item, indice) => <Rise key={item.id} index={indice + 1}><Surface style={styles.stack}>
              <View style={styles.autor}><Avatar name={item.author_name} src={item.avatar_url} /><View style={styles.flex}><Text variant="kicker">Para {item.para_nome}</Text><Text>{item.author_name}</Text></View></View>
              <Text>{item.texto}</Text>
              {item.image_url ? <Image source={{ uri: item.image_url }} contentFit="cover" style={styles.foto} accessibilityLabel="Foto da mensagem" /> : null}
              {item.pode_apagar ? <Button variant="quiet" disabled={escrita.busy} onPress={() => confirmar('Apagar esta mensagem?', () => escrita.executar(() => api(`/api/capsula/${item.id}`, { method: 'DELETE' })))}>Apagar</Button> : null}
              {item.user_id !== data.eu.id ? <ModerationActions userId={item.user_id} name={item.author_name} alvoTipo="capsula" alvoId={item.id} onDone={() => { void consulta.refetch(); }} /> : null}
            </Surface></Rise>)}
          </> : null}
          <Sheet visible={form} title="Guardar uma mensagem" onClose={() => setForm(false)}>
            <Formulario familia={data.familia} eu={data.eu.id} busy={escrita.busy} onClose={() => setForm(false)} salvar={(preparar) => escrita.executar(async () => { await api('/api/capsula', { method: 'POST', json: await preparar() }); setForm(false); })} />
          </Sheet>
          <Sheet visible={editando != null} title="Trocar mensagem" onClose={() => setEditando(null)}>
            {editando ? <Formulario familia={data.familia} eu={data.eu.id} busy={escrita.busy} trocar destino={editando.para_user_id} temFoto={editando.tem_foto} onClose={() => setEditando(null)} salvar={(preparar) => escrita.executar(async () => { await api(`/api/capsula/${editando.id}`, { method: 'PATCH', json: await preparar() }); setEditando(null); })} /> : null}
          </Sheet>
        </> : null}
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

function confirmar(titulo: string, aoConfirmar: () => void) {
  Alert.alert(titulo, 'Não tem como desfazer.', [{ text: 'Voltar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: aoConfirmar }]);
}

function Formulario({ familia, eu, busy, destino = null, temFoto = false, trocar = false, onClose, salvar }: {
  familia: PessoaResumo[]; eu: number; busy: boolean; destino?: number | null; temFoto?: boolean; trocar?: boolean; onClose: () => void;
  salvar: (preparar: () => Promise<Record<string, unknown>>) => void;
}) {
  const toast = useToast();
  const [texto, setTexto] = useState('');
  const [para, setPara] = useState<number | null>(destino);
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
    <Text variant="muted">{trocar ? 'A anterior continua lacrada. Esta aqui substitui ela.' : 'Ela abre na próxima ceia. Até lá, nem você consegue ler.'}</Text>
    <Text variant="muted">Para quem</Text>
    <ScrollView style={styles.lista} nestedScrollEnabled keyboardShouldPersistTaps="handled">
      <Button variant={para == null ? 'primary' : 'ghost'} selected={para == null} disabled={busy} onPress={() => setPara(null)}>A família toda</Button>
      {familia.map((pessoa) => <Button key={pessoa.id} variant={para === pessoa.id ? 'primary' : 'ghost'} selected={para === pessoa.id} disabled={busy} onPress={() => setPara(pessoa.id)}>{pessoa.id === eu ? `${pessoa.name} (para mim)` : pessoa.name}</Button>)}
    </ScrollView>
    <Field label="Mensagem" value={texto} onChangeText={setTexto} multiline maxLength={4000} editable={!busy} placeholder="O que você quer que a família leia?" />
    <Button variant="ghost" disabled={busy} onPress={() => { void escolher('galeria'); }}>Escolher foto</Button>
    <Button variant="ghost" disabled={busy} onPress={() => { void escolher('camera'); }}>Tirar foto</Button>
    {foto ? <Text variant="muted">Foto pronta para enviar.</Text> : null}
    {temFoto ? <Button variant={tirar ? 'primary' : 'ghost'} selected={tirar} disabled={busy} onPress={() => { setTirar((valor) => !valor); setFoto(null); }}>Tirar a foto antiga</Button> : null}
    <Button loading={busy} disabled={busy || !texto.trim()} onPress={() => salvar(async () => {
      const json: Record<string, unknown> = { texto: texto.trim(), para_user_id: para };
      if (foto) json.image_url = await enviarFoto(foto);
      else if (tirar) json.image_url = null;
      return json;
    })}>Guardar</Button>
    <Button variant="quiet" disabled={busy} onPress={onClose}>Cancelar</Button>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { paddingBottom: 48 },
  content: { padding: 20, gap: 20 },
  stack: { gap: 14, paddingBottom: 12 },
  titulo: { fontSize: 28, lineHeight: 36 },
  centro: { alignItems: 'center', gap: 8 },
  centroTexto: { textAlign: 'center' },
  autor: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  foto: { width: '100%', height: 220, borderRadius: 14 },
  lista: { maxHeight: 180 },
  folha: { maxHeight: 520 },
});
