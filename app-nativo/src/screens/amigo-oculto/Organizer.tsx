import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import Settings2 from 'lucide-react-native/icons/settings-2';
import Check from 'lucide-react-native/icons/check';
import X from 'lucide-react-native/icons/x';
import { api, ApiError, queryClient, queryKeys, sessionStore } from '../../api';
import { brl } from '../../format';
import { theme } from '../../theme';
import type { DrawInput, DrawRule, SantaAdminData } from '../../types/amigo-oculto';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Sheet } from '../../ui/Sheet';
import { Skeleton } from '../../ui/Skeleton';
import { Surface } from '../../ui/Surface';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { assertSession, revealDateLabel, sameSession, santaKeys } from './data';
import { RevealDate } from './RevealDate';

type AdminOperation = { kind: 'draw'; body: DrawInput; generation: number } | { kind: 'cancel'; generation: number };

export function Organizer() {
  const query = useQuery({ queryKey: santaKeys.admin, queryFn: ({ signal }) => api<SantaAdminData>('/api/secret-santa/admin', { signal }), refetchInterval: 60_000 });
  const [editing, setEditing] = useState(false);
  const saving = useRef(false);
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: (operation: AdminOperation) => {
      assertSession(operation.generation);
      return operation.kind === 'draw'
        ? api<{ ok: true }>('/api/secret-santa/admin', { method: 'POST', json: operation.body })
        : api<{ ok: true }>('/api/secret-santa/admin', { method: 'DELETE' });
    },
    onMutate: async operation => {
      await queryClient.cancelQueries({ queryKey: santaKeys.all });
      assertSession(operation.generation);
    },
    onSuccess: (_result, operation) => {
      if (!sameSession(operation.generation)) return;
      setEditing(false);
      toast(operation.kind === 'draw' ? 'Sorteio pronto. Cada pessoa guarda seu segredo.' : 'O sorteio foi encerrado. Os desejos foram mantidos.');
    },
    onError: (error, operation) => {
      if (!sameSession(operation.generation)) return;
      if (error instanceof ApiError && error.status === 409 && operation.kind === 'draw' && !operation.body.force) {
        Alert.alert('Já tem gente que revelou', `${error.message}\nOs nomes serão trocados e as marcações de compra serão zeradas.`, [
          { text: 'Manter o sorteio', style: 'cancel' },
          { text: 'Refazer mesmo assim', style: 'destructive', onPress: () => execute({ ...operation, body: { ...operation.body, force: true } }) },
        ]);
      } else toast(error.message, 'error');
    },
    onSettled: (_result, _error, operation) => {
      saving.current = false;
      if (sameSession(operation.generation)) {
        void queryClient.invalidateQueries({ queryKey: santaKeys.all });
        void queryClient.invalidateQueries({ queryKey: queryKeys.home });
      }
    },
  });

  function execute(operation: AdminOperation) {
    if (saving.current || !sameSession(operation.generation)) return;
    saving.current = true;
    mutation.mutate(operation);
  }

  function confirmDraw(body: DrawInput) {
    const generation = sessionStore.getGeneration();
    Alert.alert(query.data?.config ? 'Refazer o sorteio?' : 'Vamos sortear?', `${body.participant_ids.length} pessoas, presentes de ${brl(body.min_gift_value)} a ${brl(body.max_gift_value)}.\n${body.reveal_date ? `Revelação em ${revealDateLabel(body.reveal_date)}.` : 'Revelação liberada imediatamente.'}${query.data?.config ? '\nO sorteio atual será substituído.' : ''}`, [
      { text: 'Revisar', style: 'cancel' },
      { text: 'Sortear', onPress: () => execute({ kind: 'draw', body, generation }) },
    ]);
  }

  function cancelDraw() {
    const generation = sessionStore.getGeneration();
    Alert.alert('Encerrar o sorteio?', 'O sorteio deixará de ficar disponível para a família. As listas de desejos serão mantidas.', [
      { text: 'Manter', style: 'cancel' },
      { text: 'Encerrar sorteio', style: 'destructive', onPress: () => execute({ kind: 'cancel', generation }) },
    ]);
  }

  return <View style={styles.section}>
    <View style={styles.heading}><Settings2 size={19} color={theme.colors.champagne} /><Text variant="kicker">Para quem cuida do encontro</Text></View>
    <Text variant="display" accessibilityRole="header" style={styles.title}>Organizar sorteio</Text>
    {query.isPending ? <Skeleton style={{ height: 140 }} /> : !query.data ? <Surface style={styles.gap}>
      <Text variant="muted">{query.error?.message ?? 'Não foi possível carregar a organização.'}</Text><Button variant="ghost" onPress={() => { void query.refetch(); }}>Tentar novamente</Button>
    </Surface> : <Surface style={styles.gap}>
      <Text variant="muted">{query.data.config ? `${query.data.status.filter(person => person.revealed).length} de ${query.data.status.length} pessoas já revelaram.` : 'Escolha as pessoas, combine o valor e deixe a surpresa acontecer.'}</Text>
      {query.data.config?.reveal_date ? <Text variant="muted">Revelação: {revealDateLabel(query.data.config.reveal_date)}.</Text> : null}
      {query.isError ? <Text accessibilityRole="alert" variant="muted">Não conseguimos atualizar o status. Tente atualizar a tela.</Text> : null}
      {query.data.status.map((person, index) => <View key={`${person.name}:${index}`} style={styles.statusRow}>
        <Text style={styles.flex}>{person.name}</Text><Text variant="muted" style={{ color: person.revealed ? theme.colors.champagne : theme.colors.muted }}>{person.revealed ? 'Já revelou' : 'Aguardando'}</Text>
      </View>)}
      <Button variant="ghost" disabled={mutation.isPending} onPress={() => setEditing(true)}>{query.data.config ? 'Preparar novo sorteio' : 'Preparar sorteio'}</Button>
      {query.data.config ? <Button variant="quiet" loading={mutation.isPending && mutation.variables?.kind === 'cancel'} disabled={mutation.isPending} onPress={cancelDraw}>Encerrar sorteio atual</Button> : null}
    </Surface>}
    {editing && query.data ? <OrganizerEditor data={query.data} pending={mutation.isPending} onClose={() => { if (!saving.current) setEditing(false); }} onDraw={confirmDraw} /> : null}
  </View>;
}

