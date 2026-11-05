import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Svg, { Line } from 'react-native-svg';
import Minus from 'lucide-react-native/icons/minus';
import Plus from 'lucide-react-native/icons/plus';
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
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { Cabecalho } from '../familia/Cabecalho';
import { useEscrita } from '../capsula/escrita';
import { CARTAO_A, CARTAO_L, desenharArvore, rotuloAnos } from './desenho';
import { arvoreKey, type ArvoreDados, type PessoaArvore, type TipoVinculo } from './data';

export default function Arvore() {
  const { status, user } = useSession();
  const params = useLocalSearchParams<{ pessoa?: string }>();
  const [escala, setEscala] = useState(1);
  const [escolha, setEscolha] = useState<number | null | undefined>(undefined);
  const [nova, setNova] = useState(false);
  const [ligarAberto, setLigarAberto] = useState(false);
  const [editando, setEditando] = useState(false);
  const consulta = useQuery({ queryKey: arvoreKey, enabled: status === 'authenticated', queryFn: ({ signal }) => api<ArvoreDados>('/api/arvore', { signal }) });
  const escrita = useEscrita(arvoreKey);
  const data = consulta.data;
  const bruto = Array.isArray(params.pessoa) ? params.pessoa[0] : params.pessoa;
  const pedido = Number(bruto);
  const pedidoValido = Number.isInteger(pedido) && data?.pessoas.some((item) => item.id === pedido) ? pedido : null;
  const escolhidaId = escolha === undefined ? pedidoValido : escolha;
  const pessoa = data?.pessoas.find((item) => item.id === escolhidaId) ?? null;
  const desenho = useMemo(() => desenharArvore(data?.pessoas.map((item) => item.id) ?? [], data?.vinculos ?? []), [data]);
  if (status !== 'authenticated' || !user) return null;
  function voltar() { if (router.canGoBack()) router.back(); else router.navigate('/'); }
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={consulta.isRefetching} onRefresh={() => { void consulta.refetch(); }} tintColor={theme.colors.champagne} />}>
      <Cabecalho titulo="Árvore da família" kicker="Natal em Família" aoVoltar={voltar} />
      <View style={styles.content}>
        <Text variant="muted">Quem veio antes, os casais e os filhos. Toque numa pessoa para ver o cartão.</Text>
        {consulta.isPending ? <Skeleton style={{ height: 220 }} /> : null}
        {consulta.isError ? <EmptyState title="A árvore não carregou" message={consulta.error.message} action="Tentar novamente" onAction={() => { void consulta.refetch(); }} /> : null}
        {data ? <>
          <Button variant="ghost" onPress={() => setNova(true)}>Adicionar pessoa</Button>
          {data.pessoas.length > 1 ? <Button variant="ghost" onPress={() => setLigarAberto(true)}>Ligar parentes</Button> : null}
          {!data.pessoas.length ? <EmptyState title="A árvore espera o primeiro nome" message="Comece por quem veio antes." /> : <>
            <View style={styles.zoom}>
              <Button style={styles.flex} variant="ghost" icon={<Minus color={theme.colors.ivory} size={16} />} onPress={() => setEscala((valor) => Math.max(1, Math.round((valor - 0.2) * 10) / 10))}>Diminuir</Button>
              <Button style={styles.flex} variant="ghost" icon={<Plus color={theme.colors.ivory} size={16} />} onPress={() => setEscala((valor) => Math.min(1.6, Math.round((valor + 0.2) * 10) / 10))}>Aumentar</Button>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator style={{ height: desenho.altura * escala }} contentContainerStyle={{ height: desenho.altura * escala }}>
              <View style={{ width: desenho.largura * escala, height: desenho.altura * escala }}>
                <Svg width={desenho.largura * escala} height={desenho.altura * escala} style={StyleSheet.absoluteFill}>
                  {desenho.linhas.map((linha, indice) => <Line key={indice} x1={linha.x1 * escala} y1={linha.y1 * escala} x2={linha.x2 * escala} y2={linha.y2 * escala} stroke={theme.colors.champagne} strokeWidth={1.25} />)}
                </Svg>
                {desenho.cartoes.map((cartao) => {
                  const item = data.pessoas.find((p) => p.id === cartao.id);
                  if (!item) return null;
                  const anos = rotuloAnos(item.nascimento_ano, item.falecimento_ano);
                  return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.nome} onPress={() => { setEscolha(item.id); setEditando(false); }} style={[styles.cartao, escolhidaId === item.id && styles.cartaoAtivo, { left: cartao.esquerda * escala, top: cartao.topo * escala, width: CARTAO_L * escala, height: CARTAO_A * escala }]}>
                    <Avatar name={item.nome} src={item.foto_url} size={28 * escala} />
                    <Text style={{ fontSize: 13 * escala, lineHeight: 18 * escala }} numberOfLines={2}>{item.nome}</Text>
                    {anos ? <Text variant="muted" style={{ fontSize: 11 * escala }} numberOfLines={1}>{anos}</Text> : null}
                  </Pressable>;
                })}
              </View>
            </ScrollView>
          </>}
          <Sheet visible={nova} title="Adicionar pessoa" onClose={() => setNova(false)}>
            <FormPessoa familia={data.familia} busy={escrita.busy} onClose={() => setNova(false)} salvar={(preparar) => escrita.executar(async () => { await api('/api/arvore', { method: 'POST', json: await preparar() }); setNova(false); })} />
          </Sheet>
          <Sheet visible={ligarAberto} title="Ligar parentes" onClose={() => setLigarAberto(false)}>
            <FormVinculo pessoas={data.pessoas} busy={escrita.busy} onClose={() => setLigarAberto(false)} salvar={(json) => escrita.executar(async () => { await api('/api/arvore/vinculos', { method: 'POST', json }); setLigarAberto(false); })} />
          </Sheet>
          <Sheet visible={pessoa != null} title={pessoa?.nome ?? 'Pessoa'} onClose={() => setEscolha(null)}>
            {pessoa ? <Cartao pessoa={pessoa} pessoas={data.pessoas} vinculos={data.vinculos.filter((v) => v.pessoa_id === pessoa.id || v.parente_id === pessoa.id)} familia={data.familia} busy={escrita.busy} editando={editando} setEditando={setEditando} executar={escrita.executar} fechar={() => setEscolha(null)} /> : null}
          </Sheet>
        </> : null}
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

