import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import { useSession } from '../../session';
import { theme } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Field } from '../../ui/Field';
import { Skeleton } from '../../ui/Skeleton';
import { Surface } from '../../ui/Surface';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { Cabecalho } from '../familia/Cabecalho';
import { ModerationActions } from '../moderacao/Actions';
import { caronasKey, rotulos, tipos, useEscritaParte, type CaronasData, type Oferta, type Tipo } from './data';

export default function Caronas() {
  const { status, user } = useSession();
  const [aba, setAba] = useState<'oferta' | 'pedido'>('oferta');
  const [form, setForm] = useState(false);
  const consulta = useQuery({ queryKey: caronasKey, enabled: status === 'authenticated', queryFn: ({ signal }) => api<CaronasData>('/api/caronas', { signal }) });
  const escrita = useEscritaParte(caronasKey);
  if (status !== 'authenticated' || !user) return null;
  const data = consulta.data;
  const ofertas = data?.ofertas.filter(o => o.tipo.endsWith(`_${aba}`)) ?? [];
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={consulta.isRefetching} onRefresh={() => { void consulta.refetch(); }} tintColor={theme.colors.champagne} />}>
      <Cabecalho titulo="Caronas e hospedagem" kicker={data ? `Natal ${data.ano}` : 'Natal em Família'} aoVoltar={() => { if (router.canGoBack()) router.back(); else router.navigate('/'); }} />
      <View style={styles.content}><Text variant="muted">Um lugar no carro ou em casa para celebrar juntos.</Text>
        <Button variant="ghost" onPress={() => setForm(!form)}>{form ? 'Fechar formulário' : 'Oferecer ou pedir ajuda'}</Button>
        {form ? <Formulario busy={escrita.busy} criar={json => escrita.executar(() => api('/api/caronas', { method: 'POST', json }), () => setForm(false))} /> : null}
        <View style={styles.tabs}>{(['oferta', 'pedido'] as const).map(t => <Button key={t} style={styles.flex} variant={t === aba ? 'primary' : 'ghost'} selected={t === aba} onPress={() => setAba(t)}>{t === 'oferta' ? 'Ofertas' : 'Pedidos'}</Button>)}</View>
        {consulta.isPending ? <Skeleton style={{ height: 180 }} /> : null}
        {consulta.isError ? <EmptyState title="Não foi possível atualizar" message={consulta.error.message} action="Tentar novamente" onAction={() => { void consulta.refetch(); }} /> : null}
        {data && !ofertas.length ? <EmptyState title="Vamos juntos" message={`Ainda não há ${aba === 'oferta' ? 'ofertas' : 'pedidos'} nesta edição.`} /> : null}
        {ofertas.map(o => <Cartao key={o.id} oferta={o} meuId={user.id} admin={Boolean(user.is_admin)} busy={escrita.busy} executar={escrita.executar} atualizar={() => { void consulta.refetch(); }} />)}
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

function Formulario({ busy, criar }: { busy: boolean; criar: (json: unknown) => void }) {
  const [tipo, setTipo] = useState<Tipo>('carona_oferta');
  const [origem, setOrigem] = useState(''); const [quando, setQuando] = useState('');
  const [vagas, setVagas] = useState('1'); const [observacao, setObservacao] = useState(''); const [telefone, setTelefone] = useState('');
  return <Surface style={styles.stack}>
    <Text variant="kicker">Novo anúncio</Text>
    {tipos.map(t => <Button key={t} variant={tipo === t ? 'primary' : 'ghost'} selected={tipo === t} disabled={busy} onPress={() => setTipo(t)}>{rotulos[t]}</Button>)}
    <Field label={tipo.startsWith('carona') ? 'De onde sai? Cidade ou bairro' : 'Em qual cidade?'} value={origem} onChangeText={setOrigem} maxLength={160} editable={!busy} />
    <Field label="Quando? Dia e horário" value={quando} onChangeText={setQuando} placeholder="24 de dezembro, às 18h" maxLength={160} editable={!busy} />
    <Field label={tipo.endsWith('_oferta') ? 'Vagas disponíveis' : 'Quantas vagas precisa?'} value={vagas} onChangeText={setVagas} keyboardType="number-pad" maxLength={3} editable={!busy} />
    <Field label="Observação (opcional)" value={observacao} onChangeText={setObservacao} multiline maxLength={2000} editable={!busy} />
    <Field label="Telefone para a família ver (opcional)" value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" maxLength={40} editable={!busy} />
    <Text variant="muted">Preencha o telefone só se quiser mostrá-lo no anúncio.</Text>
    <Button loading={busy} disabled={!origem.trim() || !quando.trim() || !/^\d+$/.test(vagas) || Number(vagas) < 1 || Number(vagas) > 100} onPress={() => criar({ tipo, origem, quando, vagas: Number(vagas), observacao, telefone })}>Publicar</Button>
  </Surface>;
}

