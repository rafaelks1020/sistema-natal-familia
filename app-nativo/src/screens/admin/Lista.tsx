import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Switch, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Copy from 'lucide-react-native/icons/copy';
import Search from 'lucide-react-native/icons/search';
import Trash from 'lucide-react-native/icons/trash';
import { api } from '../../api';
import { brl } from '../../format';
import { theme } from '../../theme';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Field } from '../../ui/Field';
import { Sheet } from '../../ui/Sheet';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { Cabecalho } from '../familia/Cabecalho';
import { abrirLink, formatar, urlAbsoluta, voltar } from './comum';
import { adminKeys, type Editavel, type ItemAdmin, type PaginaRecurso, type RecursoMeta, type RespostaAcao } from './tipos';

type Valor = string | boolean;

function paraCampo(item: ItemAdmin, e: Editavel): Valor {
  const v = item[e.campo];
  if (e.tipo === 'bool') return Boolean(v);
  if (v === null || v === undefined) return '';
  if (e.tipo === 'dinheiro' && typeof v === 'number') return (v / 100).toFixed(2).replace('.', ',');
  return String(v);
}

/** Converte o que foi digitado para o valor do contrato; devolve undefined se inválido. */
function paraEnvio(e: Editavel, v: Valor): string | number | boolean | undefined {
  if (e.tipo === 'bool') return Boolean(v);
  const texto = String(v).trim();
  if (e.tipo === 'dinheiro') {
    const n = Number(texto.replace(/\./g, '').replace(',', '.'));
    return texto && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
  }
  if (e.tipo === 'numero') {
    const n = Number(texto.replace(',', '.'));
    return texto && Number.isFinite(n) ? n : undefined;
  }
  return String(v);
}