function Cartao({ pessoa, pessoas, vinculos, familia, busy, editando, setEditando, executar, fechar }: {
  pessoa: PessoaArvore; pessoas: PessoaArvore[]; vinculos: ArvoreDados['vinculos']; familia: ArvoreDados['familia'];
  busy: boolean; editando: boolean; setEditando: (valor: boolean) => void; executar: (acao: () => Promise<unknown>) => void; fechar: () => void;
}) {
  const nomeDe = (id: number) => pessoas.find((item) => item.id === id)?.nome ?? 'alguém';
  return <ScrollView keyboardShouldPersistTaps="handled" style={styles.folha} contentContainerStyle={styles.stack}>
    <View style={styles.autor}><Avatar name={pessoa.nome} src={pessoa.foto_url} size={64} /><View style={styles.flex}>{pessoa.apelido ? <Text variant="muted">{pessoa.apelido}</Text> : null}{rotuloAnos(pessoa.nascimento_ano, pessoa.falecimento_ano) ? <Text variant="kicker">{rotuloAnos(pessoa.nascimento_ano, pessoa.falecimento_ano)}</Text> : null}</View></View>
    {pessoa.user_id ? <Button variant="ghost" onPress={() => router.push(`/familia/${pessoa.user_id}`)}>Ver perfil</Button> : <Text variant="muted">Sem conta no aplicativo.</Text>}
    {vinculos.map((v) => {
      const outro = v.pessoa_id === pessoa.id ? v.parente_id : v.pessoa_id;
      const texto = v.tipo === 'conjuge' ? `Casal com ${nomeDe(outro)}` : v.pessoa_id === pessoa.id ? `Filho ou filha de ${nomeDe(outro)}` : `Pai ou mãe de ${nomeDe(outro)}`;
      return <View key={`${v.tipo}-${v.pessoa_id}-${v.parente_id}`} style={styles.stack}>
        <Text>{texto}</Text>
        {v.pode_apagar ? <Button variant="quiet" disabled={busy} onPress={() => Alert.alert('Desfazer esta ligação?', '', [{ text: 'Voltar', style: 'cancel' }, { text: 'Desfazer', style: 'destructive', onPress: () => executar(() => api('/api/arvore/vinculos', { method: 'DELETE', json: { pessoa_id: v.pessoa_id, parente_id: v.parente_id, tipo: v.tipo } })) }])}>Desfazer</Button> : null}
      </View>;
    })}
    {pessoa.pode_editar && !editando ? <Button variant="ghost" disabled={busy} onPress={() => setEditando(true)}>Editar</Button> : null}
    {pessoa.pode_editar && editando ? <FormPessoa familia={familia} busy={busy} pessoa={pessoa} onClose={() => setEditando(false)} salvar={(preparar) => executar(async () => { await api(`/api/arvore/${pessoa.id}`, { method: 'PATCH', json: await preparar() }); setEditando(false); })} /> : null}
    {pessoa.pode_editar ? <Button variant="quiet" disabled={busy} onPress={() => Alert.alert(`Tirar ${pessoa.nome} da árvore?`, 'As ligações também saem.', [{ text: 'Voltar', style: 'cancel' }, { text: 'Tirar', style: 'destructive', onPress: () => { executar(() => api(`/api/arvore/${pessoa.id}`, { method: 'DELETE' })); fechar(); } }])}>Tirar da árvore</Button> : null}
  </ScrollView>;
}

