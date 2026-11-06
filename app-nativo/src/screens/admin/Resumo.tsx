import { useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import Check from 'lucide-react-native/icons/check';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Megaphone from 'lucide-react-native/icons/megaphone';
import ScrollText from 'lucide-react-native/icons/scroll-text';
import Wrench from 'lucide-react-native/icons/wrench';
import { api, API_BASE_URL } from '../../api';
import type { Membro } from '../../types/familia';
import { theme } from '../../theme';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Field } from '../../ui/Field';
import { Sheet } from '../../ui/Sheet';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { Cabecalho } from '../familia/Cabecalho';
import { familiaKeys } from '../familia/chaves';
import { voltar } from './comum';
import { adminKeys, type Resumo as ResumoDados } from './tipos';

const PENDENCIAS = [
  { chave: 'denuncias', recurso: 'denuncias', rotulo: 'Denúncias' },
  { chave: 'pedidos_convite', recurso: 'pedidos_convite', rotulo: 'Pedidos de convite' },
  { chave: 'bingo_pendentes', recurso: 'bingo', rotulo: 'Bingo para conferir' },
] as const;

export default function Resumo() {
  const toast = useToast();
  const resumo = useQuery({ queryKey: adminKeys.resumo, queryFn: ({ signal }) => api<ResumoDados>('/api/admin/resumo', { signal }) });
  const [aviso, setAviso] = useState(false);

  function abrirRecurso(id: string) { router.push(`/admin/${id}` as Href); }
  function abrirFerramenta(rotaApp: string, rotaSite: string) {
    if (rotaApp && !rotaApp.startsWith('web:')) router.push(rotaApp as Href);
    else {
      const caminho = rotaApp.startsWith('web:') ? rotaApp.slice(4) : rotaSite;
      if (caminho) void Linking.openURL(`${API_BASE_URL}${caminho}`).catch(() => toast('Não foi possível abrir o link.', 'error'));
    }
  }
  const dados = resumo.data;
  const pendencias = dados ? PENDENCIAS.map((p) => ({ ...p, total: dados.pendencias[p.chave] ?? 0 })) : [];
  // O bingo pode ter id composto; usa o primeiro recurso que começa com "bingo".
  function recursoDe(p: typeof PENDENCIAS[number]): string {
    const achado = dados?.grupos.flatMap((g) => g.recursos).find((r) => r.id === p.recurso || r.id.startsWith(p.recurso));
    return achado?.id ?? p.recurso;
  }
  return <View style={styles.pagina}>
    <ScrollView contentContainerStyle={styles.miolo} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={resumo.isRefetching && !resumo.isPending} onRefresh={() => { void resumo.refetch(); }} tintColor={theme.colors.champagne} colors={[theme.colors.cherry]} progressBackgroundColor={theme.colors.surface} />}>
      <Cabecalho kicker="Tudo sob controle" titulo="Painel admin" aoVoltar={voltar} />
      {resumo.isPending ? <View style={styles.esqueleto}><Skeleton style={{ height: 110 }} /><Skeleton style={{ height: 200 }} /><Skeleton style={{ height: 200 }} /></View>
        : !dados ? <View style={styles.corpo}><EmptyState title="Não deu para abrir o painel" message={resumo.error?.message ?? 'Tente novamente.'} action="Tentar novamente" onAction={() => { void resumo.refetch(); }} /></View>
        : <View style={styles.corpo}>
          <View style={styles.secao}>
            <Text variant="kicker">Pendências</Text>
            <View style={styles.pendencias}>
              {pendencias.map((p) => <Pressable key={p.chave} accessibilityRole="button" accessibilityLabel={`${p.rotulo}: ${p.total}`} onPress={() => abrirRecurso(recursoDe(p))}
                style={({ pressed }) => [styles.pendencia, p.total > 0 && styles.pendenciaViva, pressed && styles.pressionado]}>
                <Text variant="numeral" style={[styles.pendenciaNumero, p.total > 0 && { color: theme.colors.champagne }]}>{p.total}</Text>
                <Text variant="muted" style={styles.pendenciaRotulo}>{p.rotulo}</Text>
              </Pressable>)}
            </View>
          </View>

          <Button onPress={() => setAviso(true)} icon={<Megaphone size={16} color={theme.colors.ivory} strokeWidth={1.5} />}>Enviar aviso para a família</Button>

          {dados.grupos.map((grupo) => <View key={grupo.titulo} style={styles.secao}>
            <Text variant="kicker">{grupo.titulo}</Text>
            <View>
              {grupo.recursos.map((r) => <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`${r.nome}, ${r.total} registros`} onPress={() => abrirRecurso(r.id)}
                style={({ pressed }) => [styles.linha, pressed && styles.pressionado]}>
                <View style={styles.flex}>
                  <Text style={styles.linhaTitulo}>{r.nome}</Text>
                  {r.novos7d > 0 ? <Text variant="muted" style={styles.novos}>+{r.novos7d} nos últimos 7 dias</Text> : null}
                </View>
                <Text variant="numeral" style={styles.total}>{r.total}</Text>
                <ChevronRight size={18} color={theme.colors.champagne} strokeWidth={1.5} />
              </Pressable>)}
            </View>
          </View>)}

          {dados.ferramentas.length ? <View style={styles.secao}>
            <Text variant="kicker">Ferramentas de organizador</Text>
            <View>
              {dados.ferramentas.map((f) => <Pressable key={f.titulo} accessibilityRole="button" accessibilityLabel={f.titulo} onPress={() => abrirFerramenta(f.rota_app, f.rota_site)}
                style={({ pressed }) => [styles.linha, pressed && styles.pressionado]}>
                <Wrench size={18} color={theme.colors.champagne} strokeWidth={1.5} />
                <View style={styles.flex}>
                  <Text style={styles.linhaTitulo}>{f.titulo}</Text>
                  <Text variant="muted">{f.texto}</Text>
                </View>
                <ChevronRight size={18} color={theme.colors.champagne} strokeWidth={1.5} />
              </Pressable>)}
            </View>
          </View> : null}

          <Pressable accessibilityRole="button" accessibilityLabel="Ver o registro de ações" onPress={() => router.push('/admin/log' as Href)} style={({ pressed }) => [styles.linha, pressed && styles.pressionado]}>
            <ScrollText size={18} color={theme.colors.champagne} strokeWidth={1.5} />
            <View style={styles.flex}>
              <Text style={styles.linhaTitulo}>Registro de ações</Text>
              <Text variant="muted">Tudo o que foi mudado aqui no painel.</Text>
            </View>
            <ChevronRight size={18} color={theme.colors.champagne} strokeWidth={1.5} />
          </Pressable>
        </View>}
    </ScrollView>
    <FolhaAviso visible={aviso} onClose={() => setAviso(false)} />
  </View>;
}

