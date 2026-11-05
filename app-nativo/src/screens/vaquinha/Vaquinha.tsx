import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Check from 'lucide-react-native/icons/check';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Plus from 'lucide-react-native/icons/plus';
import Trash2 from 'lucide-react-native/icons/trash';
import { api, queryClient, sessionStore } from '../../api';
import { useSession } from '../../session';
import { brl } from '../../format';
import { enviarFoto, type FotoLocal } from '../../upload';
import type { Participant, TimelineEvent } from '../../types/vaquinha';
import { theme } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Field } from '../../ui/Field';
import { LoopVideo } from '../../ui/LoopVideo';
import { Rise } from '../../ui/motion';
import { Sheet } from '../../ui/Sheet';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import type { Purchase, PurchaseInput, VaquinhaData } from './data';
import { GoalCard } from './GoalCard';
import { dateLabel, getVaquinha, refreshVaquinha, requireCurrentSession, sessionIsCurrent, vaquinhaKeys } from './data';
import { PurchaseDetail } from './PurchaseDetail';
import { PurchaseForm } from './PurchaseForm';
import { confettiMediaName } from './celebration';

type Action = { generation: number } & (
  { kind: 'toggle'; participant: Participant } | { kind: 'participant'; name: string } |
  { kind: 'purchase'; input: PurchaseInput; photos: FotoLocal[]; purchaseId?: number } |
  { kind: 'deleteParticipant'; id: number } | { kind: 'deletePurchase'; id: number }
);
type Row = { kind: 'participant'; data: Participant } | { kind: 'purchase'; data: Purchase } | { kind: 'event'; data: TimelineEvent };
const tabs = ['Quem pagou', 'Contas', 'Linha do tempo'] as const;

