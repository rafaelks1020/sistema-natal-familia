import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { api, queryClient, sessionStore } from '../../api';
import { brl } from '../../format';
import { theme } from '../../theme';
import { Surface } from '../../ui/Surface';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { useReduceMotion } from '../../ui/motion';
import { parseValue, requireCurrentSession, sessionIsCurrent, vaquinhaKeys, type VaquinhaData } from './data';

export function GoalCard({ data, isAdmin }: { data: VaquinhaData; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [destino, setDestino] = useState('');
  const toast = useToast();
  const reduced = useReduceMotion();
  const progress = useSharedValue(0);
  const percentage = data.meta_centavos ? Math.min(100, data.arrecadado_centavos / data.meta_centavos * 100) : 0;
  useEffect(() => { progress.set(withTiming(percentage, { duration: reduced ? 0 : 700 })); }, [percentage, progress, reduced]);
  const animated = useAnimatedStyle(() => ({ width: `${progress.get()}%` }));
  const mutation = useMutation({
    mutationFn: async ({ generation, centavos, destino }: { generation: number; centavos: number; destino: string }) => {
      requireCurrentSession(generation);
      return api('/api/vaquinha/meta', { method: 'PUT', json: { meta_centavos: centavos, destino } });
    },
    onMutate: async () => { await queryClient.cancelQueries({ queryKey: vaquinhaKeys.all }); },
    onSuccess: (_result, input) => {
      if (!sessionIsCurrent(input.generation)) return;
      setOpen(false); toast('Meta atualizada.');
      void queryClient.invalidateQueries({ queryKey: vaquinhaKeys.all });
    },
    onError: (error, input) => { if (sessionIsCurrent(input.generation)) toast(error.message, 'error'); },
  });
  return <Surface style={styles.card}>
    <Text variant="kicker">Nosso Natal de {data.ano}</Text>
    <Text variant="display" style={styles.title}>Cada contribuição aproxima a ceia</Text>
    <Text variant="numeral" style={styles.amount}>{brl(data.arrecadado_centavos / 100)}</Text>
    <Text variant="muted">{data.meta_centavos ? `de ${brl(data.meta_centavos / 100)}` : 'Meta ainda não definida'}</Text>
    <View style={styles.progress} accessibilityRole="progressbar" accessibilityLabel="Arrecadação confirmada em relação à meta" accessibilityValue={{ min: 0, max: 100, now: Math.round(percentage) }}><Animated.View style={[styles.fill, animated]} /></View>
    {data.meta_centavos > 0 ? <Text>{percentage >= 100 ? 'Meta alcançada. Obrigado, família!' : `Faltam ${brl(Math.max(0, data.meta_centavos - data.arrecadado_centavos) / 100)}`}</Text> : null}
    <Text variant="muted">{data.contribuintes} {data.contribuintes === 1 ? 'pessoa já contribuiu' : 'pessoas já contribuíram'} com pagamento confirmado.</Text>
    {data.destino ? <Text>Destino do dinheiro: {data.destino}</Text> : null}
    {isAdmin ? <Button variant="quiet" onPress={() => { setValue(String(data.meta_centavos / 100).replace('.', ',')); setDestino(data.destino); setOpen(true); }}>Definir meta e destino</Button> : null}
    <Sheet visible={open} title="Meta da vaquinha" onClose={() => { if (!mutation.isPending) setOpen(false); }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.card}>
      <Field label="Meta em reais" value={value} onChangeText={setValue} keyboardType="decimal-pad" maxLength={13} editable={!mutation.isPending} />
      <Field label="Para que vamos usar o dinheiro?" value={destino} onChangeText={setDestino} multiline maxLength={500} editable={!mutation.isPending} />
      <Button loading={mutation.isPending} onPress={() => { const amount = parseValue(value); if (!Number.isFinite(amount) || amount <= 0 || !destino.trim()) { toast('Preencha uma meta válida e o destino do dinheiro.', 'error'); return; } mutation.mutate({ generation: sessionStore.getGeneration(), centavos: Math.round(amount * 100), destino }); }}>Salvar meta</Button>
    </ScrollView></Sheet>
  </Surface>;
}
const styles = StyleSheet.create({ card: { gap: 12 }, title: { fontSize: 28, lineHeight: 38 }, amount: { fontSize: 38, color: theme.colors.champagne }, progress: { height: 8, borderRadius: 4, backgroundColor: theme.colors.field, overflow: 'hidden' }, fill: { height: 8, backgroundColor: theme.colors.sage, borderRadius: 4 } });