function FormPessoa({ familia, busy, pessoa, onClose, salvar }: {
  familia: ArvoreDados['familia']; busy: boolean; pessoa?: PessoaArvore; onClose: () => void;
  salvar: (preparar: () => Promise<Record<string, unknown>>) => void;
}) {
  const toast = useToast();
  const [nome, setNome] = useState(pessoa?.nome ?? '');
  const [apelido, setApelido] = useState(pessoa?.apelido ?? '');
  const [nascimento, setNascimento] = useState(pessoa?.nascimento_ano ? String(pessoa.nascimento_ano) : '');
  const [falecimento, setFalecimento] = useState(pessoa?.falecimento_ano ? String(pessoa.falecimento_ano) : '');
  const [conta, setConta] = useState<number | null>(pessoa?.user_id ?? null);
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
    <Field label="Apelido (opcional)" value={apelido} onChangeText={setApelido} maxLength={60} editable={!busy} />
    <Field label="Nasceu em" value={nascimento} onChangeText={setNascimento} keyboardType="number-pad" maxLength={4} placeholder="1940" editable={!busy} />
    <Field label="Partiu em" value={falecimento} onChangeText={setFalecimento} keyboardType="number-pad" maxLength={4} placeholder="2019" editable={!busy} />
    <Text variant="muted">Conta no aplicativo</Text>
    <ScrollView style={styles.lista} nestedScrollEnabled keyboardShouldPersistTaps="handled">
      <Button variant={conta == null ? 'primary' : 'ghost'} selected={conta == null} disabled={busy} onPress={() => setConta(null)}>Sem conta</Button>
      {familia.map((item) => <Button key={item.id} variant={conta === item.id ? 'primary' : 'ghost'} selected={conta === item.id} disabled={busy} onPress={() => setConta(item.id)}>{item.name}</Button>)}
    </ScrollView>
    <Button variant="ghost" disabled={busy} onPress={() => { void escolher('galeria'); }}>Escolher foto</Button>
    <Button variant="ghost" disabled={busy} onPress={() => { void escolher('camera'); }}>Tirar foto</Button>
    {pessoa?.foto_url ? <Button variant={tirar ? 'primary' : 'ghost'} selected={tirar} disabled={busy} onPress={() => { setTirar((valor) => !valor); setFoto(null); }}>Tirar a foto</Button> : null}
    <Button loading={busy} disabled={busy || !nome.trim()} onPress={() => salvar(async () => {
      const json: Record<string, unknown> = { nome: nome.trim(), apelido: apelido.trim(), nascimento_ano: nascimento.trim() || null, falecimento_ano: falecimento.trim() || null, user_id: conta };
      if (foto) json.foto_url = await enviarFoto(foto);
      else if (tirar) json.foto_url = null;
      return json;
    })}>Salvar</Button>
    <Button variant="quiet" disabled={busy} onPress={onClose}>Cancelar</Button>
  </ScrollView>;
}

function FormVinculo({ pessoas, busy, onClose, salvar }: {
  pessoas: PessoaArvore[]; busy: boolean; onClose: () => void;
  salvar: (json: { pessoa_id: number; parente_id: number; tipo: TipoVinculo }) => void;
}) {
  const [tipo, setTipo] = useState<TipoVinculo>('pai_mae');
  const [pessoaId, setPessoaId] = useState<number | null>(null);
  const [parenteId, setParenteId] = useState<number | null>(null);
  return <ScrollView keyboardShouldPersistTaps="handled" style={styles.folha} contentContainerStyle={styles.stack}>
    <Button variant={tipo === 'pai_mae' ? 'primary' : 'ghost'} selected={tipo === 'pai_mae'} onPress={() => setTipo('pai_mae')}>Pai ou mãe</Button>
    <Button variant={tipo === 'conjuge' ? 'primary' : 'ghost'} selected={tipo === 'conjuge'} onPress={() => setTipo('conjuge')}>Casal</Button>
    <Text variant="muted">{tipo === 'pai_mae' ? 'Filho ou filha' : 'Uma pessoa'}</Text>
    <ScrollView style={styles.lista} nestedScrollEnabled>{pessoas.map((item) => <Button key={item.id} variant={pessoaId === item.id ? 'primary' : 'ghost'} selected={pessoaId === item.id} onPress={() => setPessoaId(item.id)}>{item.nome}</Button>)}</ScrollView>
    <Text variant="muted">{tipo === 'pai_mae' ? 'Pai ou mãe' : 'A outra pessoa'}</Text>
    <ScrollView style={styles.lista} nestedScrollEnabled>{pessoas.map((item) => <Button key={item.id} variant={parenteId === item.id ? 'primary' : 'ghost'} selected={parenteId === item.id} onPress={() => setParenteId(item.id)}>{item.nome}</Button>)}</ScrollView>
    <Button loading={busy} disabled={busy || pessoaId == null || parenteId == null} onPress={() => { if (pessoaId != null && parenteId != null) salvar({ pessoa_id: pessoaId, parente_id: parenteId, tipo }); }}>Ligar</Button>
    <Button variant="quiet" disabled={busy} onPress={onClose}>Cancelar</Button>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { paddingBottom: 48 },
  content: { padding: 20, gap: 16 },
  stack: { gap: 12, paddingBottom: 8 },
  zoom: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  autor: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cartao: { position: 'absolute', borderRadius: 14, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface, padding: 8, gap: 4, overflow: 'hidden' },
  cartaoAtivo: { borderColor: theme.colors.champagne },
  lista: { maxHeight: 160 },
  folha: { maxHeight: 520 },
});
