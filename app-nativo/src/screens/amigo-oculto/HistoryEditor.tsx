import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Sheet } from '../../ui/Sheet';
import { Text } from '../../ui/Text';
import { useFeatureMutation } from './featureData';
export function HistoryEditor() {
  const [open, setOpen] = useState(false), [year, setYear] = useState('2025'), [pairs, setPairs] = useState<Record<number, number>>({}), [confirmed, setConfirmed] = useState(false), [editing, setEditing] = useState<number | null>(null);
  const query = useQuery({ queryKey: ['amigo-oculto', 'history-editor'], queryFn: ({ signal }) => api<{ participants: { id: number; name: string }[] }>('/api/secret-santa/admin', { signal }), enabled: open });
  const mutation = useFeatureMutation();
  function save() {
    Alert.alert('Salvar histórico?', 'Os pares deste ano ficarão visíveis para toda a família.', [{ text: 'Revisar', style: 'cancel' }, { text: 'Salvar', onPress: () => mutation.send({ path: '/api/secret-santa/history', method: 'POST', json: { ano: Number(year), confirm_revealed: confirmed, pairs: Object.entries(pairs).filter(([, r]) => r).map(([g, r]) => ({ giver_participant_id: Number(g), receiver_participant_id: r })) }, message: 'Histórico salvo.', onSuccess: () => setOpen(false) }) }]);
  }
  return <><Button variant="ghost" onPress={() => setOpen(true)}>Cadastrar ano passado</Button><Sheet visible={open} onClose={() => setOpen(false)} title="Histórico de outro Natal"><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16, paddingBottom: 24 }}><Field label="Ano" value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} /><Text variant="muted">Escolha quem cada pessoa tirou. Deixe sem seleção quem não participou.</Text>
    {query.data?.participants.map(p => <View key={p.id} style={{ gap: 8 }}><Button variant="ghost" onPress={() => setEditing(editing === p.id ? null : p.id)}>{p.name}: {query.data.participants.find(r => r.id === pairs[p.id])?.name ?? 'Não participou'}</Button>{editing === p.id ? <><Button variant="quiet" onPress={() => { setPairs(v => ({ ...v, [p.id]: 0 })); setEditing(null); }}>Não participou</Button>{query.data.participants.filter(r => r.id !== p.id).map(r => <Button key={r.id} variant="quiet" onPress={() => { setPairs(v => ({ ...v, [p.id]: r.id })); setEditing(null); }}>{r.name}</Button>)}</> : null}</View>)}
    {query.isError ? <><Text>{query.error.message}</Text><Button variant="quiet" onPress={() => { void query.refetch(); }}>Tentar novamente</Button></> : null}
    <Button selected={confirmed} variant="ghost" onPress={() => setConfirmed(v => !v)}>{confirmed ? 'Confirmado' : 'Confirmar'}: esse ano já foi revelado</Button><Button disabled={!confirmed || mutation.isPending || query.isPending} loading={mutation.isPending} onPress={save}>Salvar histórico</Button></ScrollView></Sheet></>;
}