function Cartao({ oferta: o, meuId, admin, busy, executar, atualizar }: { oferta: Oferta; meuId: number; admin: boolean; busy: boolean; executar: ReturnType<typeof useEscritaParte>['executar']; atualizar: () => void }) {
  const [quantidade, setQuantidade] = useState('1');
  const toast = useToast();
  const dono = o.user_id === meuId;
  function remover(pessoa?: number) {
    Alert.alert('Cancelar reserva?', 'As vagas ficarão disponíveis de novo.', [{ text: 'Voltar', style: 'cancel' }, { text: 'Remover reserva', style: 'destructive', onPress: () => executar(() => api(`/api/caronas/${o.id}/reservas`, { method: 'DELETE', json: pessoa ? { reserva_user_id: pessoa } : {} })) }]);
  }
  return <Surface style={styles.stack}>
    <View style={styles.author}><Avatar name={o.name} src={o.avatar_url} /><View style={styles.flex}><Text variant="kicker">{rotulos[o.tipo]}</Text><Text>{o.name}</Text></View></View>
    <Text variant="display" style={styles.title}>{o.origem}</Text><Text variant="muted">{o.quando}</Text>
    <Text>{o.vagas} {o.tipo.endsWith('_oferta') ? 'vaga(s) disponível(is)' : 'vaga(s) necessária(s)'}{!o.ativo ? ' · Encerrado' : ''}</Text>
    {o.observacao ? <Text>{o.observacao}</Text> : null}{o.telefone ? <Text variant="muted">Telefone: {o.telefone}</Text> : null}
    {o.minha_reserva ? <><Text>Você reservou {o.minha_reserva} vaga(s).</Text><Button variant="ghost" disabled={busy} onPress={() => remover()}>Cancelar minha reserva</Button></> : null}
    {!dono && o.ativo && o.tipo.endsWith('_oferta') && !o.minha_reserva ? <><Field label="Quantidade de vagas" value={quantidade} onChangeText={setQuantidade} keyboardType="number-pad" maxLength={3} editable={!busy} /><Button disabled={busy || !o.vagas} onPress={() => { if (!/^\d+$/.test(quantidade) || Number(quantidade) < 1 || Number(quantidade) > o.vagas) { toast('Confira a quantidade de vagas.', 'error'); return; } executar(() => api(`/api/caronas/${o.id}/reservas`, { method: 'POST', json: { quantidade: Number(quantidade) } })); }}>{o.vagas ? 'Quero uma vaga' : 'Sem vagas no momento'}</Button></> : null}
    {dono ? <><Button variant="ghost" disabled={busy} onPress={() => executar(() => api(`/api/caronas/${o.id}`, { method: 'PATCH', json: { ativo: !o.ativo } }))}>{o.ativo ? 'Encerrar anúncio' : 'Reabrir anúncio'}</Button>{o.reservas.length ? <Text variant="kicker">Quem reservou</Text> : null}{o.reservas.map(r => <View key={r.user_id} style={styles.stack}><Text>{r.name}: {r.quantidade} vaga(s)</Text><Button variant="quiet" disabled={busy} onPress={() => remover(r.user_id)}>Remover reserva</Button></View>)}</> : null}
    {dono || admin ? <Button variant="quiet" disabled={busy} onPress={() => Alert.alert('Apagar anúncio?', 'As reservas também serão apagadas.', [{ text: 'Voltar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: () => executar(() => api(`/api/caronas/${o.id}`, { method: 'DELETE' })) }])}>Apagar anúncio</Button> : null}
    {!dono ? <ModerationActions userId={o.user_id} name={o.name} alvoTipo="carona" alvoId={o.id} onDone={atualizar} /> : null}
  </Surface>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background }, scroll: { paddingBottom: 48 }, content: { padding: 20, gap: 20 },
  stack: { gap: 14 }, tabs: { flexDirection: 'row', gap: 10 }, flex: { flex: 1, minWidth: 0 }, author: { flexDirection: 'row', alignItems: 'center', gap: 12 }, title: { fontSize: 28, lineHeight: 36 },
});