function FolhaAviso({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const toast = useToast();
  const { height } = useWindowDimensions();
  const [titulo, setTitulo] = useState('');
  const [corpo, setCorpo] = useState('');
  const [todos, setTodos] = useState(true);
  const [escolhidos, setEscolhidos] = useState<number[]>([]);
  const familia = useQuery({ queryKey: familiaKeys.lista, enabled: visible, queryFn: ({ signal }) => api<Membro[]>('/api/family', { signal }) });
  const pessoas = (familia.data ?? []).filter((m): m is Membro & { id: number } => m.id !== null && m.has_login);
  const enviar = useMutation({
    mutationFn: (json: { titulo: string; corpo: string; user_ids?: number[] }) => api<{ ok: boolean; enviados: number }>('/api/admin/aviso', { method: 'POST', json }),
    onSuccess: (r) => {
      toast(r.enviados === 1 ? 'Aviso enviado para 1 pessoa.' : `Aviso enviado para ${r.enviados} pessoas.`);
      setTitulo(''); setCorpo(''); setEscolhidos([]); setTodos(true); onClose();
    },
    onError: (erro) => toast(erro.message, 'error'),
  });
  function alternar(id: number) { setEscolhidos((atual) => atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]); }
  function enviarAviso() {
    if (enviar.isPending) return;
    const t = titulo.trim(), c = corpo.trim();
    if (!t || !c) { toast('Escreva o título e o texto do aviso.', 'error'); return; }
    if (!todos && !escolhidos.length) { toast('Escolha pelo menos uma pessoa.', 'error'); return; }
    const json = todos ? { titulo: t, corpo: c } : { titulo: t, corpo: c, user_ids: escolhidos };
    Alert.alert('Enviar o aviso?', todos ? 'Todos da família vão receber agora.' : `${escolhidos.length} pessoa(s) vão receber agora.`, [
      { text: 'Cancelar', style: 'cancel' }, { text: 'Enviar', onPress: () => enviar.mutate(json) },
    ]);
  }
  return <Sheet visible={visible} title="Aviso para a família" onClose={() => { if (!enviar.isPending) onClose(); }}>
    <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: height * 0.6 }} contentContainerStyle={styles.form}>
      <Field label="Título" value={titulo} onChangeText={setTitulo} maxLength={80} />
      <Field label="Texto" value={corpo} onChangeText={setCorpo} maxLength={300} multiline style={styles.longo} />
      <Text variant="muted">Quem recebe</Text>
      <View style={styles.chips}>
        <Chip rotulo="Todos" ativo={todos} onPress={() => setTodos(true)} />
        <Chip rotulo="Escolher pessoas" ativo={!todos} onPress={() => setTodos(false)} />
      </View>
      {!todos ? (familia.isPending ? <Skeleton style={{ height: 80 }} /> : pessoas.map((p) => {
        const marcado = escolhidos.includes(p.id);
        return <Pressable key={p.id} accessibilityRole="checkbox" accessibilityState={{ checked: marcado }} onPress={() => alternar(p.id)} style={styles.pessoa}>
          <View style={[styles.caixa, marcado && styles.caixaMarcada]}>{marcado ? <Check size={14} color={theme.colors.ivory} strokeWidth={2} /> : null}</View>
          <Text>{p.name}</Text>
        </Pressable>;
      })) : null}
      <Button loading={enviar.isPending} onPress={enviarAviso}>Enviar aviso</Button>
    </ScrollView>
  </Sheet>;
}

