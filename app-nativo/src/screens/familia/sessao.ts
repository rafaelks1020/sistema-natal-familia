import { useEffect } from 'react';
import { router } from 'expo-router';
import { sessionStore } from '../../api';
import { useSession } from '../../session';

export function sessaoVigente(generation: number): boolean {
  return generation === sessionStore.getGeneration() && sessionStore.getSnapshot().status === 'authenticated';
}

export function useAutenticado(): boolean {
  const { status } = useSession();
  useEffect(() => {
    if (status === 'guest' || status === 'locked') router.replace('/entrar');
  }, [status]);
  return status === 'authenticated';
}
