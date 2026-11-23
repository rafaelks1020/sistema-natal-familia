import { Platform } from 'react-native';

/**
 * Margem de baixo que a tela ainda precisa reservar para a barra do sistema.
 * No Android o layout raiz já termina cada tela acima dos botões de voltar e início (ver `src/app/_layout.tsx`),
 * então aqui a resposta é zero: somar de novo deixaria um vão. No iPhone a tela vai até a borda e a margem é a do sistema.
 * Não usar dentro de `Modal` (folhas, visualizador de fotos): o modal é outra janela e precisa da margem inteira.
 */
export function fundoSeguro(bottom: number): number {
  return Platform.OS === 'android' ? 0 : bottom;
}