function money(value: string) {
  const trimmed = value.trim();
  if (!trimmed || !/^(?:\d+(?:\.\d{1,2})?|\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)$/.test(trimmed)) return NaN;
  const number = Number(trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed);
  return Number.isFinite(number) && number >= 0 && number <= 1_000_000 ? Math.round(number * 100) / 100 : NaN;
}

function OrganizerEditor({ data, pending, onClose, onDraw }: { data: SantaAdminData; pending: boolean; onClose: () => void; onDraw: (body: DrawInput) => void }) {
  const [selected, setSelected] = useState(() => data.participants.map(person => person.id));
  const [min, setMin] = useState(data.config?.min_gift_value?.toFixed(2).replace('.', ',') ?? '');
  const [max, setMax] = useState(data.config?.max_gift_value?.toFixed(2).replace('.', ',') ?? '');
  const [date, setDate] = useState<string | null>(data.config?.reveal_date ?? null);
  const [rules, setRules] = useState<DrawRule[]>([]);
  const [first, setFirst] = useState<number | null>(null);
  const [second, setSecond] = useState<number | null>(null);
  const [errors, setErrors] = useState<{ people?: string; min?: string; max?: string; rules?: string }>({});
  const people = data.participants.filter(person => selected.includes(person.id));

  function toggle(id: number) {
    setSelected(current => current.includes(id) ? current.filter(person => person !== id) : [...current, id]);
    setRules(current => current.filter(rule => rule.participant1_id !== id && rule.participant2_id !== id));
    if (first === id) setFirst(null);
    if (second === id) setSecond(null);
  }

  function addRule() {
    if (first === null || second === null || first === second) return;
    if (rules.length >= 100) { setErrors(current => ({ ...current, rules: 'O limite é de 100 regras.' })); return; }
    if (rules.some(rule => rule.participant1_id === first && rule.participant2_id === second || rule.participant1_id === second && rule.participant2_id === first)) {
      setErrors(current => ({ ...current, rules: 'Este par já tem uma regra.' })); return;
    }
    setRules(current => [...current, { type: 'cannot_draw', participant1_id: first, participant2_id: second }]);
    setFirst(null); setSecond(null); setErrors(current => ({ ...current, rules: undefined }));
  }

  function draw() {
    const minimum = money(min), maximum = money(max);
    const next: typeof errors = {};
    if (selected.length < 3 || selected.length > 200) next.people = 'Escolha de 3 a 200 pessoas.';
    if (!Number.isFinite(minimum)) next.min = 'Informe um valor de R$ 0,00 a R$ 1.000.000,00.';
    if (!Number.isFinite(maximum)) next.max = 'Informe um valor de R$ 0,00 a R$ 1.000.000,00.';
    else if (minimum > maximum) next.max = 'O máximo precisa ser igual ou maior que o mínimo.';
    if (first !== null || second !== null) next.rules = 'Adicione o par escolhido ou limpe a seleção antes de sortear.';
    setErrors(next);
    if (Object.keys(next).length) return;
    onDraw({ action: 'draw', participant_ids: [...selected], min_gift_value: minimum, max_gift_value: maximum, reveal_date: date, rules: [...rules] });
  }

  return <Sheet visible title="Preparar o sorteio" onClose={onClose}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
      <Text variant="muted">Um novo sorteio troca os nomes e reinicia as marcações de compra. Os desejos são mantidos.</Text>
      <Text variant="kicker">Participantes ({selected.length})</Text>
      <View style={styles.chips}>{data.participants.map(person => <Chip key={person.id} label={`${person.name}${person.has_login ? '' : ' (sem acesso)'}`} selected={selected.includes(person.id)} disabled={pending} onPress={() => toggle(person.id)} />)}</View>
      {!data.participants.length ? <Text variant="muted">Ainda não há pessoas na lista da família.</Text> : null}
      {data.participants.some(person => !person.has_login) ? <Text variant="muted" style={styles.note}>Quem está sem acesso precisa vincular uma conta para revelar pelo app.</Text> : null}
      {errors.people ? <Text accessibilityRole="alert" style={styles.error}>{errors.people}</Text> : null}
      <View style={styles.amounts}><View style={styles.amount}><Field label="Valor mínimo (R$)" value={min} onChangeText={setMin} keyboardType="decimal-pad" maxLength={16} error={errors.min} editable={!pending} /></View>
        <View style={styles.amount}><Field label="Valor máximo (R$)" value={max} onChangeText={setMax} keyboardType="decimal-pad" maxLength={16} error={errors.max} editable={!pending} /></View></View>
      <RevealDate value={date} onChange={setDate} disabled={pending} />
      <View style={styles.divider} />
      <Text variant="display" style={styles.subtitle}>Quem não pode se tirar?</Text>
      <Text variant="muted">Cada regra vale nos dois sentidos. Ninguém tira a si mesmo, mesmo sem regra.</Text>
      {rules.map(rule => <View key={`${rule.participant1_id}:${rule.participant2_id}`} style={styles.rule}>
        <Text variant="muted" style={styles.flex}>{data.participants.find(person => person.id === rule.participant1_id)?.name} e {data.participants.find(person => person.id === rule.participant2_id)?.name}</Text>
        <Button variant="quiet" disabled={pending} accessibilityLabel="Remover regra deste par" icon={<X size={15} color={theme.colors.secondary} />} onPress={() => setRules(current => current.filter(entry => entry !== rule))}>Remover</Button>
      </View>)}
      <Text variant="kicker">Primeira pessoa</Text>
      <View style={styles.chips}>{people.map(person => <Chip key={person.id} label={person.name} disabled={pending || second === person.id} selected={first === person.id} onPress={() => setFirst(current => current === person.id ? null : person.id)} />)}</View>
      <Text variant="kicker">Não pode tirar</Text>
      <View style={styles.chips}>{people.map(person => <Chip key={person.id} label={person.name} disabled={pending || first === person.id} selected={second === person.id} onPress={() => setSecond(current => current === person.id ? null : person.id)} />)}</View>
      <View style={styles.chips}><Button variant="ghost" disabled={pending || first === null || second === null} onPress={addRule}>Adicionar regra</Button>
        {first !== null || second !== null ? <Button variant="quiet" disabled={pending} onPress={() => { setFirst(null); setSecond(null); }}>Limpar seleção</Button> : null}</View>
      {errors.rules ? <Text accessibilityRole="alert" style={styles.error}>{errors.rules}</Text> : null}
      <Button loading={pending} onPress={draw}>Sortear com carinho</Button>
    </ScrollView>
  </Sheet>;
}

