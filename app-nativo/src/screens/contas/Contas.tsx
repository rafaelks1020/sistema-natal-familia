import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api, sessionStore } from '../../api';
import { brl } from '../../format';
import { useSession } from '../../session';
import { theme } from '../../theme';
import { escolherFotos, enviarFoto } from '../../upload';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Field } from '../../ui/Field';
import { Skeleton } from '../../ui/Skeleton';
import { Surface } from '../../ui/Surface';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { Cabecalho } from '../familia/Cabecalho';
import { useEscritaParte, vigente } from '../caronas/data';
import { contasKey, type ContasData, type Pessoa } from './data';

export default function Contas() {
  const { status, user } = useSession();
  const toast = useToast();
  const [form, setForm] = useState(false);
  const consulta = useQuery({ queryKey: contasKey, enabled: status === 'authenticated', queryFn: ({ signal }) => api<ContasData>('/api/contas-da-ceia', { signal }) });
  const escrita = useEscritaParte(contasKey);
  if (status !== 'authenticated' || !user) return null;
  const data = consulta.data;
  const nomes = new Map(data?.pessoas.map(p => [p.id, p.name]));
  const enviar = (path: string, method: string, json?: unknown) => escrita.executar(() => api(path, { method, json }));
  async function copiar(chave: string) {
    try { if (!await Clipboard.setStringAsync(chave, { android: { isSensitive: true } })) throw new Error('Não foi possível copiar.'); toast('Chave Pix copiada. Confira o nome no banco antes de pagar.'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Não foi possível copiar.', 'error'); }
  }
  function bloquear(userId: number) {
    Alert.alert(`Bloquear ${nomes.get(userId)}?`, 'O conteúdo ficará oculto. Os saldos continuam completos.', [{ text: 'Voltar', style: 'cancel' }, { text: 'Bloquear', style: 'destructive', onPress: () => escrita.executar(async generation => { await api('/api/blocks', { method: 'POST', json: { user_id: userId } }); if (!vigente(generation)) return; await sessionStore.contentChanged(); if (vigente(generation + 1)) await consulta.refetch(); }) }]);
  }
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={consulta.isRefetching} onRefresh={() => { void consulta.refetch(); }} tintColor={theme.colors.champagne} />}>
      <Cabecalho titulo="Contas da ceia" kicker={data ? `Natal ${data.ano}` : 'Natal em Família'} aoVoltar={() => { if (router.canGoBack()) router.back(); else router.navigate('/'); }} />
      <View style={styles.content}><Text variant="muted">Dividam as compras feitas por cada pessoa. Este controle é separado da vaquinha.</Text>
        {consulta.isPending ? <Skeleton style={{ height: 160 }} /> : null}{consulta.isError ? <EmptyState title="Não foi possível atualizar" message={consulta.error.message} action="Tentar novamente" onAction={() => { void consulta.refetch(); }} /> : null}
        {data ? <>
          <Surface style={styles.stack}><Text variant="kicker">Despesas desta edição</Text><Text variant="numeral">{brl(data.total_centavos / 100)}</Text></Surface>
          {user.is_admin && data.denuncias.length ? <Surface style={styles.stack}><Text variant="display">Despesas denunciadas</Text>{data.denuncias.map(d => <View key={d.id} style={styles.stack}><Text>{d.trecho}</Text><Text variant="muted">Motivo: {d.motivo}</Text><Button variant="ghost" disabled={escrita.busy} onPress={() => enviar(`/api/contas-da-ceia/denuncias/${d.id}`, 'POST', { acao: 'manter' })}>Manter despesa</Button><Button variant="quiet" disabled={escrita.busy} onPress={() => Alert.alert('Apagar despesa denunciada?', 'Os saldos serão recalculados.', [{ text: 'Voltar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: () => enviar(`/api/contas-da-ceia/denuncias/${d.id}`, 'POST', { acao: 'apagar' }) }])}>Apagar despesa denunciada</Button></View>)}</Surface> : null}
          <MinhaChave key={data.minha_chave} initial={data.minha_chave} busy={escrita.busy} salvar={pix_key => enviar('/api/contas-da-ceia', 'PATCH', { pix_key })} />
          <Button variant="ghost" onPress={() => setForm(!form)}>{form ? 'Fechar formulário' : 'Lançar uma despesa que paguei'}</Button>
          {form ? <Formulario pessoas={data.pessoas} busy={escrita.busy} executar={escrita.executar} fechar={() => setForm(false)} /> : null}
          <Text variant="display">Saldo de cada pessoa</Text><Text variant="muted">Os centavos que sobrarem são distribuídos na ordem do cadastro.</Text>
          {data.pessoas.map(p => <View key={p.id} style={styles.line}><Text>{p.name}</Text><Text variant="muted">{p.saldo_centavos > 0 ? 'Recebe ' : p.saldo_centavos < 0 ? 'Paga ' : ''}{brl(Math.abs(p.saldo_centavos) / 100)}</Text></View>)}
          <Text variant="display">Quem paga para quem</Text><Text variant="muted">Juntamos os saldos para reduzir as transferências. Confirme só depois de conferir o recebimento no banco.</Text>
          {!data.transferencias.length ? <Text variant="muted">Tudo acertado por enquanto.</Text> : null}
          {data.transferencias.map(t => { const recebedor = data.pessoas.find(p => p.id === t.para_user_id); return <Surface key={`${t.de_user_id}-${t.para_user_id}`} style={styles.stack}><Text>{nomes.get(t.de_user_id)} paga para {recebedor?.name}</Text><Text variant="numeral">{brl(t.valor_centavos / 100)}</Text>{recebedor?.pix_key ? <><Text selectable variant="muted">{recebedor.pix_key}</Text><Button variant="ghost" onPress={() => { void copiar(recebedor.pix_key!); }}>Copiar chave Pix</Button></> : <Text variant="muted">Peça a chave Pix ao recebedor.</Text>}{t.para_user_id === user.id ? <Button disabled={escrita.busy} onPress={() => Alert.alert('Confirmar recebimento?', `Você conferiu no banco ${brl(t.valor_centavos / 100)} de ${nomes.get(t.de_user_id)}?`, [{ text: 'Voltar', style: 'cancel' }, { text: 'Sim, recebi', onPress: () => enviar('/api/contas-da-ceia', 'PUT', { de_user_id: t.de_user_id, valor_centavos: t.valor_centavos }) }])}>Confirmar que recebi</Button> : <Text variant="muted">Só quem recebe confirma o acerto.</Text>}</Surface>; })}
          <Text variant="display">Despesas</Text>{!data.despesas.length ? <Text variant="muted">Nenhuma despesa visível nesta edição.</Text> : null}
          {data.despesas.map(d => <Surface key={d.id} style={styles.stack}><Text>{d.descricao}</Text><Text variant="kicker">{brl(d.valor_centavos / 100)}</Text><Text variant="muted">Pago por {nomes.get(d.user_id)}</Text><Text variant="muted">Dividido entre {d.partes.map(id => nomes.get(id)).join(', ')}</Text>{d.comprovante_url ? <Button variant="ghost" onPress={() => { void Linking.openURL(d.comprovante_url!).catch(() => toast('Não foi possível abrir o comprovante.', 'error')); }}>Ver comprovante</Button> : null}{d.user_id === user.id || user.is_admin ? <Button variant="quiet" disabled={escrita.busy} onPress={() => Alert.alert('Apagar despesa?', 'Os saldos serão recalculados.', [{ text: 'Voltar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: () => enviar(`/api/contas-da-ceia/${d.id}`, 'DELETE') }])}>Apagar despesa</Button> : null}{d.user_id !== user.id ? <><Button variant="quiet" disabled={escrita.busy} onPress={() => Alert.alert('Denunciar despesa', 'Escolha um motivo. Quem organiza analisará a denúncia.', ['Conteúdo inadequado', 'Valor incorreto'].map(motivo => ({ text: motivo, onPress: () => enviar(`/api/contas-da-ceia/${d.id}/denunciar`, 'POST', { motivo }) })).concat([{ text: 'Cancelar', onPress: () => {} }]))}>Denunciar despesa</Button><Button variant="quiet" disabled={escrita.busy} onPress={() => bloquear(d.user_id)}>Bloquear {nomes.get(d.user_id)}</Button></> : null}</Surface>)}
          <Text variant="display">Acertos confirmados</Text>{!data.acertos.length ? <Text variant="muted">Nenhum recebimento confirmado ainda.</Text> : null}{data.acertos.map(a => <View key={a.id} style={styles.line}><Text variant="muted">{nomes.get(a.para_user_id)} confirmou {brl(a.valor_centavos / 100)} de {nomes.get(a.de_user_id)} em {new Date(a.confirmado_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.</Text></View>)}
        </> : null}
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

function MinhaChave({ initial, busy, salvar }: { initial: string; busy: boolean; salvar: (chave: string) => void }) {
  const [chave, setChave] = useState(initial);
  return <Surface style={styles.stack}><Field label="Minha chave Pix" value={chave} onChangeText={setChave} maxLength={200} autoCapitalize="none" editable={!busy} /><Text variant="muted">A família poderá copiar sua chave. Deixe em branco para remover.</Text><Button variant="ghost" disabled={busy} onPress={() => salvar(chave)}>Salvar minha chave</Button></Surface>;
}

function Formulario({ pessoas, busy, executar, fechar }: { pessoas: Pessoa[]; busy: boolean; executar: ReturnType<typeof useEscritaParte>['executar']; fechar: () => void }) {
  const [descricao, setDescricao] = useState(''); const [valor, setValor] = useState('');
  const [partes, setPartes] = useState(pessoas.filter(p => p.confirmou).map(p => p.id));
  const [comprovante, setComprovante] = useState<string | null>(null); const [upload, setUpload] = useState(false);
  const toast = useToast();
  async function foto() {
    if (busy || upload) return;
    const generation = sessionStore.getGeneration(); setUpload(true);
    try { const fotos = await escolherFotos('galeria', 1); const foto = fotos[0]; if (!foto || !vigente(generation)) return; const url = await enviarFoto(foto); if (vigente(generation)) setComprovante(url); }
    catch (e) { if (vigente(generation)) toast(e instanceof Error ? e.message : 'Não foi possível enviar a foto.', 'error'); }
    finally { setUpload(false); }
  }
  function salvar() {
    const texto = valor.trim().replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(texto)) { toast('Informe um valor como 42,90.', 'error'); return; }
    const [inteiros, decimais = ''] = texto.split('.');
    const valor_centavos = Number(inteiros) * 100 + Number(decimais.padEnd(2, '0'));
    executar(() => api('/api/contas-da-ceia', { method: 'POST', json: { descricao, valor_centavos, partes, comprovante_url: comprovante } }), fechar);
  }
  return <Surface style={styles.stack}><Text variant="kicker">Nova despesa</Text><Field label="O que você pagou?" value={descricao} onChangeText={setDescricao} maxLength={240} editable={!busy} /><Field label="Valor em reais" value={valor} onChangeText={setValor} keyboardType="decimal-pad" placeholder="42,90" maxLength={12} editable={!busy} /><Text>Dividir igualmente entre</Text><Text variant="muted">Começamos com quem confirmou presença. Você pode mudar.</Text><Button variant="quiet" disabled={busy} onPress={() => setPartes(pessoas.filter(p => p.confirmou).map(p => p.id))}>Usar presenças confirmadas</Button>{pessoas.map(p => <Button key={p.id} variant={partes.includes(p.id) ? 'primary' : 'ghost'} selected={partes.includes(p.id)} disabled={busy} accessibilityLabel={`${p.name}, ${partes.includes(p.id) ? 'selecionado' : 'não selecionado'}`} onPress={() => setPartes(atual => atual.includes(p.id) ? atual.filter(id => id !== p.id) : [...atual, p.id])}>{partes.includes(p.id) ? '✓ ' : ''}{p.name}</Button>)}<Button variant="ghost" loading={upload} disabled={busy} onPress={() => { void foto(); }}>{comprovante ? 'Trocar foto do comprovante' : 'Adicionar foto do comprovante'}</Button>{comprovante ? <><Text variant="muted">Foto anexada.</Text><Button variant="quiet" disabled={busy || upload} onPress={() => setComprovante(null)}>Remover foto</Button></> : null}<Button loading={busy} disabled={upload || !descricao.trim() || !partes.length || !valor.trim()} onPress={salvar}>Lançar despesa</Button></Surface>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: theme.colors.background }, scroll: { paddingBottom: 48 }, content: { padding: 20, gap: 20 }, stack: { gap: 14 }, line: { borderBottomWidth: 1, borderBottomColor: theme.colors.line, paddingBottom: 14, gap: 4 } });
