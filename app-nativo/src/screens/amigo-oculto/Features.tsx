import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api, queryClient } from '../../api';
import { brl } from '../../format';
import { useSession } from '../../session';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Surface } from '../../ui/Surface';
import { Text } from '../../ui/Text';
import { EmptyState } from '../../ui/EmptyState';
import { Skeleton } from '../../ui/Skeleton';
import { featureKeys, temas, useFeatureMutation, type HintData, type HistoryData, type ThemeData } from './featureData';
import { HistoryEditor } from './HistoryEditor';

export function ThemeBanner({ compact = false }: { compact?: boolean }) {
  const query = useQuery({ queryKey: featureKeys.theme, queryFn: ({ signal }) => api<ThemeData>('/api/secret-santa/theme', { signal }) });
  if (!query.data) return query.isPending ? <Skeleton style={{ height: 50 }} /> : <Text variant="muted">Não foi possível carregar o tema.</Text>;
  const data = query.data;
  if (compact) return <Text variant="muted" style={{ textAlign: 'center' }}>{data.tema}{data.valor_centavos !== null ? ` · ${brl(data.valor_centavos / 100)}` : ''}</Text>;
  return <Surface style={styles.gap}><Text variant="kicker">O presente deste Natal</Text><Text variant="display" style={styles.title}>{data.tema}</Text>{data.valor_centavos !== null ? <Text variant="muted">Valor sugerido: {brl(data.valor_centavos / 100)}</Text> : null}<Button variant="ghost" onPress={() => router.push('/amigo-oculto-ao-vivo')}>Acompanhar revelação ao vivo</Button></Surface>;
}
export function Features({ canSend, configId }: { canSend: boolean; configId: number | null }) {
  const { user } = useSession();
  const hints = useQuery({ queryKey: [...featureKeys.hints, configId], queryFn: ({ signal }) => api<HintData>('/api/secret-santa/hints', { signal }) });
  const history = useQuery({ queryKey: featureKeys.history, queryFn: ({ signal }) => api<HistoryData>('/api/secret-santa/history', { signal }) });
  const themeQuery = useQuery({ queryKey: featureKeys.theme, queryFn: ({ signal }) => api<ThemeData>('/api/secret-santa/theme', { signal }) });
  const [texto, setTexto] = useState(''), [guess, setGuess] = useState<number | null>(null), [year, setYear] = useState<number | null>(null);
  const mutation = useFeatureMutation();
  const years = [...new Set(history.data?.history.map(p => p.ano) ?? [])];
  const currentYear = year ?? years[0];
  const selectedGuess = guess ?? hints.data?.guess;
  return <View style={styles.section}>
    <Text variant="display" style={styles.title}>Dicas anônimas</Text><Text variant="muted">Só quem tirou você envia. O nome fica em segredo.</Text>
    {hints.isPending ? <Skeleton style={{ height: 100 }} /> : hints.data ? <>
      {!hints.data.hints.length ? <Text variant="muted">Quando chegar uma dica, ela aparece aqui.</Text> : hints.data.hints.map(h => <Surface key={h.id} style={styles.gap}><Text variant="kicker">Dica do seu amigo oculto</Text><Text>{h.texto}</Text>
        <Button variant="quiet" disabled={mutation.isPending} onPress={() => Alert.alert('Denunciar dica?', 'Quem organiza analisará a denúncia em até 24 horas. O autor continua anônimo.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Denunciar', onPress: () => mutation.send({ path: '/api/reports', method: 'POST', json: { alvo_tipo: 'dica', alvo_id: h.id, motivo: 'Dica inadequada' }, message: 'Denúncia enviada.' }) }])}>Denunciar</Button>
        <Button variant="quiet" disabled={mutation.isPending} onPress={() => Alert.alert('Parar de receber dicas?', 'As dicas do seu amigo oculto somem e o nome continua em segredo.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Parar as dicas', style: 'destructive', onPress: () => mutation.send({ path: '/api/secret-santa/hints', method: 'DELETE', json: { id: h.id, action: 'silenciar' }, message: 'Pronto, você não recebe mais dicas.' }) }])}>Não quero mais dicas</Button>
        {user?.is_admin ? <Button variant="quiet" disabled={mutation.isPending} onPress={() => mutation.send({ path: '/api/secret-santa/hints', method: 'DELETE', json: { id: h.id }, message: 'Dica apagada.' })}>Apagar dica</Button> : null}
      </Surface>)}
      {canSend ? <Surface style={styles.gap}><Field label="Dica para quem você tirou" value={texto} onChangeText={setTexto} maxLength={280} multiline editable={!mutation.isPending} /><Text variant="muted">{texto.length}/280. Até 3 dicas por dia.</Text><Button disabled={mutation.isPending || !texto.trim()} onPress={() => mutation.send({ path: '/api/secret-santa/hints', method: 'POST', json: { texto }, message: 'Dica enviada sem seu nome.', onSuccess: () => setTexto('') })}>Enviar dica anônima</Button></Surface> : null}
      {hints.data.participants.length ? <Surface style={styles.gap}><Text variant="display" style={styles.subtitle}>Quem tirou você?</Text><Text variant="muted">Seu palpite aparece na revelação se acertar.</Text><View style={styles.gap}>{hints.data.participants.map(p => <Button key={p.id} variant={selectedGuess === p.id ? 'ghost' : 'quiet'} selected={selectedGuess === p.id} onPress={() => setGuess(p.id)}>{selectedGuess === p.id ? `Escolhido: ${p.name}` : p.name}</Button>)}</View><Button disabled={mutation.isPending || !selectedGuess} onPress={() => mutation.send({ path: '/api/secret-santa/guess', method: 'POST', json: { participant_id: selectedGuess }, message: 'Palpite guardado.' })}>Guardar palpite</Button></Surface> : null}
    </> : <EmptyState title="As dicas aguardam" message={hints.error?.message} action="Tentar novamente" onAction={() => { void hints.refetch(); }} />}
    <Button variant="quiet" onPress={() => { void queryClient.invalidateQueries({ queryKey: featureKeys.hints }); }}>Atualizar dicas</Button>
    <Text variant="display" style={styles.title}>Histórico</Text><Text variant="muted">Somente edições já reveladas para a família.</Text>
    {history.isPending ? <Skeleton style={{ height: 80 }} /> : history.data ? <>{years.map(y => <Button key={y} selected={currentYear === y} variant={currentYear === y ? 'ghost' : 'quiet'} onPress={() => setYear(y)}>{String(y)}</Button>)}{history.data.history.filter(p => p.ano === currentYear).map(p => <Surface key={`${p.ano}:${p.giver}`}><Text>{p.giver} tirou {p.receiver}</Text></Surface>)}{!years.length ? <Text variant="muted">Ainda não há edições reveladas.</Text> : null}</> : <EmptyState title="Histórico indisponível" message={history.error?.message} action="Tentar novamente" onAction={() => { void history.refetch(); }} />}
    {user?.is_admin ? <>{themeQuery.data ? <ThemeEditor key={JSON.stringify(themeQuery.data)} data={themeQuery.data} /> : null}<HistoryEditor /></> : null}
  </View>;
}
function ThemeEditor({ data }: { data: ThemeData }) {
  const [tema, setTema] = useState(data.tema), [valor, setValor] = useState(data.valor_centavos === null ? '' : String(data.valor_centavos / 100)), [avoid, setAvoid] = useState(data.evitar_repeticao);
  const mutation = useFeatureMutation();
  const amount = valor.trim() === '' ? null : Math.round(Number(valor.replace(',', '.')) * 100);
  return <Surface style={styles.gap}><Text variant="display" style={styles.title}>Tema e valor</Text><View style={styles.gap}>{temas.map(t => <Button key={t} variant={t === tema ? 'ghost' : 'quiet'} selected={t === tema} onPress={() => { setTema(t); if (t === 'Até R$ 50') setValor('50'); }}>{t}</Button>)}</View><Field label="Tema próprio" value={tema} onChangeText={setTema} maxLength={100} /><Field label="Valor sugerido (R$)" value={valor} onChangeText={setValor} keyboardType="decimal-pad" /><Button selected={avoid} variant="ghost" onPress={() => setAvoid(v => !v)}>{avoid ? 'Ativado' : 'Desativado'}: evitar o mesmo par do ano anterior</Button><Button loading={mutation.isPending} disabled={!tema.trim() || (amount !== null && (!Number.isSafeInteger(amount) || amount < 0))} onPress={() => mutation.send({ path: '/api/secret-santa/theme', method: 'PUT', json: { tema, valor_centavos: amount, evitar_repeticao: avoid }, message: 'Combinado salvo.' })}>Salvar combinado</Button></Surface>;
}
const styles = StyleSheet.create({ section: { gap: 18 }, gap: { gap: 12 }, title: { fontSize: 29, lineHeight: 38 }, subtitle: { fontSize: 25, lineHeight: 33 } });
