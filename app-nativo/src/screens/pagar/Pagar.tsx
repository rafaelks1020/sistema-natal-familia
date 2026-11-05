import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Check from 'lucide-react-native/icons/check';
import { api, ApiError, queryClient, sessionStore } from '../../api';
import { useSession } from '../../session';
import type { Payment, PaymentInput, PaymentResult, PaymentStatus } from '../../types/vaquinha';
import { theme } from '../../theme';
import { brl } from '../../format';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LoopVideo } from '../../ui/LoopVideo';
import { Rise } from '../../ui/motion';
import { Skeleton } from '../../ui/Skeleton';
import { Text } from '../../ui/Text';
import { useToast } from '../../ui/Toast';
import { refreshVaquinha, requireCurrentSession, sessionIsCurrent, vaquinhaKeys } from '../vaquinha/data';
import { PaymentForm } from './PaymentForm';
import { PixPanel } from './PixPanel';
import { confettiMediaName } from '../vaquinha/celebration';

const inactiveStatuses = new Set(['CANCELED', 'CANCELLED', 'EXPIRED', 'SUBSTITUIDO']);
export function paymentIsOpen(payment: Payment | null | undefined) {
  if (!payment || payment.paid || payment.status === 'PAID' || inactiveStatuses.has(payment.status)) return false;
  const today = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date());
  return !payment.due_date || payment.due_date >= today;
}
export default function Pagar() {
  const { user, status } = useSession();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [changing, setChanging] = useState(false);
  const [confetti, setConfetti] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const saving = useRef(false);
  const thanked = useRef(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => { const subscription = AppState.addEventListener('change', state => setActive(state === 'active')); return () => subscription.remove(); }, []);
  const linked = user?.participant_id != null;
  const payment = useQuery({
    queryKey: vaquinhaKeys.payment,
    queryFn: ({ signal }) => api<PaymentStatus>('/api/pagamento', { signal }),
    enabled: status === 'authenticated' && linked && focused && active && !submitting,
    staleTime: 0,
    refetchInterval: query => focused && active && !submitting && !query.state.data?.participant_paid && paymentIsOpen(query.state.data?.payment) ? 8000 : false,
    refetchIntervalInBackground: false,
  });
  const paid = Boolean(payment.data?.participant_paid || payment.data?.payment?.paid || payment.data?.payment?.status === 'PAID');
  useEffect(() => {
    if (!paid || thanked.current) return;
    thanked.current = true;
    refreshVaquinha(sessionStore.getGeneration());
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [paid]);
  useEffect(() => { if (!paid) return; const timer = setTimeout(() => setConfetti(false), 5000); return () => clearTimeout(timer); }, [paid]);
  const mutation = useMutation({
    mutationFn: ({ input, generation }: { input: PaymentInput; generation: number }) => {
      requireCurrentSession(generation);
      return api<PaymentResult>('/api/pagamento', { method: 'POST', json: input, timeoutMs: 60000 });
    },
    onMutate: async ({ generation }) => { await queryClient.cancelQueries({ queryKey: vaquinhaKeys.payment }); requireCurrentSession(generation); },
    onSuccess: (result, { generation }) => {
      if (!sessionIsCurrent(generation)) return;
      queryClient.setQueryData<PaymentStatus>(vaquinhaKeys.payment, current => current ? { ...current, payment: result.payment, participant_paid: current.participant_paid || Boolean(result.payment?.paid) } : current);
      setChanging(false); Keyboard.dismiss();
      toast(result.reused ? 'Seu Pix continua disponível.' : 'Seu Pix está pronto.');
    },
    onError: (error, { generation }) => {
      if (!sessionIsCurrent(generation)) return;
      toast(error.message, 'error');
      if (error instanceof ApiError && error.status === 409) setChanging(false);
    },
    onSettled: (_result, _error, { generation }) => {
      saving.current = false;
      if (!sessionIsCurrent(generation)) return;
      setSubmitting(false);
      void queryClient.invalidateQueries({ queryKey: vaquinhaKeys.payment });
    },
  });
  function submit(input: PaymentInput) {
    if (saving.current || mutation.isPending || paid) return;
    saving.current = true; setSubmitting(true);
    mutation.mutate({ input, generation: sessionStore.getGeneration() });
  }
  function back() { if (router.canGoBack()) router.back(); else router.replace('/vaquinha'); }
  const openPayment = paymentIsOpen(payment.data?.payment) ? payment.data?.payment : null;
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.page}>
    <View style={[styles.nav, { paddingTop: insets.top + 8 }]}><Pressable accessibilityRole="button" accessibilityLabel="Voltar para a vaquinha" disabled={submitting} onPress={back} style={styles.back}><ArrowLeft size={23} strokeWidth={1.5} color={theme.colors.ivory} /></Pressable><Text variant="display" accessibilityRole="header" style={styles.navTitle}>Minha contribuição</Text></View>
    {!linked ? <EmptyState title="Seu lugar na vaquinha" message="Peça a quem organiza para vincular seu acesso a um participante antes de pagar." action="Voltar à vaquinha" onAction={back} />
      : payment.isPending ? <View style={styles.loading}><Skeleton style={{ height: 180 }} /><Skeleton style={{ height: 100 }} /><Skeleton style={{ height: 230 }} /></View>
      : !payment.data ? <EmptyState title="Vamos tentar de novo?" message={payment.error?.message ?? 'Não conseguimos consultar seu pagamento.'} action="Consultar novamente" onAction={() => { void payment.refetch(); }} />
      : <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) + 24 }]}>
        {paid ? <Rise style={styles.thanks}>
          {confetti && confettiMediaName ? <LoopVideo name={confettiMediaName} once onEnded={() => setConfetti(false)} style={styles.confetti} /> : <View style={styles.paidSeal}><Check size={44} strokeWidth={1.2} color={theme.colors.champagne} /></View>}
          <Text variant="kicker">Sua parte está paga</Text><Text variant="display" style={styles.thanksTitle}>A nossa ceia tem um pouco de você.</Text><Text variant="muted" style={styles.center}>Obrigado por fazer parte desse encontro. Sua contribuição foi confirmada.</Text>
          {payment.data.payment?.paid ? <Text variant="numeral" style={styles.paidAmount}>{brl(payment.data.payment.amount)}</Text> : null}
          <Button onPress={() => router.replace('/vaquinha')}>Voltar à vaquinha</Button>
        </Rise> : openPayment && !changing ? <PixPanel key={openPayment.reference} payment={openPayment} checking={payment.isFetching} error={payment.error?.message} onChange={() => setChanging(true)} onRefresh={() => { void payment.refetch(); }} />
          : !payment.data.enabled || payment.data.amount <= 0 || payment.data.amount > 5000 ? <EmptyState title="Logo, a nossa vaquinha" message="O pagamento ainda precisa ser preparado por quem organiza a ceia." action="Consultar novamente" onAction={() => { void payment.refetch(); }} />
          : <View style={styles.form}>
            {changing ? <Text variant="muted">O novo Pix será criado com o valor escolhido. Depois, use apenas o novo código para contribuir.</Text> : payment.data.payment && !openPayment ? <Text variant="muted">O pagamento anterior foi encerrado ou venceu. Você pode gerar um novo Pix abaixo.</Text> : null}
            <PaymentForm status={payment.data} busy={submitting} initialValue={changing ? openPayment?.amount : undefined} onSubmit={submit} onCancel={openPayment ? () => setChanging(false) : undefined} />
          </View>}
      </ScrollView>}
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background }, nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12, paddingBottom: 14, borderBottomWidth: 1, borderColor: theme.colors.line }, back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, navTitle: { flex: 1, fontSize: 25, lineHeight: 34 }, content: { padding: 24, paddingTop: 30, width: '100%', maxWidth: 720, alignSelf: 'center', flexGrow: 1 }, loading: { padding: 24, gap: 24 }, form: { gap: 20 }, thanks: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24, paddingVertical: 20 }, confetti: { width: 210, height: 155, borderRadius: 18 }, paidSeal: { height: 155, justifyContent: 'center' }, thanksTitle: { textAlign: 'center', fontSize: 38, lineHeight: 50 }, center: { textAlign: 'center' }, paidAmount: { fontSize: 42, lineHeight: 56 },
});