function optimistic(data: VaquinhaData, action: Action): VaquinhaData {
  if (action.kind === 'toggle') {
    const person = action.participant;
    return { ...data, participants: data.participants.map(p => p.id === person.id ? { ...p, paid: !person.paid, paid_date: person.paid ? null : new Date().toISOString() } : p) };
  }
  // Remoções aguardam a validação do servidor: podem envolver vínculos e pagamentos.
  return data;
}
export default function Vaquinha() {
  const { user, status } = useSession();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState(0);
  const [editor, setEditor] = useState<'participant' | 'purchase' | null>(null);
  const [name, setName] = useState('');
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [detail, setDetail] = useState<Purchase | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const celebrated = useRef(false);
  const saving = useRef(false);
  const fund = useQuery({ queryKey: vaquinhaKeys.all, queryFn: ({ signal }) => getVaquinha(signal), enabled: status === 'authenticated' });
  useFocusEffect(useCallback(() => { if (sessionStore.getSnapshot().status === 'authenticated' && !saving.current) void queryClient.invalidateQueries({ queryKey: vaquinhaKeys.all, exact: true }); }, []));
  useEffect(() => { if (fund.error) toast(fund.error.message, 'error'); }, [fund.error, toast]);
  const allPaid = Boolean(fund.data?.participants.length && fund.data.participants.every(p => p.paid || p.pix));
  useEffect(() => { if (allPaid && !celebrated.current && !saving.current) { celebrated.current = true; setCelebrate(true); } }, [allPaid, fund.isFetching]);
  useEffect(() => { if (!celebrate) return; const timer = setTimeout(() => setCelebrate(false), 4500); return () => clearTimeout(timer); }, [celebrate]);
  const mutation = useMutation({
    mutationFn: async (action: Action) => {
      requireCurrentSession(action.generation);
      if (action.kind === 'toggle') return api(`/api/vaquinha/participants/${action.participant.id}`, { method: 'PUT', json: { paid: !action.participant.paid } });
      if (action.kind === 'participant') return api('/api/vaquinha/participants', { method: 'POST', json: { name: action.name } });
      if (action.kind === 'deleteParticipant') return api(`/api/vaquinha/participants/${action.id}`, { method: 'DELETE' });
      if (action.kind === 'deletePurchase') return api(`/api/vaquinha/purchases/${action.id}`, { method: 'DELETE' });
      const images = await Promise.all(action.photos.map(photo => { requireCurrentSession(action.generation); return enviarFoto(photo); }));
      requireCurrentSession(action.generation);
      return api(action.purchaseId ? `/api/vaquinha/purchases/${action.purchaseId}` : '/api/vaquinha/purchases', { method: action.purchaseId ? 'PUT' : 'POST', json: { ...action.input, images: [...(action.input.images || []), ...images] } });
    },
    onMutate: async action => {
      await queryClient.cancelQueries({ queryKey: vaquinhaKeys.all, exact: true });
      requireCurrentSession(action.generation);
      const previous = queryClient.getQueryData<VaquinhaData>(vaquinhaKeys.all);
      if (previous) queryClient.setQueryData(vaquinhaKeys.all, optimistic(previous, action));
      return { previous, generation: action.generation };
    },
    onError: (error, action, context) => {
      if (!sessionIsCurrent(action.generation)) return;
      if (context?.previous) queryClient.setQueryData(vaquinhaKeys.all, context.previous);
      toast(error.message, 'error');
    },
    onSuccess: (_data, action) => {
      if (!sessionIsCurrent(action.generation)) return;
      if (action.kind === 'participant' || action.kind === 'purchase') { setEditor(null); setEditingPurchase(null); setName(''); }
      if (action.kind === 'deletePurchase') setDetail(null);
      toast(action.kind.startsWith('delete') ? 'Registro apagado.' : 'Vaquinha atualizada.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    },
    onSettled: (_data, _error, action) => { saving.current = false; refreshVaquinha(action.generation); },
  });
  function run(action: Action) {
    if (saving.current || mutation.isPending || !user?.is_admin) return;
    saving.current = true; mutation.mutate(action);
  }
  function toggle(person: Participant) {
    if (person.pix) { toast('Pago pelo Pix: não dá para desmarcar.', 'error'); return; }
    run({ kind: 'toggle', participant: person, generation: sessionStore.getGeneration() });
  }
  function remove(kind: 'deleteParticipant' | 'deletePurchase', id: number, label: string) {
    Alert.alert('Apagar este registro?', label, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: () => run({ kind, id, generation: sessionStore.getGeneration() }) }]);
  }
  if (!user) return null;
  if (fund.isPending) return <View style={[styles.page, styles.loading, { paddingTop: insets.top + 32 }]}><Skeleton style={{ height: 210 }} /><Skeleton style={{ height: 85 }} /><Skeleton style={{ height: 250 }} /></View>;
  if (!fund.data) return <EmptyState title="A vaquinha já volta" message={fund.error?.message ?? 'Não conseguimos carregar as contribuições.'} action="Tentar novamente" onAction={() => { void fund.refetch(); }} />;
  const data = fund.data;
  const mine = data.participants.find(p => p.id === user.participant_id);
  const paid = data.participants.filter(p => p.paid || p.pix).length;
  const rows: Row[] = tab === 0 ? data.participants.map(p => ({ kind: 'participant', data: p })) : tab === 1 ? data.purchases.map(p => ({ kind: 'purchase', data: p })) : data.timeline.map(event => ({ kind: 'event', data: event }));
  return <View style={styles.page}>
    <FlatList data={rows} keyExtractor={row => `${row.kind}-${row.data.id}`} contentContainerStyle={[styles.list, { paddingTop: insets.top + 28 }]} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={fund.isRefetching && !mutation.isPending} onRefresh={() => { if (!saving.current) void fund.refetch(); }} tintColor={theme.colors.champagne} colors={[theme.colors.cherry]} progressBackgroundColor={theme.colors.surface} />}
      ListHeaderComponent={<View style={styles.header}>
        <Rise><Text variant="kicker">Cada um faz parte</Text><Text variant="display" accessibilityRole="header" style={styles.title}>Vaquinha da ceia</Text></Rise>
        <GoalCard data={data} isAdmin={user.is_admin} />
        <Rise index={1} style={styles.balance}><Text variant="display" style={{ fontSize: 25 }}>Prestação de contas</Text><Text variant="muted">Saldo da nossa ceia</Text><Text variant="numeral" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={[styles.amount, data.saldo < 0 && { color: theme.colors.cherry }]}>{brl(data.saldo)}</Text>
          <View style={styles.totals}>{([['Arrecadado', data.arrecadado], ['Gasto', data.gasto]] as const).map(([label, value]) => <View key={label} style={styles.flex}><Text variant="muted">{label}</Text><Text variant="numeral" style={styles.subAmount}>{brl(value)}</Text></View>)}</View>
          <View style={styles.progress} accessibilityRole="progressbar" accessibilityLabel="Participantes que contribuíram" accessibilityValue={{ min: 0, max: data.participants.length || 1, now: paid }}><View style={{ height: 5, width: `${data.participants.length ? paid / data.participants.length * 100 : 0}%`, backgroundColor: theme.colors.sage }} /></View>
          <Text variant="muted" style={styles.small}>{paid} de {data.participants.length} contribuições recebidas</Text>
        </Rise>
        {mine?.paid || mine?.pix ? <View style={styles.badge}><Check size={18} color={theme.colors.champagne} /><Text style={styles.badgeText}>Sua parte está paga</Text></View>
          : mine ? <View style={styles.gap}><Button onPress={() => router.push('/pagar')}>Pagar minha parte com Pix</Button><Text variant="muted" style={styles.small}>A partir de {brl(data.contribution_value)}. Você escolhe quanto contribuir.</Text></View> : <Text variant="muted">Peça a quem organiza para vincular seu acesso a um participante.</Text>}
        {allPaid ? <View style={styles.celebration}><Text variant="display" style={styles.celebrationTitle}>A família toda fez parte.</Text><Text variant="muted">Nossa ceia começa com esse carinho.</Text>{celebrate && confettiMediaName ? <LoopVideo name={confettiMediaName} once onEnded={() => setCelebrate(false)} style={styles.confetti} /> : null}</View> : null}
        <View accessibilityRole="tablist" style={styles.segments}>{tabs.map((label, index) => <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected: index === tab }} onPress={() => { setTab(index); void Haptics.selectionAsync().catch(() => {}); }} style={[styles.segment, tab === index && styles.segmentActive]}><Text style={[styles.segmentLabel, tab === index && { color: theme.colors.ivory }]}>{label}</Text></Pressable>)}</View>
        {user.is_admin ? <View style={styles.actions}><Button variant="ghost" style={styles.flex} disabled={mutation.isPending} onPress={() => setEditor('participant')} icon={<Plus size={15} color={theme.colors.champagne} />}>Participante</Button><Button variant="ghost" style={styles.flex} disabled={mutation.isPending} onPress={() => { setEditingPurchase(null); setEditor('purchase'); }} icon={<Plus size={15} color={theme.colors.champagne} />}>Compra</Button></View> : null}
      </View>}
      ListEmptyComponent={<EmptyState title={tab === 0 ? 'A mesa está se formando' : tab === 1 ? 'Os preparativos vão começar' : 'Nossa história começa aqui'} message={tab === 0 ? 'Os participantes da vaquinha vão aparecer aqui.' : tab === 1 ? 'As compras e os comprovantes ficarão aqui para a família acompanhar.' : 'Contribuições e compras aparecerão nesta linha do tempo.'} />}
      renderItem={({ item }) => {
        if (item.kind === 'participant') {
          const p = item.data; const received = p.paid || p.pix;
          return <View style={styles.person}><Avatar name={p.name} src={p.avatar_url} size={42} /><View style={styles.flex}><Text style={styles.personName}>{p.name}</Text><Text variant="muted" style={styles.small}>{received ? p.pix ? 'Pago com Pix' : `Pago · ${dateLabel(p.paid_date)}` : 'Aguardando contribuição'}</Text></View>
            {user.is_admin ? <Pressable accessibilityRole="switch" accessibilityLabel={`Contribuição de ${p.name}${p.pix ? ', confirmada pelo Pix' : ''}`} accessibilityState={{ checked: received, disabled: mutation.isPending || p.pix }} disabled={mutation.isPending || p.pix} onPress={() => toggle(p)} style={[styles.status, received && styles.statusPaid]}>{received ? <Check size={18} color={theme.colors.ivory} /> : <Text variant="muted" style={styles.small}>Marcar</Text>}</Pressable> : received ? <Check size={20} color={theme.colors.champagne} /> : null}
            {user.is_admin && p.user_id === null ? <Pressable style={styles.iconButton} accessibilityRole="button" accessibilityLabel={`Apagar participante ${p.name}`} disabled={mutation.isPending} onPress={() => remove('deleteParticipant', p.id, `Remover ${p.name} da vaquinha?`)}><Trash2 size={17} color={theme.colors.muted} /></Pressable> : null}
          </View>;
        }
        if (item.kind === 'purchase') {
          const purchase = item.data;
          return <Pressable style={styles.purchase} accessibilityRole="button" accessibilityLabel={`${purchase.description}, ${brl(purchase.value)}, ver detalhes`} onPress={() => setDetail(purchase)}>
            {purchase.images[0] ? <Image source={{ uri: purchase.images[0] }} contentFit="cover" style={styles.thumbnail} accessibilityLabel={purchase.description} /> : <View style={styles.noPhoto}><Text variant="display" style={{ color: theme.colors.champagne }}>{purchase.category.charAt(0)}</Text></View>}
            <View style={styles.flex}><Text variant="kicker">{purchase.category}</Text><Text style={styles.personName}>{purchase.description}</Text><Text variant="muted" style={styles.small}>{dateLabel(purchase.created_at)}</Text></View><View style={styles.purchasePrice}><Text variant="numeral" style={styles.price}>{brl(purchase.value)}</Text><ChevronRight size={17} color={theme.colors.champagne} /></View>
          </Pressable>;
        }
        const event = item.data;
        return <Pressable style={styles.event} accessibilityRole={event.type === 'purchase' ? 'button' : 'text'} disabled={event.type !== 'purchase'} onPress={() => { const purchase = data.purchases.find(p => p.id === event.ref_id); if (purchase) setDetail(purchase); }}>
          <View style={styles.timelineRail}><View style={[styles.dot, { backgroundColor: event.type === 'payment' ? theme.colors.sage : theme.colors.cherry }]} /><View style={styles.rail} /></View><View style={styles.eventBody}><Text variant="muted" style={styles.small}>{dateLabel(event.date)}</Text><Text>{event.description}</Text><Text variant="numeral" style={[styles.price, { color: event.type === 'payment' ? theme.colors.champagne : theme.colors.ivory }]}>{event.type === 'payment' ? 'Contribuição recebida' : `- ${brl(event.value)}`}</Text></View>
        </Pressable>;
      }} />
    <Sheet visible={editor === 'participant'} title="Mais alguém à mesa" onClose={() => { if (!saving.current) setEditor(null); }}><View style={styles.gap}><Field label="Nome do participante" value={name} onChangeText={setName} maxLength={60} editable={!mutation.isPending} autoCapitalize="words" /><Button loading={mutation.isPending} disabled={!name.trim()} onPress={() => run({ kind: 'participant', name: name.trim(), generation: sessionStore.getGeneration() })}>Adicionar participante</Button></View></Sheet>
    <Sheet visible={editor === 'purchase'} title={editingPurchase ? "Editar gasto" : "Novo gasto"} onClose={() => { if (!saving.current) { setEditor(null); setEditingPurchase(null); } }}>{editor === 'purchase' ? <PurchaseForm key={editingPurchase?.id || 0} initial={editingPurchase} busy={mutation.isPending} onSave={(input, photos) => run({ kind: 'purchase', input, photos, purchaseId: editingPurchase?.id, generation: sessionStore.getGeneration() })} /> : null}</Sheet>
    {detail ? <PurchaseDetail key={detail.id} purchase={detail} busy={mutation.isPending} onClose={() => setDetail(null)} onEdit={user.is_admin ? () => { setEditingPurchase(detail); setDetail(null); setEditor('purchase'); } : undefined} onDelete={user.is_admin ? () => remove('deletePurchase', detail.id, `${detail.description}, ${brl(detail.value)}. Essa compra será retirada do total gasto.`) : undefined} /> : null}
  </View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background }, loading: { padding: 24, gap: 24 }, list: { paddingHorizontal: 24, paddingBottom: 32, width: '100%', maxWidth: 720, alignSelf: 'center' }, header: { gap: 24, paddingBottom: 12 },
  title: { fontSize: 37, lineHeight: 49, marginTop: 8 }, balance: { paddingTop: 24, borderTopWidth: 1, borderColor: theme.colors.line }, amount: { fontSize: 65, lineHeight: 88, marginVertical: 8 }, totals: { flexDirection: 'row', gap: 24 }, flex: { flex: 1, minWidth: 0 }, subAmount: { fontSize: 29, lineHeight: 43 },
  progress: { marginTop: 24, height: 5, borderRadius: 3, backgroundColor: theme.colors.field, overflow: 'hidden' }, small: { fontSize: 11, lineHeight: 18, marginTop: 4 }, gap: { gap: 12 }, badge: { padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.lineStrong }, badgeText: { fontFamily: theme.fonts.medium },
  celebration: { minHeight: 100, justifyContent: 'center', gap: 6, paddingRight: 65 }, celebrationTitle: { fontSize: 25, lineHeight: 34 }, confetti: { position: 'absolute', right: 0, width: 90, height: 90, borderRadius: 16 },
  segments: { flexDirection: 'row', gap: 3, padding: 4, borderRadius: 16, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line }, segment: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', padding: 6, borderRadius: 12 }, segmentActive: { backgroundColor: theme.colors.field }, segmentLabel: { textAlign: 'center', fontFamily: theme.fonts.medium, fontSize: 11, lineHeight: 16, color: theme.colors.muted }, actions: { flexDirection: 'row', gap: 10 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 18, borderBottomWidth: 1, borderColor: theme.colors.line }, personName: { fontFamily: theme.fonts.medium, fontSize: 14 }, status: { minWidth: 52, minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.lineStrong, alignItems: 'center', justifyContent: 'center', padding: 6 }, statusPaid: { backgroundColor: theme.colors.sage, borderColor: theme.colors.sage }, iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  purchase: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 22, borderBottomWidth: 1, borderColor: theme.colors.line }, thumbnail: { width: 58, height: 72, borderRadius: 14 }, noPhoto: { width: 58, height: 72, borderRadius: 14, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' }, purchasePrice: { maxWidth: '35%', alignItems: 'flex-end', gap: 4 }, price: { fontSize: 22, lineHeight: 32 },
  event: { flexDirection: 'row', gap: 16, minHeight: 105 }, timelineRail: { width: 12, alignItems: 'center', paddingTop: 12 }, dot: { width: 9, height: 9, borderRadius: 5 }, rail: { width: 1, flex: 1, backgroundColor: theme.colors.line, marginTop: 8 }, eventBody: { flex: 1, paddingBottom: 22, gap: 4 },
});