function Chip({ rotulo, ativo, onPress }: { rotulo: string; ativo: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: ativo }} onPress={onPress} style={[styles.chip, ativo && styles.chipAtivo]}>
    <Text style={{ fontSize: 14, color: ativo ? theme.colors.ivory : theme.colors.secondary }}>{rotulo}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1, minWidth: 0 },
  miolo: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingBottom: 48 },
  corpo: { paddingHorizontal: 24, paddingTop: 8, gap: 24 },
  esqueleto: { padding: 24, gap: 20 },
  secao: { gap: 10 },
  pendencias: { flexDirection: 'row', gap: 10 },
  pendencia: { flex: 1, minHeight: 96, borderRadius: theme.radius.card, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface, padding: 14, justifyContent: 'space-between' },
  pendenciaViva: { borderColor: theme.colors.champagne },
  pendenciaNumero: { fontSize: 34, lineHeight: 40 },
  pendenciaRotulo: { fontSize: 12, lineHeight: 17 },
  linha: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  linhaTitulo: { fontFamily: theme.fonts.medium, fontSize: 15 },
  novos: { fontSize: 12 },
  total: { fontSize: 24, lineHeight: 32 },
  pressionado: { opacity: 0.72 },
  form: { gap: 14, paddingBottom: 8 },
  longo: { minHeight: 90, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: theme.radius.button, borderWidth: 1, borderColor: theme.colors.line, justifyContent: 'center' },
  chipAtivo: { borderColor: theme.colors.cherry, backgroundColor: theme.colors.cherry },
  pessoa: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  caixa: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  caixaMarcada: { backgroundColor: theme.colors.cherry, borderColor: theme.colors.cherry },
});
