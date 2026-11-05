import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { api, sessionStore } from '../../api';
import { Button } from '../../ui/Button';
import { useToast } from '../../ui/Toast';

export function ModerationActions({ userId, name, postId, commentId, onDone }: { userId: number; name: string; postId?: number; commentId?: number; onDone?: () => void }) {
  const toast = useToast();
  const [reporting, setReporting] = useState(false);
  const mutation = useMutation({
    mutationFn: async (motivo: string | null) => {
      await api(motivo === null ? '/api/blocks' : '/api/reports', { method: 'POST', json: motivo === null ? { user_id: userId } : { post_id: postId, comment_id: commentId, motivo } });
      return { blocked: motivo === null, generation: sessionStore.getGeneration() };
    },
    onSuccess: async ({ blocked, generation }) => {
      if (sessionStore.getSnapshot().status !== 'authenticated' || sessionStore.getGeneration() !== generation) return;
      if (blocked) await sessionStore.contentChanged();
      toast(blocked ? 'Pessoa bloqueada.' : 'Denúncia enviada. Análise em até 24 horas.');
      setReporting(false); onDone?.();
    },
    onError: (error) => toast(error.message, 'error'),
  });
  return <View style={{ gap: 4 }}>
    {reporting ? <>{['Ofensivo', 'Spam', 'Outro'].map(motivo => <Button key={motivo} variant="quiet" disabled={mutation.isPending} onPress={() => mutation.mutate(motivo)}>{motivo}</Button>)}<Button variant="quiet" disabled={mutation.isPending} onPress={() => setReporting(false)}>Cancelar denúncia</Button></>
      : <Button variant="quiet" disabled={mutation.isPending} onPress={() => setReporting(true)}>Denunciar</Button>}
    <Button variant="quiet" disabled={mutation.isPending} onPress={() => Alert.alert(`Bloquear ${name}?`, 'Você deixará de ver as publicações, fotos e comentários dessa pessoa. Pode desbloquear no seu perfil.', [
      { text: 'Cancelar', style: 'cancel' }, { text: 'Bloquear pessoa', style: 'destructive', onPress: () => mutation.mutate(null) },
    ])}>Bloquear {name}</Button>
  </View>;
}
