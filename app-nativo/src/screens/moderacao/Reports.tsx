import { Alert, View } from 'react-native';
import { Image } from 'expo-image';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, queryClient, sessionStore } from '../../api';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { Skeleton } from '../../ui/Skeleton';
import { useToast } from '../../ui/Toast';
import { theme } from '../../theme';
type Report = { id: number; comment_id: number | null; tipo_rotulo?: string; author_name: string; reporter_name: string; content: string; images: string[]; motivo: string };
export function Reports() {
  const toast = useToast();
  const reports = useQuery({ queryKey: ['moderacao', 'reports'], queryFn: ({ signal }) => api<Report[]>('/api/reports', { signal }) });
  const mutation = useMutation({ mutationFn: async ({ id, acao }: { id: number; acao: 'apagar' | 'manter' }) => { await api(`/api/reports/${id}/resolve`, { method: 'POST', json: { acao } }); return sessionStore.getGeneration(); },
    onSuccess: async (generation) => {
      if (sessionStore.getGeneration() !== generation || sessionStore.getSnapshot().status !== 'authenticated') return;
      await sessionStore.contentChanged();
      await queryClient.invalidateQueries({ queryKey: ['moderacao', 'reports'] }); toast('Denúncia resolvida.');
    }, onError: (error) => toast(error.message, 'error') });
  return <View style={{ gap: 16 }}><Text variant="display" accessibilityRole="header" style={{ fontSize: 30 }}>Denúncias</Text><Text variant="muted">Analise e resolva cada denúncia em até 24 horas.</Text>
    {reports.isPending ? <Skeleton style={{ height: 96 }} /> : reports.isError ? <><Text variant="muted">{reports.error.message}</Text><Button variant="ghost" onPress={() => { void reports.refetch(); }}>Tentar novamente</Button></> : !reports.data.length ? <Text variant="muted">Nenhuma denúncia pendente.</Text> : reports.data.map(report => <View key={report.id} style={{ gap: 12, paddingVertical: 16, borderTopWidth: 1, borderTopColor: theme.colors.line }}>
      <Text>{report.tipo_rotulo ?? (report.comment_id ? 'Comentário' : 'Publicação')} de {report.author_name}</Text><Text>{report.content}</Text>
      {report.images.map((uri, index) => <Image key={uri} source={{ uri }} contentFit="contain" style={{ width: '100%', height: 280 }} accessibilityLabel={`Foto denunciada ${index + 1}`} />)}
      <Text variant="muted">Denunciado por {report.reporter_name}: {report.motivo}</Text>
      <Button disabled={mutation.isPending} onPress={() => Alert.alert('Apagar conteúdo?', 'O conteúdo denunciado será removido para toda a família.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Apagar', style: 'destructive', onPress: () => mutation.mutate({ id: report.id, acao: 'apagar' }) }])}>Apagar conteúdo</Button>
      <Button variant="ghost" disabled={mutation.isPending} onPress={() => mutation.mutate({ id: report.id, acao: 'manter' })}>Manter</Button>
    </View>)}
  </View>;
}
