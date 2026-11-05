import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError, queryClient, sessionStore } from '../../api';
import { theme } from '../../theme';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Sheet } from '../../ui/Sheet';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { ModerationActions } from '../moderacao/Actions';
import { sessaoVigente } from '../familia/sessao';
import { ceiaKeys } from './chaves';
import { Secao } from './Secao';
import { CATEGORIAS, type CategoriaPrato, type CeiaDados, type CeiaPrato } from './tipos';
import { avisoPratos, quemLeva, rotuloCategoria } from './texto';

type Modo = 'levo' | 'falta' | null;

export function PratosCeia({ pratos, usuarioId, admin }: { pratos: CeiaPrato[]; usuarioId: number; admin: boolean }) {
  const toast = useToast();
  const [modo, setModo] = useState<Modo>(null);
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState<CategoriaPrato>('salgado');
  const [quantidade, setQuantidade] = useState('');
  const aviso = nome.trim().length >= 2 ? avisoPratos(pratos, nome, categoria) : null;
  const criar = useMutation({
    mutationFn: (vars: { preciso: boolean; nome: string; categoria: CategoriaPrato; quantidade: string; generation: number }) => {
      if (!sessaoVigente(vars.generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      return api<{ prato: CeiaPrato; aviso: string | null }>('/api/ceia/pratos', {
        method: 'POST',
        json: { nome: vars.nome, categoria: vars.categoria, quantidade: vars.quantidade, preciso: vars.preciso },
      });
    },
    onSuccess: (resp, vars) => {
      if (!sessaoVigente(vars.generation)) return;
      queryClient.setQueryData<CeiaDados>(ceiaKeys.tudo, (atual) => atual ? { ...atual, pratos: [...atual.pratos.filter((item) => item.id !== resp.prato.id), resp.prato] } : atual);
      setModo(null);
      setNome('');
      setQuantidade('');
      toast(resp.aviso ? `Anotado. ${resp.aviso}` : 'Anotado na lista da ceia.');
    },
    onError: (erro) => toast(erro.message, 'error'),
    onSettled: (_dado, _erro, vars) => {
      if (!vars || !sessaoVigente(vars.generation)) return;
      void queryClient.invalidateQueries({ queryKey: ceiaKeys.tudo });
    },
  });
  const mudar = useMutation({
    mutationFn: async (vars: { id: number; tipo: 'assumir' | 'desistir' | 'apagar'; generation: number }) => {
      if (!sessaoVigente(vars.generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      if (vars.tipo === 'apagar') {
        await api(`/api/ceia/pratos/${vars.id}`, { method: 'DELETE' });
        return null;
      }
      return api<CeiaPrato>(`/api/ceia/pratos/${vars.id}`, { method: 'POST', json: { acao: vars.tipo } });
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ceiaKeys.tudo });
      const anterior = queryClient.getQueryData<CeiaDados>(ceiaKeys.tudo);
      if (anterior && sessaoVigente(vars.generation)) {
        queryClient.setQueryData<CeiaDados>(ceiaKeys.tudo, {
          ...anterior,
          pratos: vars.tipo === 'apagar'
            ? anterior.pratos.filter((item) => item.id !== vars.id)
            : anterior.pratos.map((item) => item.id === vars.id ? {
              ...item,
              responsavel_id: vars.tipo === 'assumir' ? usuarioId : null,
              responsavel_nome: vars.tipo === 'assumir' ? 'Você' : null,
            } : item),
        });
      }
      return { anterior };
    },
    onError: (erro, vars, ctx) => {
      if (ctx?.anterior && sessaoVigente(vars.generation)) queryClient.setQueryData(ceiaKeys.tudo, ctx.anterior);
      toast(erro.message, 'error');
    },
    onSuccess: (resp, vars) => {
      if (!sessaoVigente(vars.generation)) return;
      if (resp) {
        queryClient.setQueryData<CeiaDados>(ceiaKeys.tudo, (atual) => atual ? { ...atual, pratos: atual.pratos.map((item) => item.id === resp.id ? resp : item) } : atual);
      }
      toast(vars.tipo === 'apagar' ? 'Item apagado.' : vars.tipo === 'assumir' ? 'Combinado, você leva.' : 'Tudo bem, outra pessoa pode levar.');
    },
    onSettled: (_dado, _erro, vars) => {
      if (!vars || !sessaoVigente(vars.generation)) return;
      void queryClient.invalidateQueries({ queryKey: ceiaKeys.tudo });
    },
  });
  function abrir(proximo: Modo) {
    setNome('');
    setQuantidade('');
    setCategoria('salgado');
    setModo(proximo);
  }
  function anotar() {
    if (criar.isPending || !modo) return;
    if (!nome.trim()) { toast('Escreva o que vai para a mesa.', 'error'); return; }
    criar.mutate({ preciso: modo === 'falta', nome: nome.trim(), categoria, quantidade: quantidade.trim(), generation: sessionStore.getGeneration() });
  }
  function apagar(prato: CeiaPrato) {
    Alert.alert('Apagar da lista?', prato.nome, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => mudar.mutate({ id: prato.id, tipo: 'apagar', generation: sessionStore.getGeneration() }) },
    ]);
  }
  return <Secao indice="03" kicker="Quem leva o quê" titulo="A mesa" texto="Diga o que você leva, ou assuma algo que ainda está sem dono.">
    <Button onPress={() => abrir('levo')}>Eu levo um prato</Button>
    {admin ? <Button variant="ghost" onPress={() => abrir('falta')}>Precisamos de algo</Button> : null}
    {pratos.length ? CATEGORIAS.map((grupo) => {
      const itens = pratos.filter((prato) => prato.categoria === grupo.id).sort((a, b) => Number(Boolean(a.responsavel_id)) - Number(Boolean(b.responsavel_id)) || a.nome.localeCompare(b.nome, 'pt-BR'));
      if (!itens.length) return null;
      return <View key={grupo.id} style={styles.grupo}>
        <Text variant="kicker">{rotuloCategoria(grupo.id)} ({itens.length})</Text>
        {itens.map((prato) => <View key={prato.id} style={styles.cartao}>
          <Text>{prato.nome}</Text>
          {prato.quantidade ? <Text variant="muted">{prato.quantidade}</Text> : null}
          <Text variant="muted">{quemLeva(prato, usuarioId)}</Text>
          <View style={styles.acoes}>
            {!prato.responsavel_id ? <Button style={styles.flex} disabled={mudar.isPending} onPress={() => mudar.mutate({ id: prato.id, tipo: 'assumir', generation: sessionStore.getGeneration() })}>Eu levo</Button> : null}
            {prato.responsavel_id === usuarioId ? <Button style={styles.flex} variant="ghost" disabled={mudar.isPending} onPress={() => mudar.mutate({ id: prato.id, tipo: 'desistir', generation: sessionStore.getGeneration() })}>Desistir</Button> : null}
            {prato.user_id === usuarioId || admin ? <Button style={styles.flex} variant="quiet" disabled={mudar.isPending} onPress={() => apagar(prato)}>Apagar</Button> : null}
          </View>
          {prato.user_id !== usuarioId ? <ModerationActions userId={prato.user_id} name={prato.autor_nome} alvoTipo="prato" alvoId={prato.id} onDone={() => { void queryClient.invalidateQueries({ queryKey: ceiaKeys.tudo }); }} /> : null}
        </View>)}
      </View>;
    }) : <Text variant="muted">A lista ainda está vazia. Se for levar algo, avise a família.</Text>}
    <Sheet visible={modo !== null} onClose={() => { if (!criar.isPending) setModo(null); }} title={modo === 'falta' ? 'Precisamos de' : 'Eu levo'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.folha}>
        <Field label="O que é" value={nome} onChangeText={setNome} placeholder="Ex.: pavê, gelo, guardanapo" maxLength={80} />
        {aviso ? <Text style={styles.aviso}>{aviso} Pode levar mesmo assim.</Text> : null}
        <Text variant="muted">Categoria</Text>
        <View style={styles.categorias}>
          {CATEGORIAS.map((item) => <Button key={item.id} style={styles.cat} variant={categoria === item.id ? 'primary' : 'ghost'} selected={categoria === item.id} onPress={() => setCategoria(item.id)}>{item.rotulo}</Button>)}
        </View>
        <Field label="Quantidade (se quiser)" value={quantidade} onChangeText={setQuantidade} placeholder="Ex.: 2 travessas" maxLength={40} />
        <Button loading={criar.isPending} onPress={anotar}>{modo === 'falta' ? 'Anunciar o que falta' : 'Eu levo'}</Button>
      </ScrollView>
    </Sheet>
  </Secao>;
}

const styles = StyleSheet.create({
  grupo: { gap: 10 },
  cartao: { gap: 6, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.card, backgroundColor: theme.colors.surface, padding: 16 },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  flex: { flexGrow: 1 },
  folha: { gap: 14, paddingBottom: 12 },
  aviso: { color: theme.colors.champagne },
  categorias: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cat: { minWidth: 108 },
});