export default function Lista() {
  const { recurso: param } = useLocalSearchParams<{ recurso: string }>();
  const recurso = String(param ?? '');
  const toast = useToast();
  const cliente = useQueryClient();
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [aberto, setAberto] = useState<number | string | null>(null);
  const [senha, setSenha] = useState('');

  useEffect(() => { const t = setTimeout(() => setQ(texto.trim()), 350); return () => clearTimeout(t); }, [texto]);

  const consulta = useInfiniteQuery({
    queryKey: adminKeys.lista(recurso, q),
    enabled: Boolean(recurso),
    initialPageParam: null as string | null,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam, signal }) => {
      const partes = [`q=${encodeURIComponent(q)}`];
      if (pageParam) partes.push(`cursor=${encodeURIComponent(pageParam)}`);
      return api<PaginaRecurso>(`/api/admin/r/${encodeURIComponent(recurso)}?${partes.join('&')}`, { signal });
    },
    getNextPageParam: (ultima) => ultima.proximo ?? undefined,
  });
  const meta: RecursoMeta | undefined = consulta.data?.pages[0]?.recurso;
  const itens = useMemo(() => consulta.data?.pages.flatMap((p) => p.itens) ?? [], [consulta.data]);
  const selecionado = aberto === null ? null : itens.find((i) => String(i.id) === String(aberto)) ?? null;
  const invalidar = () => { void cliente.invalidateQueries({ queryKey: adminKeys.listaRaiz(recurso) }); void cliente.invalidateQueries({ queryKey: adminKeys.resumo }); };

  const salvar = useMutation({
    mutationFn: (v: { id: number | string; corpo: Record<string, unknown> }) => api<{ ok: boolean; item: ItemAdmin }>(`/api/admin/r/${encodeURIComponent(recurso)}/${encodeURIComponent(String(v.id))}`, { method: 'PATCH', json: v.corpo }),
    onSuccess: () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); toast('Alterações salvas.'); invalidar(); },
    onError: (erro) => toast(erro.message, 'error'),
  });
  const apagar = useMutation({
    mutationFn: (id: number | string) => api<{ ok: boolean }>(`/api/admin/r/${encodeURIComponent(recurso)}/${encodeURIComponent(String(id))}`, { method: 'DELETE' }),
    onSuccess: () => { setAberto(null); toast('Item apagado.'); invalidar(); },
    onError: (erro) => toast(erro.message, 'error'),
  });
  const acionar = useMutation({
    mutationFn: (v: { id: number | string; acao: string }) => api<RespostaAcao>(`/api/admin/r/${encodeURIComponent(recurso)}/${encodeURIComponent(String(v.id))}/acao`, { method: 'POST', json: { acao: v.acao } }),
    onSuccess: (r) => {
      if (r.senha_temporaria) { setAberto(null); setSenha(r.senha_temporaria); }
      toast(r.mensagem ?? 'Pronto.');
      invalidar();
    },
    onError: (erro) => toast(erro.message, 'error'),
  });
  const ocupado = salvar.isPending || apagar.isPending || acionar.isPending;

  function confirmarApagar(item: ItemAdmin) {
    Alert.alert('Apagar este item?', 'Isso não pode ser desfeito.', [
      { text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: () => apagar.mutate(item.id) },
    ]);
  }
  function executarAcao(item: ItemAdmin, id: string, rotulo: string, perigosa: boolean) {
    if (!perigosa) { acionar.mutate({ id: item.id, acao: id }); return; }
    Alert.alert(`${rotulo}?`, 'Confirme para continuar. Essa ação pode ser difícil de desfazer.', [
      { text: 'Cancelar', style: 'cancel' }, { text: rotulo, style: 'destructive', onPress: () => acionar.mutate({ id: item.id, acao: id }) },
    ]);
  }
  async function copiar() {
    try { await Clipboard.setStringAsync(senha); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); toast('Senha copiada.'); }
    catch { toast('Não foi possível copiar. Selecione a senha e copie manualmente.', 'error'); }
  }

  const cabecalho = <View>
    <Cabecalho kicker="Painel admin" titulo={meta?.nome ?? 'Carregando'} aoVoltar={voltar} />
    <View style={styles.busca}>
      <Field label="Buscar" value={texto} onChangeText={setTexto} placeholder="Digite para buscar" autoCapitalize="none" autoCorrect={false} returnKeyType="search"
        trailing={<View style={styles.lupa}><Search size={18} color={theme.colors.muted} strokeWidth={1.5} /></View>} />
    </View>
  </View>;

  return <View style={styles.pagina}>
    <FlatList
      data={itens}
      keyExtractor={(i) => String(i.id)}
      ListHeaderComponent={cabecalho}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.miolo}
      onEndReachedThreshold={0.4}
      onEndReached={() => { if (consulta.hasNextPage && !consulta.isFetchingNextPage) void consulta.fetchNextPage(); }}
      refreshing={consulta.isRefetching && !consulta.isFetchingNextPage && !consulta.isPlaceholderData}
      onRefresh={() => { void consulta.refetch(); }}
      renderItem={({ item }) => meta ? <Linha item={item} meta={meta} onPress={() => setAberto(item.id)} /> : null}
      ListEmptyComponent={consulta.isPending ? <View style={styles.esqueleto}><Skeleton style={{ height: 64 }} /><Skeleton style={{ height: 64 }} /><Skeleton style={{ height: 64 }} /></View>
        : consulta.isError ? <EmptyState title="Não deu para carregar" message={consulta.error.message} action="Tentar novamente" onAction={() => { void consulta.refetch(); }} />
        : <EmptyState title="Nada por aqui" message={q ? 'Nenhum resultado para essa busca.' : 'Ainda não há registros neste recurso.'} />}
      ListFooterComponent={consulta.isFetchingNextPage ? <ActivityIndicator color={theme.colors.champagne} style={styles.rodape} /> : undefined}
    />
    <Sheet visible={selecionado !== null && meta !== undefined} title={selecionado && meta ? String(formatar(selecionado[meta.colunas[0]?.campo ?? 'id'], meta.colunas[0]?.tipo ?? 'texto')).slice(0, 40) : 'Detalhes'} onClose={() => { if (!ocupado) setAberto(null); }}>
      {selecionado && meta ? <Detalhe key={String(selecionado.id)} item={selecionado} meta={meta} ocupado={ocupado} salvando={salvar.isPending}
        onSalvar={(corpo) => salvar.mutate({ id: selecionado.id, corpo })} onApagar={() => confirmarApagar(selecionado)}
        onAcao={(a) => executarAcao(selecionado, a.id, a.rotulo, a.perigosa)} acionando={acionar.isPending} /> : null}
    </Sheet>
    <Sheet visible={senha !== ''} title="Senha temporária" onClose={() => setSenha('')}>
      <View style={styles.form}>
        <Text variant="muted">Compartilhe com a pessoa e peça para trocar no perfil. Ela só aparece desta vez.</Text>
        <Field label="Senha temporária" value={senha} editable={false} selectTextOnFocus style={styles.senha} />
        <Button onPress={() => { void copiar(); }} icon={<Copy size={16} color={theme.colors.ivory} strokeWidth={1.5} />}>Copiar senha</Button>
        <Button variant="ghost" onPress={() => setSenha('')}>Fechar</Button>
      </View>
    </Sheet>
  </View>;
}