function Chip({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.chip, selected && styles.chipSelected, disabled && styles.dim]}>
    {selected ? <Check size={13} color={theme.colors.champagne} /> : null}<Text style={styles.chipText}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  section: { gap: 15, paddingTop: 30, borderTopWidth: 1, borderColor: theme.colors.line }, heading: { flexDirection: 'row', alignItems: 'center', gap: 10 }, title: { fontSize: 30, lineHeight: 38 },
  gap: { gap: 16 }, flex: { flex: 1 }, statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingVertical: 10, borderBottomWidth: 1, borderColor: theme.colors.line },
  form: { gap: 18, paddingBottom: 16 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, minWidth: 44, borderRadius: theme.radius.field, borderWidth: 1, borderColor: theme.colors.line, paddingVertical: 11, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7, maxWidth: '100%' },
  chipSelected: { backgroundColor: theme.colors.field, borderColor: theme.colors.champagne }, chipText: { fontSize: 12, flexShrink: 1 }, dim: { opacity: 0.45 },
  amounts: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, amount: { flex: 1, minWidth: 125 }, note: { fontSize: 11 }, error: { fontSize: 12, color: theme.colors.error },
  divider: { height: 1, backgroundColor: theme.colors.line, marginVertical: 6 }, subtitle: { fontSize: 24, lineHeight: 32 }, rule: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.field, borderRadius: theme.radius.field, paddingLeft: 14 },
});
