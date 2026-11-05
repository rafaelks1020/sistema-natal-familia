export const familiaKeys = {
  lista: ['familia', 'lista'] as const,
  perfil: (id: number) => ['familia', 'perfil', id] as const,
  posts: (id: number) => ['familia', 'posts', id] as const,
};