function Linha({ item, meta, onPress }: { item: ItemAdmin; meta: RecursoMeta; onPress: () => void }) {
  const [primeira, ...resto] = meta.colunas.filter((c) => c.tipo !== 'imagem');
  const foto = meta.colunas.find((c) => c.tipo === 'imagem');
  const foto_url = foto ? urlAbsoluta(item[foto.campo]) : null;
  const detalhes = resto.slice(0, 2).map((c) => formatar(item[c.campo], c.tipo)).filter((t) => t !== '-').join(' · ');
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.linha, pressed && { opacity: 0.72 }]}>
    {foto_url ? <Image source={{ uri: foto_url }} contentFit="cover" style={styles.miniatura} accessibilityLabel="Imagem do item" /> : null}
    <View style={styles.flex}>
      <Text style={styles.linhaTitulo} numberOfLines={2}>{primeira ? formatar(item[primeira.campo], primeira.tipo) : `#${item.id}`}</Text>
      {detalhes ? <Text variant="muted" numberOfLines={2}>{detalhes}</Text> : null}
    </View>
    <ChevronRight size={18} color={theme.colors.champagne} strokeWidth={1.5} />
  </Pressable>;
}

function Detalhe({ item, meta, ocupado, salvando, acionando, onSalvar, onApagar, onAcao }: {
  item: ItemAdmin; meta: RecursoMeta; ocupado: boolean; salvando: boolean; acionando: boolean;
  onSalvar: (corpo: Record<string, unknown>) => void; onApagar: () => void; onAcao: (a: RecursoMeta['acoes'][number]) => void;
}) {
  const { height } = useWindowDimensions();
  const toast = useToast();
  const [valores, setValores] = useState<Record<string, Valor>>(() => Object.fromEntries(meta.editaveis.map((e) => [e.campo, paraCampo(item, e)])));
  const editaveis = new Set(meta.editaveis.map((e) => e.campo));
  const somenteLeitura = meta.colunas.filter((c) => !editaveis.has(c.campo));

  function guardar() {
    const corpo: Record<string, unknown> = {};
    for (const e of meta.editaveis) {
      if (valores[e.campo] === paraCampo(item, e)) continue;
      const v = paraEnvio(e, valores[e.campo] ?? '');
      if (v === undefined) { toast(`Valor inválido em "${e.rotulo}".`, 'error'); return; }
      corpo[e.campo] = v;
    }
    if (!Object.keys(corpo).length) { toast('Nada mudou.'); return; }
    onSalvar(corpo);
  }
  const definir = (campo: string, v: Valor) => setValores((a) => ({ ...a, [campo]: v }));

  return <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: height * 0.62 }} contentContainerStyle={styles.form}>
    {somenteLeitura.map((c) => {
      const bruto = item[c.campo];
      const url = c.tipo === 'imagem' ? urlAbsoluta(bruto) : null;
      return <View key={c.campo} style={styles.campo}>
        <Text variant="kicker">{c.rotulo}</Text>
        {c.tipo === 'imagem' ? (url ? <Image source={{ uri: url }} contentFit="contain" style={styles.imagem} accessibilityLabel={c.rotulo} /> : <Text variant="muted">-</Text>)
          : c.tipo === 'link' && urlAbsoluta(bruto) ? <Pressable accessibilityRole="link" onPress={() => abrirLink(bruto)} style={styles.alvo}><Text style={styles.link} selectable>{String(bruto)}</Text></Pressable>
          : <Text selectable>{c.tipo === 'dinheiro' && typeof bruto === 'number' ? brl(bruto / 100) : formatar(bruto, c.tipo)}</Text>}
      </View>;
    })}
    {meta.editaveis.length ? <View style={styles.edicao}>
      <Text variant="kicker">Editar</Text>
      {meta.editaveis.map((e) => {
        const v = valores[e.campo];
        if (e.tipo === 'bool') return <View key={e.campo} style={styles.interruptor}>
          <Text style={styles.flex}>{e.rotulo}</Text>
          <Switch value={Boolean(v)} onValueChange={(x) => definir(e.campo, x)} trackColor={{ true: theme.colors.cherry, false: theme.colors.field }} thumbColor={theme.colors.ivory} accessibilityLabel={e.rotulo} />
        </View>;
        if (e.tipo === 'opcao') return <View key={e.campo} style={styles.campo}>
          <Text variant="muted">{e.rotulo}</Text>
          <View style={styles.chips}>
            {(e.opcoes ?? []).map((o) => <Pressable key={o} accessibilityRole="button" accessibilityState={{ selected: v === o }} onPress={() => definir(e.campo, o)} style={[styles.chip, v === o && styles.chipAtivo]}>
              <Text style={{ fontSize: 14, color: v === o ? theme.colors.ivory : theme.colors.secondary }}>{o}</Text>
            </Pressable>)}
          </View>
        </View>;
        return <Field key={e.campo} label={e.tipo === 'dinheiro' ? `${e.rotulo} (R$)` : e.rotulo} value={String(v ?? '')} onChangeText={(t) => definir(e.campo, t)}
          multiline={e.tipo === 'longo'} style={e.tipo === 'longo' ? styles.longo : undefined}
          keyboardType={e.tipo === 'numero' ? 'numeric' : e.tipo === 'dinheiro' ? 'decimal-pad' : 'default'} />;
      })}
      <Button loading={salvando} disabled={ocupado} onPress={guardar}>Salvar alterações</Button>
    </View> : null}
    {meta.acoes.length ? <View style={styles.edicao}>
      <Text variant="kicker">Ações</Text>
      {meta.acoes.map((a) => <Button key={a.id} variant={a.perigosa ? 'ghost' : 'quiet'} loading={acionando} disabled={ocupado} onPress={() => onAcao(a)}>{a.rotulo}</Button>)}
    </View> : null}
    {meta.pode_apagar ? <Button variant="ghost" disabled={ocupado} onPress={onApagar} icon={<Trash size={16} color={theme.colors.error} strokeWidth={1.5} />}>Apagar</Button> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1, minWidth: 0 },
  miolo: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 48 },
  busca: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8 },
  lupa: { paddingRight: 14 },
  esqueleto: { paddingHorizontal: 24, gap: 12 },
  rodape: { paddingVertical: 20 },
  linha: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 24, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  linhaTitulo: { fontFamily: theme.fonts.medium, fontSize: 15 },
  miniatura: { width: 48, height: 48, borderRadius: 10, backgroundColor: theme.colors.field },
  form: { gap: 14, paddingBottom: 8 },
  campo: { gap: 6 },
  alvo: { minHeight: 44, justifyContent: 'center' },
  link: { color: theme.colors.champagne, textDecorationLine: 'underline' },
  imagem: { width: '100%', height: 200, borderRadius: 12, backgroundColor: theme.colors.field },
  edicao: { gap: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.colors.line },
  interruptor: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  longo: { minHeight: 100, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: theme.radius.button, borderWidth: 1, borderColor: theme.colors.line, justifyContent: 'center' },
  chipAtivo: { borderColor: theme.colors.cherry, backgroundColor: theme.colors.cherry },
  senha: { textAlign: 'center', fontSize: 22, letterSpacing: 3, color: theme.colors.champagne },
});
