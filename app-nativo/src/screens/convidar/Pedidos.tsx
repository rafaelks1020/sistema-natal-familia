import { useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, ApiError, queryClient, sessionStore } from '../../api';
import { useSession } from '../../session';
import { theme } from '../../theme';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Field } from '../../ui/Field';
import { Skeleton } from '../../ui/Skeleton';
import { Surface } from '../../ui/Surface';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';

interface Pedido { id: number; nome: string; parentesco: string; solicitante: string; status: 'pendente' | 'aprovado' | 'recusado'; token: string | null; link_ativo: boolean }
type Operacao = { generation: number } & ({ tipo: 'criar'; nome: string; parentesco: string } | { tipo: 'decidir'; id: number; status: 'aprovado' | 'recusado' } | { tipo: 'apagar'; id: number });

export function PedidosConvite({ organizar = false }: { organizar?: boolean }) {
  const { user, status } = useSession();
  const toast = useToast();
  const [nome, setNome] = useState('');
  const [parentesco, setParentesco] = useState('');
  const key = ['pedidos-convite-g', user?.id, organizar] as const;
  const consulta = useQuery({ queryKey: key, enabled: status === 'authenticated' && (!organizar || Boolean(user?.is_admin)),
    queryFn: ({ signal }) => api<Pedido[]>(`/api/convidar${organizar ? '?organizar=1' : ''}`, { signal }),
  });
  const mutacao = useMutation({
    mutationFn: async (op: Operacao) => {
      if (sessionStore.getGeneration() !== op.generation) throw new ApiError('A sessão mudou. Tente novamente.', 401);
      if (op.tipo === 'criar') return api('/api/convidar', { method: 'POST', json: { nome: op.nome, parentesco: op.parentesco } });
      return api(`/api/convidar/${op.id}`, { method: op.tipo === 'apagar' ? 'DELETE' : 'PATCH', json: op.tipo === 'decidir' ? { status: op.status } : undefined });
    },
    onMutate: async () => { await queryClient.cancelQueries({ queryKey: key }); },
    onSuccess: (_dado, op) => {
      if (sessionStore.getGeneration() !== op.generation) return;
      if (op.tipo === 'criar') { setNome(''); setParentesco(''); }
      toast(op.tipo === 'criar' ? 'Pedido enviado para quem organiza.' : 'Pedido atualizado.');
    },
    onError: (erro, op) => { if (sessionStore.getGeneration() === op.generation) toast(erro.message, 'error'); },
    onSettled: (_dado, _erro, op) => {
      if (op && sessionStore.getGeneration() === op.generation) {
        void queryClient.invalidateQueries({ queryKey: ['pedidos-convite-g', user?.id] });
        void queryClient.invalidateQueries({ queryKey: ['convites'] });
      }
    },
  });
  if (status !== 'authenticated' || (organizar && !user?.is_admin)) return null;
  function decidir(id: number, decisao: 'aprovado' | 'recusado') { mutacao.mutate({ tipo: 'decidir', id, status: decisao, generation: sessionStore.getGeneration() }); }
  async function compartilhar(token: string) {
    try { await Share.share({ message: `Vem participar do nosso Natal em Família! https://natalemfamilia.com.br/entrar?convite=${encodeURIComponent(token)}` }); }
    catch { toast('Não foi possível compartilhar o convite.', 'error'); }
  }
  return <View style={styles.bloco}>
    {!organizar ? <Surface style={styles.cartao}>
      <Text variant="muted">Quer trazer alguém novo? Quem organiza analisa e libera o link para você enviar.</Text>
      <Field label="Nome da pessoa" value={nome} onChangeText={setNome} maxLength={60} />
      <Field label="Como ela faz parte da família?" placeholder="Ex.: namorada do João" value={parentesco} onChangeText={setParentesco} maxLength={120} />
      <Text variant="muted">Este pedido é privado: só você e quem organiza podem ver.</Text>
      <Button loading={mutacao.isPending} disabled={!nome.trim() || !parentesco.trim()} onPress={() => mutacao.mutate({ tipo: 'criar', nome: nome.trim(), parentesco: parentesco.trim(), generation: sessionStore.getGeneration() })}>Pedir convite</Button>
    </Surface> : null}
    <Text variant="display" style={styles.titulo}>{organizar ? 'Pedidos de parentes' : 'Seus pedidos'}</Text>
    {consulta.isPending ? <Skeleton style={{ height: 100 }} /> : consulta.isError ? <EmptyState title="Não foi possível abrir os pedidos" message={consulta.error.message} action="Tentar novamente" onAction={() => { void consulta.refetch(); }} /> : !consulta.data?.length ? <Text variant="muted">Nenhum pedido por aqui.</Text> : consulta.data.map((p) => <Surface key={p.id} style={styles.cartao}>
      <Text style={{ fontFamily: theme.fonts.medium }}>{p.nome}</Text><Text variant="muted">{p.parentesco}</Text>
      {organizar ? <Text variant="muted">Pedido de {p.solicitante}</Text> : null}
      <Text style={styles.estado}>{p.status === 'pendente' ? 'Aguardando aprovação' : p.status === 'recusado' ? 'Não aprovado. Converse com quem organiza.' : p.link_ativo ? 'Aprovado! O link vale para um cadastro, por até 30 dias.' : 'Aprovado. O link foi usado, venceu ou foi cancelado.'}</Text>
      {p.status === 'aprovado' && p.token && p.link_ativo ? <><Button onPress={() => { void compartilhar(p.token!); }}>Compartilhar convite</Button><Text selectable variant="muted">{`https://natalemfamilia.com.br/entrar?convite=${p.token}`}</Text></> : null}
      {organizar ? <>{p.status === 'pendente' ? <><Button disabled={mutacao.isPending} onPress={() => decidir(p.id, 'aprovado')}>Aprovar</Button><Button variant="ghost" disabled={mutacao.isPending} onPress={() => decidir(p.id, 'recusado')}>Recusar</Button></> : null}
        <Button variant="quiet" disabled={mutacao.isPending} onPress={() => Alert.alert('Apagar pedido?', 'O link também será cancelado, se houver.', [{ text: 'Manter', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: () => mutacao.mutate({ tipo: 'apagar', id: p.id, generation: sessionStore.getGeneration() }) }])}>Apagar pedido</Button>
      </> : null}
    </Surface>)}
    <Button variant="quiet" disabled={consulta.isFetching} onPress={() => { void consulta.refetch(); }}>Atualizar pedidos</Button>
  </View>;
}
const styles = StyleSheet.create({ bloco: { gap: 16 }, cartao: { gap: 12 }, titulo: { fontSize: 28, lineHeight: 36 }, estado: { fontSize: 13, color: theme.colors.champagne } });
