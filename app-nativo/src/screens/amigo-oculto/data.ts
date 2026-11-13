import { ApiError, sessionStore } from '../../api';

export const santaKeys = {
  all: ['amigo-oculto'] as const,
  draw: ['amigo-oculto', 'draw'] as const,
  admin: ['amigo-oculto', 'admin'] as const,
  wishlist: (participantId?: number, configId?: number) =>
    ['amigo-oculto', 'wishlist', participantId ?? 'mine', configId ?? 'current'] as const,
};

export function sameSession(generation: number) {
  return generation === sessionStore.getGeneration() && sessionStore.getSnapshot().status === 'authenticated';
}

export function assertSession(generation: number) {
  if (!sameSession(generation)) throw new ApiError('A sessão mudou. Tente novamente.', 401);
}

export const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function revealDateLabel(value: string | null) {
  if (!value) return 'data a confirmar';
  const [, month, day] = value.split('-');
  return `${day} de ${months[Number(month) - 1] ?? ''}`;
}
