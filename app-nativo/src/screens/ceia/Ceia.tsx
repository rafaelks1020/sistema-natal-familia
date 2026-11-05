import { useEffect } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api, queryClient } from '../../api';
import { Cabecalho } from '../familia/Cabecalho';
import { useAutenticado } from '../familia/sessao';
import { useSession } from '../../session';
import { theme } from '../../theme';
import { EmptyState } from '../../ui/EmptyState';
import { Skeleton } from '../../ui/Skeleton';
import { useToast } from '../../ui/Toast';
import { ceiaKeys } from './chaves';
import { EventoCeia } from './Evento';
import { PratosCeia } from './Pratos';
import { PresencaCeia } from './Presenca';
import type { CeiaDados } from './tipos';
import { VotacaoCeia } from './Votacao';

export default function Ceia() {
  const ok = useAutenticado();
  const { user } = useSession();
  const toast = useToast();
  const ceia = useQuery({
    queryKey: ceiaKeys.tudo,
    enabled: ok,
    queryFn: ({ signal }) => api<CeiaDados>('/api/ceia', { signal }),
  });
  useEffect(() => { if (ceia.error) toast(ceia.error.message, 'error'); }, [ceia.error, toast]);
  if (!ok || !user) return null;
  function voltar() { if (router.canGoBack()) router.back(); else router.navigate('/'); }
  return <View style={styles.pagina}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.miolo} contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={ceia.isRefetching && !ceia.isPending} onRefresh={() => { void ceia.refetch(); }} tintColor={theme.colors.champagne} colors={[theme.colors.cherry]} progressBackgroundColor={theme.colors.surface} />}>
        <Cabecalho kicker="A mesa da família" titulo="Ceia" aoVoltar={voltar} />
        {ceia.isPending ? <Esqueleto /> : ceia.data
          ? <View style={styles.corpo}>
            <EventoCeia evento={ceia.data.evento} admin={user.is_admin} />
            <PresencaCeia presenca={ceia.data.presenca} usuario={user} />
            <PratosCeia pratos={ceia.data.pratos} usuarioId={user.id} admin={user.is_admin} />
            <VotacaoCeia votacoes={ceia.data.votacoes} admin={user.is_admin} />
          </View>
          : <EmptyState title="Vamos tentar de novo?" message={ceia.error?.message ?? 'Não foi possível abrir a ceia.'} action="Tentar novamente" onAction={() => { void queryClient.invalidateQueries({ queryKey: ceiaKeys.tudo }); }} />}
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}

function Esqueleto() {
  return <View style={styles.corpo} accessibilityLabel="Preparando a ceia">
    <Skeleton style={styles.bloco} />
    <Skeleton style={styles.bloco} />
    <Skeleton style={styles.bloco} />
  </View>;
}

const styles = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  miolo: { paddingBottom: 48 },
  corpo: { paddingHorizontal: 24, paddingBottom: 24, gap: 36 },
  bloco: { height: 140 },
});
