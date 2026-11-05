import { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, queryClient, sessionStore } from '../../api';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { Skeleton } from '../../ui/Skeleton';
import { useToast } from '../../ui/Toast';
export function BlockedPeople() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const people = useQuery({ queryKey: ['moderacao', 'blocks'], enabled: open, queryFn: ({ signal }) => api<{ id: number; name: string }[]>('/api/blocks', { signal }) });
  const mutation = useMutation({ mutationFn: async (id: number) => { await api(`/api/blocks/${id}`, { method: 'DELETE' }); return sessionStore.getGeneration(); },
    onSuccess: async (generation) => {
      if (sessionStore.getGeneration() !== generation || sessionStore.getSnapshot().status !== 'authenticated') return;
      await sessionStore.contentChanged();
      await queryClient.invalidateQueries({ queryKey: ['moderacao', 'blocks'] }); toast('Pessoa desbloqueada.');
    }, onError: (error) => toast(error.message, 'error') });
  return <View style={{ gap: 12 }}><Button variant="quiet" onPress={() => setOpen(value => !value)}>Pessoas bloqueadas</Button>
    {open ? people.isPending ? <Skeleton style={{ height: 64 }} /> : people.isError ? <><Text variant="muted">{people.error.message}</Text><Button variant="ghost" onPress={() => { void people.refetch(); }}>Tentar novamente</Button></> : !people.data.length ? <Text variant="muted">Nenhuma pessoa bloqueada.</Text> : people.data.map(person => <View key={person.id} style={{ gap: 4 }}><Text>{person.name}</Text><Button variant="ghost" disabled={mutation.isPending} onPress={() => mutation.mutate(person.id)}>Desbloquear</Button></View>) : null}
  </View>;
}
